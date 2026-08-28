package service

import (
	"errors"
	"time"

	"scaffold-admin/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrOrderNotFound     = errors.New("order not found")
	ErrDramaNotAvailable = errors.New("drama not available")
	ErrNothingToUnlock   = errors.New("nothing to unlock")
	ErrEpisodeLocked     = errors.New("episode locked")
	ErrInvalidTier       = errors.New("invalid tier")
	ErrPlanNotFound      = errors.New("subscription plan not found")
)

// errAlreadyFinalized 内部哨兵：并发下订单已被其它请求推进到终态，
// 本次不再重复执行解锁/开通。仅用于事务内提前返回，不对外暴露。
var errAlreadyFinalized = errors.New("order already finalized")

type PaywallTier struct {
	Key       string `json:"key"`
	Label     string `json:"label"`
	Episodes  int    `json:"episodes"`
	BeansCost int    `json:"beansCost"`
}

type PaywallSubPlan struct {
	PlanID      string  `json:"planId"`
	Period      string  `json:"period"`
	ApplePrice  float64 `json:"applePrice"`
	GooglePrice float64 `json:"googlePrice"`
	WebDiscount int     `json:"webDiscount"`
	TierID      string  `json:"tierId"`
}

type MiniPaywallResult struct {
	DramaID           string           `json:"dramaId"`
	TotalEpisodes     int              `json:"totalEpisodes"`
	PaywallEpisode    int              `json:"paywallEpisode"`
	BeansPerEp        int              `json:"beansPerEp"`
	UnlockedCount     int              `json:"unlockedCount"`
	RemainingCount    int              `json:"remainingCount"`
	HasSubscription   bool             `json:"hasSubscription"`
	Tiers             []PaywallTier    `json:"tiers"`
	SubscriptionPlans []PaywallSubPlan `json:"subscriptionPlans"`
}

type MiniOrderResult struct {
	OrderNo   string `json:"orderNo"`
	OrderType string `json:"orderType"`
	PayStatus string `json:"payStatus"`
	BeansCost int    `json:"beansCost,omitempty"`
	Episodes  []int  `json:"episodes,omitempty"`
}

type MiniPayResultOutput struct {
	OrderNo   string `json:"orderNo"`
	PayStatus string `json:"payStatus"`
	Unlocked  []int  `json:"unlocked,omitempty"`
}

// MiniSubscriptionRecord 用户一条订阅（会员）支付成功记录
type MiniSubscriptionRecord struct {
	OrderNo  string  `json:"orderNo"`
	Period   string  `json:"period"` // weekly/monthly/quarterly/yearly
	Amount   float64 `json:"amount"` // 实际支付金额（按设备系统取 Apple/Google 价）
	DeviceOS string  `json:"deviceOs"`
	PaidAt   string  `json:"paidAt"` // 支付时间 2006-01-02 15:04:05
}

// MiniUnlockRecord 用户一条 Beans 解锁支付成功记录
type MiniUnlockRecord struct {
	OrderNo     string `json:"orderNo"`
	DramaID     string `json:"dramaId"`
	DramaName   string `json:"dramaName"`
	UnlockCount int    `json:"unlockCount"` // 本单解锁的集数
	Episodes    []int  `json:"episodes"`    // 本单解锁的具体集数
	BeansCost   int    `json:"beansCost"`   // 支付的 Beans
	PaidAt      string `json:"paidAt"`      // 支付时间 2006-01-02 15:04:05
}

// MiniPaymentRecords 用户支付成功记录（订阅 + Beans 解锁）
type MiniPaymentRecords struct {
	Subscriptions []MiniSubscriptionRecord `json:"subscriptions"`
	Unlocks       []MiniUnlockRecord       `json:"unlocks"`
}

type MiniPaymentService interface {
	GetPaywall(dramaID, userID, appID int64, currentEpisode int) (*MiniPaywallResult, error)
	CreateUnlockOrder(userID, dramaID int64, tierKey, deviceOS string, currentEpisode int) (*MiniOrderResult, error)
	CreateSubscriptionOrder(userID, planID, dramaID int64, deviceOS string) (*MiniOrderResult, error)
	SubmitPayResult(orderNo string, success bool) (*MiniPayResultOutput, error)
	UnlockedEpisodes(userID, dramaID int64) (map[int]bool, error)
	HasActiveSubscription(userID int64) bool
	SubscriptionStatus(userID int64) SubscriptionStatusOut
	PaymentRecords(userID int64) (*MiniPaymentRecords, error)
	// ExpireOverdueSubscriptions 将已到期但状态仍为 active 的订阅回写为 expired，
	// 返回受影响行数。用于后台按 status 字段筛选时结果准确。
	ExpireOverdueSubscriptions() (int64, error)
}

type miniPaymentService struct {
	db           *gorm.DB
	payConfig    PaymentConfigService
	entitlements *entitlementResolver
}

// getAppUser 加载小程序用户
func (s *miniPaymentService) getAppUser(userID int64) (*model.AppUser, error) {
	var u model.AppUser
	if err := s.db.First(&u, userID).Error; err != nil {
		return nil, ErrAppUserNotFound
	}
	return &u, nil
}

func (s *miniPaymentService) requireIAPApp(appID int64) error {
	return requireIAPApp(s.db, appID, false)
}

func requireIAPApp(db *gorm.DB, appID int64, lock bool) error {
	var app model.App
	query := db
	if lock {
		query = query.Clauses(clause.Locking{Strength: "UPDATE"})
	}
	if err := query.First(&app, appID).Error; err != nil {
		return ErrAppNotFound
	}
	return requireMonetizationApp(app, monetizationTypeIAP)
}

// hasActiveSubscriptionForApp 判断用户在某小程序下是否有有效订阅
func (s *miniPaymentService) hasActiveSubscriptionForApp(appID, userID int64) bool {
	active, err := hasActiveSubscription(s.db, appID, userID)
	return err == nil && active
}

// SubscriptionStatusOut 会员状态
type SubscriptionStatusOut struct {
	Active   bool
	Period   string
	ExpireAt *time.Time
}
