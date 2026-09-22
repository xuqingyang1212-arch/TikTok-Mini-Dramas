package handler

import (
	"fmt"
	"os"
	"time"

	"scaffold-admin/internal/config"
	"scaffold-admin/internal/consts"
	"scaffold-admin/internal/middleware"
	"scaffold-admin/internal/service"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupRouter(mode string, services *service.Services, db *gorm.DB) *gin.Engine {
	app := NewApplication(services, db)
	if mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:  []string{"*"},
		AllowMethods:  []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:  []string{"Origin", "Accept", "Accept-Language", "Content-Type", "Authorization", "Cache-Control", "Pragma", "Range"},
		ExposeHeaders: []string{"Content-Length"},
	}))

	// Serve uploaded files
	mediaDir := config.MediaStorageDir()
	if err := os.MkdirAll(mediaDir, 0755); err != nil {
		panic(fmt.Sprintf("failed to create media storage directory %q: %v", mediaDir, err))
	}
	r.Static("/media", mediaDir)

	api := r.Group("/api/v1")

	// ─── Public routes ────────────────────────────────────────────────────────
	api.POST("/auth/login", app.AuthLogin) // 只需邮箱即可登录
	api.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	perm := middleware.RequirePerm

	// ─── Protected routes ─────────────────────────────────────────────────────
	// 全链路：JWT → Session（单设备登录）→ 权限加载 → 去重（防双击）。
	auth := api.Group("",
		middleware.JWTAuth(),
		middleware.SessionGuard(db),
		middleware.LoadPermissions(db),
		middleware.PreventDuplicateSubmit(3*time.Second),
	)
	{
		// --- User Management ---
		auth.GET("/users/me", app.GetCurrentUser)
		auth.GET("/users", perm(consts.SystemUserList), app.ListUsers)
		auth.POST("/users", perm(consts.SystemUserAdd), app.CreateUser)
		auth.PUT("/users/:id", perm(consts.SystemUserEdit), app.UpdateUser)

		// --- Role Management ---
		auth.GET("/roles", perm(consts.SystemRoleList), app.ListRoles)
		auth.POST("/roles", perm(consts.SystemRoleAdd), app.CreateRole)
		auth.PUT("/roles/:id", perm(consts.SystemRoleEdit), app.UpdateRole)
		auth.GET("/permissions/tree", GetPermissionTree)

		// --- App Management (小程序应用) ---
		// 注意：/apps/companies 必须在 /apps/:id 前面，否则会被 :id 先匹配
		auth.GET("/apps/companies", perm(consts.OperationAppList), app.GetAppCompanies)
		auth.GET("/apps", perm(consts.OperationAppList), app.ListApps)
		auth.GET("/apps/:id", perm(consts.OperationAppList), app.GetApp)
		auth.POST("/apps", perm(consts.OperationAppAdd), app.CreateApp)
		auth.PUT("/apps/:id", perm(consts.OperationAppEdit), app.UpdateApp)

		// --- App User Management (小程序用户) ---
		auth.GET("/app-users", perm(consts.UserAppUserList), app.ListAppUsers)
		auth.GET("/app-users/:id", perm(consts.UserAppUserList), app.GetAppUser)
		auth.GET("/app-users/:id/detail", perm(consts.UserAppUserList), app.GetAppUserDetail)
		auth.GET("/app-users/:id/subscriptions", perm(consts.UserAppUserList), app.GetAppUserSubscriptions)
		auth.GET("/app-users/:id/unlocks", perm(consts.UserAppUserList), app.GetAppUserUnlocks)
		auth.GET("/app-users/:id/watch-logs", perm(consts.UserAppUserList), app.GetAppUserWatchLogs)

		// --- Drama Management (剧集管理) ---
		auth.GET("/dramas", perm(consts.ResourceDramaList), app.ListDramas)
		auth.GET("/dramas/:id", perm(consts.ResourceDramaList), app.GetDrama)
		auth.POST("/dramas", perm(consts.ResourceDramaAdd), app.CreateDrama)
		auth.PUT("/dramas/:id", perm(consts.ResourceDramaEdit), app.UpdateDrama)
		auth.PUT("/dramas/:id/toggle-status", perm(consts.ResourceDramaEdit), app.ToggleDramaStatus)

		// --- Episode Management (单集管理) ---
		auth.GET("/dramas/:id/episodes", perm(consts.ResourceDramaList), app.ListEpisodes)
		auth.POST("/dramas/:id/episodes", perm(consts.ResourceDramaEdit), app.BatchCreateEpisodes)
		auth.PUT("/dramas/:id/episodes/:episodeId", perm(consts.ResourceDramaEdit), app.UpdateEpisode)
		auth.DELETE("/dramas/:id/episodes/:episodeId", perm(consts.ResourceDramaEdit), app.DeleteEpisode)

		// --- Upload ---
		uploadPerm := middleware.RequireAnyPerm(consts.ResourceDramaAdd, consts.ResourceDramaEdit)
		auth.POST("/upload/image", uploadPerm, UploadImage)
		auth.POST("/upload/video", uploadPerm, UploadVideo)

		// --- Subscription Plans (订阅配置) ---
		auth.GET("/subscription-plans", perm(consts.OperationSubsList), app.ListSubscriptionPlans)
		auth.GET("/subscription-plans/:id", perm(consts.OperationSubsList), app.GetSubscriptionPlan)
		auth.POST("/subscription-plans", perm(consts.OperationSubsAdd), app.CreateSubscriptionPlan)
		auth.PUT("/subscription-plans/:id", perm(consts.OperationSubsEdit), app.UpdateSubscriptionPlan)
		auth.DELETE("/subscription-plans/:id", perm(consts.OperationSubsDelete), app.DeleteSubscriptionPlan)

		// --- Payment Config (支付配置) ---
		auth.GET("/payment-configs", perm(consts.OperationPaymentList), app.ListPaymentConfigs)
		auth.GET("/payment-configs/:id", perm(consts.OperationPaymentList), app.GetPaymentConfig)
		auth.POST("/payment-configs", perm(consts.OperationPaymentAdd), app.CreatePaymentConfig)
		auth.PUT("/payment-configs/:id", perm(consts.OperationPaymentEdit), app.UpdatePaymentConfig)
		auth.DELETE("/payment-configs/:id", perm(consts.OperationPaymentDelete), app.DeletePaymentConfig)

		// --- Promotion Links (推广链接) ---
		auth.GET("/promotion-links", perm(consts.CampaignLinkList), app.ListPromotionLinks)
		auth.GET("/promotion-links/export", perm(consts.CampaignLinkExport), app.ExportPromotionLinks)
		auth.POST("/promotion-links", perm(consts.CampaignLinkAdd), app.CreatePromotionLink)

		// --- Media Event Reports (媒体事件) ---
		auth.GET("/media-event-reports", perm(consts.CampaignMediaEventList), app.ListMediaEventReports)
		auth.GET("/media-event-reports/export", perm(consts.CampaignMediaEventExport), app.ExportMediaEventReports)

		// --- Recharge Orders (充值订单) ---
		auth.GET("/recharge-orders", perm(consts.FinanceRechargeList), app.ListRechargeOrders)
		auth.GET("/recharge-orders/export", perm(consts.FinanceRechargeExport), app.ExportRechargeOrders)

		// --- Ad Sessions (广告会话) ---
		auth.GET("/ad-sessions", perm(consts.FinanceAdSessionList), app.ListAdSessions)
		auth.GET("/ad-sessions/export", perm(consts.FinanceAdSessionExport), app.ExportAdSessions)
	}

	// ─── Mini App API (小程序接口) ────────────────────────────────────────────
	// 小程序端调用的接口，无需后台登录认证
	mini := r.Group("/api/mini", miniLanguageMiddleware())
	{
		// 获取可用小程序列表
		mini.GET("/apps", app.MiniListApps)

		// 用户登录/注册
		mini.POST("/auth/login", app.MiniLogin)
		// 外部入口或浏览器刷新时上报推广归因
		mini.POST("/users/activate", app.ReportUserActivation)
		// 用户信息（个人中心刷新会员状态）
		mini.GET("/users/:userId", app.MiniGetUserProfile)
		// 用户支付成功记录（订阅 + Beans 解锁）
		mini.GET("/users/:userId/payment-records", app.MiniGetPaymentRecords)

		// 剧集列表（已上架，按创建时间倒序）
		mini.GET("/dramas", app.MiniListDramas)
		// 剧集详情
		mini.GET("/dramas/:id", app.MiniGetDrama)
		// 剧集的所有单集列表
		mini.GET("/dramas/:id/episodes", app.MiniListEpisodes)
		// 获取单集播放信息（按集数）
		mini.GET("/dramas/:id/episodes/:episodeNo", app.MiniGetEpisode)
		// 用户在该剧的逐集解锁详情（免费/beans/会员/未解锁）
		mini.GET("/dramas/:id/unlock-status", app.MiniUnlockStatus)
		// 观看上报（开始播放某集时上报）
		mini.POST("/watch-report", app.MiniReportWatch)
		// 记录客户端媒体 SDK 的事件上报结果
		mini.POST("/media-event-reports", app.MiniRecordMediaEventReport)

		// ── IAA 激励广告解锁 ──
		mini.POST("/ad-unlock-sessions", app.MiniCreateAdUnlockSession)
		mini.POST("/ad-unlock-sessions/:sessionNo/complete", app.MiniCompleteAdUnlockSession)
		mini.POST("/ad-unlock-sessions/:sessionNo/cancel", app.MiniCancelAdUnlockSession)

		// ── 支付 / 解锁 ──
		// 剧集付费面板（档位 + 订阅 + 解锁状态）
		mini.GET("/dramas/:id/paywall", app.MiniGetPaywall)
		// 创建 Beans 解锁订单
		mini.POST("/orders/unlock", app.MiniCreateUnlockOrder)
		// 创建订阅订单
		mini.POST("/orders/subscription", app.MiniCreateSubscriptionOrder)
		// 演示：上报支付结果
		mini.POST("/orders/:orderNo/pay-result", app.MiniSubmitPayResult)
	}

	return r
}
