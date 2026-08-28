package model

import "time"

// AppUser 小程序用户（TikTok Mini 用户）
type AppUser struct {
	ID        int64     `gorm:"primaryKey" json:"id"`                                               // 雪花ID，如 341417945645711360
	AppID     int64     `gorm:"not null;uniqueIndex:uk_app_open,priority:1;index" json:"appId"`     // 关联的小程序ID
	OpenID    string    `gorm:"size:128;not null;uniqueIndex:uk_app_open,priority:2" json:"openId"` // TikTok openid（同一 openid 在不同小程序视为不同用户）
	UnionID   string    `gorm:"column:union_id;size:128;index" json:"unionId"`                      // TikTok union_id（同一开发者账号下的不同小程序保持一致）
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`

	// 关联
	App *App `gorm:"foreignKey:AppID" json:"app,omitempty"`
}

// TableName 指定表名
func (AppUser) TableName() string {
	return "app_users"
}
