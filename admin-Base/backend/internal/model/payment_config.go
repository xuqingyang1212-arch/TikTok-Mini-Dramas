package model

import "time"

// PaymentConfig 支付配置（每集消耗Beans）
// 优先级：AppID+DramaID > DramaID > AppID > 全局默认
type PaymentConfig struct {
	ID          int64     `gorm:"primaryKey" json:"id"`
	AppID       int64     `gorm:"index;uniqueIndex:uk_payment_config_scope,priority:1;default:0" json:"appId"`   // 小程序ID，0表示所有小程序
	DramaID     int64     `gorm:"index;uniqueIndex:uk_payment_config_scope,priority:2;default:0" json:"dramaId"` // 剧集ID，0表示所有剧集
	BeansPerEp  int       `gorm:"not null;default:100" json:"beansPerEp"`                                        // 每集消耗Beans
	Description string    `gorm:"size:256" json:"description"`                                                   // 配置说明
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

func (PaymentConfig) TableName() string {
	return "payment_configs"
}

// SubscriptionPlan 订阅档位配置
type SubscriptionPlan struct {
	ID          int64     `gorm:"primaryKey" json:"id"`
	AppID       int64     `gorm:"index;not null;uniqueIndex:uk_subscription_app_period,priority:1;uniqueIndex:uk_subscription_app_tier,priority:1" json:"appId"` // 小程序ID
	Period      string    `gorm:"size:32;not null;uniqueIndex:uk_subscription_app_period,priority:2" json:"period"`                                              // 订阅周期：weekly/monthly/quarterly/yearly
	ApplePrice  float64   `gorm:"type:decimal(10,2);not null" json:"applePrice"`                                                                                 // Apple价格（美元）
	GooglePrice float64   `gorm:"type:decimal(10,2);not null" json:"googlePrice"`                                                                                // Google价格（美元）
	WebDiscount int       `gorm:"not null;default:0" json:"webDiscount"`                                                                                         // 网页端折扣百分比，0-100
	TierID      string    `gorm:"size:128;not null;uniqueIndex:uk_subscription_app_tier,priority:2" json:"tierId"`                                               // tier_id
	Status      string    `gorm:"size:16;not null;default:启用" json:"status"`                                                                                     // 启用/禁用
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

func (SubscriptionPlan) TableName() string {
	return "subscription_plans"
}
