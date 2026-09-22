package service

import (
	"strconv"

	"gorm.io/gorm"
)

type PromotionLinkListFilter struct {
	Name     string
	AppID    string
	Drama    string
	LinkID   string
	Page     int
	PageSize int
}

type PromotionLinkListItem struct {
	LinkID           string `json:"linkId"`
	Name             string `json:"name"`
	AppID            string `json:"appId"`
	TiktokAppID      string `json:"tiktokAppId"`
	AppName          string `json:"appName"`
	MonetizationType string `json:"monetizationType"`
	DramaID          string `json:"dramaId"`
	DramaName        string `json:"dramaName"`
	PaywallEpisode   int    `json:"paywallEpisode"`
	BeansPerEp       *int   `json:"beansPerEp"`
	CreatorName      string `json:"creatorName"`
	PromotionURL     string `json:"promotionUrl"`
}

type PromotionLinkService interface {
	List(filter PromotionLinkListFilter) ([]PromotionLinkListItem, int64, error)
	Iterate(filter PromotionLinkListFilter, chunkSize int, yield func([]PromotionLinkListItem) error) error
	Create(input CreatePromotionLinkInput) (*CreatePromotionLinkResult, error)
	RefreshPromotionURLs(mobileBaseURL string) error
	ReportUserActivation(userID int64, linkID *int64) (*UserActivationResult, error)
}

type promotionLinkService struct {
	db *gorm.DB
}

type promotionLinkListRow struct {
	LinkID           int64
	Name             string
	AppID            int64
	TiktokAppID      string
	AppName          string
	MonetizationType string
	DramaID          int64
	DramaName        string
	PaywallEpisode   int
	BeansPerEp       *int
	CreatorName      string
	PromotionURL     string
}

func (s *promotionLinkService) filteredListQuery(f PromotionLinkListFilter) *gorm.DB {
	db := s.db.Table("promotion_links AS promotion_links").
		Joins("JOIN apps AS apps ON apps.id = promotion_links.app_id").
		Joins("JOIN dramas AS dramas ON dramas.id = promotion_links.drama_id").
		Joins("JOIN users AS creators ON creators.id = promotion_links.created_by")

	if f.Name != "" {
		db = db.Where("promotion_links.name LIKE ?", "%"+f.Name+"%")
	}
	if f.AppID != "" {
		if appID, err := strconv.ParseInt(f.AppID, 10, 64); err == nil && appID > 0 {
			db = db.Where("promotion_links.app_id = ?", appID)
		} else {
			db = db.Where("1 = 0")
		}
	}
	if f.Drama != "" {
		if dramaID, err := strconv.ParseInt(f.Drama, 10, 64); err == nil && dramaID > 0 {
			db = db.Where("promotion_links.drama_id = ?", dramaID)
		} else {
			db = db.Where("dramas.name LIKE ?", "%"+f.Drama+"%")
		}
	}
	if f.LinkID != "" {
		if linkID, err := strconv.ParseInt(f.LinkID, 10, 64); err == nil && linkID > 0 {
			db = db.Where("promotion_links.link_id = ?", linkID)
		} else {
			db = db.Where("1 = 0")
		}
	}
	return db
}

func selectPromotionLinkRows(db *gorm.DB) ([]PromotionLinkListItem, error) {
	var rows []promotionLinkListRow
	if err := db.Select(`
		promotion_links.link_id,
		promotion_links.name,
		promotion_links.app_id,
		apps.app_id AS tiktok_app_id,
		apps.name AS app_name,
		apps.monetization_type,
		promotion_links.drama_id,
		dramas.name AS drama_name,
		promotion_links.paywall_episode,
		promotion_links.beans_per_ep,
		creators.name AS creator_name,
		promotion_links.promotion_url
	`).Order("promotion_links.link_id DESC").Scan(&rows).Error; err != nil {
		return nil, err
	}

	items := make([]PromotionLinkListItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, PromotionLinkListItem{
			LinkID:           strconv.FormatInt(row.LinkID, 10),
			Name:             row.Name,
			AppID:            strconv.FormatInt(row.AppID, 10),
			TiktokAppID:      row.TiktokAppID,
			AppName:          row.AppName,
			MonetizationType: row.MonetizationType,
			DramaID:          strconv.FormatInt(row.DramaID, 10),
			DramaName:        row.DramaName,
			PaywallEpisode:   row.PaywallEpisode,
			BeansPerEp:       row.BeansPerEp,
			CreatorName:      row.CreatorName,
			PromotionURL:     row.PromotionURL,
		})
	}
	return items, nil
}

func (s *promotionLinkService) List(f PromotionLinkListFilter) ([]PromotionLinkListItem, int64, error) {
	db := s.filteredListQuery(f)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page, size := normalizePage(f.Page, f.PageSize)
	items, err := selectPromotionLinkRows(db.Offset((page - 1) * size).Limit(size))
	return items, total, err
}

func (s *promotionLinkService) Iterate(f PromotionLinkListFilter, chunkSize int, yield func([]PromotionLinkListItem) error) error {
	if chunkSize <= 0 {
		chunkSize = 500
	}
	for offset := 0; ; offset += chunkSize {
		items, err := selectPromotionLinkRows(s.filteredListQuery(f).Offset(offset).Limit(chunkSize))
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
