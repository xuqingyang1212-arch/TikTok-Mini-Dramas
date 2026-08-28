package service

import (
	"fmt"

	"scaffold-admin/internal/model"
)

// lockedEpisodesInOrder 返回按序号升序排列的、当前仍未解锁的集数列表
func lockedEpisodesInOrder(totalEpisodes, currentEpisode int, unlocked map[int]bool) []int {
	if currentEpisode < 1 {
		currentEpisode = 1
	}
	if currentEpisode > totalEpisodes {
		currentEpisode = totalEpisodes
	}
	locked := make([]int, 0, totalEpisodes-currentEpisode+1)
	for i := currentEpisode; i <= totalEpisodes; i++ {
		if !unlocked[i] {
			locked = append(locked, i)
		}
	}
	return locked
}

// buildTiers 根据剩余未解锁集数构建可选档位。
// 规则：剩余未解锁集数 <= 档位集数 时，隐藏该固定档位；“解锁全部”始终显示。
func buildTiers(remaining, beansPerEp int) []PaywallTier {
	tiers := make([]PaywallTier, 0, 4)
	fixed := []struct {
		key   string
		label string
		n     int
	}{
		{"next5", "后续5集", 5},
		{"next10", "后续10集", 10},
		{"next20", "后续20集", 20},
	}
	for _, f := range fixed {
		if remaining > f.n {
			tiers = append(tiers, PaywallTier{
				Key:       f.key,
				Label:     f.label,
				Episodes:  f.n,
				BeansCost: f.n * beansPerEp,
			})
		}
	}
	if remaining > 0 {
		tiers = append(tiers, PaywallTier{
			Key:       "all",
			Label:     "解锁全部",
			Episodes:  remaining,
			BeansCost: remaining * beansPerEp,
		})
	}
	return tiers
}

// GetPaywall 计算付费面板数据
// appID 为可选入参：未登录（userID<=0）时用于解析订阅档位与每集 Beans 配置；
// 若用户已登录，则以用户实际所属小程序为准。
func (s *miniPaymentService) GetPaywall(dramaID, userID, appID int64, currentEpisode int) (*MiniPaywallResult, error) {
	var drama model.Drama
	if err := s.db.Where("id = ? AND status = ?", dramaID, "上架").First(&drama).Error; err != nil {
		return nil, ErrDramaNotAvailable
	}

	if userID > 0 {
		u, err := s.getAppUser(userID)
		if err != nil {
			return nil, err
		}
		// 用户实际所属小程序优先
		appID = u.AppID
	}

	if appID <= 0 {
		return nil, ErrAppNotFound
	}
	if err := s.requireIAPApp(appID); err != nil {
		return nil, err
	}

	beansPerEp, err := s.payConfig.GetEffectiveConfig(appID, dramaID)
	if err != nil || beansPerEp < 1 {
		beansPerEp = 100
	}

	unlocked, err := s.UnlockedEpisodes(userID, dramaID)
	if err != nil {
		return nil, err
	}
	unlockedCount := 0
	for i := 1; i <= drama.EpisodeCount; i++ {
		if unlocked[i] {
			unlockedCount++
		}
	}
	remaining := len(lockedEpisodesInOrder(drama.EpisodeCount, currentEpisode, unlocked))

	hasSub := userID > 0 && s.hasActiveSubscriptionForApp(appID, userID)

	tiers := buildTiers(remaining, beansPerEp)
	if hasSub {
		tiers = []PaywallTier{}
	}

	// 该小程序的订阅档位
	subPlans := make([]PaywallSubPlan, 0)
	if appID > 0 {
		var plans []model.SubscriptionPlan
		if err := s.db.Where("app_id = ? AND status = ?", appID, "启用").
			Order("apple_price ASC").Find(&plans).Error; err != nil {
			return nil, err
		}
		for _, p := range plans {
			subPlans = append(subPlans, PaywallSubPlan{
				PlanID:      fmt.Sprintf("%d", p.ID),
				Period:      p.Period,
				ApplePrice:  p.ApplePrice,
				GooglePrice: p.GooglePrice,
				WebDiscount: p.WebDiscount,
				TierID:      p.TierID,
			})
		}
	}

	return &MiniPaywallResult{
		DramaID:           fmt.Sprintf("%d", drama.ID),
		TotalEpisodes:     drama.EpisodeCount,
		PaywallEpisode:    drama.PaywallEpisode,
		BeansPerEp:        beansPerEp,
		UnlockedCount:     unlockedCount,
		RemainingCount:    remaining,
		HasSubscription:   hasSub,
		Tiers:             tiers,
		SubscriptionPlans: subPlans,
	}, nil
}
