package service

import (
	"errors"
	"fmt"
	"strings"

	"scaffold-admin/internal/model"
	"scaffold-admin/internal/pkg/snowflake"

	"gorm.io/gorm"
)

// ─── Types ──────────────────────────────────────────────────────────────────

type SubscriptionPlanFilter struct {
	AppID    int64
	Period   string
	TierID   string
	Page     int
	PageSize int
}

type SubscriptionPlanItem struct {
	ID          string  `json:"id"`
	AppID       string  `json:"appId"`
	AppName     string  `json:"appName"`
	Period      string  `json:"period"`
	ApplePrice  float64 `json:"applePrice"`
	GooglePrice float64 `json:"googlePrice"`
	WebDiscount int     `json:"webDiscount"`
	TierID      string  `json:"tierId"`
}

type CreateSubscriptionPlanInput struct {
	AppID       int64
	Period      string
	ApplePrice  float64
	GooglePrice float64
	WebDiscount int
	TierID      string
}

type UpdateSubscriptionPlanInput struct {
	Period      *string
	ApplePrice  *float64
	GooglePrice *float64
	WebDiscount *int
	TierID      *string
}

type SubscriptionService interface {
	List(filter SubscriptionPlanFilter) ([]SubscriptionPlanItem, int64, error)
	GetByID(id int64) (*model.SubscriptionPlan, error)
	Create(input CreateSubscriptionPlanInput) (*model.SubscriptionPlan, error)
	Update(id int64, input UpdateSubscriptionPlanInput) error
	Delete(id int64) error
}

// ─── Errors ─────────────────────────────────────────────────────────────────

var (
	ErrSubscriptionPlanNotFound = errors.New("subscription plan not found")
	ErrDuplicatePeriod          = errors.New("该小程序已存在相同订阅周期的配置")
	ErrDuplicateTierID          = errors.New("该小程序已存在相同tier_id的配置")
)

// ─── Implementation ─────────────────────────────────────────────────────────

type subscriptionService struct {
	db *gorm.DB
}

func (s *subscriptionService) List(f SubscriptionPlanFilter) ([]SubscriptionPlanItem, int64, error) {
	db := s.db.Model(&model.SubscriptionPlan{})

	if f.AppID > 0 {
		db = db.Where("app_id = ?", f.AppID)
	}
	if f.Period != "" {
		db = db.Where("period = ?", f.Period)
	}
	if f.TierID != "" {
		db = db.Where("tier_id LIKE ?", "%"+f.TierID+"%")
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page, size := normalizePage(f.Page, f.PageSize)
	var plans []model.SubscriptionPlan
	err := db.Order("app_id ASC, created_at DESC").
		Offset((page - 1) * size).
		Limit(size).
		Find(&plans).Error
	if err != nil {
		return nil, 0, err
	}

	// 批量获取App名称
	appIDs := make([]int64, 0, len(plans))
	for _, p := range plans {
		appIDs = append(appIDs, p.AppID)
	}
	appNames := make(map[int64]string)
	if len(appIDs) > 0 {
		var apps []model.App
		if err := s.db.Where("id IN ?", appIDs).Find(&apps).Error; err != nil {
			return nil, 0, err
		}
		for _, a := range apps {
			appNames[a.ID] = a.Name
		}
	}

	items := make([]SubscriptionPlanItem, len(plans))
	for i, p := range plans {
		items[i] = SubscriptionPlanItem{
			ID:          fmt.Sprintf("%d", p.ID),
			AppID:       fmt.Sprintf("%d", p.AppID),
			AppName:     appNames[p.AppID],
			Period:      p.Period,
			ApplePrice:  p.ApplePrice,
			GooglePrice: p.GooglePrice,
			WebDiscount: p.WebDiscount,
			TierID:      p.TierID,
		}
	}
	return items, total, nil
}

func (s *subscriptionService) GetByID(id int64) (*model.SubscriptionPlan, error) {
	var plan model.SubscriptionPlan
	if err := s.db.First(&plan, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrSubscriptionPlanNotFound
		}
		return nil, err
	}
	return &plan, nil
}

func (s *subscriptionService) Create(in CreateSubscriptionPlanInput) (*model.SubscriptionPlan, error) {
	// 校验同一小程序下订阅周期唯一
	var count int64
	if err := s.db.Model(&model.SubscriptionPlan{}).
		Where("app_id = ? AND period = ?", in.AppID, in.Period).
		Count(&count).Error; err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, ErrDuplicatePeriod
	}

	// 校验同一小程序下tier_id唯一（tier_id非空时）
	if strings.TrimSpace(in.TierID) != "" {
		if err := s.db.Model(&model.SubscriptionPlan{}).
			Where("app_id = ? AND tier_id = ?", in.AppID, in.TierID).
			Count(&count).Error; err != nil {
			return nil, err
		}
		if count > 0 {
			return nil, ErrDuplicateTierID
		}
	}

	plan := model.SubscriptionPlan{
		ID:          snowflake.NextID(),
		AppID:       in.AppID,
		Period:      in.Period,
		ApplePrice:  in.ApplePrice,
		GooglePrice: in.GooglePrice,
		WebDiscount: in.WebDiscount,
		TierID:      in.TierID,
		Status:      "启用",
	}
	if err := s.db.Create(&plan).Error; err != nil {
		return nil, err
	}
	return &plan, nil
}

func (s *subscriptionService) Update(id int64, in UpdateSubscriptionPlanInput) error {
	plan, err := s.GetByID(id)
	if err != nil {
		return err
	}

	updates := map[string]interface{}{}

	// 如果要更新 period，校验唯一性
	if in.Period != nil {
		var count int64
		if err := s.db.Model(&model.SubscriptionPlan{}).
			Where("app_id = ? AND period = ? AND id != ?", plan.AppID, *in.Period, id).
			Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return ErrDuplicatePeriod
		}
		updates["period"] = *in.Period
	}

	// 如果要更新 tier_id，校验唯一性
	if in.TierID != nil && strings.TrimSpace(*in.TierID) != "" {
		var count int64
		if err := s.db.Model(&model.SubscriptionPlan{}).
			Where("app_id = ? AND tier_id = ? AND id != ?", plan.AppID, *in.TierID, id).
			Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return ErrDuplicateTierID
		}
		updates["tier_id"] = *in.TierID
	} else if in.TierID != nil {
		updates["tier_id"] = ""
	}

	if in.ApplePrice != nil {
		updates["apple_price"] = *in.ApplePrice
	}
	if in.GooglePrice != nil {
		updates["google_price"] = *in.GooglePrice
	}
	if in.WebDiscount != nil {
		updates["web_discount"] = *in.WebDiscount
	}

	if len(updates) == 0 {
		return nil
	}
	return s.db.Model(plan).Updates(updates).Error
}

func (s *subscriptionService) Delete(id int64) error {
	plan, err := s.GetByID(id)
	if err != nil {
		return err
	}
	return s.db.Delete(plan).Error
}
