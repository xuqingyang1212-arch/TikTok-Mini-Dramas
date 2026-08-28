package handler

import (
	"scaffold-admin/internal/pkg/response"
	"scaffold-admin/internal/service"

	"github.com/gin-gonic/gin"
)

// ─── List Subscription Plans ────────────────────────────────────────────────

func ListSubscriptionPlans(c *gin.Context) {
	page := QueryInt(c, "page", 1)
	pageSize := QueryInt(c, "pageSize", 20)
	appID := QueryInt64(c, "appId", 0)

	filter := service.SubscriptionPlanFilter{
		AppID:    appID,
		Period:   TrimQuery(c, "period"),
		TierID:   TrimQuery(c, "tierId"),
		Page:     page,
		PageSize: pageSize,
	}

	list, total, err := Svc.Subscription.List(filter)
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	response.OKPage(c, total, list)
}

// ─── Get Subscription Plan ──────────────────────────────────────────────────

func GetSubscriptionPlan(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}

	plan, err := Svc.Subscription.GetByID(id)
	if err == service.ErrSubscriptionPlanNotFound {
		response.FailNotFound(c, "订阅档位不存在")
		return
	}
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	response.OK(c, plan)
}

// ─── Create Subscription Plan ───────────────────────────────────────────────

type createSubscriptionPlanReq struct {
	AppID       int64   `json:"appId" binding:"required"`
	Period      string  `json:"period" binding:"required,oneof=weekly monthly quarterly half_yearly yearly"`
	ApplePrice  float64 `json:"applePrice" binding:"min=0"`
	GooglePrice float64 `json:"googlePrice" binding:"min=0"`
	WebDiscount int     `json:"webDiscount" binding:"min=0,max=100"`
	TierID      string  `json:"tierId"`
}

func CreateSubscriptionPlan(c *gin.Context) {
	var req createSubscriptionPlanReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误："+err.Error())
		return
	}

	plan, err := Svc.Subscription.Create(service.CreateSubscriptionPlanInput{
		AppID:       req.AppID,
		Period:      req.Period,
		ApplePrice:  req.ApplePrice,
		GooglePrice: req.GooglePrice,
		WebDiscount: req.WebDiscount,
		TierID:      req.TierID,
	})
	if err == service.ErrDuplicatePeriod {
		response.FailBadRequest(c, err.Error())
		return
	}
	if err == service.ErrDuplicateTierID {
		response.FailBadRequest(c, err.Error())
		return
	}
	if err != nil {
		response.FailServer(c, "创建失败")
		return
	}
	response.OK(c, plan)
}

// ─── Update Subscription Plan ───────────────────────────────────────────────

type updateSubscriptionPlanReq struct {
	Period      *string  `json:"period"`
	ApplePrice  *float64 `json:"applePrice"`
	GooglePrice *float64 `json:"googlePrice"`
	WebDiscount *int     `json:"webDiscount"`
	TierID      *string  `json:"tierId"`
}

func UpdateSubscriptionPlan(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}

	var req updateSubscriptionPlanReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误")
		return
	}

	// 校验 WebDiscount 范围
	if req.WebDiscount != nil && (*req.WebDiscount < 0 || *req.WebDiscount > 100) {
		response.FailBadRequest(c, "网页端折扣必须在0-100之间")
		return
	}
	// 校验价格不能为负
	if req.ApplePrice != nil && *req.ApplePrice < 0 {
		response.FailBadRequest(c, "Apple价格不能为负数")
		return
	}
	if req.GooglePrice != nil && *req.GooglePrice < 0 {
		response.FailBadRequest(c, "Google价格不能为负数")
		return
	}

	err := Svc.Subscription.Update(id, service.UpdateSubscriptionPlanInput{
		Period:      req.Period,
		ApplePrice:  req.ApplePrice,
		GooglePrice: req.GooglePrice,
		WebDiscount: req.WebDiscount,
		TierID:      req.TierID,
	})
	if err == service.ErrSubscriptionPlanNotFound {
		response.FailNotFound(c, "订阅档位不存在")
		return
	}
	if err == service.ErrDuplicatePeriod {
		response.FailBadRequest(c, err.Error())
		return
	}
	if err == service.ErrDuplicateTierID {
		response.FailBadRequest(c, err.Error())
		return
	}
	if err != nil {
		response.FailServer(c, "更新失败")
		return
	}
	response.OK(c, nil)
}

// ─── Delete Subscription Plan ───────────────────────────────────────────────

func DeleteSubscriptionPlan(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}

	err := Svc.Subscription.Delete(id)
	if err == service.ErrSubscriptionPlanNotFound {
		response.FailNotFound(c, "订阅档位不存在")
		return
	}
	if err != nil {
		response.FailServer(c, "删除失败")
		return
	}
	response.OK(c, nil)
}
