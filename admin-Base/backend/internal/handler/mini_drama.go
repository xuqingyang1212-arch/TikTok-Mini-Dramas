package handler

import (
	"errors"
	"strconv"

	"scaffold-admin/internal/pkg/response"
	"scaffold-admin/internal/service"

	"github.com/gin-gonic/gin"
)

// ─── Mini App Drama ─────────────────────────────────────────────────────────

// MiniListDramas 获取已上架剧集列表
// GET /api/mini/dramas?page=1&pageSize=20
// 返回已上架剧集，按创建时间倒序
func (a *Application) MiniListDramas(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	list, total, err := a.services.Mini.ListDramas(page, pageSize)
	if err != nil {
		response.FailServer(c, err.Error())
		return
	}

	response.OK(c, gin.H{
		"list":     list,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// MiniGetDrama 获取剧集详情
// GET /api/mini/dramas/:id
func (a *Application) MiniGetDrama(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		response.FailBadRequest(c, "无效的剧集ID")
		return
	}

	drama, err := a.services.Mini.GetDrama(id)
	if err != nil {
		response.FailNotFound(c, "剧集不存在或已下架")
		return
	}

	response.OK(c, drama)
}

// MiniGetEpisode 获取单集播放信息
// GET /api/mini/dramas/:id/episodes/:episodeNo
// episodeNo 是集数（1, 2, 3...），不是 episode ID
func (a *Application) MiniGetEpisode(c *gin.Context) {
	dramaIDStr := c.Param("id")
	episodeNoStr := c.Param("episodeNo")

	dramaID, err := strconv.ParseInt(dramaIDStr, 10, 64)
	if err != nil {
		response.FailBadRequest(c, "无效的剧集ID")
		return
	}

	episodeNo, err := strconv.Atoi(episodeNoStr)
	if err != nil || episodeNo < 1 {
		response.FailBadRequest(c, "无效的集数")
		return
	}

	userID, _ := strconv.ParseInt(c.Query("userId"), 10, 64)
	episode, err := a.services.Mini.GetEpisode(dramaID, userID, episodeNo)
	if err != nil {
		response.FailNotFound(c, "该集不存在")
		return
	}

	response.OK(c, episode)
}

// MiniListEpisodes 获取剧集的所有单集列表
// GET /api/mini/dramas/:id/episodes
func (a *Application) MiniListEpisodes(c *gin.Context) {
	dramaIDStr := c.Param("id")
	dramaID, err := strconv.ParseInt(dramaIDStr, 10, 64)
	if err != nil {
		response.FailBadRequest(c, "无效的剧集ID")
		return
	}

	userID, _ := strconv.ParseInt(c.Query("userId"), 10, 64)
	episodes, paywallEpisode, err := a.services.Mini.ListEpisodes(dramaID, userID)
	if err != nil {
		response.FailServer(c, err.Error())
		return
	}

	response.OK(c, gin.H{
		"list":           episodes,
		"total":          len(episodes),
		"paywallEpisode": paywallEpisode,
	})
}

// MiniUnlockStatus 用户在某部剧的逐集解锁详情
// GET /api/mini/dramas/:id/unlock-status?userId=
func (a *Application) MiniUnlockStatus(c *gin.Context) {
	dramaID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		response.FailBadRequest(c, "无效的剧集ID")
		return
	}
	userID, _ := strconv.ParseInt(c.Query("userId"), 10, 64)
	status, err := a.services.Mini.UnlockStatus(dramaID, userID)
	if err != nil {
		response.FailServer(c, err.Error())
		return
	}
	response.OK(c, status)
}

// MiniReportWatch 观看上报：用户开始播放某剧某一集时上报
// POST /api/mini/watch-report  body: { userId, dramaId, episodeNo }
func (a *Application) MiniReportWatch(c *gin.Context) {
	var req struct {
		UserID    string `json:"userId" binding:"required"`
		DramaID   string `json:"dramaId" binding:"required"`
		EpisodeNo int    `json:"episodeNo" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误：需要 userId、dramaId、episodeNo")
		return
	}
	userID, _ := strconv.ParseInt(req.UserID, 10, 64)
	dramaID, _ := strconv.ParseInt(req.DramaID, 10, 64)

	result, err := a.services.Mini.ReportWatch(userID, dramaID, req.EpisodeNo)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrAppUserNotFound):
			response.FailBadRequest(c, "用户不存在")
		case errors.Is(err, service.ErrDramaNotAvailable):
			response.FailNotFound(c, "剧集不存在或已下架")
		case errors.Is(err, service.ErrEpisodeNotFound):
			response.FailNotFound(c, "集数不存在")
		case errors.Is(err, service.ErrEpisodeLocked):
			response.FailBadRequest(c, "该集尚未解锁，不上报")
		default:
			response.FailServer(c, err.Error())
		}
		return
	}
	response.OK(c, result)
}
