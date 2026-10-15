package service

import (
	"errors"

	"scaffold-admin/internal/model"
	"scaffold-admin/internal/pkg/datetime"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ─── Types ──────────────────────────────────────────────────────────────────

type AppListFilter struct {
	Name             string
	AppID            string
	ClientKey        string
	SubjectID        string
	MonetizationType string
	Page             int
	PageSize         int
}

type CreateAppInput struct {
	Name             string
	AppID            string
	ClientKey        string
	ClientSecret     string
	SubjectID        string
	MonetizationType string
	AdPlacementID    string
}

type UpdateAppInput struct {
	Name             string
	AppID            string
	ClientKey        string
	ClientSecret     string
	SubjectID        string
	MonetizationType string
	AdPlacementID    string
}

type AppService interface {
	List(filter AppListFilter) ([]model.App, int64, error)
	GetByID(id int64) (*model.App, error)
	Create(input CreateAppInput) (*model.App, error)
	Update(id int64, input UpdateAppInput) error
	ListSubjects() ([]model.SubjectInfo, error)
}

// ─── Errors ─────────────────────────────────────────────────────────────────

var (
	ErrAppNotFound             = errors.New("app not found")
	ErrAppClientKeyExists      = errors.New("client key already exists")
	ErrAppAppIDExists          = errors.New("app id already exists")
	ErrSubjectNotFound         = errors.New("subject not found")
	ErrInvalidMonetizationType = errors.New("invalid monetization type")
)

// ─── Implementation ─────────────────────────────────────────────────────────

type appService struct {
	db            *gorm.DB
	authorization *dramaAuthorizationService
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
	if f.SubjectID != "" {
		db = db.Where("subject_id = ?", f.SubjectID)
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
	err := db.Preload("Subject").
		Order("created_at DESC").
		Offset((page - 1) * size).
		Limit(size).
		Find(&apps).Error
	return apps, total, err
}

func (s *appService) GetByID(id int64) (*model.App, error) {
	var app model.App
	if err := s.db.Preload("Subject").First(&app, id).Error; err != nil {
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
	if err := s.requireSubject(in.SubjectID); err != nil {
		return nil, err
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
		SubjectID:        in.SubjectID,
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
	if err := s.authorization.GrantAppToAllSubmissions(app.ID); err != nil {
		return nil, err
	}
	app.Subject, _ = s.getSubject(app.SubjectID)
	return &app, nil
}

func (s *appService) Update(id int64, in UpdateAppInput) error {
	if !isValidMonetizationType(in.MonetizationType) {
		return ErrInvalidMonetizationType
	}
	if err := s.requireSubject(in.SubjectID); err != nil {
		return err
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
			if err := prepareMonetizationSwitch(tx, app.ID, in.MonetizationType); err != nil {
				return err
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
			"subject_id":        in.SubjectID,
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

func prepareMonetizationSwitch(tx *gorm.DB, appID int64, nextType string) error {
	if nextType != monetizationTypeIAP {
		return nil
	}

	now := datetime.NowUTC()
	return tx.Model(&model.AdUnlockSession{}).
		Where("app_id = ? AND status = ?", appID, "pending").
		Updates(map[string]any{
			"status":     "canceled",
			"active_key": nil,
			"updated_at": now,
		}).Error
}

func isValidMonetizationType(value string) bool {
	return value == monetizationTypeIAA || value == monetizationTypeIAP
}

func normalizeAdPlacementID(monetizationType, adPlacementID string) string {
	if monetizationType != "IAA" {
		return ""
	}
	return adPlacementID
}

func (s *appService) ListSubjects() ([]model.SubjectInfo, error) {
	var subjects []model.SubjectInfo
	err := s.db.Order("subject_name_cn ASC").Find(&subjects).Error
	return subjects, err
}

func (s *appService) requireSubject(subjectID string) error {
	_, err := s.getSubject(subjectID)
	return err
}

func (s *appService) getSubject(subjectID string) (model.SubjectInfo, error) {
	var subject model.SubjectInfo
	if err := s.db.First(&subject, "subject_id = ?", subjectID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return subject, ErrSubjectNotFound
		}
		return subject, err
	}
	return subject, nil
}
