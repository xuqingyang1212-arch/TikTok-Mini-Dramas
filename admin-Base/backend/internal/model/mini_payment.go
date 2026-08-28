package model

import "time"

// ─── 小程序端支付/解锁相关模型 ─────────────────────────────────────────────
// 演示项目：不对接真实 TikTok Beans / 支付校验。
// Beans 余额由 TikTok 侧维护，本系统只负责“下单 → 支付结果 → 解锁”。

// UserUnlock 用户对某剧集某一集的永久解锁记录。
// 采用“每集一条”的方式，支持 Beans 或激励广告解锁中间集数。
type UserUnlock struct {
	ID          int64     `gorm:"primaryKey" json:"id"`
	AppID       int64     `gorm:"not null;index:idx_unlock_user_drama,priority:1;uniqueIndex:uk_unlock_aude,priority:1" json:"appId"`
	UserID      int64     `gorm:"not null;index:idx_unlock_user_drama,priority:2;uniqueIndex:uk_unlock_aude,priority:2" json:"userId"`
	DramaID     int64     `gorm:"not null;index:idx_unlock_user_drama,priority:3;uniqueIndex:uk_unlock_aude,priority:3" json:"dramaId"`
	EpisodeNo   int       `gorm:"not null;uniqueIndex:uk_unlock_aude,priority:4" json:"episodeNo"`
	UnlockType  string    `gorm:"size:16;not null;default:beans;index" json:"unlockType"` // beans/ad
	OrderID     int64     `gorm:"default:0;index" json:"orderId"`                         // Beans 来源订单
	AdSessionID int64     `gorm:"default:0;index" json:"adSessionId"`                     // 广告来源会话
	CreatedAt   time.Time `json:"createdAt"`
}

func (UserUnlock) TableName() string { return "user_unlocks" }

// AdUnlockSession 记录一次激励广告观看与单集解锁的状态机。
type AdUnlockSession struct {
	ID            int64      `gorm:"primaryKey" json:"id"`
	SessionNo     string     `gorm:"size:64;not null;uniqueIndex" json:"sessionNo"`
	AppID         int64      `gorm:"not null;index:idx_ad_session_target,priority:1" json:"appId"`
	UserID        int64      `gorm:"not null;index:idx_ad_session_target,priority:2" json:"userId"`
	DramaID       int64      `gorm:"not null;index:idx_ad_session_target,priority:3" json:"dramaId"`
	EpisodeNo     int        `gorm:"not null;index:idx_ad_session_target,priority:4" json:"episodeNo"`
	AdPlacementID string     `gorm:"size:128;not null" json:"adPlacementId"`
	Status        string     `gorm:"size:16;not null;default:pending;index:idx_ad_session_target,priority:5" json:"status"` // pending/completed/canceled/expired
	ActiveKey     *string    `gorm:"size:128;uniqueIndex" json:"-"`                                                         // pending 会话目标唯一键，终态置空
	ExpireAt      time.Time  `gorm:"not null;index" json:"expireAt"`
	CompletedAt   *time.Time `json:"completedAt,omitempty"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
}

func (AdUnlockSession) TableName() string { return "ad_unlock_sessions" }

// UserSubscription 用户订阅（会员）记录。会员有效期内所有剧集免费看。
type UserSubscription struct {
	ID        int64     `gorm:"primaryKey" json:"id"`
	AppID     int64     `gorm:"not null;index:idx_sub_user,priority:1" json:"appId"`
	UserID    int64     `gorm:"not null;index:idx_sub_user,priority:2" json:"userId"`
	PlanID    int64     `gorm:"not null" json:"planId"`
	Period    string    `gorm:"size:32;not null" json:"period"` // weekly/monthly/quarterly/yearly
	OrderID   int64     `gorm:"index" json:"orderId"`
	StartAt   time.Time `json:"startAt"`
	ExpireAt  time.Time `json:"expireAt"`
	Status    string    `gorm:"size:16;not null;default:active" json:"status"` // active/expired
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (UserSubscription) TableName() string { return "user_subscriptions" }

// PaymentOrder 支付订单，统一记录 Beans 解锁订单与订阅订单。
type PaymentOrder struct {
	ID        int64  `gorm:"primaryKey" json:"id"`
	OrderNo   string `gorm:"size:64;not null;uniqueIndex" json:"orderNo"`
	AppID     int64  `gorm:"not null;index" json:"appId"`
	UserID    int64  `gorm:"not null;index" json:"userId"`
	OrderType string `gorm:"size:16;not null" json:"orderType"` // unlock / subscription

	// 解锁类订单字段
	DramaID     int64  `gorm:"default:0" json:"dramaId"`
	TierKey     string `gorm:"size:16" json:"tierKey"`       // next5/next10/next20/all
	EpisodeList string `gorm:"size:1024" json:"episodeList"` // 逗号分隔的待解锁集数，如 "9,10,11"
	UnlockCount int    `gorm:"default:0" json:"unlockCount"`
	BeansCost   int    `gorm:"default:0" json:"beansCost"`

	// 订阅类订单字段
	PlanID int64  `gorm:"default:0" json:"planId"`
	Period string `gorm:"size:32" json:"period"`

	// 第三方（TikTok）订单号，支付成功时回填，示例 TOID1732533244259
	ThirdPartyOrderNo string `gorm:"size:64;index" json:"thirdPartyOrderNo"`
	// 设备系统：Apple / Google，下单时由前端传入
	DeviceOS string `gorm:"size:16" json:"deviceOs"`

	PayStatus string     `gorm:"size:16;not null;default:pending" json:"payStatus"` // pending/paid/failed/cancelled
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
	PaidAt    *time.Time `json:"paidAt,omitempty"`
}

func (PaymentOrder) TableName() string { return "payment_orders" }

// WatchLog 观看上报记录。用户开始播放某剧某一集时上报一条。
// 解锁方式（UnlockType）由服务端根据当前解锁状态判定，前端不上报。
type WatchLog struct {
	ID         int64     `gorm:"primaryKey" json:"id"`
	AppID      int64     `gorm:"not null;index:idx_watch_user_drama,priority:1" json:"appId"`
	UserID     int64     `gorm:"not null;index:idx_watch_user_drama,priority:2" json:"userId"`
	DramaID    int64     `gorm:"not null;index:idx_watch_user_drama,priority:3" json:"dramaId"`
	EpisodeNo  int       `gorm:"not null" json:"episodeNo"`
	UnlockType string    `gorm:"size:16;not null" json:"unlockType"` // free/beans/subscription/ad/locked
	WatchedAt  time.Time `gorm:"index" json:"watchedAt"`             // 开始播放（上报）时间
	CreatedAt  time.Time `json:"createdAt"`
}

func (WatchLog) TableName() string { return "watch_logs" }
