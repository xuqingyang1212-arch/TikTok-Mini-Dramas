package service

import (
	"scaffold-admin/internal/model"
	"scaffold-admin/internal/pkg/datetime"
)

// subscriptionOrderAmount returns the immutable amount saved on the order.
// Orders created before snapshots were introduced fall back to the current
// plan price for backward compatibility. PlanSnapshot distinguishes a real
// zero-price order from legacy rows whose amount defaulted to zero.
func subscriptionOrderAmount(order model.PaymentOrder, plans map[int64]model.SubscriptionPlan) float64 {
	if order.PlanSnapshot != "" || order.Amount > 0 {
		return order.Amount
	}
	plan, ok := plans[order.PlanID]
	if !ok {
		return 0
	}
	if order.DeviceOS == "Google" {
		return plan.GooglePrice
	}
	return plan.ApplePrice
}

// Subscriptions 分页返回用户会员订阅记录（仅成功订单）
func (s *appUserService) Subscriptions(id int64, page, pageSize int) ([]AppUserSubscriptionRecord, int64, error) {
	pg, size := normalizePage(page, pageSize)
	return s.querySubscriptionRecords(id, size, (pg-1)*size)
}

func (s *appUserService) querySubscriptionRecords(id int64, limit, offset int) ([]AppUserSubscriptionRecord, int64, error) {
	base := s.db.Model(&model.PaymentOrder{}).
		Where("user_id = ? AND pay_status = ? AND order_type = ?", id, "paid", "subscription")

	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var orders []model.PaymentOrder
	query := base.Order("paid_at DESC")
	if limit > 0 {
		query = query.Offset(offset).Limit(limit)
	}
	if err := query.Find(&orders).Error; err != nil {
		return nil, 0, err
	}

	planIDs := make([]int64, 0, len(orders))
	for _, order := range orders {
		if order.PlanSnapshot == "" && order.Amount <= 0 && order.PlanID > 0 {
			planIDs = append(planIDs, order.PlanID)
		}
	}
	plans := map[int64]model.SubscriptionPlan{}
	if len(planIDs) > 0 {
		var planList []model.SubscriptionPlan
		if err := s.db.Where("id IN ?", planIDs).Find(&planList).Error; err != nil {
			return nil, 0, err
		}
		for _, plan := range planList {
			plans[plan.ID] = plan
		}
	}

	items := make([]AppUserSubscriptionRecord, 0, len(orders))
	for _, order := range orders {
		paidAt := ""
		if order.PaidAt != nil {
			paidAt = datetime.FormatUTC(*order.PaidAt)
		}
		items = append(items, AppUserSubscriptionRecord{
			Period:  order.Period,
			Amount:  subscriptionOrderAmount(order, plans),
			PaidAt:  paidAt,
			OrderNo: order.OrderNo,
		})
	}
	return items, total, nil
}
