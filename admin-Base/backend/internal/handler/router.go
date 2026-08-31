package handler

import (
	"time"

	"scaffold-admin/internal/consts"
	"scaffold-admin/internal/middleware"
	"scaffold-admin/internal/model"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func SetupRouter(mode string) *gin.Engine {
	if mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:  []string{"*"},
		AllowMethods:  []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:  []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders: []string{"Content-Length"},
	}))

	// Serve uploaded files
	r.Static("/media", MediaStorageDir)

	api := r.Group("/api/v1")

	// ─── Public routes ────────────────────────────────────────────────────────
	api.POST("/auth/login", AuthLogin) // 只需邮箱即可登录
	api.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	perm := middleware.RequirePerm

	// ─── Protected routes ─────────────────────────────────────────────────────
	// 全链路：JWT → Session（单设备登录）→ 权限加载 → 去重（防双击）。
	auth := api.Group("",
		middleware.JWTAuth(),
		middleware.SessionGuard(),
		middleware.LoadPermissions(model.DB),
		middleware.PreventDuplicateSubmit(3*time.Second),
	)
	{
		// --- User Management ---
		auth.GET("/users/me", GetCurrentUser)
		auth.GET("/users", perm(consts.SystemUserList), ListUsers)
		auth.POST("/users", perm(consts.SystemUserAdd), CreateUser)
		auth.PUT("/users/:id", perm(consts.SystemUserEdit), UpdateUser)

		// --- Role Management ---
		auth.GET("/roles", perm(consts.SystemRoleList), ListRoles)
		auth.POST("/roles", perm(consts.SystemRoleAdd), CreateRole)
		auth.PUT("/roles/:id", perm(consts.SystemRoleEdit), UpdateRole)
		auth.GET("/permissions/tree", GetPermissionTree)

		// --- App Management (小程序应用) ---
		// 注意：/apps/companies 必须在 /apps/:id 前面，否则会被 :id 先匹配
		auth.GET("/apps/companies", perm(consts.OperationAppList), GetAppCompanies)
		auth.GET("/apps", perm(consts.OperationAppList), ListApps)
		auth.GET("/apps/:id", perm(consts.OperationAppList), GetApp)
		auth.POST("/apps", perm(consts.OperationAppAdd), CreateApp)
		auth.PUT("/apps/:id", perm(consts.OperationAppEdit), UpdateApp)

		// --- App User Management (小程序用户) ---
		auth.GET("/app-users", perm(consts.UserAppUserList), ListAppUsers)
		auth.GET("/app-users/:id", perm(consts.UserAppUserList), GetAppUser)
		auth.GET("/app-users/:id/detail", perm(consts.UserAppUserList), GetAppUserDetail)
		auth.GET("/app-users/:id/subscriptions", perm(consts.UserAppUserList), GetAppUserSubscriptions)
		auth.GET("/app-users/:id/unlocks", perm(consts.UserAppUserList), GetAppUserUnlocks)
		auth.GET("/app-users/:id/watch-logs", perm(consts.UserAppUserList), GetAppUserWatchLogs)

		// --- Drama Management (剧集管理) ---
		auth.GET("/dramas", perm(consts.ResourceDramaList), ListDramas)
		auth.GET("/dramas/:id", perm(consts.ResourceDramaList), GetDrama)
		auth.POST("/dramas", perm(consts.ResourceDramaAdd), CreateDrama)
		auth.PUT("/dramas/:id", perm(consts.ResourceDramaEdit), UpdateDrama)
		auth.PUT("/dramas/:id/toggle-status", perm(consts.ResourceDramaEdit), ToggleDramaStatus)

		// --- Episode Management (单集管理) ---
		auth.GET("/dramas/:id/episodes", perm(consts.ResourceDramaList), ListEpisodes)
		auth.POST("/dramas/:id/episodes", perm(consts.ResourceDramaEdit), BatchCreateEpisodes)
		auth.PUT("/dramas/:id/episodes/:episodeId", perm(consts.ResourceDramaEdit), UpdateEpisode)
		auth.DELETE("/dramas/:id/episodes/:episodeId", perm(consts.ResourceDramaEdit), DeleteEpisode)

		// --- Upload ---
		auth.POST("/upload/image", UploadImage)
		auth.POST("/upload/video", UploadVideo)

		// --- Subscription Plans (订阅配置) ---
		auth.GET("/subscription-plans", perm(consts.OperationSubsList), ListSubscriptionPlans)
		auth.GET("/subscription-plans/:id", perm(consts.OperationSubsList), GetSubscriptionPlan)
		auth.POST("/subscription-plans", perm(consts.OperationSubsAdd), CreateSubscriptionPlan)
		auth.PUT("/subscription-plans/:id", perm(consts.OperationSubsEdit), UpdateSubscriptionPlan)
		auth.DELETE("/subscription-plans/:id", perm(consts.OperationSubsDelete), DeleteSubscriptionPlan)

		// --- Payment Config (支付配置) ---
		auth.GET("/payment-configs", perm(consts.OperationPaymentList), ListPaymentConfigs)
		auth.GET("/payment-configs/:id", perm(consts.OperationPaymentList), GetPaymentConfig)
		auth.POST("/payment-configs", perm(consts.OperationPaymentAdd), CreatePaymentConfig)
		auth.PUT("/payment-configs/:id", perm(consts.OperationPaymentEdit), UpdatePaymentConfig)
		auth.DELETE("/payment-configs/:id", perm(consts.OperationPaymentDelete), DeletePaymentConfig)

		// --- Recharge Orders (充值订单) ---
		auth.GET("/recharge-orders", perm(consts.FinanceRechargeList), ListRechargeOrders)
		auth.GET("/recharge-orders/export", perm(consts.FinanceRechargeExport), ExportRechargeOrders)
	}

	// ─── Mini App API (小程序接口) ────────────────────────────────────────────
	// 小程序端调用的接口，无需后台登录认证
	mini := r.Group("/api/mini", miniLanguageMiddleware())
	{
		// 获取可用小程序列表
		mini.GET("/apps", MiniListApps)

		// 用户登录/注册
		mini.POST("/auth/login", MiniLogin)
		// 用户信息（个人中心刷新会员状态）
		mini.GET("/users/:userId", MiniGetUserProfile)
		// 用户支付成功记录（订阅 + Beans 解锁）
		mini.GET("/users/:userId/payment-records", MiniGetPaymentRecords)

		// 剧集列表（已上架，按创建时间倒序）
		mini.GET("/dramas", MiniListDramas)
		// 剧集详情
		mini.GET("/dramas/:id", MiniGetDrama)
		// 剧集的所有单集列表
		mini.GET("/dramas/:id/episodes", MiniListEpisodes)
		// 获取单集播放信息（按集数）
		mini.GET("/dramas/:id/episodes/:episodeNo", MiniGetEpisode)
		// 用户在该剧的逐集解锁详情（免费/beans/会员/未解锁）
		mini.GET("/dramas/:id/unlock-status", MiniUnlockStatus)
		// 观看上报（开始播放某集时上报）
		mini.POST("/watch-report", MiniReportWatch)

		// ── IAA 激励广告解锁 ──
		mini.POST("/ad-unlock-sessions", MiniCreateAdUnlockSession)
		mini.POST("/ad-unlock-sessions/:sessionNo/complete", MiniCompleteAdUnlockSession)
		mini.POST("/ad-unlock-sessions/:sessionNo/cancel", MiniCancelAdUnlockSession)

		// ── 支付 / 解锁 ──
		// 剧集付费面板（档位 + 订阅 + 解锁状态）
		mini.GET("/dramas/:id/paywall", MiniGetPaywall)
		// 创建 Beans 解锁订单
		mini.POST("/orders/unlock", MiniCreateUnlockOrder)
		// 创建订阅订单
		mini.POST("/orders/subscription", MiniCreateSubscriptionOrder)
		// 演示：上报支付结果
		mini.POST("/orders/:orderNo/pay-result", MiniSubmitPayResult)
	}

	return r
}
