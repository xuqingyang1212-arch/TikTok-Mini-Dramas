package service

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"scaffold-admin/internal/model"
	"scaffold-admin/internal/pkg/snowflake"

	"gorm.io/gorm"
)

// genOrderNo 生成订单号（纯雪花号，示例 342874772350697472）
func genOrderNo() string {
	return fmt.Sprintf("%d", snowflake.NextID())
}

// genThirdPartyOrderNo 生成演示用的第三方（TikTok）订单号，示例 TOID1732533244259
func genThirdPartyOrderNo() string {
	return fmt.Sprintf("TOID%d", time.Now().UnixMilli())
}

// normalizeDeviceOS 规整设备系统枚举，仅接受 Apple / Google，默认 Apple
func normalizeDeviceOS(v string) string {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "google", "android":
		return "Google"
	default:
		return "Apple"
	}
}

// encodeEpisodes 将集数列表编码为逗号分隔字符串
func encodeEpisodes(eps []int) string {
	parts := make([]string, len(eps))
	for i, e := range eps {
		parts[i] = strconv.Itoa(e)
	}
	return strings.Join(parts, ",")
}

// decodeEpisodes 解析逗号分隔字符串为集数列表
func decodeEpisodes(s string) []int {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	eps := make([]int, 0, len(parts))
	for _, p := range parts {
		if n, err := strconv.Atoi(strings.TrimSpace(p)); err == nil {
			eps = append(eps, n)
		}
	}
	return eps
}

// CreateUnlockOrder 创建 Beans 解锁订单（pending）。不校验余额（Beans 由 TikTok 侧维护）。
// 注意：订单以创建时的价格与集数为准形成快照（BeansCost/UnlockCount/EpisodeList），
// 后续支付回调不再重算，避免配置变更影响已下单的订单结算。
func (s *miniPaymentService) CreateUnlockOrder(userID, dramaID int64, tierKey, deviceOS string, currentEpisode int) (*MiniOrderResult, error) {
	u, err := s.getAppUser(userID)
	if err != nil {
		return nil, err
	}

	var result *MiniOrderResult
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := requireIAPApp(tx, u.AppID, true); err != nil {
			return err
		}

		var drama model.Drama
		if err := tx.Where("id = ? AND status = ?", dramaID, "上架").First(&drama).Error; err != nil {
			return ErrDramaNotAvailable
		}

		var activeSubscriptionCount int64
		if err := tx.Model(&model.UserSubscription{}).
			Where("app_id = ? AND user_id = ? AND status = ? AND expire_at > ?", u.AppID, userID, "active", time.Now()).
			Count(&activeSubscriptionCount).Error; err != nil {
			return err
		}
		if activeSubscriptionCount > 0 {
			return ErrNothingToUnlock
		}

		unlocked := make(map[int]bool)
		for i := 1; i < drama.PaywallEpisode && i <= drama.EpisodeCount; i++ {
			unlocked[i] = true
		}
		var permanentUnlocks []model.UserUnlock
		if err := tx.Where("app_id = ? AND user_id = ? AND drama_id = ?", u.AppID, userID, dramaID).
			Find(&permanentUnlocks).Error; err != nil {
			return err
		}
		for _, permanentUnlock := range permanentUnlocks {
			unlocked[permanentUnlock.EpisodeNo] = true
		}

		locked := lockedEpisodesInOrder(drama.EpisodeCount, currentEpisode, unlocked)
		if len(locked) == 0 {
			return ErrNothingToUnlock
		}

		var take int
		switch tierKey {
		case "next5":
			take = 5
		case "next10":
			take = 10
		case "next20":
			take = 20
		case "all":
			take = len(locked)
		default:
			return ErrInvalidTier
		}
		if take > len(locked) {
			take = len(locked)
		}
		target := locked[:take]

		beansPerEp, err := s.payConfig.GetEffectiveConfig(u.AppID, dramaID)
		if err != nil || beansPerEp < 1 {
			beansPerEp = 100
		}

		order := model.PaymentOrder{
			ID:          snowflake.NextID(),
			OrderNo:     genOrderNo(),
			AppID:       u.AppID,
			UserID:      userID,
			OrderType:   "unlock",
			DramaID:     dramaID,
			TierKey:     tierKey,
			EpisodeList: encodeEpisodes(target),
			UnlockCount: len(target),
			BeansCost:   len(target) * beansPerEp,
			DeviceOS:    normalizeDeviceOS(deviceOS),
			PayStatus:   "pending",
		}
		if err := tx.Create(&order).Error; err != nil {
			return err
		}

		result = &MiniOrderResult{
			OrderNo:   order.OrderNo,
			OrderType: order.OrderType,
			PayStatus: order.PayStatus,
			BeansCost: order.BeansCost,
			Episodes:  target,
		}
		return nil
	})
	return result, err
}
