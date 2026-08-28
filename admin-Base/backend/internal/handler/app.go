package handler

import (
	"strconv"

	"scaffold-admin/internal/pkg/response"
	"scaffold-admin/internal/service"

	"github.com/gin-gonic/gin"
)

// ─── List Apps ──────────────────────────────────────────────────────────────

func ListApps(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	filter := service.AppListFilter{
		Name:             TrimQuery(c, "name"),
		AppID:            TrimQuery(c, "appId"),
		ClientKey:        TrimQuery(c, "clientKey"),
		Company:          TrimQuery(c, "company"),
		MonetizationType: TrimQuery(c, "monetizationType"),
		Page:             page,
		PageSize:         pageSize,
	}

	apps, total, err := Svc.App.List(filter)
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	response.OKPage(c, total, apps)
}

// ─── Get App ────────────────────────────────────────────────────────────────

func GetApp(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}

	app, err := Svc.App.GetByID(id)
	if err == service.ErrAppNotFound {
		response.FailNotFound(c, "应用不存在")
		return
	}
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	// 安全考虑：不再返回 Client Secret，编辑时留空即保留原值
	response.OK(c, app)
}

// ─── Create App ─────────────────────────────────────────────────────────────

type CreateAppReq struct {
	Name             string `json:"name" binding:"required"`
	AppID            string `json:"appId" binding:"required"`
	ClientKey        string `json:"clientKey" binding:"required"`
	ClientSecret     string `json:"clientSecret" binding:"required"`
	Company          string `json:"company" binding:"required"`
	MonetizationType string `json:"monetizationType" binding:"required,oneof=IAA IAP"`
	AdPlacementID    string `json:"adPlacementId"`
}

func CreateApp(c *gin.Context) {
	var req CreateAppReq
	if !BindOrFail(c, &req) {
		return
	}

	app, err := Svc.App.Create(service.CreateAppInput{
		Name:             req.Name,
		AppID:            req.AppID,
		ClientKey:        req.ClientKey,
		ClientSecret:     req.ClientSecret,
		Company:          req.Company,
		MonetizationType: req.MonetizationType,
		AdPlacementID:    req.AdPlacementID,
	})
	if err == service.ErrAppClientKeyExists {
		response.FailBadRequest(c, "Client Key 已存在")
		return
	}
	if err == service.ErrAppAppIDExists {
		response.FailBadRequest(c, "App ID 已存在")
		return
	}
	if err == service.ErrInvalidMonetizationType {
		response.FailBadRequest(c, "变现类型仅支持 IAA 或 IAP")
		return
	}
	if err != nil {
		response.FailServer(c, "创建失败")
		return
	}
	response.OK(c, app)
}

// ─── Update App ─────────────────────────────────────────────────────────────

type UpdateAppReq struct {
	Name             string `json:"name" binding:"required"`
	AppID            string `json:"appId" binding:"required"`
	ClientKey        string `json:"clientKey"`
	ClientSecret     string `json:"clientSecret"`
	Company          string `json:"company" binding:"required"`
	MonetizationType string `json:"monetizationType" binding:"required,oneof=IAA IAP"`
	AdPlacementID    string `json:"adPlacementId"`
}

func UpdateApp(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}

	var req UpdateAppReq
	if !BindOrFail(c, &req) {
		return
	}

	err := Svc.App.Update(id, service.UpdateAppInput{
		Name:             req.Name,
		AppID:            req.AppID,
		ClientKey:        req.ClientKey,
		ClientSecret:     req.ClientSecret,
		Company:          req.Company,
		MonetizationType: req.MonetizationType,
		AdPlacementID:    req.AdPlacementID,
	})
	if err == service.ErrAppNotFound {
		response.FailNotFound(c, "应用不存在")
		return
	}
	if err == service.ErrAppClientKeyExists {
		response.FailBadRequest(c, "Client Key 已存在")
		return
	}
	if err == service.ErrAppAppIDExists {
		response.FailBadRequest(c, "App ID 已存在")
		return
	}
	if err == service.ErrInvalidMonetizationType {
		response.FailBadRequest(c, "变现类型仅支持 IAA 或 IAP")
		return
	}
	if err == service.ErrMonetizationTypeInUse {
		response.FailBadRequest(c, "应用已有订单或解锁权益，不能切换变现类型")
		return
	}
	if err != nil {
		response.FailServer(c, "更新失败")
		return
	}
	response.OKMsg(c, "更新成功")
}

// ─── Get Companies ──────────────────────────────────────────────────────────

func GetAppCompanies(c *gin.Context) {
	companies, err := Svc.App.GetCompanies()
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	response.OK(c, companies)
}
