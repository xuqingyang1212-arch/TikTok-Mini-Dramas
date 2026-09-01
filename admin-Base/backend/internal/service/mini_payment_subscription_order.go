package service

import (
	"encoding/json"

	"scaffold-admin/internal/model"
	"scaffold-admin/internal/pkg/snowflake"

	"gorm.io/gorm"
)

// CreateSubscriptionOrder 创建订阅订单（pending）
// 注意：订单以创建时的订阅金额为准形成快照（Amount），后续支付回调不再重算，
// 避免订阅档位价格变更影响已下单的订单结算。
func (s *miniPaymentService) CreateSubscriptionOrder(userID, planID, dramaID int64, deviceOS string) (*MiniOrderResult, error) {
	u, err := s.getAppUser(userID)
	if err != nil {
		return nil, err
	}

	var result *MiniOrderResult
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := requireIAPApp(tx, u.AppID, true); err != nil {
			return err
		}

		var plan model.SubscriptionPlan
		if err := tx.Where("id = ? AND app_id = ?", planID, u.AppID).First(&plan).Error; err != nil {
			return ErrPlanNotFound
		}

		normalizedOS := normalizeDeviceOS(deviceOS)
		amount := plan.ApplePrice
		if normalizedOS == "Google" {
			amount = plan.GooglePrice
		}
		planSnapshot, err := json.Marshal(struct {
			Period      string  `json:"period"`
			ApplePrice  float64 `json:"applePrice"`
			GooglePrice float64 `json:"googlePrice"`
			WebDiscount int     `json:"webDiscount"`
			TierID      string  `json:"tierId"`
		}{
			Period:      plan.Period,
			ApplePrice:  plan.ApplePrice,
			GooglePrice: plan.GooglePrice,
			WebDiscount: plan.WebDiscount,
			TierID:      plan.TierID,
		})
		if err != nil {
			return err
		}

		order := model.PaymentOrder{
			ID:           snowflake.NextID(),
			OrderNo:      genOrderNo(),
			AppID:        u.AppID,
			UserID:       userID,
			OrderType:    "subscription",
			DramaID:      dramaID,
			PlanID:       plan.ID,
			Period:       plan.Period,
			Amount:       amount,
			Currency:     "USD",
			PlanTierID:   plan.TierID,
			PlanSnapshot: string(planSnapshot),
			DeviceOS:     normalizedOS,
			PayStatus:    "pending",
		}
		if err := tx.Create(&order).Error; err != nil {
			return err
		}

		result = &MiniOrderResult{
			OrderNo:   order.OrderNo,
			OrderType: order.OrderType,
			PayStatus: order.PayStatus,
		}
		return nil
	})
	return result, err
}
