package service

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"regexp"
	"time"

	"scaffold-admin/internal/model"
	"scaffold-admin/internal/pkg/datetime"
	"scaffold-admin/internal/pkg/snowflake"

	"gorm.io/gorm"
)

const maxMediaEventJSONBytes = 32 * 1024

var (
	ErrMediaReportInvalid  = errors.New("invalid media event report")
	ErrMediaReportConflict = errors.New("media event report ID already used")
	mediaReportIDPattern   = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)
	mediaEventNamePattern  = regexp.MustCompile(`^[a-z][a-z0-9_]{0,63}$`)
)

type MediaEventReportInput struct {
	ReportID  string
	UserID    int64
	DramaID   int64
	EpisodeNo int
	EventName string
	Status    string
	Params    json.RawMessage
	Result    json.RawMessage
}

type MediaEventReportResult struct {
	ID         string `json:"id"`
	ReportID   string `json:"reportId"`
	Duplicated bool   `json:"duplicated"`
	ReceivedAt string `json:"receivedAt"`
}

type MediaEventReportService interface {
	Record(input MediaEventReportInput) (*MediaEventReportResult, error)
	List(filter MediaEventReportFilter) ([]MediaEventReportItem, int64, error)
	Iterate(filter MediaEventReportFilter, chunkSize int, yield func([]MediaEventReportItem) error) error
}

type mediaEventReportService struct {
	db *gorm.DB
}

func (s *mediaEventReportService) Record(input MediaEventReportInput) (*MediaEventReportResult, error) {
	if err := validateMediaEventReport(input); err != nil {
		return nil, err
	}

	var user model.AppUser
	if err := s.db.First(&user, input.UserID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAppUserNotFound
		}
		return nil, err
	}

	var drama model.Drama
	if err := s.db.First(&drama, input.DramaID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDramaNotFound
		}
		return nil, err
	}
	if input.EpisodeNo > drama.EpisodeCount {
		return nil, fmt.Errorf("%w: episodeNo exceeds drama episode count", ErrMediaReportInvalid)
	}

	existing, err := s.findByReportID(user.AppID, input.ReportID)
	if err == nil {
		if sameMediaEventReport(existing, input, user) {
			return mediaEventReportResult(existing, true), nil
		}
		return nil, ErrMediaReportConflict
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	now := time.Now().UTC().Truncate(time.Millisecond)
	report := model.MediaEventReport{
		ID:                snowflake.NextID(),
		ReportID:          input.ReportID,
		AppID:             user.AppID,
		UserID:            user.ID,
		AttributionLinkID: user.CurrentPromotionLinkID,
		DramaID:           input.DramaID,
		EpisodeNo:         input.EpisodeNo,
		EventName:         input.EventName,
		Status:            input.Status,
		ParamsJSON:        cloneJSON(input.Params),
		ResultJSON:        cloneJSON(input.Result),
		CreatedAt:         now,
	}
	if err := s.db.Create(&report).Error; err != nil {
		if !isDuplicate(err) {
			return nil, err
		}
		existing, findErr := s.findByReportID(user.AppID, input.ReportID)
		if findErr != nil {
			return nil, err
		}
		if !sameMediaEventReport(existing, input, user) {
			return nil, ErrMediaReportConflict
		}
		return mediaEventReportResult(existing, true), nil
	}
	return mediaEventReportResult(report, false), nil
}

func (s *mediaEventReportService) findByReportID(appID int64, reportID string) (model.MediaEventReport, error) {
	var report model.MediaEventReport
	err := s.db.Where("app_id = ? AND report_id = ?", appID, reportID).First(&report).Error
	return report, err
}

func validateMediaEventReport(input MediaEventReportInput) error {
	if input.UserID <= 0 || input.DramaID <= 0 || input.EpisodeNo <= 0 ||
		!mediaReportIDPattern.MatchString(input.ReportID) || !mediaEventNamePattern.MatchString(input.EventName) {
		return ErrMediaReportInvalid
	}
	switch input.Status {
	case model.MediaEventReportSuccess, model.MediaEventReportFailed, model.MediaEventReportUnsupported:
	default:
		return ErrMediaReportInvalid
	}
	if !validJSONObject(input.Params) || !validJSONObject(input.Result) {
		return ErrMediaReportInvalid
	}
	return nil
}

func validJSONObject(raw json.RawMessage) bool {
	if len(raw) == 0 || len(raw) > maxMediaEventJSONBytes || !json.Valid(raw) {
		return false
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	var object map[string]any
	return decoder.Decode(&object) == nil && object != nil
}

func sameMediaEventReport(report model.MediaEventReport, input MediaEventReportInput, user model.AppUser) bool {
	return report.UserID == user.ID && report.DramaID == input.DramaID && report.EpisodeNo == input.EpisodeNo &&
		report.EventName == input.EventName && report.Status == input.Status &&
		jsonEqual(report.ParamsJSON, input.Params) && jsonEqual(report.ResultJSON, input.Result)
}

func jsonEqual(left, right []byte) bool {
	var leftValue, rightValue any
	return json.Unmarshal(left, &leftValue) == nil && json.Unmarshal(right, &rightValue) == nil &&
		reflect.DeepEqual(leftValue, rightValue)
}

func cloneJSON(raw json.RawMessage) []byte {
	return append([]byte(nil), raw...)
}

func mediaEventReportResult(report model.MediaEventReport, duplicated bool) *MediaEventReportResult {
	return &MediaEventReportResult{
		ID:         fmt.Sprintf("%d", report.ID),
		ReportID:   report.ReportID,
		Duplicated: duplicated,
		ReceivedAt: datetime.FormatUTC(report.CreatedAt),
	}
}
