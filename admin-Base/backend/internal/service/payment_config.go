package service

import (
	"errors"
	"fmt"
	"time"

	"scaffold-admin/internal/model"
	"scaffold-admin/internal/pkg/snowflake"

	"gorm.io/gorm"
)

// ─── Types ──────────────────────────────────────────────────────────────────

type PaymentConfigFilter struct {
	AppID    int64
	DramaID  int64
	Page     int
	PageSize int
}

type PaymentConfigItem struct {
	ID          string    `json:"id"`
	AppID       string    `json:"appId"`
	AppName     string    `json:"appName"`
	DramaID     string    `json:"dramaId"`
	DramaName   string    `json:"dramaName"`
	BeansPerEp  int       `json:"beansPerEp"`
	Description string    `json:"description"`
	ConfigType  string    `json:"configType"` // 全局、小程序级、剧集级、小程序+剧集级
	CreatedAt   time.Time `json:"createdAt"`
}

type CreatePaymentConfigInput struct {
	AppID       int64
	DramaID     int64
	BeansPerEp  int
	Description string
}

type UpdatePaymentConfigInput struct {
	BeansPerEp  *int
	Description *string
}

type PaymentConfigService interface {
	List(filter PaymentConfigFilter) ([]PaymentConfigItem, int64, error)
	GetByID(id int64) (*model.PaymentConfig, error)
	Create(input CreatePaymentConfigInput) (*model.PaymentConfig, error)
	Update(id int64, input UpdatePaymentConfigInput) error
	Delete(id int64) error
	GetEffectiveConfig(appID, dramaID int64) (int, error) // 获取生效的Beans配置
	EnsureGlobalDefault() error                           // 确保全局默认配置存在
}

// ─── Errors ─────────────────────────────────────────────────────────────────

var (
	ErrPaymentConfigNotFound  = errors.New("payment config not found")
	ErrPaymentConfigDuplicate = errors.New("payment config already exists for this scope")
)

// ─── Implementation ─────────────────────────────────────────────────────────

type paymentConfigService struct {
	db *gorm.DB
}

func (s *paymentConfigService) List(f PaymentConfigFilter) ([]PaymentConfigItem, int64, error) {
	db := s.db.Model(&model.PaymentConfig{})

	if f.AppID > 0 {
		db = db.Where("app_id = ?", f.AppID)
	}
	if f.DramaID > 0 {
		db = db.Where("drama_id = ?", f.DramaID)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page, size := normalizePage(f.Page, f.PageSize)
	var configs []model.PaymentConfig
	// 排序：全局 > 小程序级 > 剧集级 > 小程序+剧集级
	err := db.Order("app_id ASC, drama_id ASC, created_at DESC").
		Offset((page - 1) * size).
		Limit(size).
		Find(&configs).Error
	if err != nil {
		return nil, 0, err
	}

	// 批量获取App和Drama名称
	appIDs := make([]int64, 0)
	dramaIDs := make([]int64, 0)
	for _, c := range configs {
		if c.AppID > 0 {
			appIDs = append(appIDs, c.AppID)
		}
		if c.DramaID > 0 {
			dramaIDs = append(dramaIDs, c.DramaID)
		}
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

	dramaNames := make(map[int64]string)
	if len(dramaIDs) > 0 {
		var dramas []model.Drama
		if err := s.db.Where("id IN ?", dramaIDs).Find(&dramas).Error; err != nil {
			return nil, 0, err
		}
		for _, d := range dramas {
			dramaNames[d.ID] = d.Name
		}
	}

	items := make([]PaymentConfigItem, len(configs))
	for i, c := range configs {
		configType := "全局默认"
		if c.AppID > 0 && c.DramaID > 0 {
			configType = "小程序+剧集"
		} else if c.AppID > 0 {
			configType = "小程序级"
		} else if c.DramaID > 0 {
			configType = "剧集级"
		}

		appName := "所有小程序"
		if c.AppID > 0 {
			appName = appNames[c.AppID]
		}
		dramaName := "所有剧集"
		if c.DramaID > 0 {
			dramaName = dramaNames[c.DramaID]
		}

		items[i] = PaymentConfigItem{
			ID:          fmt.Sprintf("%d", c.ID),
			AppID:       fmt.Sprintf("%d", c.AppID),
			AppName:     appName,
			DramaID:     fmt.Sprintf("%d", c.DramaID),
			DramaName:   dramaName,
			BeansPerEp:  c.BeansPerEp,
			Description: c.Description,
			ConfigType:  configType,
			CreatedAt:   c.CreatedAt,
		}
	}
	return items, total, nil
}

func (s *paymentConfigService) GetByID(id int64) (*model.PaymentConfig, error) {
	var config model.PaymentConfig
	if err := s.db.First(&config, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPaymentConfigNotFound
		}
		return nil, err
	}
	return &config, nil
}

func (s *paymentConfigService) Create(in CreatePaymentConfigInput) (*model.PaymentConfig, error) {
	// 检查是否已存在相同范围的配置
	var count int64
	if err := s.db.Model(&model.PaymentConfig{}).
		Where("app_id = ? AND drama_id = ?", in.AppID, in.DramaID).
		Count(&count).Error; err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, ErrPaymentConfigDuplicate
	}

	config := model.PaymentConfig{
		ID:          snowflake.NextID(),
		AppID:       in.AppID,
		DramaID:     in.DramaID,
		BeansPerEp:  in.BeansPerEp,
		Description: in.Description,
	}
	if config.BeansPerEp < 1 {
		config.BeansPerEp = 100 // 默认100
	}
	if err := s.db.Create(&config).Error; err != nil {
		return nil, err
	}
	return &config, nil
}

func (s *paymentConfigService) Update(id int64, in UpdatePaymentConfigInput) error {
	config, err := s.GetByID(id)
	if err != nil {
		return err
	}

	updates := map[string]interface{}{}
	if in.BeansPerEp != nil {
		bp := *in.BeansPerEp
		if bp < 1 {
			bp = 1
		}
		updates["beans_per_ep"] = bp
	}
	if in.Description != nil {
		updates["description"] = *in.Description
	}

	if len(updates) == 0 {
		return nil
	}
	return s.db.Model(config).Updates(updates).Error
}

func (s *paymentConfigService) Delete(id int64) error {
	config, err := s.GetByID(id)
	if err != nil {
		return err
	}
	// 不允许删除全局默认配置
	if config.AppID == 0 && config.DramaID == 0 {
		return errors.New("cannot delete global default config")
	}
	return s.db.Delete(config).Error
}

// GetEffectiveConfig 获取生效的Beans配置
// 优先级：AppID+DramaID > DramaID > AppID > 全局默认
func (s *paymentConfigService) GetEffectiveConfig(appID, dramaID int64) (int, error) {
	var config model.PaymentConfig

	// 1. 先找 AppID+DramaID
	if appID > 0 && dramaID > 0 {
		if err := s.db.Where("app_id = ? AND drama_id = ?", appID, dramaID).First(&config).Error; err == nil {
			return config.BeansPerEp, nil
		}
	}

	// 2. 再找 DramaID only
	if dramaID > 0 {
		if err := s.db.Where("app_id = 0 AND drama_id = ?", dramaID).First(&config).Error; err == nil {
			return config.BeansPerEp, nil
		}
	}

	// 3. 再找 AppID only
	if appID > 0 {
		if err := s.db.Where("app_id = ? AND drama_id = 0", appID).First(&config).Error; err == nil {
			return config.BeansPerEp, nil
		}
	}

	// 4. 全局默认
	if err := s.db.Where("app_id = 0 AND drama_id = 0").First(&config).Error; err == nil {
		return config.BeansPerEp, nil
	}

	// 如果没有任何配置，返回默认100
	return 100, nil
}

// EnsureGlobalDefault 确保全局默认配置存在
func (s *paymentConfigService) EnsureGlobalDefault() error {
	var count int64
	if err := s.db.Model(&model.PaymentConfig{}).Where("app_id = 0 AND drama_id = 0").Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		config := model.PaymentConfig{
			ID:          snowflake.NextID(),
			AppID:       0,
			DramaID:     0,
			BeansPerEp:  100,
			Description: "全局默认配置：每集100 Beans",
		}
		return s.db.Create(&config).Error
	}
	return nil
}
