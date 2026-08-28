package service

import (
	"errors"

	"scaffold-admin/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ─── Types ──────────────────────────────────────────────────────────────────

type AppListFilter struct {
	Name             string
	AppID            string
	ClientKey        string
	Company          string
	MonetizationType string
	Page             int
	PageSize         int
}

type CreateAppInput struct {
	Name             string
	AppID            string
	ClientKey        string
	ClientSecret     string
	Company          string
	MonetizationType string
	AdPlacementID    string
}

type UpdateAppInput struct {
	Name             string
	AppID            string
	ClientKey        string
	ClientSecret     string
	Company          string
	MonetizationType string
	AdPlacementID    string
}

type AppService interface {
	List(filter AppListFilter) ([]model.App, int64, error)
	GetByID(id int64) (*model.App, error)
	Create(input CreateAppInput) (*model.App, error)
	Update(id int64, input UpdateAppInput) error
	GetCompanies() ([]string, error)
}

// ─── Errors ─────────────────────────────────────────────────────────────────

var (
	ErrAppNotFound             = errors.New("app not found")
	ErrAppClientKeyExists      = errors.New("client key already exists")
	ErrAppAppIDExists          = errors.New("app id already exists")
	ErrInvalidMonetizationType = errors.New("invalid monetization type")
	ErrMonetizationTypeInUse   = errors.New("monetization type has business data")
)

// ─── Implementation ─────────────────────────────────────────────────────────

type appService struct {
	db *gorm.DB
}

func (s *appService) List(f AppListFilter) ([]model.App, int64, error) {
	db := s.db.Model(&model.App{})

	if f.Name != "" {
		db = db.Where("name LIKE ?", "%"+f.Name+"%")
	}
	if f.AppID != "" {
		db = db.Where("app_id LIKE ?", "%"+f.AppID+"%")
	}
	if f.ClientKey != "" {
		db = db.Where("client_key LIKE ?", "%"+f.ClientKey+"%")
	}
	if f.Company != "" {
		db = db.Where("company LIKE ?", "%"+f.Company+"%")
	}
	if f.MonetizationType != "" {
		db = db.Where("monetization_type = ?", f.MonetizationType)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page, size := normalizePage(f.Page, f.PageSize)
	var apps []model.App
	err := db.Order("created_at DESC").
		Offset((page - 1) * size).
		Limit(size).
		Find(&apps).Error
	return apps, total, err
}

func (s *appService) GetByID(id int64) (*model.App, error) {
	var app model.App
	if err := s.db.First(&app, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAppNotFound
		}
		return nil, err
	}
	return &app, nil
}

func (s *appService) Create(in CreateAppInput) (*model.App, error) {
	if !isValidMonetizationType(in.MonetizationType) {
		return nil, ErrInvalidMonetizationType
	}
	if in.AppID != "" {
		var cnt int64
		if err := s.db.Model(&model.App{}).Where("app_id = ?", in.AppID).Count(&cnt).Error; err != nil {
			return nil, err
		}
		if cnt > 0 {
			return nil, ErrAppAppIDExists
		}
	}
	app := model.App{
		Name:             in.Name,
		TiktokAppID:      in.AppID,
		ClientKey:        in.ClientKey,
		ClientSecret:     in.ClientSecret,
		Company:          in.Company,
		MonetizationType: in.MonetizationType,
		AdPlacementID:    normalizeAdPlacementID(in.MonetizationType, in.AdPlacementID),
		Status:           "启用",
	}
	if err := s.db.Create(&app).Error; err != nil {
		if isDuplicate(err) {
			return nil, classifyAppDuplicate(err)
		}
		return nil, err
	}
	return &app, nil
}

func (s *appService) Update(id int64, in UpdateAppInput) error {
	if !isValidMonetizationType(in.MonetizationType) {
		return ErrInvalidMonetizationType
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		var app model.App
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&app, id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrAppNotFound
			}
			return err
		}
		if app.MonetizationType != in.MonetizationType {
			tables := []any{&model.PaymentOrder{}, &model.UserSubscription{}, &model.UserUnlock{}, &model.AdUnlockSession{}}
			for _, table := range tables {
				var count int64
				if err := tx.Model(table).Where("app_id = ?", id).Count(&count).Error; err != nil {
					return err
				}
				if count > 0 {
					return ErrMonetizationTypeInUse
				}
			}
		}

		if in.AppID != "" {
			var cnt int64
			if err := tx.Model(&model.App{}).Where("app_id = ? AND id <> ?", in.AppID, id).Count(&cnt).Error; err != nil {
				return err
			}
			if cnt > 0 {
				return ErrAppAppIDExists
			}
		}

		updates := map[string]any{
			"name":              in.Name,
			"app_id":            in.AppID,
			"company":           in.Company,
			"monetization_type": in.MonetizationType,
			"ad_placement_id":   normalizeAdPlacementID(in.MonetizationType, in.AdPlacementID),
		}
		if in.ClientKey != "" {
			updates["client_key"] = in.ClientKey
		}
		if in.ClientSecret != "" {
			updates["client_secret"] = in.ClientSecret
		}

		if err := tx.Model(&app).Updates(updates).Error; err != nil {
			if isDuplicate(err) {
				return classifyAppDuplicate(err)
			}
			return err
		}
		return nil
	})
}

func isValidMonetizationType(value string) bool {
	return value == "IAA" || value == "IAP"
}

func normalizeAdPlacementID(monetizationType, adPlacementID string) string {
	if monetizationType != "IAA" {
		return ""
	}
	return adPlacementID
}

func (s *appService) GetCompanies() ([]string, error) {
	var companies []string
	err := s.db.Model(&model.App{}).
		Distinct("company").
		Where("company != ''").
		Pluck("company", &companies).Error
	return companies, err
}
