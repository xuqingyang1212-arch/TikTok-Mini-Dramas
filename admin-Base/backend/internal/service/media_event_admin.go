package service

import (
	"encoding/json"
	"strconv"
	"time"

	"scaffold-admin/internal/pkg/datetime"

	"gorm.io/gorm"
)

type MediaEventReportFilter struct {
	UserID            string
	AttributionLinkID string
	AppID             int64
	Drama             string
	EventName         string
	Status            string
	ReportedAtFrom    *time.Time
	ReportedAtTo      *time.Time
	Page              int
	PageSize          int
}

type MediaEventReportItem struct {
	ID                string         `json:"id"`
	UserID            string         `json:"userId"`
	AttributionLinkID *string        `json:"attributionLinkId"`
	AppID             string         `json:"appId"`
	AppName           string         `json:"appName"`
	MonetizationType  string         `json:"monetizationType"`
	DramaID           string         `json:"dramaId"`
	DramaName         string         `json:"dramaName"`
	EpisodeNo         int            `json:"episodeNo"`
	EventName         string         `json:"eventName"`
	Status            string         `json:"status"`
	ReportedAt        string         `json:"reportedAt"`
	Params            map[string]any `json:"params"`
	Result            map[string]any `json:"result"`
}

type mediaEventReportRow struct {
	ID                int64
	UserID            int64
	AttributionLinkID *int64
	AppID             int64
	AppName           string
	MonetizationType  string
	DramaID           int64
	DramaName         string
	EpisodeNo         int
	EventName         string
	Status            string
	CreatedAt         time.Time
	ParamsJSON        []byte
	ResultJSON        []byte
}

func (s *mediaEventReportService) filteredQuery(filter MediaEventReportFilter) *gorm.DB {
	db := s.db.Table("media_event_reports AS reports").
		Joins("JOIN apps AS apps ON apps.id = reports.app_id").
		Joins("JOIN dramas AS dramas ON dramas.id = reports.drama_id")
	if filter.UserID != "" {
		db = db.Where("reports.user_id = ?", filter.UserID)
	}
	if filter.AttributionLinkID != "" {
		db = db.Where("reports.attribution_link_id = ?", filter.AttributionLinkID)
	}
	if filter.AppID > 0 {
		db = db.Where("reports.app_id = ?", filter.AppID)
	}
	if filter.Drama != "" {
		if dramaID, err := strconv.ParseInt(filter.Drama, 10, 64); err == nil && dramaID > 0 {
			db = db.Where("reports.drama_id = ?", dramaID)
		} else {
			db = db.Where("dramas.name LIKE ?", "%"+filter.Drama+"%")
		}
	}
	if filter.EventName != "" {
		db = db.Where("reports.event_name = ?", filter.EventName)
	}
	if filter.Status != "" {
		db = db.Where("reports.status = ?", filter.Status)
	}
	if filter.ReportedAtFrom != nil {
		db = db.Where("reports.created_at >= ?", filter.ReportedAtFrom)
	}
	if filter.ReportedAtTo != nil {
		db = db.Where("reports.created_at < ?", filter.ReportedAtTo)
	}
	return db
}

func selectMediaEventReportItems(db *gorm.DB) ([]MediaEventReportItem, error) {
	var rows []mediaEventReportRow
	if err := db.Select(`
		reports.id, reports.user_id, reports.attribution_link_id, reports.app_id,
		apps.name AS app_name, apps.monetization_type, reports.drama_id, dramas.name AS drama_name, reports.episode_no,
		reports.event_name, reports.status, reports.created_at, reports.params_json, reports.result_json
	`).Order("reports.created_at DESC, reports.id DESC").Scan(&rows).Error; err != nil {
		return nil, err
	}
	items := make([]MediaEventReportItem, len(rows))
	for index, row := range rows {
		params := make(map[string]any)
		if err := json.Unmarshal(row.ParamsJSON, &params); err != nil {
			return nil, err
		}
		result := make(map[string]any)
		if err := json.Unmarshal(row.ResultJSON, &result); err != nil {
			return nil, err
		}
		items[index] = MediaEventReportItem{
			ID:                strconv.FormatInt(row.ID, 10),
			UserID:            strconv.FormatInt(row.UserID, 10),
			AttributionLinkID: promotionLinkIDString(row.AttributionLinkID),
			AppID:             strconv.FormatInt(row.AppID, 10),
			AppName:           row.AppName,
			MonetizationType:  row.MonetizationType,
			DramaID:           strconv.FormatInt(row.DramaID, 10),
			DramaName:         row.DramaName,
			EpisodeNo:         row.EpisodeNo,
			EventName:         row.EventName,
			Status:            row.Status,
			ReportedAt:        datetime.FormatUTC(row.CreatedAt),
			Params:            params,
			Result:            result,
		}
	}
	return items, nil
}

func (s *mediaEventReportService) List(filter MediaEventReportFilter) ([]MediaEventReportItem, int64, error) {
	db := s.filteredQuery(filter)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	page, pageSize := normalizePage(filter.Page, filter.PageSize)
	items, err := selectMediaEventReportItems(db.Offset((page - 1) * pageSize).Limit(pageSize))
	return items, total, err
}

func (s *mediaEventReportService) Iterate(filter MediaEventReportFilter, chunkSize int, yield func([]MediaEventReportItem) error) error {
	if chunkSize <= 0 {
		chunkSize = 500
	}
	for offset := 0; ; offset += chunkSize {
		items, err := selectMediaEventReportItems(s.filteredQuery(filter).Offset(offset).Limit(chunkSize))
		if err != nil {
			return err
		}
		if len(items) == 0 {
			return nil
		}
		if err := yield(items); err != nil {
			return err
		}
		if len(items) < chunkSize {
			return nil
		}
	}
}
