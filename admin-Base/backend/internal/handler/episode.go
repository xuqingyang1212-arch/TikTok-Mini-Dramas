package handler

import (
	"scaffold-admin/internal/pkg/response"
	"scaffold-admin/internal/service"

	"github.com/gin-gonic/gin"
)

// ─── List Episodes ──────────────────────────────────────────────────────────

func (a *Application) ListEpisodes(c *gin.Context) {
	dramaID, ok := ParseID(c, "id")
	if !ok {
		return
	}

	items, err := a.services.Episode.ListByDrama(dramaID)
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	response.OK(c, items)
}

// ─── Batch Create Episodes ──────────────────────────────────────────────────

type batchCreateEpisodesReq struct {
	Episodes []episodeUploadReq `json:"episodes" binding:"required"`
}

type episodeUploadReq struct {
	EpisodeNo int    `json:"episodeNo" binding:"required"`
	VideoURL  string `json:"videoUrl" binding:"required"`
	Duration  int    `json:"duration"`
	FileSize  int64  `json:"fileSize"`
}

func (a *Application) BatchCreateEpisodes(c *gin.Context) {
	dramaID, ok := ParseID(c, "id")
	if !ok {
		return
	}

	var req batchCreateEpisodesReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误")
		return
	}

	if len(req.Episodes) == 0 {
		response.FailBadRequest(c, "请至少上传一集")
		return
	}

	uploads := make([]service.EpisodeUpload, len(req.Episodes))
	for i, ep := range req.Episodes {
		uploads[i] = service.EpisodeUpload{
			EpisodeNo: ep.EpisodeNo,
			VideoURL:  ep.VideoURL,
			Duration:  ep.Duration,
			FileSize:  ep.FileSize,
		}
	}

	items, err := a.services.Episode.BatchCreate(service.BatchCreateEpisodeInput{
		DramaID:  dramaID,
		Episodes: uploads,
	})
	if err != nil {
		response.FailBadRequest(c, err.Error())
		return
	}
	response.OK(c, items)
}

// ─── Update Episode (re-upload) ─────────────────────────────────────────────

type updateEpisodeReq struct {
	VideoURL string `json:"videoUrl" binding:"required"`
	Duration int    `json:"duration"`
	FileSize int64  `json:"fileSize"`
}

func (a *Application) UpdateEpisode(c *gin.Context) {
	dramaID, ok := ParseID(c, "id")
	if !ok {
		return
	}
	episodeID, ok := ParseID(c, "episodeId")
	if !ok {
		return
	}

	var req updateEpisodeReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误")
		return
	}

	if err := a.services.Episode.Update(dramaID, episodeID, req.VideoURL, req.Duration, req.FileSize); err != nil {
		if err == service.ErrEpisodeNotFound {
			response.FailNotFound(c, "单集不存在")
			return
		}
		response.FailServer(c, "更新失败")
		return
	}
	response.OK(c, nil)
}

// ─── Delete Episode ─────────────────────────────────────────────────────────

func (a *Application) DeleteEpisode(c *gin.Context) {
	dramaID, ok := ParseID(c, "id")
	if !ok {
		return
	}
	episodeID, ok := ParseID(c, "episodeId")
	if !ok {
		return
	}

	if err := a.services.Episode.Delete(dramaID, episodeID); err != nil {
		if err == service.ErrEpisodeNotFound {
			response.FailNotFound(c, "单集不存在")
			return
		}
		if err == service.ErrEpisodeDramaMustBeOffline {
			response.FailBadRequest(c, "请先下架剧集后再删除单集")
			return
		}
		if err == service.ErrEpisodeNotLast {
			response.FailBadRequest(c, "只能删除最后一集，请从最后一集开始删除")
			return
		}
		response.FailServer(c, "删除失败")
		return
	}
	response.OK(c, nil)
}
