package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"scaffold-admin/internal/config"
	"scaffold-admin/internal/model"
	"scaffold-admin/internal/pkg/datetime"
	"scaffold-admin/internal/pkg/snowflake"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	minDramaTag = 1
	maxDramaTag = 46
)

var (
	ErrDramaSubmissionNotFound          = errors.New("drama submission not found")
	ErrDramaSubmissionVersionMissing    = errors.New("drama submission version not found")
	ErrDramaSubmissionMediaMissing      = errors.New("drama submission media not found")
	ErrDramaAlreadySubmitted            = errors.New("drama already submitted")
	ErrDramaSubmissionNoCover           = errors.New("drama submission requires cover")
	ErrDramaSubmissionNoEpisodes        = errors.New("drama submission requires episodes")
	ErrDramaSubmissionInvalidType       = errors.New("invalid drama type")
	ErrDramaSubmissionInvalidTags       = errors.New("invalid drama tags")
	ErrDramaSubmissionInvalidYear       = errors.New("invalid release year")
	ErrDramaSubmissionInvalidFields     = errors.New("invalid submission fields")
	ErrDramaSubmissionReviewPending     = errors.New("drama submission review is pending")
	ErrDramaSubmissionInvalidState      = errors.New("invalid drama submission state")
	ErrDramaSubmissionNoApprovedVersion = errors.New("drama submission has no approved version")
	ErrDramaSubmissionUploadIncomplete  = errors.New("drama submission upload incomplete")
	ErrDramaSubmissionInvalidApp        = errors.New("invalid drama submission authorization app")
)

type DramaSubmissionListFilter struct {
	AlbumID       string
	SubmittedName string
	DramaID       string
	ReviewStatus  string
	PublishStatus string
	Page          int
	PageSize      int
}

type DramaSubmissionListItem struct {
	AlbumID        string        `json:"albumId"`
	AppID          string        `json:"appId"`
	SubmittedName  string        `json:"submittedName"`
	DramaID        string        `json:"dramaId"`
	EpisodeCount   int           `json:"episodeCount"`
	Version        int           `json:"version"`
	CreatedAt      datetime.Time `json:"createdAt"`
	ReviewStatus   int           `json:"reviewStatus"`
	PublishStatus  int           `json:"publishStatus"`
	WorkflowStatus string        `json:"workflowStatus"`
}

type EligibleDramaListFilter struct {
	Keyword  string
	Page     int
	PageSize int
}

type EligibleDramaListItem struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	CoverURL     string `json:"coverUrl"`
	Language     string `json:"language"`
	EpisodeCount int    `json:"episodeCount"`
}

type CreateDramaSubmissionInput struct {
	DramaID       int64
	SubmittedName string
	CoverURL      string
	Language      string
	Year          int
	Description   string
	DramaType     int
	TagList       []int
	EpisodeIDs    []int64
}

type DramaSubmissionVersionItem struct {
	Version         int            `json:"version"`
	SubmittedName   string         `json:"submittedName"`
	CoverURL        string         `json:"coverUrl"`
	Language        string         `json:"language"`
	Year            int            `json:"year"`
	Description     string         `json:"description"`
	DramaType       int            `json:"dramaType"`
	TagList         []int          `json:"tagList"`
	ReviewID        string         `json:"reviewId"`
	ReviewStatus    int            `json:"reviewStatus"`
	SubmittedAt     *datetime.Time `json:"submittedAt"`
	ReviewedAt      *datetime.Time `json:"reviewedAt"`
	WithdrawnAt     *datetime.Time `json:"withdrawnAt"`
	RejectionReason string         `json:"rejectionReason"`
	WorkflowStatus  string         `json:"workflowStatus"`
	WorkflowError   string         `json:"workflowError"`
	RemoteVersion   int            `json:"remoteVersion"`
	CreatedAt       datetime.Time  `json:"createdAt"`
	UpdatedAt       datetime.Time  `json:"updatedAt"`
}

type DramaSubmissionDetail struct {
	AlbumID        string                       `json:"albumId"`
	DramaID        string                       `json:"dramaId"`
	AppID          string                       `json:"appId"`
	CurrentVersion int                          `json:"currentVersion"`
	OnlineVersion  int                          `json:"onlineVersion"`
	PublishStatus  int                          `json:"publishStatus"`
	Versions       []DramaSubmissionVersionItem `json:"versions"`
}

type DramaSubmissionEpisodeItem struct {
	MediaID       string         `json:"mediaId"`
	EpisodeID     string         `json:"episodeId"`
	EpisodeNo     int            `json:"episodeNo"`
	SourceURL     string         `json:"sourceUrl"`
	UploadStatus  string         `json:"uploadStatus"`
	JobID         string         `json:"jobId"`
	VID           string         `json:"vid"`
	UploadError   string         `json:"uploadError"`
	RetryCount    int            `json:"retryCount"`
	LastAttemptAt *datetime.Time `json:"lastAttemptAt"`
	Reused        bool           `json:"reused"`
}

type DramaSubmissionVersionDetail struct {
	DramaSubmissionVersionItem
	AlbumID  string                       `json:"albumId"`
	DramaID  string                       `json:"dramaId"`
	Episodes []DramaSubmissionEpisodeItem `json:"episodes"`
}

type DramaSubmissionAuthorizationItem struct {
	AppID              string `json:"appId"`
	AppName            string `json:"appName"`
	MonetizationType   string `json:"monetizationType"`
	IsSourceApp        bool   `json:"isSourceApp"`
	Authorized         bool   `json:"authorized"`
	AuthorizationError string `json:"authorizationError,omitempty"`
}

type DramaSubmissionAuthorizationDetail struct {
	AlbumID string                             `json:"albumId"`
	Apps    []DramaSubmissionAuthorizationItem `json:"apps"`
}

type DramaSubmissionService interface {
	List(filter DramaSubmissionListFilter) ([]DramaSubmissionListItem, int64, error)
	ListEligibleDramas(filter EligibleDramaListFilter) ([]EligibleDramaListItem, int64, error)
	Create(input CreateDramaSubmissionInput) (*DramaSubmissionListItem, error)
	GetDetail(albumID int64) (*DramaSubmissionDetail, error)
	GetVersionDetail(albumID int64, version int) (*DramaSubmissionVersionDetail, error)
	GetAuthorizations(albumID int64) (*DramaSubmissionAuthorizationDetail, error)
	UpdateAuthorizations(albumID int64, targetAppIDs []string) (*DramaSubmissionAuthorizationDetail, error)
	Resubmit(albumID int64, input CreateDramaSubmissionInput) (*DramaSubmissionListItem, error)
	RetryMedia(albumID int64, version int, mediaID int64) error
	SimulateMediaSuccess(albumID int64, version int, mediaID int64) error
	SimulateMediaFailure(albumID int64, version int, mediaID int64) error
	ContinueVersion(albumID int64, version int) error
	Withdraw(albumID int64) error
	SimulateReview(albumID int64, reviewStatus int) error
	TogglePublishStatus(albumID int64) error
}

type dramaSubmissionService struct {
	db            *gorm.DB
	authorization *dramaAuthorizationService
}

func (s *dramaSubmissionService) List(f DramaSubmissionListFilter) ([]DramaSubmissionListItem, int64, error) {
	db := s.db.Table("drama_submissions AS submissions").Joins("JOIN dramas AS dramas ON dramas.id = submissions.drama_id").Joins("JOIN apps AS apps ON apps.id = submissions.source_app_id").Joins("JOIN drama_submission_versions AS versions ON versions.album_id = submissions.album_id AND versions.version = submissions.version")
	if f.AlbumID != "" {
		db = db.Where("submissions.album_id = ?", f.AlbumID)
	}
	if f.SubmittedName != "" {
		db = db.Where("versions.submitted_name LIKE ?", "%"+f.SubmittedName+"%")
	}
	if f.DramaID != "" {
		db = db.Where("submissions.drama_id = ?", f.DramaID)
	}
	if f.ReviewStatus != "" {
		status, err := strconv.Atoi(f.ReviewStatus)
		if err != nil || status < 0 || status > 4 {
			db = db.Where("1 = 0")
		} else {
			db = db.Where("versions.review_status = ?", status)
		}
	}
	if f.PublishStatus != "" {
		status, err := strconv.Atoi(f.PublishStatus)
		if err != nil || (status != 1 && status != 2) {
			db = db.Where("1 = 0")
		} else {
			db = db.Where("submissions.publish_status = ?", status)
		}
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	type row struct {
		AlbumID        int64
		AppID          string
		SubmittedName  string
		DramaID        int64
		EpisodeCount   int
		Version        int
		CreatedAt      time.Time
		ReviewStatus   int
		PublishStatus  int
		WorkflowStatus string
	}
	page, size := normalizePage(f.Page, f.PageSize)
	var rows []row
	if err := db.Select("submissions.album_id, apps.app_id, versions.submitted_name, submissions.drama_id, dramas.episode_count, submissions.version, submissions.created_at, versions.review_status, submissions.publish_status, versions.workflow_status").Order("submissions.created_at DESC").Offset((page - 1) * size).Limit(size).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	items := make([]DramaSubmissionListItem, len(rows))
	for i, row := range rows {
		items[i] = dramaSubmissionListItem(row.AlbumID, row.AppID, row.SubmittedName, row.DramaID, row.EpisodeCount, row.Version, row.CreatedAt, row.ReviewStatus, row.PublishStatus, row.WorkflowStatus)
	}
	return items, total, nil
}

func (s *dramaSubmissionService) ListEligibleDramas(f EligibleDramaListFilter) ([]EligibleDramaListItem, int64, error) {
	db := s.db.Table("dramas AS dramas").Where("NOT EXISTS (?)", s.db.Table("drama_submissions AS submissions").Select("1").Where("submissions.drama_id = dramas.id"))
	if f.Keyword != "" {
		if id, err := strconv.ParseInt(f.Keyword, 10, 64); err == nil && id > 0 {
			db = db.Where("dramas.id = ?", id)
		} else {
			db = db.Where("dramas.name LIKE ?", "%"+f.Keyword+"%")
		}
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	page, size := normalizePage(f.Page, f.PageSize)
	type row struct {
		ID           int64
		Name         string
		Description  string
		CoverURL     string
		Language     string
		EpisodeCount int
	}
	var rows []row
	if err := db.Select("dramas.id, dramas.name, dramas.description, dramas.cover_url, dramas.language, dramas.episode_count").Order("dramas.created_at DESC").Offset((page - 1) * size).Limit(size).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	items := make([]EligibleDramaListItem, len(rows))
	for i, row := range rows {
		items[i] = EligibleDramaListItem{ID: fmt.Sprintf("%d", row.ID), Name: row.Name, Description: row.Description, CoverURL: row.CoverURL, Language: row.Language, EpisodeCount: row.EpisodeCount}
	}
	return items, total, nil
}

func validateDramaSubmissionInput(in *CreateDramaSubmissionInput) error {
	in.SubmittedName = strings.TrimSpace(in.SubmittedName)
	in.CoverURL = strings.TrimSpace(in.CoverURL)
	in.Language = strings.TrimSpace(in.Language)
	in.Description = strings.TrimSpace(in.Description)
	if in.SubmittedName == "" || in.CoverURL == "" || in.Language == "" || in.Description == "" {
		return ErrDramaSubmissionInvalidFields
	}
	if in.Year < 1900 || in.Year > datetime.ChinaNow().Year()+1 {
		return ErrDramaSubmissionInvalidYear
	}
	if in.DramaType < 1 || in.DramaType > 4 {
		return ErrDramaSubmissionInvalidType
	}
	if !validDramaTags(in.TagList) {
		return ErrDramaSubmissionInvalidTags
	}
	return nil
}

func (s *dramaSubmissionService) Create(in CreateDramaSubmissionInput) (*DramaSubmissionListItem, error) {
	if err := validateDramaSubmissionInput(&in); err != nil {
		return nil, err
	}
	var result DramaSubmissionListItem
	err := s.db.Transaction(func(tx *gorm.DB) error {
		drama, episodes, err := loadSubmissionResources(tx, in.DramaID, in.EpisodeIDs)
		if err != nil {
			return err
		}
		var existing int64
		if err := tx.Model(&model.DramaSubmission{}).Where("drama_id = ?", drama.ID).Count(&existing).Error; err != nil {
			return err
		}
		if existing > 0 {
			return ErrDramaAlreadySubmitted
		}
		var sourceApp model.App
		if err := tx.Where("app_id = ?", config.DramaSubmissionSourceTikTokAppID()).First(&sourceApp).Error; err != nil {
			return fmt.Errorf("load drama submission source app: %w", err)
		}
		submission := model.DramaSubmission{AlbumID: snowflake.NextID(), SourceAppID: sourceApp.ID, DramaID: drama.ID, SubmittedName: in.SubmittedName, Language: in.Language, Year: in.Year, Description: in.Description, DramaType: in.DramaType, TagList: append([]int(nil), in.TagList...), Version: 1, AlbumStatus: model.DramaAlbumCompleted, PublishStatus: model.DramaPublishOffline}
		version := submissionVersionFromInput(submission, in)
		media := buildSubmissionMedia(submission.AlbumID, 1, in.CoverURL, episodes, nil)
		version.WorkflowStatus = initialWorkflowState(media)
		if version.WorkflowStatus == model.DramaSubmissionWorkflowReviewing {
			now := time.Now().UTC()
			version.ReviewStatus = model.DramaReviewPending
			version.RemoteVersion = version.Version
			version.SubmittedAt = &now
		}
		if err := tx.Create(&submission).Error; err != nil {
			if isDuplicate(err) {
				return ErrDramaAlreadySubmitted
			}
			return err
		}
		if err := tx.Create(&version).Error; err != nil {
			return err
		}
		if err := tx.Create(&media).Error; err != nil {
			return err
		}
		result = dramaSubmissionListItem(submission.AlbumID, sourceApp.TiktokAppID, submission.SubmittedName, submission.DramaID, drama.EpisodeCount, 1, submission.CreatedAt, version.ReviewStatus, submission.PublishStatus, version.WorkflowStatus)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func (s *dramaSubmissionService) GetDetail(albumID int64) (*DramaSubmissionDetail, error) {
	var submission model.DramaSubmission
	if err := s.db.First(&submission, "album_id = ?", albumID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDramaSubmissionNotFound
		}
		return nil, err
	}
	var versions []model.DramaSubmissionVersion
	if err := s.db.Where("album_id = ?", albumID).Order("version DESC").Find(&versions).Error; err != nil {
		return nil, err
	}
	items := make([]DramaSubmissionVersionItem, len(versions))
	for i, version := range versions {
		items[i] = dramaSubmissionVersionItem(version)
	}
	var sourceApp model.App
	if err := s.db.Select("app_id").First(&sourceApp, submission.SourceAppID).Error; err != nil {
		return nil, err
	}
	return &DramaSubmissionDetail{AlbumID: strconv.FormatInt(submission.AlbumID, 10), DramaID: strconv.FormatInt(submission.DramaID, 10), AppID: sourceApp.TiktokAppID, CurrentVersion: submission.Version, OnlineVersion: submission.OnlineVersion, PublishStatus: submission.PublishStatus, Versions: items}, nil
}

func (s *dramaSubmissionService) GetVersionDetail(albumID int64, versionNumber int) (*DramaSubmissionVersionDetail, error) {
	var submission model.DramaSubmission
	if err := s.db.First(&submission, "album_id = ?", albumID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDramaSubmissionNotFound
		}
		return nil, err
	}
	var version model.DramaSubmissionVersion
	if err := s.db.Where("album_id = ? AND version = ?", albumID, versionNumber).First(&version).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDramaSubmissionVersionMissing
		}
		return nil, err
	}
	var media []model.DramaSubmissionMedia
	if err := s.db.Where("album_id = ? AND version = ? AND media_type = ?", albumID, versionNumber, model.DramaSubmissionMediaEpisode).Order("episode_no ASC").Find(&media).Error; err != nil {
		return nil, err
	}
	episodes := make([]DramaSubmissionEpisodeItem, len(media))
	for i, item := range media {
		episodes[i] = DramaSubmissionEpisodeItem{MediaID: strconv.FormatInt(item.ID, 10), EpisodeID: strconv.FormatInt(item.EpisodeID, 10), EpisodeNo: item.EpisodeNo, SourceURL: item.SourceURL, UploadStatus: item.UploadStatus, JobID: item.JobID, VID: item.VID, UploadError: item.UploadError, RetryCount: item.RetryCount, LastAttemptAt: optionalDateTime(item.LastAttemptAt), Reused: item.SourceMediaID > 0}
	}
	return &DramaSubmissionVersionDetail{DramaSubmissionVersionItem: dramaSubmissionVersionItem(version), AlbumID: strconv.FormatInt(albumID, 10), DramaID: strconv.FormatInt(submission.DramaID, 10), Episodes: episodes}, nil
}

func (s *dramaSubmissionService) GetAuthorizations(albumID int64) (*DramaSubmissionAuthorizationDetail, error) {
	return s.authorization.GetDetail(albumID)
}

func (s *dramaSubmissionService) UpdateAuthorizations(albumID int64, targetAppIDs []string) (*DramaSubmissionAuthorizationDetail, error) {
	return s.authorization.SyncSelection(albumID, targetAppIDs)
}

func (s *dramaSubmissionService) Resubmit(albumID int64, in CreateDramaSubmissionInput) (*DramaSubmissionListItem, error) {
	if err := validateDramaSubmissionInput(&in); err != nil {
		return nil, err
	}
	var result DramaSubmissionListItem
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var submission model.DramaSubmission
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&submission, "album_id = ?", albumID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrDramaSubmissionNotFound
			}
			return err
		}
		if in.DramaID != 0 && in.DramaID != submission.DramaID {
			return ErrDramaSubmissionInvalidFields
		}
		drama, episodes, err := loadSubmissionResources(tx, submission.DramaID, in.EpisodeIDs)
		if err != nil {
			return err
		}
		var currentVersion model.DramaSubmissionVersion
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("album_id = ? AND version = ?", albumID, submission.Version).First(&currentVersion).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrDramaSubmissionVersionMissing
			}
			return err
		}
		if currentVersion.ReviewStatus == model.DramaReviewPending {
			return ErrDramaSubmissionReviewPending
		}

		targetVersion := submission.Version + 1
		previousMedia := make(map[string]model.DramaSubmissionMedia)
		var oldMedia []model.DramaSubmissionMedia
		if err := tx.Where("album_id = ? AND version = ?", albumID, submission.Version).Find(&oldMedia).Error; err != nil {
			return err
		}
		for _, item := range oldMedia {
			previousMedia[mediaKey(item.MediaType, item.EpisodeID)] = item
		}
		reviewID := snowflake.NextID()
		tagListJSON, err := json.Marshal(in.TagList)
		if err != nil {
			return err
		}
		version := model.DramaSubmissionVersion{ID: snowflake.NextID(), AlbumID: albumID, Version: targetVersion, SubmittedName: in.SubmittedName, CoverURL: in.CoverURL, Language: in.Language, Year: in.Year, Description: in.Description, DramaType: in.DramaType, TagList: append([]int(nil), in.TagList...), ReviewID: reviewID, ReviewStatus: model.DramaReviewUnsubmitted, WorkflowStatus: model.DramaSubmissionWorkflowUploading}
		media := buildSubmissionMedia(albumID, targetVersion, in.CoverURL, episodes, previousMedia)
		version.WorkflowStatus = initialWorkflowState(media)
		if version.WorkflowStatus == model.DramaSubmissionWorkflowReviewing {
			now := time.Now().UTC()
			version.ReviewStatus = model.DramaReviewPending
			version.RemoteVersion = targetVersion
			version.SubmittedAt = &now
		}
		if err := tx.Create(&version).Error; err != nil {
			return err
		}
		if err := tx.Create(&media).Error; err != nil {
			return err
		}
		updates := map[string]any{"submitted_name": in.SubmittedName, "language": in.Language, "year": in.Year, "description": in.Description, "drama_type": in.DramaType, "tag_list": string(tagListJSON), "version": targetVersion}
		if err := tx.Model(&submission).Updates(updates).Error; err != nil {
			return err
		}
		var sourceApp model.App
		if err := tx.Select("app_id").First(&sourceApp, submission.SourceAppID).Error; err != nil {
			return err
		}
		result = dramaSubmissionListItem(albumID, sourceApp.TiktokAppID, in.SubmittedName, submission.DramaID, drama.EpisodeCount, targetVersion, submission.CreatedAt, version.ReviewStatus, submission.PublishStatus, version.WorkflowStatus)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func (s *dramaSubmissionService) RetryMedia(albumID int64, versionNumber int, mediaID int64) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		submission, version, media, err := lockUploadMedia(tx, albumID, versionNumber, mediaID, model.DramaSubmissionMediaFailed)
		if err != nil {
			return err
		}
		now := time.Now().UTC()
		if err := tx.Model(media).Updates(map[string]any{
			"upload_status":   model.DramaSubmissionMediaProcessing,
			"upload_error":    "",
			"job_id":          "",
			"vid":             "",
			"retry_count":     media.RetryCount + 1,
			"last_attempt_at": now,
		}).Error; err != nil {
			return err
		}
		return updateUploadWorkflowProjection(tx, submission, version)
	})
}

func (s *dramaSubmissionService) SimulateMediaSuccess(albumID int64, versionNumber int, mediaID int64) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		submission, version, media, err := lockUploadMedia(tx, albumID, versionNumber, mediaID, model.DramaSubmissionMediaProcessing)
		if err != nil {
			return err
		}
		now := time.Now().UTC()
		upload := simulatedUploadResult(*media)
		if err := tx.Model(media).Updates(map[string]any{
			"upload_status":   upload.UploadStatus,
			"upload_error":    upload.UploadError,
			"job_id":          upload.JobID,
			"vid":             upload.VID,
			"last_attempt_at": now,
		}).Error; err != nil {
			return err
		}
		return updateUploadWorkflowProjection(tx, submission, version)
	})
}

func (s *dramaSubmissionService) SimulateMediaFailure(albumID int64, versionNumber int, mediaID int64) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		submission, version, media, err := lockUploadMedia(tx, albumID, versionNumber, mediaID, model.DramaSubmissionMediaProcessing)
		if err != nil {
			return err
		}
		now := time.Now().UTC()
		if err := tx.Model(media).Updates(map[string]any{
			"upload_status":   model.DramaSubmissionMediaFailed,
			"upload_error":    "上传失败",
			"job_id":          "",
			"vid":             "",
			"last_attempt_at": now,
		}).Error; err != nil {
			return err
		}
		return updateUploadWorkflowProjection(tx, submission, version)
	})
}

func lockUploadMedia(tx *gorm.DB, albumID int64, versionNumber int, mediaID int64, expectedStatus string) (*model.DramaSubmission, *model.DramaSubmissionVersion, *model.DramaSubmissionMedia, error) {
	var submission model.DramaSubmission
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&submission, "album_id = ?", albumID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, nil, ErrDramaSubmissionNotFound
		}
		return nil, nil, nil, err
	}
	version, err := lockSubmissionVersion(tx, albumID, versionNumber)
	if err != nil {
		return nil, nil, nil, err
	}
	if submission.Version != versionNumber || (version.WorkflowStatus != model.DramaSubmissionWorkflowUploading && version.WorkflowStatus != model.DramaSubmissionWorkflowUploadFailed) || version.ReviewStatus != model.DramaReviewUnsubmitted {
		return nil, nil, nil, ErrDramaSubmissionInvalidState
	}
	var media model.DramaSubmissionMedia
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND album_id = ? AND version = ? AND media_type = ?", mediaID, albumID, versionNumber, model.DramaSubmissionMediaEpisode).First(&media).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, nil, ErrDramaSubmissionMediaMissing
		}
		return nil, nil, nil, err
	}
	if media.UploadStatus != expectedStatus {
		return nil, nil, nil, ErrDramaSubmissionInvalidState
	}
	return &submission, version, &media, nil
}

func updateUploadWorkflowProjection(tx *gorm.DB, submission *model.DramaSubmission, version *model.DramaSubmissionVersion) error {
	if err := refreshVersionUploadState(tx, submission.AlbumID, version.Version); err != nil {
		return err
	}
	if err := tx.Where("album_id = ? AND version = ?", submission.AlbumID, version.Version).First(version).Error; err != nil {
		return err
	}
	if version.WorkflowStatus != model.DramaSubmissionWorkflowAlbumReady {
		return nil
	}
	return submitReadyVersion(tx, submission, version)
}

func (s *dramaSubmissionService) ContinueVersion(albumID int64, versionNumber int) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var submission model.DramaSubmission
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&submission, "album_id = ?", albumID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrDramaSubmissionNotFound
			}
			return err
		}
		version, err := lockSubmissionVersion(tx, albumID, versionNumber)
		if err != nil {
			return err
		}
		if submission.Version != versionNumber {
			return ErrDramaSubmissionInvalidState
		}
		switch version.WorkflowStatus {
		case model.DramaSubmissionWorkflowUploading, model.DramaSubmissionWorkflowUploadFailed:
			if err := refreshVersionUploadState(tx, albumID, versionNumber); err != nil {
				return err
			}
			if err := tx.Where("album_id = ? AND version = ?", albumID, versionNumber).First(version).Error; err != nil {
				return err
			}
			if version.WorkflowStatus == model.DramaSubmissionWorkflowUploadFailed {
				return ErrDramaSubmissionUploadIncomplete
			}
			if version.WorkflowStatus == model.DramaSubmissionWorkflowUploading {
				return nil
			}
			return submitReadyVersion(tx, &submission, version)
		case model.DramaSubmissionWorkflowAlbumReady, model.DramaSubmissionWorkflowAlbumFailed, model.DramaSubmissionWorkflowReviewReady, model.DramaSubmissionWorkflowReviewFailed:
			return submitReadyVersion(tx, &submission, version)
		default:
			return ErrDramaSubmissionInvalidState
		}
	})
}

func submitReadyVersion(tx *gorm.DB, submission *model.DramaSubmission, version *model.DramaSubmissionVersion) error {
	if err := tx.Model(version).Updates(map[string]any{"workflow_status": model.DramaSubmissionWorkflowReviewReady, "workflow_error": "", "remote_version": version.Version}).Error; err != nil {
		return err
	}
	now := time.Now().UTC()
	if err := tx.Model(version).Updates(map[string]any{"workflow_status": model.DramaSubmissionWorkflowReviewing, "workflow_error": "", "review_status": model.DramaReviewPending, "submitted_at": now}).Error; err != nil {
		return err
	}
	return nil
}

func lockSubmissionVersion(tx *gorm.DB, albumID int64, versionNumber int) (*model.DramaSubmissionVersion, error) {
	var version model.DramaSubmissionVersion
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("album_id = ? AND version = ?", albumID, versionNumber).First(&version).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDramaSubmissionVersionMissing
		}
		return nil, err
	}
	return &version, nil
}

func refreshVersionUploadState(tx *gorm.DB, albumID int64, versionNumber int) error {
	var failed int64
	if err := tx.Model(&model.DramaSubmissionMedia{}).Where("album_id = ? AND version = ? AND upload_status = ?", albumID, versionNumber, model.DramaSubmissionMediaFailed).Count(&failed).Error; err != nil {
		return err
	}
	var incomplete int64
	if err := tx.Model(&model.DramaSubmissionMedia{}).Where("album_id = ? AND version = ? AND upload_status <> ?", albumID, versionNumber, model.DramaSubmissionMediaSuccess).Count(&incomplete).Error; err != nil {
		return err
	}
	status := model.DramaSubmissionWorkflowAlbumReady
	errorMessage := ""
	if failed > 0 {
		status = model.DramaSubmissionWorkflowUploadFailed
		errorMessage = "存在上传失败的资源，请重试失败资源"
	} else if incomplete > 0 {
		status = model.DramaSubmissionWorkflowUploading
	}
	return tx.Model(&model.DramaSubmissionVersion{}).Where("album_id = ? AND version = ?", albumID, versionNumber).Updates(map[string]any{"workflow_status": status, "workflow_error": errorMessage, "review_status": model.DramaReviewUnsubmitted, "remote_version": 0, "submitted_at": nil}).Error
}

func simulatedUploadResult(media model.DramaSubmissionMedia) model.DramaSubmissionMedia {
	media.UploadStatus = model.DramaSubmissionMediaSuccess
	media.UploadError = ""
	media.JobID = "job_" + strconv.FormatInt(snowflake.NextID(), 10)
	media.VID = "vid_" + strconv.FormatInt(snowflake.NextID(), 10)
	return media
}

func (s *dramaSubmissionService) Withdraw(albumID int64) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var submission model.DramaSubmission
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&submission, "album_id = ?", albumID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrDramaSubmissionNotFound
			}
			return err
		}
		var currentVersion model.DramaSubmissionVersion
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("album_id = ? AND version = ?", albumID, submission.Version).First(&currentVersion).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrDramaSubmissionVersionMissing
			}
			return err
		}
		if currentVersion.ReviewStatus != model.DramaReviewPending {
			return ErrDramaSubmissionInvalidState
		}
		now := time.Now().UTC()
		workflowStatus := model.DramaSubmissionWorkflowWithdrawn
		if err := tx.Model(&currentVersion).Updates(map[string]any{"review_status": model.DramaReviewWithdrawn, "workflow_status": workflowStatus, "workflow_error": "", "withdrawn_at": now}).Error; err != nil {
			return err
		}
		return nil
	})
}

func (s *dramaSubmissionService) TogglePublishStatus(albumID int64) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var submission model.DramaSubmission
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&submission, "album_id = ?", albumID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrDramaSubmissionNotFound
			}
			return err
		}
		var drama model.Drama
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&drama, submission.DramaID).Error; err != nil {
			return err
		}

		var approvedVersionCount int64
		if err := tx.Model(&model.DramaSubmissionVersion{}).
			Where("album_id = ? AND review_status = ?", albumID, model.DramaReviewApproved).
			Count(&approvedVersionCount).Error; err != nil {
			return err
		}
		if approvedVersionCount == 0 {
			return ErrDramaSubmissionNoApprovedVersion
		}

		publishStatus := model.DramaPublishOnline
		dramaStatus := "上架"
		if submission.PublishStatus == model.DramaPublishOnline {
			publishStatus = model.DramaPublishOffline
			dramaStatus = "下架"
		}
		if err := tx.Model(&submission).Update("publish_status", publishStatus).Error; err != nil {
			return err
		}
		return tx.Model(&drama).Update("status", dramaStatus).Error
	})
}
func (s *dramaSubmissionService) SimulateReview(albumID int64, reviewStatus int) error {
	if reviewStatus != model.DramaReviewApproved && reviewStatus != model.DramaReviewRejected {
		return ErrDramaSubmissionInvalidFields
	}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var submission model.DramaSubmission
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&submission, "album_id = ?", albumID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrDramaSubmissionNotFound
			}
			return err
		}
		var drama model.Drama
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&drama, submission.DramaID).Error; err != nil {
			return err
		}
		var currentVersion model.DramaSubmissionVersion
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("album_id = ? AND version = ?", albumID, submission.Version).First(&currentVersion).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrDramaSubmissionVersionMissing
			}
			return err
		}
		if currentVersion.ReviewStatus != model.DramaReviewPending {
			return ErrDramaSubmissionInvalidState
		}
		now := time.Now().UTC()
		reason := ""
		if reviewStatus == model.DramaReviewRejected {
			reason = "模拟审核驳回，请检查剧目及单集内容"
		}
		workflowStatus := model.DramaSubmissionWorkflowApproved
		if reviewStatus == model.DramaReviewRejected {
			workflowStatus = model.DramaSubmissionWorkflowRejected
		}
		if err := tx.Model(&currentVersion).Updates(map[string]any{"review_status": reviewStatus, "workflow_status": workflowStatus, "workflow_error": "", "reviewed_at": now, "rejection_reason": reason}).Error; err != nil {
			return err
		}
		publishStatus := submission.PublishStatus
		onlineVersion := submission.OnlineVersion
		if reviewStatus == model.DramaReviewApproved {
			publishStatus = model.DramaPublishOnline
			onlineVersion = currentVersion.Version
		} else if submission.PublishStatus != model.DramaPublishOnline {
			publishStatus = model.DramaPublishOffline
		}
		if err := tx.Model(&submission).Updates(map[string]any{"publish_status": publishStatus, "online_version": onlineVersion}).Error; err != nil {
			return err
		}
		if reviewStatus == model.DramaReviewApproved {
			if err := tx.Model(&drama).Update("status", "上架").Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	if reviewStatus == model.DramaReviewApproved {
		var submission model.DramaSubmission
		if err := s.db.Select("version").First(&submission, "album_id = ?", albumID).Error; err != nil {
			return err
		}
		if submission.Version == 1 {
			if err := s.authorization.GrantAlbumToAllApps(albumID); err != nil {
				return fmt.Errorf("剧目已审核通过并上架，但自动授权未完全成功: %w", err)
			}
		}
	}
	return nil
}

func loadSubmissionResources(tx *gorm.DB, dramaID int64, episodeIDs []int64) (*model.Drama, []model.Episode, error) {
	var drama model.Drama
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&drama, dramaID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, ErrDramaNotFound
		}
		return nil, nil, err
	}
	if drama.EpisodeCount < 1 || len(episodeIDs) != drama.EpisodeCount {
		return nil, nil, ErrDramaSubmissionNoEpisodes
	}
	seenIDs := make(map[int64]struct{}, len(episodeIDs))
	for _, episodeID := range episodeIDs {
		if _, exists := seenIDs[episodeID]; exists {
			return nil, nil, ErrDramaSubmissionNoEpisodes
		}
		seenIDs[episodeID] = struct{}{}
	}
	var episodes []model.Episode
	if err := tx.Where("drama_id = ? AND id IN ? AND TRIM(video_url) <> ''", drama.ID, episodeIDs).Order("episode_no ASC").Find(&episodes).Error; err != nil {
		return nil, nil, err
	}
	if len(episodes) != len(episodeIDs) {
		return nil, nil, ErrDramaSubmissionNoEpisodes
	}
	return &drama, episodes, nil
}

func submissionVersionFromInput(submission model.DramaSubmission, in CreateDramaSubmissionInput) model.DramaSubmissionVersion {
	return model.DramaSubmissionVersion{ID: snowflake.NextID(), AlbumID: submission.AlbumID, Version: submission.Version, SubmittedName: in.SubmittedName, CoverURL: in.CoverURL, Language: in.Language, Year: in.Year, Description: in.Description, DramaType: in.DramaType, TagList: append([]int(nil), in.TagList...), ReviewID: snowflake.NextID(), ReviewStatus: model.DramaReviewUnsubmitted, WorkflowStatus: model.DramaSubmissionWorkflowUploading}
}

func initialWorkflowState(media []model.DramaSubmissionMedia) string {
	for _, item := range media {
		if item.UploadStatus == model.DramaSubmissionMediaFailed {
			return model.DramaSubmissionWorkflowUploadFailed
		}
		if item.UploadStatus != model.DramaSubmissionMediaSuccess {
			return model.DramaSubmissionWorkflowUploading
		}
	}
	return model.DramaSubmissionWorkflowReviewing
}

func buildSubmissionMedia(albumID int64, version int, coverURL string, episodes []model.Episode, previous map[string]model.DramaSubmissionMedia) []model.DramaSubmissionMedia {
	media := make([]model.DramaSubmissionMedia, 0, len(episodes)+1)
	media = append(media, reusableSubmissionMedia(albumID, version, model.DramaSubmissionMediaCover, 0, 0, coverURL, previous))
	for _, episode := range episodes {
		media = append(media, reusableSubmissionMedia(albumID, version, model.DramaSubmissionMediaEpisode, episode.ID, episode.EpisodeNo, episode.VideoURL, previous))
	}
	return media
}

func reusableSubmissionMedia(albumID int64, version int, mediaType string, episodeID int64, episodeNo int, sourceURL string, previous map[string]model.DramaSubmissionMedia) model.DramaSubmissionMedia {
	if item, ok := previous[mediaKey(mediaType, episodeID)]; ok && item.SourceURL == sourceURL && item.UploadStatus == model.DramaSubmissionMediaSuccess && item.VID != "" {
		now := time.Now().UTC()
		return model.DramaSubmissionMedia{ID: snowflake.NextID(), AlbumID: albumID, Version: version, MediaType: mediaType, EpisodeID: episodeID, EpisodeNo: episodeNo, SourceURL: sourceURL, UploadStatus: model.DramaSubmissionMediaSuccess, JobID: item.JobID, VID: item.VID, SourceMediaID: item.ID, LastAttemptAt: &now}
	}
	if mediaType == model.DramaSubmissionMediaCover {
		return simulatedSubmissionMedia(albumID, version, mediaType, episodeID, episodeNo, sourceURL)
	}
	return model.DramaSubmissionMedia{ID: snowflake.NextID(), AlbumID: albumID, Version: version, MediaType: mediaType, EpisodeID: episodeID, EpisodeNo: episodeNo, SourceURL: sourceURL, UploadStatus: model.DramaSubmissionMediaProcessing}
}

func mediaKey(mediaType string, episodeID int64) string {
	return mediaType + ":" + strconv.FormatInt(episodeID, 10)
}

func dramaSubmissionVersionItem(version model.DramaSubmissionVersion) DramaSubmissionVersionItem {
	return DramaSubmissionVersionItem{Version: version.Version, SubmittedName: version.SubmittedName, CoverURL: version.CoverURL, Language: version.Language, Year: version.Year, Description: version.Description, DramaType: version.DramaType, TagList: append([]int(nil), version.TagList...), ReviewID: strconv.FormatInt(version.ReviewID, 10), ReviewStatus: version.ReviewStatus, SubmittedAt: optionalDateTime(version.SubmittedAt), ReviewedAt: optionalDateTime(version.ReviewedAt), WithdrawnAt: optionalDateTime(version.WithdrawnAt), RejectionReason: version.RejectionReason, WorkflowStatus: version.WorkflowStatus, WorkflowError: version.WorkflowError, RemoteVersion: version.RemoteVersion, CreatedAt: datetime.From(version.CreatedAt), UpdatedAt: datetime.From(version.UpdatedAt)}
}

func optionalDateTime(value *time.Time) *datetime.Time {
	if value == nil {
		return nil
	}
	result := datetime.From(*value)
	return &result
}

func validDramaTags(tags []int) bool {
	if len(tags) < 1 || len(tags) > 3 {
		return false
	}
	seen := make(map[int]struct{}, len(tags))
	for _, tag := range tags {
		if tag < minDramaTag || tag > maxDramaTag || tag == 32 {
			return false
		}
		if _, exists := seen[tag]; exists {
			return false
		}
		seen[tag] = struct{}{}
	}
	return true
}

func simulatedSubmissionMedia(albumID int64, version int, mediaType string, episodeID int64, episodeNo int, sourceURL string) model.DramaSubmissionMedia {
	id := snowflake.NextID()
	now := time.Now().UTC()
	return model.DramaSubmissionMedia{ID: id, AlbumID: albumID, Version: version, MediaType: mediaType, EpisodeID: episodeID, EpisodeNo: episodeNo, SourceURL: sourceURL, UploadStatus: model.DramaSubmissionMediaSuccess, JobID: "job_" + strconv.FormatInt(id, 10), VID: "vid_" + strconv.FormatInt(snowflake.NextID(), 10), LastAttemptAt: &now}
}

func dramaSubmissionListItem(albumID int64, appID, submittedName string, dramaID int64, episodeCount, version int, createdAt time.Time, reviewStatus, publishStatus int, workflowStatus string) DramaSubmissionListItem {
	return DramaSubmissionListItem{AlbumID: fmt.Sprintf("%d", albumID), AppID: appID, SubmittedName: submittedName, DramaID: fmt.Sprintf("%d", dramaID), EpisodeCount: episodeCount, Version: version, CreatedAt: datetime.From(createdAt), ReviewStatus: reviewStatus, PublishStatus: publishStatus, WorkflowStatus: workflowStatus}
}
