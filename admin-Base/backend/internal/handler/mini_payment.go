package handler

import (
	"errors"
	"strconv"

	"scaffold-admin/internal/pkg/response"
	"scaffold-admin/internal/service"

	"github.com/gin-gonic/gin"
)

// ─── Mini App Payment / Unlock ──────────────────────────────────────────────

// MiniGetPaywall 获取剧集付费面板数据
// GET /api/mini/dramas/:id/paywall?userId=xxx&appId=xxx
func MiniGetPaywall(c *gin.Context) {
	dramaID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.FailBadRequest(c, "无效的剧集ID")
		return
	}
	userID, _ := strconv.ParseInt(c.Query("userId"), 10, 64)
	appID, _ := strconv.ParseInt(c.Query("appId"), 10, 64)
	currentEpisode, _ := strconv.Atoi(c.DefaultQuery("currentEpisode", "1"))
	if currentEpisode < 1 {
		currentEpisode = 1
	}

	result, err := Svc.MiniPayment.GetPaywall(dramaID, userID, appID, currentEpisode)
	if err != nil {
		if errors.Is(err, service.ErrDramaNotAvailable) {
			response.FailNotFound(c, "剧集不存在或已下架")
			return
		}
		if errors.Is(err, service.ErrAppUserNotFound) {
			response.FailBadRequest(c, "用户不存在")
			return
		}
		if errors.Is(err, service.ErrMonetizationNotSupported) {
			response.FailBadRequest(c, "当前小程序不支持 Beans 或订阅支付")
			return
		}
		if errors.Is(err, service.ErrAppDisabled) {
			response.FailBadRequest(c, "小程序已禁用")
			return
		}
		response.FailServer(c, err.Error())
		return
	}
	response.OK(c, result)
}

// MiniCreateUnlockOrder 创建 Beans 解锁订单
// POST /api/mini/orders/unlock  body: { userId, dramaId, tierKey }
func MiniCreateUnlockOrder(c *gin.Context) {
	var req struct {
		UserID         string `json:"userId" binding:"required"`
		DramaID        string `json:"dramaId" binding:"required"`
		TierKey        string `json:"tierKey" binding:"required"`
		DeviceOS       string `json:"deviceOs"`
		CurrentEpisode int    `json:"currentEpisode"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误：需要 userId、dramaId、tierKey")
		return
	}
	userID, _ := strconv.ParseInt(req.UserID, 10, 64)
	dramaID, _ := strconv.ParseInt(req.DramaID, 10, 64)

	result, err := Svc.MiniPayment.CreateUnlockOrder(userID, dramaID, req.TierKey, req.DeviceOS, req.CurrentEpisode)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrAppUserNotFound):
			response.FailBadRequest(c, "用户不存在")
		case errors.Is(err, service.ErrDramaNotAvailable):
			response.FailNotFound(c, "剧集不存在或已下架")
		case errors.Is(err, service.ErrInvalidTier):
			response.FailBadRequest(c, "无效的解锁档位")
		case errors.Is(err, service.ErrNothingToUnlock):
			response.FailBadRequest(c, "没有可解锁的集数（可能已全部解锁或已是会员）")
		case errors.Is(err, service.ErrMonetizationNotSupported):
			response.FailBadRequest(c, "当前小程序不支持 Beans 或订阅支付")
		case errors.Is(err, service.ErrAppDisabled):
			response.FailBadRequest(c, "小程序已禁用")
		default:
			response.FailServer(c, err.Error())
		}
		return
	}
	response.OK(c, result)
}

// MiniCreateSubscriptionOrder 创建订阅订单
// POST /api/mini/orders/subscription  body: { userId, planId }
func MiniCreateSubscriptionOrder(c *gin.Context) {
	var req struct {
		UserID   string `json:"userId" binding:"required"`
		PlanID   string `json:"planId" binding:"required"`
		DramaID  string `json:"dramaId"`
		DeviceOS string `json:"deviceOs"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误：需要 userId、planId")
		return
	}
	userID, _ := strconv.ParseInt(req.UserID, 10, 64)
	planID, _ := strconv.ParseInt(req.PlanID, 10, 64)
	dramaID, _ := strconv.ParseInt(req.DramaID, 10, 64)

	result, err := Svc.MiniPayment.CreateSubscriptionOrder(userID, planID, dramaID, req.DeviceOS)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrAppUserNotFound):
			response.FailBadRequest(c, "用户不存在")
		case errors.Is(err, service.ErrPlanNotFound):
			response.FailNotFound(c, "订阅档位不存在")
		case errors.Is(err, service.ErrMonetizationNotSupported):
			response.FailBadRequest(c, "当前小程序不支持 Beans 或订阅支付")
		case errors.Is(err, service.ErrAppDisabled):
			response.FailBadRequest(c, "小程序已禁用")
		default:
			response.FailServer(c, err.Error())
		}
		return
	}
	response.OK(c, result)
}

// MiniSubmitPayResult 演示用：前端上报支付结果
// POST /api/mini/orders/:orderNo/pay-result  body: { success: true|false }
func MiniSubmitPayResult(c *gin.Context) {
	orderNo := c.Param("orderNo")
	var req struct {
		Success *bool `json:"success" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Success == nil {
		response.FailBadRequest(c, "参数错误：需要 success (true/false)")
		return
	}

	result, err := Svc.MiniPayment.SubmitPayResult(orderNo, *req.Success)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrOrderNotFound):
			response.FailNotFound(c, "订单不存在")
		case errors.Is(err, service.ErrMonetizationNotSupported):
			response.FailBadRequest(c, "当前小程序不支持 Beans 或订阅支付")
		case errors.Is(err, service.ErrAppDisabled):
			response.FailBadRequest(c, "小程序已禁用")
		default:
			response.FailServer(c, err.Error())
		}
		return
	}
	response.OK(c, result)
}

// MiniGetPaymentRecords 获取用户支付成功记录（订阅 + Beans 解锁）
// GET /api/mini/users/:userId/payment-records
func MiniGetPaymentRecords(c *gin.Context) {
	userID, err := strconv.ParseInt(c.Param("userId"), 10, 64)
	if err != nil || userID <= 0 {
		response.FailBadRequest(c, "无效的用户ID")
		return
	}

	result, err := Svc.MiniPayment.PaymentRecords(userID)
	if err != nil {
		if errors.Is(err, service.ErrAppUserNotFound) {
			response.FailBadRequest(c, "用户不存在")
			return
		}
		response.FailServer(c, err.Error())
		return
	}
	response.OK(c, result)
}
