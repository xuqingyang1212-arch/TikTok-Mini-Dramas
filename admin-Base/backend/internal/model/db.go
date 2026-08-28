package model

import (
	"log"

	"scaffold-admin/internal/config"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB() {
	cfg := config.Global.Database
	var logLevel logger.LogLevel
	if config.Global.Server.Mode == "debug" {
		logLevel = logger.Info
	} else {
		logLevel = logger.Warn
	}

	var err error
	DB, err = gorm.Open(mysql.Open(cfg.DSN()), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logLevel),
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	sqlDB, _ := DB.DB()
	sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)

	// Session-level tuning only; global server variables should be tuned via my.cnf,
	// not by the application (which requires SUPER and silently fails otherwise).
	DB.Exec("SET SESSION sort_buffer_size = 8388608")
}

func AutoMigrate() {
	// 演示项目统一由 GORM 在启动时维护表结构，不再同时维护版本化 DDL。
	// migrations/ 仅保留初始化账号等种子数据。
	err := DB.AutoMigrate(
		&User{},
		&Role{},
		&UserRole{},
		&RolePermission{},
		&App{},
		&AppUser{},
		&Drama{},
		&Episode{},
		&PaymentConfig{},
		&SubscriptionPlan{},
		&UserUnlock{},
		&AdUnlockSession{},
		&UserSubscription{},
		&PaymentOrder{},
		&WatchLog{},
	)
	if err != nil {
		log.Fatalf("failed to auto-migrate: %v", err)
	}

	// 迁移收尾：删除历史遗留的 open_id 单列唯一索引。
	// 现在唯一性以 (app_id, open_id) 联合唯一为准（同一 openid 在不同小程序视为不同用户）。
	// AutoMigrate 只新增联合唯一索引，不会移除旧的单列唯一索引，故在此显式清理（幂等）。
	if DB.Migrator().HasIndex(&AppUser{}, "idx_app_users_open_id") {
		if err := DB.Migrator().DropIndex(&AppUser{}, "idx_app_users_open_id"); err != nil {
			log.Printf("warn: drop legacy index idx_app_users_open_id failed: %v", err)
		}
	}

	// 历史永久解锁均来自 Beans。AutoMigrate 新增字段后显式回填，避免旧库数据来源为空。
	if err := DB.Model(&UserUnlock{}).
		Where("unlock_type = '' OR unlock_type IS NULL").
		Update("unlock_type", "beans").Error; err != nil {
		log.Printf("warn: backfill user_unlocks.unlock_type failed: %v", err)
	}
	// 旧索引缺少 app_id；新索引创建成功后清理旧索引。
	if DB.Migrator().HasIndex(&UserUnlock{}, "uk_unlock_aude") && DB.Migrator().HasIndex(&UserUnlock{}, "uk_unlock_ude") {
		if err := DB.Migrator().DropIndex(&UserUnlock{}, "uk_unlock_ude"); err != nil {
			log.Printf("warn: drop legacy index uk_unlock_ude failed: %v", err)
		}
	}
}
