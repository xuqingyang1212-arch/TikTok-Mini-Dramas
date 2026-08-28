package handler

import (
	"strconv"

	"scaffold-admin/internal/pkg/response"
	"scaffold-admin/internal/service"

	"github.com/gin-gonic/gin"
)

// ─── List Episodes ──────────────────────────────────────────────────────────

func ListEpisodes(c *gin.Context) {
	dramaID, ok := ParseID(c, "id")
	if !ok {
		return
	}

	items, err := Svc.Episode.ListByDrama(dramaID)
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

func BatchCreateEpisodes(c *gin.Context) {
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

	items, err := Svc.Episode.BatchCreate(service.BatchCreateEpisodeInput{
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

func UpdateEpisode(c *gin.Context) {
	idStr := c.Param("episodeId")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || id <= 0 {
		response.FailBadRequest(c, "无效的episodeId")
		return
	}

	var req updateEpisodeReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误")
		return
	}

	if err := Svc.Episode.Update(id, req.VideoURL, req.Duration, req.FileSize); err != nil {
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

func DeleteEpisode(c *gin.Context) {
	idStr := c.Param("episodeId")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || id <= 0 {
		response.FailBadRequest(c, "无效的episodeId")
		return
	}

	if err := Svc.Episode.Delete(id); err != nil {
		if err == service.ErrEpisodeNotFound {
			response.FailNotFound(c, "单集不存在")
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
