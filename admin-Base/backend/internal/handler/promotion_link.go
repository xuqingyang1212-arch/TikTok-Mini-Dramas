package handler

import (
	"errors"
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"

	"scaffold-admin/internal/config"
	"scaffold-admin/internal/middleware"
	"scaffold-admin/internal/pkg/datetime"
	"scaffold-admin/internal/pkg/response"
	"scaffold-admin/internal/pkg/xlsxstream"
	"scaffold-admin/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

func parsePromotionLinkFilter(c *gin.Context) service.PromotionLinkListFilter {
	return service.PromotionLinkListFilter{
		Name:     TrimQuery(c, "name"),
		AppID:    TrimQuery(c, "appId"),
		Drama:    TrimQuery(c, "drama"),
		LinkID:   TrimQuery(c, "linkId"),
		Page:     QueryInt(c, "page", 1),
		PageSize: QueryInt(c, "pageSize", 10),
	}
}

func (a *Application) ListPromotionLinks(c *gin.Context) {
	items, total, err := a.services.PromotionLink.List(parsePromotionLinkFilter(c))
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	response.OKPage(c, total, items)
}

func (a *Application) ExportPromotionLinks(c *gin.Context) {
	headers := []string{"链接名称", "Linkid", "小程序名称", "变现类型", "Appid", "剧集名称", "剧集 ID", "卡点集数", "单集 Beans 价格", "创建人", "推广链接"}
	headerValues := make([]any, len(headers))
	for i := range headers {
		headerValues[i] = headers[i]
	}
	filename := fmt.Sprintf("promotion-links-%s.xlsx", datetime.ChinaNow().Format("20060102150405"))
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	if err := xlsxstream.Write(c.Writer, xlsxstream.Options{Sheet: "推广链接", Headers: headerValues}, func(_ *excelize.File, yield func(xlsxstream.Row) error) error {
		return a.services.PromotionLink.Iterate(parsePromotionLinkFilter(c), 500, func(items []service.PromotionLinkListItem) error {
			for _, item := range items {
				values := []any{item.Name, item.LinkID, item.AppName, item.MonetizationType, item.TiktokAppID, item.DramaName, item.DramaID, item.PaywallEpisode, "", item.CreatorName, item.PromotionURL}
				if item.BeansPerEp != nil {
					values[8] = *item.BeansPerEp
				}
				if err := yield(xlsxstream.Row{Values: values}); err != nil {
					return err
				}
			}
			return nil
		})
	}); err != nil {
		response.FailServer(c, "导出失败")
	}
}

type createPromotionLinkReq struct {
	Name           string `json:"name"`
	AppID          string `json:"appId" binding:"required"`
	DramaID        string `json:"dramaId" binding:"required"`
	PaywallEpisode int    `json:"paywallEpisode" binding:"required"`
	BeansPerEp     *int   `json:"beansPerEp"`
}

func (a *Application) CreatePromotionLink(c *gin.Context) {
	var req createPromotionLinkReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误：需要小程序和剧集")
		return
	}
	appID, appErr := strconv.ParseInt(req.AppID, 10, 64)
	dramaID, dramaErr := strconv.ParseInt(req.DramaID, 10, 64)
	if appErr != nil || dramaErr != nil || appID <= 0 || dramaID <= 0 {
		response.FailBadRequest(c, "小程序或剧集参数错误")
		return
	}

	mobileBaseURL := config.Global.Promotion.MobileBaseURL
	if mobileBaseURL == "" {
		mobileBaseURL = inferredMobileBaseURL(c)
	}
	result, err := a.services.PromotionLink.Create(service.CreatePromotionLinkInput{
		Name:           req.Name,
		AppID:          appID,
		DramaID:        dramaID,
		PaywallEpisode: req.PaywallEpisode,
		BeansPerEp:     req.BeansPerEp,
		CreatedBy:      middleware.GetUserID(c),
		MobileBaseURL:  mobileBaseURL,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPromotionAppNotFound):
			response.FailBadRequest(c, "小程序不存在")
		case errors.Is(err, service.ErrPromotionAppDisabled):
			response.FailBadRequest(c, "小程序已禁用")
		case errors.Is(err, service.ErrPromotionDramaNotFound):
			response.FailBadRequest(c, "剧集不存在")
		case errors.Is(err, service.ErrPromotionDramaNotOnShelf):
			response.FailBadRequest(c, "只能选择已上架剧集")
		case errors.Is(err, service.ErrPromotionPaywallInvalid):
			response.FailBadRequest(c, "付费卡点必须在 1 到剧集总集数之间")
		case errors.Is(err, service.ErrPromotionBeansRequired):
			response.FailBadRequest(c, "IAP 小程序必须配置单集 Beans 价格")
		case errors.Is(err, service.ErrPromotionBeansInvalid):
			response.FailBadRequest(c, "单集 Beans 价格必须在 10 到 500 之间")
		case errors.Is(err, service.ErrPromotionCreatorNotFound):
			response.FailUnauthorized(c, "创建人不存在，请重新登录")
		default:
			response.FailServer(c, "创建失败")
		}
		return
	}
	response.OK(c, result)
}

type reportUserActivationReq struct {
	UserID string `json:"userId" binding:"required"`
	LinkID string `json:"linkId"`
}

func (a *Application) ReportUserActivation(c *gin.Context) {
	var req reportUserActivationReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误：需要 userId")
		return
	}
	userID, userErr := strconv.ParseInt(req.UserID, 10, 64)
	if userErr != nil || userID <= 0 {
		response.FailBadRequest(c, "userId 格式错误")
		return
	}
	var linkID *int64
	if rawLinkID := strings.TrimSpace(req.LinkID); rawLinkID != "" {
		parsedLinkID, linkErr := strconv.ParseInt(rawLinkID, 10, 64)
		if linkErr != nil || parsedLinkID <= 0 {
			response.FailBadRequest(c, "linkId 格式错误")
			return
		}
		linkID = &parsedLinkID
	}

	result, err := a.services.PromotionLink.ReportUserActivation(userID, linkID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPromotionUserNotFound):
			response.FailNotFound(c, "用户不存在，请先登录")
		case errors.Is(err, service.ErrPromotionLinkNotFound):
			response.FailNotFound(c, "推广链接不存在")
		case errors.Is(err, service.ErrPromotionAppMismatch):
			response.FailForbidden(c, "用户与推广链接的小程序不匹配")
		default:
			response.FailServer(c, "激活上报失败")
		}
		return
	}
	response.OK(c, result)
}

func requestBaseURL(c *gin.Context) string {
	scheme := "http"
	if c.Request.TLS != nil || strings.EqualFold(c.GetHeader("X-Forwarded-Proto"), "https") {
		scheme = "https"
	}
	return scheme + "://" + c.Request.Host
}

func inferredMobileBaseURL(c *gin.Context) string {
	host := c.Request.Host
	if hostname, _, err := net.SplitHostPort(host); err == nil {
		host = hostname
	}
	return (&url.URL{Scheme: strings.SplitN(requestBaseURL(c), ":", 2)[0], Host: net.JoinHostPort(host, "3001")}).String()
}
