package service

import (
	"strconv"
	"time"

	"scaffold-admin/internal/pkg/datetime"

	"gorm.io/gorm"
)

type AdSessionFilter struct {
	UserID            string
	AttributionLinkID string
	AppID             int64
	DramaID           string
	Status            string
	CreatedAtFrom     *time.Time
	CreatedAtTo       *time.Time
	Page              int
	PageSize          int
}

type AdSessionItem struct {
	ID                string  `json:"id"`
	SessionNo         string  `json:"sessionNo"`
	UserID            string  `json:"userId"`
	AttributionLinkID *string `json:"attributionLinkId"`
	AppID             string  `json:"appId"`
	AppName           string  `json:"appName"`
	DramaID           string  `json:"dramaId"`
	EpisodeNo         int     `json:"episodeNo"`
	Status            string  `json:"status"`
	CreatedAt         string  `json:"createdAt"`
	CompletedAt       string  `json:"completedAt,omitempty"`
}

type AdSessionService interface {
	List(filter AdSessionFilter) ([]AdSessionItem, int64, error)
	Iterate(filter AdSessionFilter, chunkSize int, yield func([]AdSessionItem) error) error
}

type adSessionService struct {
	db *gorm.DB
}

type adSessionRow struct {
	ID                int64
	SessionNo         string
	UserID            int64
	AttributionLinkID *int64
	AppID             int64
	AppName           string
	DramaID           int64
	EpisodeNo         int
	Status            string
	CreatedAt         time.Time
	CompletedAt       *time.Time
}

func (s *adSessionService) filteredQuery(f AdSessionFilter) *gorm.DB {
	db := s.db.Table("ad_unlock_sessions AS sessions").
		Joins("JOIN apps AS apps ON apps.id = sessions.app_id")
	if f.UserID != "" {
		db = db.Where("sessions.user_id = ?", f.UserID)
	}
	if f.AttributionLinkID != "" {
		db = db.Where("sessions.attribution_link_id = ?", f.AttributionLinkID)
	}
	if f.AppID > 0 {
		db = db.Where("sessions.app_id = ?", f.AppID)
	}
	if f.DramaID != "" {
		db = db.Where("sessions.drama_id = ?", f.DramaID)
	}
	if f.Status != "" {
		db = db.Where("sessions.status = ?", f.Status)
	}
	if f.CreatedAtFrom != nil {
		db = db.Where("sessions.created_at >= ?", f.CreatedAtFrom)
	}
	if f.CreatedAtTo != nil {
		db = db.Where("sessions.created_at < ?", f.CreatedAtTo)
	}
	return db
}

func selectAdSessionItems(db *gorm.DB) ([]AdSessionItem, error) {
	var rows []adSessionRow
	if err := db.Select(`
		sessions.id, sessions.session_no, sessions.user_id, sessions.attribution_link_id,
		sessions.app_id, apps.name AS app_name, sessions.drama_id,
		sessions.episode_no, sessions.status, sessions.created_at, sessions.completed_at
	`).Order("sessions.created_at DESC, sessions.id DESC").Scan(&rows).Error; err != nil {
		return nil, err
	}
	items := make([]AdSessionItem, len(rows))
	for i, row := range rows {
		items[i] = AdSessionItem{
			ID:                strconv.FormatInt(row.ID, 10),
			SessionNo:         row.SessionNo,
			UserID:            strconv.FormatInt(row.UserID, 10),
			AttributionLinkID: promotionLinkIDString(row.AttributionLinkID),
			AppID:             strconv.FormatInt(row.AppID, 10),
			AppName:           row.AppName,
			DramaID:           strconv.FormatInt(row.DramaID, 10),
			EpisodeNo:         row.EpisodeNo,
			Status:            row.Status,
			CreatedAt:         datetime.FormatUTC(row.CreatedAt),
		}
		if row.CompletedAt != nil {
			items[i].CompletedAt = datetime.FormatUTC(*row.CompletedAt)
		}
	}
	return items, nil
}

func (s *adSessionService) List(f AdSessionFilter) ([]AdSessionItem, int64, error) {
	db := s.filteredQuery(f)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	page, size := normalizePage(f.Page, f.PageSize)
	items, err := selectAdSessionItems(db.Offset((page - 1) * size).Limit(size))
	return items, total, err
}

func (s *adSessionService) Iterate(f AdSessionFilter, chunkSize int, yield func([]AdSessionItem) error) error {
	if chunkSize <= 0 {
		chunkSize = 500
	}
	for offset := 0; ; offset += chunkSize {
		items, err := selectAdSessionItems(s.filteredQuery(f).Offset(offset).Limit(chunkSize))
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
