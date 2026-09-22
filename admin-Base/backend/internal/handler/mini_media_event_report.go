package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"scaffold-admin/internal/pkg/response"
	"scaffold-admin/internal/service"

	"github.com/gin-gonic/gin"
)

const maxMediaEventReportBodyBytes = 72 * 1024

// MiniRecordMediaEventReport records the result returned by the client media SDK.
// POST /api/mini/media-event-reports
func (a *Application) MiniRecordMediaEventReport(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxMediaEventReportBodyBytes)
	var req struct {
		ReportID  string          `json:"reportId" binding:"required"`
		UserID    string          `json:"userId" binding:"required"`
		DramaID   string          `json:"dramaId" binding:"required"`
		EpisodeNo int             `json:"episodeNo" binding:"required"`
		EventName string          `json:"eventName" binding:"required"`
		Status    string          `json:"status" binding:"required"`
		Params    json.RawMessage `json:"params" binding:"required"`
		Result    json.RawMessage `json:"result" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误或请求体过大")
		return
	}
	userID, userErr := strconv.ParseInt(req.UserID, 10, 64)
	dramaID, dramaErr := strconv.ParseInt(req.DramaID, 10, 64)
	if userErr != nil || dramaErr != nil {
		response.FailBadRequest(c, "无效的用户ID或剧集ID")
		return
	}

	result, err := a.services.MediaEventReport.Record(service.MediaEventReportInput{
		ReportID:  req.ReportID,
		UserID:    userID,
		DramaID:   dramaID,
		EpisodeNo: req.EpisodeNo,
		EventName: req.EventName,
		Status:    req.Status,
		Params:    req.Params,
		Result:    req.Result,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrMediaReportInvalid):
			response.FailBadRequest(c, "上报参数无效")
		case errors.Is(err, service.ErrAppUserNotFound):
			response.FailBadRequest(c, "用户不存在")
		case errors.Is(err, service.ErrDramaNotFound):
			response.FailNotFound(c, "剧集不存在")
		case errors.Is(err, service.ErrMediaReportConflict):
			response.FailConflict(c, "reportId 已被其他上报内容使用")
		default:
			response.FailServer(c, err.Error())
		}
		return
	}
	response.OK(c, result)
}
