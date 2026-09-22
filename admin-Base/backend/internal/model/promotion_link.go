package model

import "time"

// PromotionLink 推广链接。应用名、变现类型和剧集名通过关联表实时读取。
type PromotionLink struct {
	LinkID         int64     `gorm:"column:link_id;primaryKey;autoIncrement" json:"linkId"`
	Name           string    `gorm:"size:128;not null;index" json:"name"`
	AppID          int64     `gorm:"column:app_id;not null;index" json:"appId"`
	DramaID        int64     `gorm:"column:drama_id;not null;index" json:"dramaId"`
	PaywallEpisode int       `gorm:"column:paywall_episode;not null;default:0" json:"paywallEpisode"`
	BeansPerEp     *int      `gorm:"column:beans_per_ep" json:"beansPerEp"`
	CreatedBy      int64     `gorm:"column:created_by;not null;index" json:"createdBy"`
	PromotionURL   string    `gorm:"column:promotion_url;size:1024;not null;default:''" json:"promotionUrl"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}
