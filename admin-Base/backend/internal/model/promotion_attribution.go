package model

import "time"

// PromotionAttributionHistory records every effective last-touch attribution change.
type PromotionAttributionHistory struct {
	ID             int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID         int64     `gorm:"column:user_id;not null;index" json:"userId"`
	PreviousLinkID *int64    `gorm:"column:previous_link_id;index" json:"previousLinkId,omitempty"`
	LinkID         int64     `gorm:"column:link_id;not null;index" json:"linkId"`
	CreatedAt      time.Time `gorm:"column:created_at;not null;index" json:"createdAt"`
}

func (PromotionAttributionHistory) TableName() string {
	return "promotion_attribution_histories"
}
