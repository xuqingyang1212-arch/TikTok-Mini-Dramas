package model

import "time"

// App 小程序应用
type App struct {
	ID               int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	Name             string    `gorm:"size:128;not null" json:"name"`
	TiktokAppID      string    `gorm:"column:app_id;size:128;uniqueIndex" json:"appId"` // TikTok 小程序 App ID，全局唯一
	ClientKey        string    `gorm:"size:128;not null;uniqueIndex" json:"clientKey"`
	ClientSecret     string    `gorm:"size:256;not null" json:"-"`                                                         // 不返回给前端
	Company          string    `gorm:"size:256;not null" json:"company"`                                                   // 主体信息
	MonetizationType string    `gorm:"column:monetization_type;size:8;not null;default:IAP;index" json:"monetizationType"` // IAA | IAP
	AdPlacementID    string    `gorm:"column:ad_placement_id;size:128" json:"adPlacementId"`                               // IAA 激励广告位 ID
	Status           string    `gorm:"size:16;not null;default:启用" json:"status"`                                          // 启用 | 禁用
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}
