package service

import (
	"errors"
	"fmt"
	"time"

	"scaffold-admin/internal/model"
	"scaffold-admin/internal/pkg/snowflake"

	"gorm.io/gorm"
)

// periodDuration 返回订阅周期对应的时长
func periodDuration(period string, from time.Time) time.Time {
	switch period {
	case "weekly":
		return from.AddDate(0, 0, 7)
	case "monthly":
		return from.AddDate(0, 1, 0)
	case "quarterly":
		return from.AddDate(0, 3, 0)
	case "half_yearly":
		return from.AddDate(0, 6, 0)
	case "yearly":
		return from.AddDate(1, 0, 0)
	default:
		return from.AddDate(0, 1, 0)
	}
}

// SubmitPayResult 处理演示支付结果：success=true 则解锁/开通，false 则失败。幂等。
func (s *miniPaymentService) SubmitPayResult(orderNo string, success bool) (*MiniPayResultOutput, error) {
	var order model.PaymentOrder
	if err := s.db.Where("order_no = ?", orderNo).First(&order).Error; err != nil {
		return nil, ErrOrderNotFound
	}

	// 幂等：已支付/已失败/已取消均为终态，直接返回当前状态。
	// 支付失败(failed)是终态，不能再变为成功；用户如需重试须重新下单（点击档位创建新订单）。
	if order.PayStatus == "paid" || order.PayStatus == "failed" || order.PayStatus == "cancelled" {
		out := &MiniPayResultOutput{OrderNo: order.OrderNo, PayStatus: order.PayStatus}
		if order.PayStatus == "paid" && order.OrderType == "unlock" {
			out.Unlocked = decodeEpisodes(order.EpisodeList)
		}
		return out, nil
	}

	if !success {
		var result *MiniPayResultOutput
		err := s.db.Transaction(func(tx *gorm.DB) error {
			if err := requireIAPApp(tx, order.AppID, true); err != nil {
				return err
			}
			now := time.Now()
			res := tx.Model(&model.PaymentOrder{}).
				Where("order_no = ? AND pay_status = ?", order.OrderNo, "pending").
				Updates(map[string]interface{}{"pay_status": "failed", "updated_at": now})
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 0 {
				var cur model.PaymentOrder
				if err := tx.Where("order_no = ?", order.OrderNo).First(&cur).Error; err != nil {
					return ErrOrderNotFound
				}
				result = &MiniPayResultOutput{OrderNo: cur.OrderNo, PayStatus: cur.PayStatus}
				if cur.PayStatus == "paid" && cur.OrderType == "unlock" {
					result.Unlocked = decodeEpisodes(cur.EpisodeList)
				}
				return nil
			}
			result = &MiniPayResultOutput{OrderNo: order.OrderNo, PayStatus: "failed"}
			return nil
		})
		return result, err
	}

	// 支付成功：在事务内执行解锁/开通
	var unlockedEps []int
	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := requireIAPApp(tx, order.AppID, true); err != nil {
			return err
		}
		now := time.Now()
		// 只有抢占成功（RowsAffected==1）的那次才继续执行解锁/开通，杜绝并发双花。
		paidAt := now
		claim := tx.Model(&model.PaymentOrder{}).
			Where("order_no = ? AND pay_status = ?", order.OrderNo, "pending").
			Updates(map[string]interface{}{
				"pay_status":           "paid",
				"paid_at":              &paidAt,
				"third_party_order_no": genThirdPartyOrderNo(),
				"updated_at":           now,
			})
		if claim.Error != nil {
			return claim.Error
		}
		if claim.RowsAffected == 0 {
			// 未抢到（已被并发推进到终态），本次不执行任何解锁/开通。
			return errAlreadyFinalized
		}
		if order.OrderType == "unlock" {
			eps := decodeEpisodes(order.EpisodeList)
			for _, ep := range eps {
				// 幂等去重：已解锁则跳过
				var cnt int64
				if err := tx.Model(&model.UserUnlock{}).
					Where("app_id = ? AND user_id = ? AND drama_id = ? AND episode_no = ?", order.AppID, order.UserID, order.DramaID, ep).
					Count(&cnt).Error; err != nil {
					return err
				}
				if cnt > 0 {
					continue
				}
				rec := model.UserUnlock{
					ID:         snowflake.NextID(),
					AppID:      order.AppID,
					UserID:     order.UserID,
					DramaID:    order.DramaID,
					EpisodeNo:  ep,
					UnlockType: "beans",
					OrderID:    order.ID,
					CreatedAt:  now,
				}
				if err := tx.Create(&rec).Error; err != nil {
					return err
				}
			}
			unlockedEps = eps
		} else if order.OrderType == "subscription" {
			start := now
			// 若已有有效订阅，则在原到期时间上叠加续期
			var existing model.UserSubscription
			if err := tx.Where("app_id = ? AND user_id = ? AND status = ? AND expire_at > ?",
				order.AppID, order.UserID, "active", now).
				Order("expire_at DESC").First(&existing).Error; err == nil {
				start = existing.ExpireAt
			}
			sub := model.UserSubscription{
				ID:        snowflake.NextID(),
				AppID:     order.AppID,
				UserID:    order.UserID,
				PlanID:    order.PlanID,
				Period:    order.Period,
				OrderID:   order.ID,
				StartAt:   now,
				ExpireAt:  periodDuration(order.Period, start),
				Status:    "active",
				CreatedAt: now,
			}
			if err := tx.Create(&sub).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, errAlreadyFinalized) {
			// 并发下已被其它请求处理为终态，返回当前真实状态。
			var cur model.PaymentOrder
			if e := s.db.Where("order_no = ?", order.OrderNo).First(&cur).Error; e != nil {
				return nil, ErrOrderNotFound
			}
			out := &MiniPayResultOutput{OrderNo: cur.OrderNo, PayStatus: cur.PayStatus}
			if cur.PayStatus == "paid" && cur.OrderType == "unlock" {
				out.Unlocked = decodeEpisodes(cur.EpisodeList)
			}
			return out, nil
		}
		return nil, err
	}

	out := &MiniPayResultOutput{OrderNo: order.OrderNo, PayStatus: "paid"}
	if order.OrderType == "unlock" {
		out.Unlocked = unlockedEps
	}
	return out, nil
}

// PaymentRecords 返回用户支付成功的订阅记录与 Beans 解锁记录（按支付时间倒序）。
// 仅统计 pay_status = "paid" 的订单；pending / failed / cancelled 不返回。
func (s *miniPaymentService) PaymentRecords(userID int64) (*MiniPaymentRecords, error) {
	if _, err := s.getAppUser(userID); err != nil {
		return nil, err
	}

	var orders []model.PaymentOrder
	if err := s.db.Where("user_id = ? AND pay_status = ?", userID, "paid").
		Order("paid_at DESC").
		Find(&orders).Error; err != nil {
		return nil, err
	}

	// 预取订阅档位（用于按设备系统换算实付金额）与剧集名称
	planIDs := make([]int64, 0, len(orders))
	dramaIDs := make([]int64, 0, len(orders))
	for _, o := range orders {
		if o.OrderType == "subscription" && o.PlanID > 0 {
			planIDs = append(planIDs, o.PlanID)
		}
		if o.OrderType == "unlock" && o.DramaID > 0 {
			dramaIDs = append(dramaIDs, o.DramaID)
		}
	}
	plans := map[int64]model.SubscriptionPlan{}
	if len(planIDs) > 0 {
		var ps []model.SubscriptionPlan
		if err := s.db.Where("id IN ?", planIDs).Find(&ps).Error; err != nil {
			return nil, err
		}
		for _, p := range ps {
			plans[p.ID] = p
		}
	}
	dramaNames := map[int64]string{}
	if len(dramaIDs) > 0 {
		var ds []model.Drama
		if err := s.db.Where("id IN ?", dramaIDs).Find(&ds).Error; err != nil {
			return nil, err
		}
		for _, d := range ds {
			dramaNames[d.ID] = d.Name
		}
	}

	const layout = "2006-01-02 15:04:05"
	result := &MiniPaymentRecords{
		Subscriptions: make([]MiniSubscriptionRecord, 0),
		Unlocks:       make([]MiniUnlockRecord, 0),
	}
	for _, o := range orders {
		paidAt := ""
		if o.PaidAt != nil {
			paidAt = o.PaidAt.Format(layout)
		}
		switch o.OrderType {
		case "subscription":
			amount := 0.0
			if p, ok := plans[o.PlanID]; ok {
				if o.DeviceOS == "Google" {
					amount = p.GooglePrice
				} else {
					amount = p.ApplePrice
				}
			}
			result.Subscriptions = append(result.Subscriptions, MiniSubscriptionRecord{
				OrderNo:  o.OrderNo,
				Period:   o.Period,
				Amount:   amount,
				DeviceOS: o.DeviceOS,
				PaidAt:   paidAt,
			})
		case "unlock":
			result.Unlocks = append(result.Unlocks, MiniUnlockRecord{
				OrderNo:     o.OrderNo,
				DramaID:     fmt.Sprintf("%d", o.DramaID),
				DramaName:   dramaNames[o.DramaID],
				UnlockCount: o.UnlockCount,
				Episodes:    decodeEpisodes(o.EpisodeList),
				BeansCost:   o.BeansCost,
				PaidAt:      paidAt,
			})
		}
	}
	return result, nil
}

// ExpireOverdueSubscriptions 将已到期但状态仍为 active 的订阅批量回写为 expired，
// 返回受影响行数。查询逻辑本身按 expire_at 判定有效性，此处仅保证 status 字段一致，
// 便于后台按 status 精确筛选。
func (s *miniPaymentService) ExpireOverdueSubscriptions() (int64, error) {
	res := s.db.Model(&model.UserSubscription{}).
		Where("status = ? AND expire_at <= ?", "active", time.Now()).
		Update("status", "expired")
	return res.RowsAffected, res.Error
}
