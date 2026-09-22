package handler

import (
	"strconv"

	"scaffold-admin/internal/pkg/response"
	"scaffold-admin/internal/service"

	"github.com/gin-gonic/gin"
)

// ─── List App Users ─────────────────────────────────────────────────────────

func (a *Application) ListAppUsers(c *gin.Context) {
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

	list, total, err := a.services.AppUser.List(filter)
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	response.OKPage(c, total, list)
}

// ─── Get App User ───────────────────────────────────────────────────────────

func (a *Application) GetAppUser(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}

	user, err := a.services.AppUser.GetByID(id)
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

func (a *Application) GetAppUserDetail(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}

	detail, err := a.services.AppUser.Detail(id)
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

func (a *Application) GetAppUserSubscriptions(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	list, total, err := a.services.AppUser.Subscriptions(id, page, pageSize)
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	response.OKPage(c, total, list)
}

func (a *Application) GetAppUserUnlocks(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	unlockType := TrimQuery(c, "unlockType")
	if unlockType != "" && unlockType != "beans" && unlockType != "ad" {
		response.FailBadRequest(c, "解锁类型无效")
		return
	}
	list, total, err := a.services.AppUser.Unlocks(id, unlockType, page, pageSize)
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	response.OKPage(c, total, list)
}

func (a *Application) GetAppUserWatchLogs(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	list, total, err := a.services.AppUser.WatchLogs(id, page, pageSize)
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	response.OKPage(c, total, list)
}
