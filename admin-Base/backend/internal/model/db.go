package model

import (
	"database/sql"
	"fmt"
	"time"

	"scaffold-admin/internal/config"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Open(cfg config.Config) (*gorm.DB, error) {
	logLevel := logger.Warn
	if cfg.Server.Mode == "debug" {
		logLevel = logger.Info
	}
	db, err := gorm.Open(mysql.Open(cfg.Database.DSN()), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logLevel),
		DisableForeignKeyConstraintWhenMigrating: true,
		NowFunc:                                  func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		return nil, fmt.Errorf("connect database: %w", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("get database pool: %w", err)
	}
	sqlDB.SetMaxIdleConns(cfg.Database.MaxIdleConns)
	sqlDB.SetMaxOpenConns(cfg.Database.MaxOpenConns)
	if err := db.Exec("SET SESSION sort_buffer_size = 8388608").Error; err != nil {
		return nil, fmt.Errorf("configure database session: %w", err)
	}
	return db, nil
}

func MigrateSchema(db *gorm.DB) error {
	if err := runPreSchemaMigrations(db); err != nil {
		return err
	}
	if err := db.AutoMigrate(
		&User{},
		&Role{},
		&UserRole{},
		&RolePermission{},
		&SubjectInfo{},
		&App{},
		&AppUser{},
		&Drama{},
		&Episode{},
		&DramaSubmission{},
		&DramaSubmissionVersion{},
		&DramaSubmissionMedia{},
		&DramaSubmissionAuthorization{},
		&PaymentConfig{},
		&SubscriptionPlan{},
		&UserUnlock{},
		&AdUnlockSession{},
		&UserSubscription{},
		&PaymentOrder{},
		&WatchLog{},
		&PromotionLink{},
		&PromotionAttributionHistory{},
		&MediaEventReport{},
	); err != nil {
		return err
	}
	return runPostSchemaMigrations(db)
}

const (
	firstPromotionLinkID int64 = 10000001
	defaultSubjectID           = "eastern-star-digital-entertainment"
)

func defaultSubjectInfo() SubjectInfo {
	return SubjectInfo{
		SubjectID:          defaultSubjectID,
		SubjectNameCN:      "东方星空数字娱乐有限公司",
		SubjectNameEN:      "EASTERN STAR DIGITAL ENTERTAINMENT CO.,LIMITED",
		RegisteredAddress:  "Room 1401, Building 2, Zheshu Technology Center, No. 15 Chuxin Road, Shangtang Subdistrict, Gongshu District, Hangzhou City, Zhejiang Province",
		RegistrationNumber: "9133000030758045X2",
	}
}

func SetupCurrentData(db *gorm.DB) error {
	defaultSubject := defaultSubjectInfo()
	if err := db.Where("subject_id = ?", defaultSubject.SubjectID).FirstOrCreate(&defaultSubject).Error; err != nil {
		return fmt.Errorf("initialize default subject: %w", err)
	}

	var nextID sql.NullInt64
	if err := db.Raw(`
		SELECT AUTO_INCREMENT
		FROM information_schema.TABLES
		WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'promotion_links'
	`).Scan(&nextID).Error; err != nil {
		return fmt.Errorf("read promotion link sequence: %w", err)
	}
	if !promotionLinkSequenceNeedsInitialization(nextID) {
		return nil
	}
	if err := db.Exec(fmt.Sprintf("ALTER TABLE promotion_links AUTO_INCREMENT = %d", firstPromotionLinkID)).Error; err != nil {
		return fmt.Errorf("initialize promotion link sequence: %w", err)
	}
	return nil
}

func promotionLinkSequenceNeedsInitialization(nextID sql.NullInt64) bool {
	return !nextID.Valid || nextID.Int64 < firstPromotionLinkID
}
