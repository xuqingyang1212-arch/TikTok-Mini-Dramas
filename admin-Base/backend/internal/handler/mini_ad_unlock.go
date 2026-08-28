package handler

import (
	"errors"
	"strconv"

	"scaffold-admin/internal/pkg/response"
	"scaffold-admin/internal/service"

	"github.com/gin-gonic/gin"
)

func MiniCreateAdUnlockSession(c *gin.Context) {
	var req struct {
		UserID    string `json:"userId" binding:"required"`
		DramaID   string `json:"dramaId" binding:"required"`
		EpisodeNo int    `json:"episodeNo" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误：需要 userId、dramaId、episodeNo")
		return
	}
	userID, err := strconv.ParseInt(req.UserID, 10, 64)
	if err != nil || userID <= 0 {
		response.FailBadRequest(c, "无效的用户ID")
		return
	}
	dramaID, err := strconv.ParseInt(req.DramaID, 10, 64)
	if err != nil || dramaID <= 0 || req.EpisodeNo <= 0 {
		response.FailBadRequest(c, "无效的剧集或集数")
		return
	}

	result, err := Svc.AdUnlock.Create(userID, dramaID, req.EpisodeNo)
	if err != nil {
		writeAdUnlockError(c, err)
		return
	}
	response.OK(c, result)
}

func MiniCompleteAdUnlockSession(c *gin.Context) {
	sessionNo := c.Param("sessionNo")
	var req struct {
		UserID string `json:"userId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误：需要 userId")
		return
	}
	userID, err := strconv.ParseInt(req.UserID, 10, 64)
	if err != nil || userID <= 0 {
		response.FailBadRequest(c, "无效的用户ID")
		return
	}
	result, err := Svc.AdUnlock.Complete(sessionNo, userID)
	if err != nil {
		writeAdUnlockError(c, err)
		return
	}
	response.OK(c, result)
}

func MiniCancelAdUnlockSession(c *gin.Context) {
	sessionNo := c.Param("sessionNo")
	var req struct {
		UserID string `json:"userId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误：需要 userId")
		return
	}
	userID, err := strconv.ParseInt(req.UserID, 10, 64)
	if err != nil || userID <= 0 {
		response.FailBadRequest(c, "无效的用户ID")
		return
	}
	result, err := Svc.AdUnlock.Cancel(sessionNo, userID)
	if err != nil {
		writeAdUnlockError(c, err)
		return
	}
	response.OK(c, result)
}

func writeAdUnlockError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrAppUserNotFound):
		response.FailBadRequest(c, "用户不存在")
	case errors.Is(err, service.ErrAppDisabled):
		response.FailBadRequest(c, "小程序已禁用")
	case errors.Is(err, service.ErrMonetizationNotSupported):
		response.FailBadRequest(c, "当前小程序不支持激励广告解锁")
	case errors.Is(err, service.ErrAdPlacementNotConfigured):
		response.FailBadRequest(c, "当前小程序未配置激励广告位")
	case errors.Is(err, service.ErrDramaNotAvailable):
		response.FailNotFound(c, "剧集不存在或已下架")
	case errors.Is(err, service.ErrEpisodeNotFound):
		response.FailNotFound(c, "集数不存在")
	case errors.Is(err, service.ErrAdSessionNotFound):
		response.FailNotFound(c, "广告解锁会话不存在")
	case errors.Is(err, service.ErrAdSessionOwnerMismatch):
		response.FailBadRequest(c, "广告解锁会话不属于当前用户")
	case errors.Is(err, service.ErrAdSessionCanceled):
		response.FailBadRequest(c, "广告解锁会话已取消")
	case errors.Is(err, service.ErrAdSessionExpired):
		response.FailBadRequest(c, "广告解锁会话已过期")
	default:
		response.FailServer(c, err.Error())
	}
}
