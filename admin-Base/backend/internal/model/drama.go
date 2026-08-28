package model

import "time"

// Drama 剧集
type Drama struct {
	ID             int64     `gorm:"primaryKey" json:"id"`                        // 雪花ID
	Name           string    `gorm:"size:256;not null" json:"name"`               // 剧集名称
	CoverURL       string    `gorm:"size:512" json:"coverUrl"`                    // 封面图URL
	Language       string    `gorm:"size:32;not null;default:中文" json:"language"` // 语种：中文、英文
	EpisodeCount   int       `gorm:"default:0" json:"episodeCount"`               // 总集数
	PaywallEpisode int       `gorm:"default:2" json:"paywallEpisode"`             // 付费卡点集数
	Status         string    `gorm:"size:16;not null;default:下架" json:"status"`   // 状态：上架、下架
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

// TableName 指定表名
func (Drama) TableName() string {
	return "dramas"
}
