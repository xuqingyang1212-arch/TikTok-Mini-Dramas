package handler

import (
	"scaffold-admin/internal/pkg/response"
	"scaffold-admin/internal/service"

	"github.com/gin-gonic/gin"
)

// ─── List Payment Configs ───────────────────────────────────────────────────

func ListPaymentConfigs(c *gin.Context) {
	page := QueryInt(c, "page", 1)
	pageSize := QueryInt(c, "pageSize", 20)
	appID := QueryInt64(c, "appId", 0)
	dramaID := QueryInt64(c, "dramaId", 0)

	filter := service.PaymentConfigFilter{
		AppID:    appID,
		DramaID:  dramaID,
		Page:     page,
		PageSize: pageSize,
	}

	list, total, err := Svc.PaymentConfig.List(filter)
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	response.OKPage(c, total, list)
}

// ─── Get Payment Config ─────────────────────────────────────────────────────

func GetPaymentConfig(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}

	config, err := Svc.PaymentConfig.GetByID(id)
	if err == service.ErrPaymentConfigNotFound {
		response.FailNotFound(c, "支付配置不存在")
		return
	}
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	response.OK(c, config)
}

// ─── Create Payment Config ──────────────────────────────────────────────────

type createPaymentConfigReq struct {
	AppID       int64  `json:"appId"`
	DramaID     int64  `json:"dramaId"`
	BeansPerEp  int    `json:"beansPerEp" binding:"required,min=1"`
	Description string `json:"description"`
}

func CreatePaymentConfig(c *gin.Context) {
	var req createPaymentConfigReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误：每集Beans必须大于0")
		return
	}

	config, err := Svc.PaymentConfig.Create(service.CreatePaymentConfigInput{
		AppID:       req.AppID,
		DramaID:     req.DramaID,
		BeansPerEp:  req.BeansPerEp,
		Description: req.Description,
	})
	if err == service.ErrPaymentConfigDuplicate {
		response.FailBadRequest(c, "该范围的支付配置已存在")
		return
	}
	if err != nil {
		response.FailServer(c, "创建失败")
		return
	}
	response.OK(c, config)
}

// ─── Update Payment Config ──────────────────────────────────────────────────

type updatePaymentConfigReq struct {
	BeansPerEp  *int    `json:"beansPerEp"`
	Description *string `json:"description"`
}

func UpdatePaymentConfig(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}

	var req updatePaymentConfigReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误")
		return
	}

	if req.BeansPerEp != nil && *req.BeansPerEp < 1 {
		response.FailBadRequest(c, "每集Beans必须大于0")
		return
	}

	err := Svc.PaymentConfig.Update(id, service.UpdatePaymentConfigInput{
		BeansPerEp:  req.BeansPerEp,
		Description: req.Description,
	})
	if err == service.ErrPaymentConfigNotFound {
		response.FailNotFound(c, "支付配置不存在")
		return
	}
	if err != nil {
		response.FailServer(c, "更新失败")
		return
	}
	response.OK(c, nil)
}

// ─── Delete Payment Config ──────────────────────────────────────────────────

func DeletePaymentConfig(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}

	err := Svc.PaymentConfig.Delete(id)
	if err == service.ErrPaymentConfigNotFound {
		response.FailNotFound(c, "支付配置不存在")
		return
	}
	if err != nil {
		response.FailBadRequest(c, err.Error())
		return
	}
	response.OK(c, nil)
}
