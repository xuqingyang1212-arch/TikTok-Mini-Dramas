package service

import (
	"time"

	"scaffold-admin/internal/model"
)

// HasActiveSubscription 便捷方法：根据 userID 自动解析 appID
func (s *miniPaymentService) HasActiveSubscription(userID int64) bool {
	u, err := s.getAppUser(userID)
	if err != nil || s.requireIAPApp(u.AppID) != nil {
		return false
	}
	return s.hasActiveSubscriptionForApp(u.AppID, userID)
}

// SubscriptionStatus 返回用户当前有效会员状态（取到期时间最晚的一条）
func (s *miniPaymentService) SubscriptionStatus(userID int64) SubscriptionStatusOut {
	u, err := s.getAppUser(userID)
	if err != nil || s.requireIAPApp(u.AppID) != nil {
		return SubscriptionStatusOut{}
	}
	var sub model.UserSubscription
	err = s.db.Where("app_id = ? AND user_id = ? AND status = ? AND expire_at > ?",
		u.AppID, userID, "active", time.Now()).
		Order("expire_at DESC").First(&sub).Error
	if err != nil {
		return SubscriptionStatusOut{}
	}
	return SubscriptionStatusOut{Active: true, Period: sub.Period, ExpireAt: &sub.ExpireAt}
}

// UnlockedEpisodes 返回该用户对该剧“已可观看”的集数集合（免费 + 永久权益 + 订阅覆盖）
func (s *miniPaymentService) UnlockedEpisodes(userID, dramaID int64) (map[int]bool, error) {
	var drama model.Drama
	if err := s.db.First(&drama, dramaID).Error; err != nil {
		return nil, ErrDramaNotAvailable
	}

	entitlements, err := s.entitlements.resolve(drama, userID)
	if err != nil {
		return nil, err
	}
	set := make(map[int]bool, len(entitlements.UnlockTypes))
	for episodeNo, unlockType := range entitlements.UnlockTypes {
		if unlockType != unlockTypeLocked {
			set[episodeNo] = true
		}
	}
	return set, nil
}
