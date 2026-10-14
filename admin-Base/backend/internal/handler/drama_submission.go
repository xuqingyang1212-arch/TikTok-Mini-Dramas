package handler

import (
	"errors"
	"strconv"
	"strings"

	"scaffold-admin/internal/pkg/response"
	"scaffold-admin/internal/service"

	"github.com/gin-gonic/gin"
)

type createDramaSubmissionReq struct {
	DramaID       string   `json:"dramaId" binding:"required"`
	SubmittedName string   `json:"submittedName" binding:"required"`
	CoverURL      string   `json:"coverUrl" binding:"required"`
	Language      string   `json:"language" binding:"required"`
	Year          int      `json:"year" binding:"required"`
	Description   string   `json:"description" binding:"required"`
	DramaType     int      `json:"dramaType" binding:"required"`
	TagList       []int    `json:"tagList" binding:"required"`
	EpisodeIDs    []string `json:"episodeIds" binding:"required"`
}

func (a *Application) ListDramaSubmissions(c *gin.Context) {
	list, total, err := a.services.DramaSubmission.List(service.DramaSubmissionListFilter{
		AlbumID:       TrimQuery(c, "albumId"),
		SubmittedName: TrimQuery(c, "submittedName"),
		DramaID:       TrimQuery(c, "dramaId"),
		ReviewStatus:  TrimQuery(c, "reviewStatus"),
		PublishStatus: TrimQuery(c, "publishStatus"),
		Page:          QueryInt(c, "page", 1),
		PageSize:      QueryInt(c, "pageSize", 20),
	})
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	response.OKPage(c, total, list)
}

func (a *Application) ListEligibleSubmissionDramas(c *gin.Context) {
	list, total, err := a.services.DramaSubmission.ListEligibleDramas(service.EligibleDramaListFilter{
		Keyword:  TrimQuery(c, "keyword"),
		Page:     QueryInt(c, "page", 1),
		PageSize: QueryInt(c, "pageSize", 20),
	})
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	response.OKPage(c, total, list)
}

func (a *Application) CreateDramaSubmission(c *gin.Context) {
	var req createDramaSubmissionReq
	if !BindOrFail(c, &req) {
		return
	}
	dramaID, err := strconv.ParseInt(strings.TrimSpace(req.DramaID), 10, 64)
	if err != nil || dramaID <= 0 {
		response.FailBadRequest(c, "无效的剧集ID")
		return
	}

	episodeIDs := make([]int64, len(req.EpisodeIDs))
	for i, rawID := range req.EpisodeIDs {
		episodeID, parseErr := strconv.ParseInt(strings.TrimSpace(rawID), 10, 64)
		if parseErr != nil || episodeID <= 0 {
			response.FailBadRequest(c, "无效的单集ID")
			return
		}
		episodeIDs[i] = episodeID
	}

	item, err := a.services.DramaSubmission.Create(service.CreateDramaSubmissionInput{
		DramaID:       dramaID,
		SubmittedName: req.SubmittedName,
		CoverURL:      req.CoverURL,
		Language:      req.Language,
		Year:          req.Year,
		Description:   req.Description,
		DramaType:     req.DramaType,
		TagList:       req.TagList,
		EpisodeIDs:    episodeIDs,
	})
	if dramaSubmissionError(c, err, "提审") {
		return
	}
	response.OK(c, item)
}

func dramaSubmissionError(c *gin.Context, err error, action string) bool {
	switch {
	case errors.Is(err, service.ErrDramaNotFound):
		response.FailNotFound(c, "剧集不存在")
	case errors.Is(err, service.ErrDramaSubmissionNotFound):
		response.FailNotFound(c, "剧目不存在")
	case errors.Is(err, service.ErrDramaSubmissionVersionMissing):
		response.FailNotFound(c, "剧目版本不存在")
	case errors.Is(err, service.ErrDramaSubmissionMediaMissing):
		response.FailNotFound(c, "媒资不存在")
	case errors.Is(err, service.ErrDramaSubmissionUploadIncomplete):
		response.FailBadRequest(c, "媒资尚未全部上传成功")
	case errors.Is(err, service.ErrDramaAlreadySubmitted):
		response.FailConflict(c, "该剧集已创建剧目")
	case errors.Is(err, service.ErrDramaSubmissionNoCover):
		response.FailBadRequest(c, "剧集封面未上传")
	case errors.Is(err, service.ErrDramaSubmissionNoEpisodes):
		response.FailBadRequest(c, "剧集视频未完整上传")
	case errors.Is(err, service.ErrDramaSubmissionInvalidType):
		response.FailBadRequest(c, "剧目类型无效")
	case errors.Is(err, service.ErrDramaSubmissionInvalidTags):
		response.FailBadRequest(c, "请选择1至3个有效标签")
	case errors.Is(err, service.ErrDramaSubmissionInvalidYear):
		response.FailBadRequest(c, "上线年份无效")
	case errors.Is(err, service.ErrDramaSubmissionReviewPending):
		response.FailBadRequest(c, "审核中的版本请先撤回送审")
	case errors.Is(err, service.ErrDramaSubmissionNoApprovedVersion):
		response.FailBadRequest(c, "该剧目没有审核通过的版本，无法上下架")
	case errors.Is(err, service.ErrDramaSubmissionInvalidState):
		response.FailBadRequest(c, "当前状态不支持该操作")
	case errors.Is(err, service.ErrDramaSubmissionInvalidFields):
		response.FailBadRequest(c, "请完整填写提审信息")
	case err != nil:
		response.FailServer(c, action+"失败")
	default:
		return false
	}
	return true
}

func (a *Application) GetDramaSubmission(c *gin.Context) {
	albumID, ok := ParseID(c, "albumId")
	if !ok {
		return
	}
	detail, err := a.services.DramaSubmission.GetDetail(albumID)
	if dramaSubmissionError(c, err, "查询") {
		return
	}
	response.OK(c, detail)
}

func (a *Application) GetDramaSubmissionVersion(c *gin.Context) {
	albumID, ok := ParseID(c, "albumId")
	if !ok {
		return
	}
	version, err := strconv.Atoi(c.Param("version"))
	if err != nil || version < 1 {
		response.FailBadRequest(c, "无效的版本号")
		return
	}
	detail, err := a.services.DramaSubmission.GetVersionDetail(albumID, version)
	if dramaSubmissionError(c, err, "查询") {
		return
	}
	response.OK(c, detail)
}

func (a *Application) ResubmitDramaSubmission(c *gin.Context) {
	albumID, ok := ParseID(c, "albumId")
	if !ok {
		return
	}
	var req createDramaSubmissionReq
	if !BindOrFail(c, &req) {
		return
	}
	dramaID, err := strconv.ParseInt(strings.TrimSpace(req.DramaID), 10, 64)
	if err != nil || dramaID <= 0 {
		response.FailBadRequest(c, "无效的剧集ID")
		return
	}
	episodeIDs := make([]int64, len(req.EpisodeIDs))
	for i, rawID := range req.EpisodeIDs {
		episodeID, parseErr := strconv.ParseInt(strings.TrimSpace(rawID), 10, 64)
		if parseErr != nil || episodeID <= 0 {
			response.FailBadRequest(c, "无效的单集ID")
			return
		}
		episodeIDs[i] = episodeID
	}
	item, err := a.services.DramaSubmission.Resubmit(albumID, service.CreateDramaSubmissionInput{DramaID: dramaID, SubmittedName: req.SubmittedName, CoverURL: req.CoverURL, Language: req.Language, Year: req.Year, Description: req.Description, DramaType: req.DramaType, TagList: req.TagList, EpisodeIDs: episodeIDs})
	if dramaSubmissionError(c, err, "重新提审") {
		return
	}
	response.OK(c, item)
}

func (a *Application) RetryDramaSubmissionMedia(c *gin.Context) {
	albumID, ok := ParseID(c, "albumId")
	if !ok {
		return
	}
	version, err := strconv.Atoi(c.Param("version"))
	if err != nil || version < 1 {
		response.FailBadRequest(c, "无效的版本号")
		return
	}
	mediaID, err := strconv.ParseInt(c.Param("mediaId"), 10, 64)
	if err != nil || mediaID <= 0 {
		response.FailBadRequest(c, "无效的媒资ID")
		return
	}
	if dramaSubmissionError(c, a.services.DramaSubmission.RetryMedia(albumID, version, mediaID), "重试上传") {
		return
	}
	response.OK(c, nil)
}

func (a *Application) SimulateDramaSubmissionMediaSuccess(c *gin.Context) {
	albumID, ok := ParseID(c, "albumId")
	if !ok {
		return
	}
	version, err := strconv.Atoi(c.Param("version"))
	if err != nil || version < 1 {
		response.FailBadRequest(c, "无效的版本号")
		return
	}
	mediaID, err := strconv.ParseInt(c.Param("mediaId"), 10, 64)
	if err != nil || mediaID <= 0 {
		response.FailBadRequest(c, "无效的媒资ID")
		return
	}
	if dramaSubmissionError(c, a.services.DramaSubmission.SimulateMediaSuccess(albumID, version, mediaID), "模拟上传成功") {
		return
	}
	response.OK(c, nil)
}

func (a *Application) SimulateDramaSubmissionMediaFailure(c *gin.Context) {
	albumID, ok := ParseID(c, "albumId")
	if !ok {
		return
	}
	version, err := strconv.Atoi(c.Param("version"))
	if err != nil || version < 1 {
		response.FailBadRequest(c, "无效的版本号")
		return
	}
	mediaID, err := strconv.ParseInt(c.Param("mediaId"), 10, 64)
	if err != nil || mediaID <= 0 {
		response.FailBadRequest(c, "无效的媒资ID")
		return
	}
	if dramaSubmissionError(c, a.services.DramaSubmission.SimulateMediaFailure(albumID, version, mediaID), "模拟上传失败") {
		return
	}
	response.OK(c, nil)
}

func (a *Application) ContinueDramaSubmissionVersion(c *gin.Context) {
	albumID, ok := ParseID(c, "albumId")
	if !ok {
		return
	}
	version, err := strconv.Atoi(c.Param("version"))
	if err != nil || version < 1 {
		response.FailBadRequest(c, "无效的版本号")
		return
	}
	if dramaSubmissionError(c, a.services.DramaSubmission.ContinueVersion(albumID, version), "继续处理") {
		return
	}
	response.OK(c, nil)
}
func (a *Application) WithdrawDramaSubmission(c *gin.Context) {
	albumID, ok := ParseID(c, "albumId")
	if !ok {
		return
	}
	if dramaSubmissionError(c, a.services.DramaSubmission.Withdraw(albumID), "撤回") {
		return
	}
	response.OK(c, nil)
}

type simulateDramaReviewReq struct {
	ReviewStatus int `json:"reviewStatus" binding:"required"`
}

func (a *Application) ToggleDramaSubmissionPublishStatus(c *gin.Context) {
	albumID, ok := ParseID(c, "albumId")
	if !ok {
		return
	}
	if dramaSubmissionError(c, a.services.DramaSubmission.TogglePublishStatus(albumID), "上下架") {
		return
	}
	response.OK(c, nil)
}
func (a *Application) SimulateDramaSubmissionReview(c *gin.Context) {
	albumID, ok := ParseID(c, "albumId")
	if !ok {
		return
	}
	var req simulateDramaReviewReq
	if !BindOrFail(c, &req) {
		return
	}
	if dramaSubmissionError(c, a.services.DramaSubmission.SimulateReview(albumID, req.ReviewStatus), "审核") {
		return
	}
	response.OK(c, nil)
}
