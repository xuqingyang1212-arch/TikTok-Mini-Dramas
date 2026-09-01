package service

import (
	"fmt"
	"time"

	"scaffold-admin/internal/model"
	"scaffold-admin/internal/pkg/datetime"

	"gorm.io/gorm"
)

// RechargeOrderFilter 充值订单列表筛选条件
type RechargeOrderFilter struct {
	AppID             int64
	OrderNo           string
	ThirdPartyOrderNo string
	DramaID           string
	UserID            string
	OrderType         string // unlock / subscription
	PayStatus         string // pending / paid / failed / cancelled
	DeviceOS          string // Apple / Google
	CreatedAtFrom     *time.Time
	CreatedAtTo       *time.Time
	Page              int
	PageSize          int
}

// RechargeOrderItem 充值订单列表项
type RechargeOrderItem struct {
	ID                string  `json:"id"`
	OrderNo           string  `json:"orderNo"`
	ThirdPartyOrderNo string  `json:"thirdPartyOrderNo"`
	AppID             string  `json:"appId"`
	AppName           string  `json:"appName"`
	UserID            string  `json:"userId"`
	OrderType         string  `json:"orderType"`
	DramaID           string  `json:"dramaId,omitempty"`
	DramaName         string  `json:"dramaName,omitempty"`
	TierKey           string  `json:"tierKey,omitempty"`
	UnlockCount       int     `json:"unlockCount"`
	EpisodeList       string  `json:"episodeList,omitempty"`
	BeansCost         int     `json:"beansCost"`
	Period            string  `json:"period,omitempty"`
	SubscribeAmount   float64 `json:"subscribeAmount"`
	DeviceOS          string  `json:"deviceOs"`
	PayStatus         string  `json:"payStatus"`
	CreatedAt         string  `json:"createdAt"`
	PaidAt            string  `json:"paidAt,omitempty"`
}

type RechargeOrderService interface {
	List(filter RechargeOrderFilter) ([]RechargeOrderItem, int64, error)
	ListAll(filter RechargeOrderFilter) ([]RechargeOrderItem, error)
}

type rechargeOrderService struct {
	db *gorm.DB
}

func (s *rechargeOrderService) applyFilter(f RechargeOrderFilter) (*gorm.DB, error) {
	db := s.db.Model(&model.PaymentOrder{})
	if f.AppID > 0 {
		db = db.Where("app_id = ?", f.AppID)
	}
	if f.OrderNo != "" {
		db = db.Where("order_no LIKE ?", "%"+f.OrderNo+"%")
	}
	if f.ThirdPartyOrderNo != "" {
		db = db.Where("third_party_order_no LIKE ?", "%"+f.ThirdPartyOrderNo+"%")
	}
	if f.DramaID != "" {
		// 充值剧集筛选同时支持剧集ID与剧集名称：
		// 先在 dramas 表里找出「ID 完全相等 或 名称模糊命中」的剧集ID列表，再用 drama_id IN 过滤。
		kw := f.DramaID
		var matchedIDs []int64
		if err := s.db.Model(&model.Drama{}).
			Where("CAST(id AS CHAR) = ? OR name LIKE ?", kw, "%"+kw+"%").
			Pluck("id", &matchedIDs).Error; err != nil {
			return nil, err
		}
		if len(matchedIDs) == 0 {
			// 没有任何剧集命中，直接返回空结果
			db = db.Where("1 = 0")
		} else {
			db = db.Where("drama_id IN ?", matchedIDs)
		}
	}
	if f.UserID != "" {
		db = db.Where("user_id = ?", f.UserID)
	}
	if f.OrderType != "" {
		db = db.Where("order_type = ?", f.OrderType)
	}
	if f.PayStatus != "" {
		db = db.Where("pay_status = ?", f.PayStatus)
	}
	if f.DeviceOS != "" {
		db = db.Where("device_os = ?", f.DeviceOS)
	}
	if f.CreatedAtFrom != nil {
		db = db.Where("created_at >= ?", f.CreatedAtFrom)
	}
	if f.CreatedAtTo != nil {
		db = db.Where("created_at < ?", f.CreatedAtTo)
	}
	return db, nil
}

func (s *rechargeOrderService) List(f RechargeOrderFilter) ([]RechargeOrderItem, int64, error) {
	db, err := s.applyFilter(f)
	if err != nil {
		return nil, 0, err
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page, size := normalizePage(f.Page, f.PageSize)
	var orders []model.PaymentOrder
	if err := db.Order("created_at DESC").
		Offset((page - 1) * size).
		Limit(size).
		Find(&orders).Error; err != nil {
		return nil, 0, err
	}

	items, _, err := s.buildItems(orders)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// ListAll 按筛选返回全部结果（不分页），用于导出。
func (s *rechargeOrderService) ListAll(f RechargeOrderFilter) ([]RechargeOrderItem, error) {
	db, err := s.applyFilter(f)
	if err != nil {
		return nil, err
	}
	var orders []model.PaymentOrder
	if err := db.Order("created_at DESC").Find(&orders).Error; err != nil {
		return nil, err
	}
	items, _, err := s.buildItems(orders)
	return items, err
}

func (s *rechargeOrderService) buildItems(orders []model.PaymentOrder) ([]RechargeOrderItem, int64, error) {
	appIDs := make([]int64, 0, len(orders))
	dramaIDs := make([]int64, 0, len(orders))
	planIDs := make([]int64, 0, len(orders))
	for _, o := range orders {
		appIDs = append(appIDs, o.AppID)
		if o.DramaID > 0 {
			dramaIDs = append(dramaIDs, o.DramaID)
		}
		if o.OrderType == "subscription" && o.Amount <= 0 && o.PlanID > 0 {
			planIDs = append(planIDs, o.PlanID)
		}
	}
	appNames := map[int64]string{}
	if len(appIDs) > 0 {
		var apps []model.App
		if err := s.db.Where("id IN ?", appIDs).Find(&apps).Error; err != nil {
			return nil, 0, err
		}
		for _, a := range apps {
			appNames[a.ID] = a.Name
		}
	}
	dramaNames := map[int64]string{}
	if len(dramaIDs) > 0 {
		var dramas []model.Drama
		if err := s.db.Where("id IN ?", dramaIDs).Find(&dramas).Error; err != nil {
			return nil, 0, err
		}
		for _, d := range dramas {
			dramaNames[d.ID] = d.Name
		}
	}
	plans := map[int64]model.SubscriptionPlan{}
	if len(planIDs) > 0 {
		var ps []model.SubscriptionPlan
		if err := s.db.Where("id IN ?", planIDs).Find(&ps).Error; err != nil {
			return nil, 0, err
		}
		for _, p := range ps {
			plans[p.ID] = p
		}
	}

	items := make([]RechargeOrderItem, len(orders))
	for i, o := range orders {
		item := RechargeOrderItem{
			ID:                fmt.Sprintf("%d", o.ID),
			OrderNo:           o.OrderNo,
			ThirdPartyOrderNo: o.ThirdPartyOrderNo,
			AppID:             fmt.Sprintf("%d", o.AppID),
			AppName:           appNames[o.AppID],
			UserID:            fmt.Sprintf("%d", o.UserID),
			OrderType:         o.OrderType,
			TierKey:           o.TierKey,
			UnlockCount:       o.UnlockCount,
			EpisodeList:       o.EpisodeList,
			BeansCost:         o.BeansCost,
			Period:            o.Period,
			DeviceOS:          o.DeviceOS,
			PayStatus:         o.PayStatus,
			CreatedAt:         datetime.FormatUTC(o.CreatedAt),
		}
		if o.DramaID > 0 {
			item.DramaID = fmt.Sprintf("%d", o.DramaID)
			item.DramaName = dramaNames[o.DramaID]
		}
		if o.OrderType == "subscription" {
			item.SubscribeAmount = subscriptionOrderAmount(o, plans)
		}
		if o.PaidAt != nil {
			item.PaidAt = datetime.FormatUTC(*o.PaidAt)
		}
		items[i] = item
	}
	return items, int64(len(items)), nil
}
