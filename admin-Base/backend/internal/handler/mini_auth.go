package handler

import (
	"errors"
	"strconv"

	"scaffold-admin/internal/pkg/response"
	"scaffold-admin/internal/service"

	"github.com/gin-gonic/gin"
)

// ─── Mini App Auth ──────────────────────────────────────────────────────────

// MiniListApps 获取可用小程序列表
// GET /api/mini/apps
// 返回已启用的小程序列表，包含名称、Client Key、变现类型和 IAA 广告位 ID
func MiniListApps(c *gin.Context) {
	list, err := Svc.Mini.ListApps()
	if err != nil {
		response.FailServer(c, err.Error())
		return
	}
	response.OK(c, gin.H{"list": list})
}

// MiniLogin 小程序用户登录/注册
// POST /api/mini/auth/login
// 请求体: { "appId": "string", "openId": "string" }
// 返回: { "userId": "string", "isNew": bool }
func MiniLogin(c *gin.Context) {
	var req struct {
		AppID  string `json:"appId" binding:"required"`
		OpenID string `json:"openId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误：需要 appId 和 openId")
		return
	}

	result, err := Svc.Mini.Login(req.AppID, req.OpenID)
	if err != nil {
		if errors.Is(err, service.ErrAppNotFound) {
			response.FailBadRequest(c, "小程序不存在")
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

// MiniGetUserProfile 获取用户信息（个人中心刷新会员状态用）
// GET /api/mini/users/:userId
func MiniGetUserProfile(c *gin.Context) {
	userID, err := strconv.ParseInt(c.Param("userId"), 10, 64)
	if err != nil {
		response.FailBadRequest(c, "无效的用户ID")
		return
	}
	profile, err := Svc.Mini.GetUserProfile(userID)
	if err != nil {
		if errors.Is(err, service.ErrAppUserNotFound) {
			response.FailBadRequest(c, "用户不存在")
			return
		}
		response.FailServer(c, err.Error())
		return
	}
	response.OK(c, profile)
}
