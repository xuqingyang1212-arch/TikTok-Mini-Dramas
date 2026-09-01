package handler

import (
	"strconv"

	"scaffold-admin/internal/pkg/response"
	"scaffold-admin/internal/service"

	"github.com/gin-gonic/gin"
)

// ─── List App Users ─────────────────────────────────────────────────────────

func ListAppUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	appID, _ := strconv.ParseInt(c.Query("appId"), 10, 64)

	createdAtFrom, createdAtTo := ParseChinaDateRange(c, "createdAtFrom", "createdAtTo")

	filter := service.AppUserListFilter{
		AppID:              appID,
		UserID:             TrimQuery(c, "userId"),
		OpenID:             TrimQuery(c, "openId"),
		UnionID:            TrimQuery(c, "unionId"),
		SubscriptionStatus: TrimQuery(c, "subscriptionStatus"),
		CreatedAtFrom:      createdAtFrom,
		CreatedAtTo:        createdAtTo,
		Page:               page,
		PageSize:           pageSize,
	}

	list, total, err := Svc.AppUser.List(filter)
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	response.OKPage(c, total, list)
}

// ─── Get App User ───────────────────────────────────────────────────────────

func GetAppUser(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}

	user, err := Svc.AppUser.GetByID(id)
	if err == service.ErrAppUserNotFound {
		response.FailNotFound(c, "用户不存在")
		return
	}
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	response.OK(c, user)
}

// ─── Get App User Detail (用户详情弹窗) ──────────────────────────────────────

func GetAppUserDetail(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}

	detail, err := Svc.AppUser.Detail(id)
	if err == service.ErrAppUserNotFound {
		response.FailNotFound(c, "用户不存在")
		return
	}
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	response.OK(c, detail)
}

// ─── App User Detail Sub-lists (分页) ────────────────────────────────────────

func GetAppUserSubscriptions(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	list, total, err := Svc.AppUser.Subscriptions(id, page, pageSize)
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	response.OKPage(c, total, list)
}

func GetAppUserUnlocks(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	list, total, err := Svc.AppUser.Unlocks(id, page, pageSize)
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	response.OKPage(c, total, list)
}

func GetAppUserWatchLogs(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	list, total, err := Svc.AppUser.WatchLogs(id, page, pageSize)
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	response.OKPage(c, total, list)
}
