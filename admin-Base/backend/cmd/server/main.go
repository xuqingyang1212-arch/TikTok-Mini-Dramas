package main

import (
	"fmt"
	"log"
	"time"

	"scaffold-admin/internal/config"
	"scaffold-admin/internal/handler"
	"scaffold-admin/internal/model"
	"scaffold-admin/internal/service"
)

func main() {
	if err := config.Load("config.yaml"); err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	db, err := model.Open(config.Global)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	if err := model.MigrateSchema(db); err != nil {
		log.Fatalf("failed to migrate database schema: %v", err)
	}
	if err := model.SetupCurrentData(db); err != nil {
		log.Fatalf("failed to set up current database data: %v", err)
	}
	services := service.New(db)

	if config.Global.Promotion.MobileBaseURL != "" {
		if err := services.PromotionLink.RefreshPromotionURLs(config.Global.Promotion.MobileBaseURL); err != nil {
			log.Printf("warn: refresh promotion URLs failed: %v", err)
		}
	}

	// 启动时以 consts.AllLeafKeys() 为准把超管角色缺失的权限点补齐。
	// 保证新增权限点时无需改种子 SQL（单一真相源 = internal/consts/permissions.go）。
	if err := services.Role.SyncSuperAdminPermissions(); err != nil {
		log.Printf("warn: sync super admin permissions failed: %v", err)
	}

	// 确保全局默认支付配置存在（每集100 Beans）
	if err := services.PaymentConfig.EnsureGlobalDefault(); err != nil {
		log.Printf("warn: ensure global payment config failed: %v", err)
	}

	// 启动时先回写一次已到期订阅，并起定时任务每 10 分钟同步一次 status 字段。
	if n, err := services.MiniPayment.ExpireOverdueSubscriptions(); err != nil {
		log.Printf("warn: expire overdue subscriptions failed: %v", err)
	} else if n > 0 {
		log.Printf("expired %d overdue subscriptions on startup", n)
	}
	go func() {
		ticker := time.NewTicker(10 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			if _, err := services.MiniPayment.ExpireOverdueSubscriptions(); err != nil {
				log.Printf("warn: expire overdue subscriptions failed: %v", err)
			}
		}
	}()

	r := handler.SetupRouter(config.Global.Server.Mode, services, db)

	addr := fmt.Sprintf(":%d", config.Global.Server.Port)
	log.Printf("server starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
