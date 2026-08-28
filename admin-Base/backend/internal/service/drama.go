package service

import (
	"errors"
	"fmt"
	"time"

	"scaffold-admin/internal/model"
	"scaffold-admin/internal/pkg/snowflake"

	"gorm.io/gorm"
)

// ─── Types ──────────────────────────────────────────────────────────────────

type DramaListFilter struct {
	DramaID       string
	Name          string
	Language      string
	Status        string
	CreatedAtFrom *time.Time
	CreatedAtTo   *time.Time
	Page          int
	PageSize      int
}

type DramaListItem struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	CoverURL       string    `json:"coverUrl"`
	Language       string    `json:"language"`
	EpisodeCount   int       `json:"episodeCount"`
	PaywallEpisode int       `json:"paywallEpisode"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"createdAt"`
}

type CreateDramaInput struct {
	Name           string
	CoverURL       string
	Language       string
	PaywallEpisode int
}

type UpdateDramaInput struct {
	Name           *string
	CoverURL       *string
	Language       *string
	Status         *string
	PaywallEpisode *int
}

type DramaService interface {
	List(filter DramaListFilter) ([]DramaListItem, int64, error)
	GetByID(id int64) (*model.Drama, error)
	Create(input CreateDramaInput) (*model.Drama, error)
	Update(id int64, input UpdateDramaInput) error
	ToggleStatus(id int64) error
}

// ─── Errors ─────────────────────────────────────────────────────────────────

var (
	ErrDramaNotFound          = errors.New("drama not found")
	ErrDramaNoEpisodes        = errors.New("cannot publish drama without episodes")
	ErrDramaPaywallExceedsEps = errors.New("paywall episode exceeds total episodes")
)

// ─── Implementation ─────────────────────────────────────────────────────────

type dramaService struct {
	db *gorm.DB
}

func (s *dramaService) List(f DramaListFilter) ([]DramaListItem, int64, error) {
	db := s.db.Model(&model.Drama{})

	if f.DramaID != "" {
		db = db.Where("CAST(id AS CHAR) LIKE ?", "%"+f.DramaID+"%")
	}
	if f.Name != "" {
		db = db.Where("name LIKE ?", "%"+f.Name+"%")
	}
	if f.Language != "" {
		db = db.Where("language = ?", f.Language)
	}
	if f.Status != "" {
		db = db.Where("status = ?", f.Status)
	}
	if f.CreatedAtFrom != nil {
		db = db.Where("created_at >= ?", f.CreatedAtFrom)
	}
	if f.CreatedAtTo != nil {
		db = db.Where("created_at <= ?", f.CreatedAtTo)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page, size := normalizePage(f.Page, f.PageSize)
	var dramas []model.Drama
	err := db.Order("created_at DESC").
		Offset((page - 1) * size).
		Limit(size).
		Find(&dramas).Error
	if err != nil {
		return nil, 0, err
	}

	items := make([]DramaListItem, len(dramas))
	for i, d := range dramas {
		items[i] = DramaListItem{
			ID:             fmt.Sprintf("%d", d.ID),
			Name:           d.Name,
			CoverURL:       d.CoverURL,
			Language:       d.Language,
			EpisodeCount:   d.EpisodeCount,
			PaywallEpisode: d.PaywallEpisode,
			Status:         d.Status,
			CreatedAt:      d.CreatedAt,
		}
	}
	return items, total, nil
}

func (s *dramaService) GetByID(id int64) (*model.Drama, error) {
	var drama model.Drama
	if err := s.db.First(&drama, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDramaNotFound
		}
		return nil, err
	}
	return &drama, nil
}

func (s *dramaService) Create(in CreateDramaInput) (*model.Drama, error) {
	paywallEp := in.PaywallEpisode
	if paywallEp < 1 {
		paywallEp = 2 // 默认卡点第2集
	}
	drama := model.Drama{
		ID:             snowflake.NextID(),
		Name:           in.Name,
		CoverURL:       in.CoverURL,
		Language:       in.Language,
		PaywallEpisode: paywallEp,
		Status:         "下架",
	}
	if err := s.db.Create(&drama).Error; err != nil {
		return nil, err
	}
	return &drama, nil
}

func (s *dramaService) Update(id int64, in UpdateDramaInput) error {
	drama, err := s.GetByID(id)
	if err != nil {
		return err
	}

	updates := map[string]interface{}{}
	if in.Name != nil {
		updates["name"] = *in.Name
	}
	if in.CoverURL != nil {
		updates["cover_url"] = *in.CoverURL
	}
	if in.Language != nil {
		updates["language"] = *in.Language
	}
	if in.Status != nil {
		updates["status"] = *in.Status
	}
	if in.PaywallEpisode != nil {
		pw := *in.PaywallEpisode
		if pw < 1 {
			pw = 1
		}
		// 如果剧集有集数，卡点不能超过总集数（不管上架还是下架）
		if drama.EpisodeCount > 0 && pw > drama.EpisodeCount {
			return ErrDramaPaywallExceedsEps
		}
		updates["paywall_episode"] = pw
	}

	if len(updates) == 0 {
		return nil
	}
	return s.db.Model(drama).Updates(updates).Error
}

func (s *dramaService) ToggleStatus(id int64) error {
	drama, err := s.GetByID(id)
	if err != nil {
		return err
	}

	newStatus := "上架"
	if drama.Status == "上架" {
		newStatus = "下架"
	} else {
		// 上架时检查总集数
		if drama.EpisodeCount == 0 {
			return ErrDramaNoEpisodes
		}
		// 上架时检查付费卡点不超过总集数
		if drama.PaywallEpisode > drama.EpisodeCount {
			return ErrDramaPaywallExceedsEps
		}
	}
	return s.db.Model(drama).Update("status", newStatus).Error
}
