package service

import (
	"errors"
	"strings"

	"scaffold-admin/internal/model"
	"scaffold-admin/internal/pkg/datetime"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	monetizationTypeIAA = "IAA"
	monetizationTypeIAP = "IAP"

	appStatusEnabled = "启用"

	unlockTypeFree         = "free"
	unlockTypeBeans        = "beans"
	unlockTypeSubscription = "subscription"
	unlockTypeAd           = "ad"
	unlockTypeLocked       = "locked"
)

type appContext struct {
	User model.AppUser
	App  model.App
}

func loadAppContext(db *gorm.DB, userID int64, lockApp bool) (*appContext, error) {
	var user model.AppUser
	if err := db.First(&user, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAppUserNotFound
		}
		return nil, err
	}

	query := db
	if lockApp {
		query = query.Clauses(clause.Locking{Strength: "UPDATE"})
	}
	var app model.App
	if err := query.First(&app, user.AppID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAppNotFound
		}
		return nil, err
	}
	return &appContext{User: user, App: app}, nil
}

func requireMonetizationApp(app model.App, monetizationType string) error {
	if app.Status != appStatusEnabled {
		return ErrAppDisabled
	}
	if app.MonetizationType != monetizationType {
		return ErrMonetizationNotSupported
	}
	return nil
}

func requireIAAApp(app model.App) error {
	if err := requireMonetizationApp(app, monetizationTypeIAA); err != nil {
		return err
	}
	if strings.TrimSpace(app.AdPlacementID) == "" {
		return ErrAdPlacementNotConfigured
	}
	return nil
}

type entitlementContext struct {
	UnlockTypes  map[int]string
	Subscription bool
	CanUnlockAd  bool
}

type entitlementResolver struct {
	db *gorm.DB
}

func (r *entitlementResolver) resolve(drama model.Drama, userID int64) (*entitlementContext, error) {
	result := &entitlementContext{
		UnlockTypes: make(map[int]string, drama.EpisodeCount),
	}
	for episodeNo := 1; episodeNo <= drama.EpisodeCount; episodeNo++ {
		if episodeNo < drama.PaywallEpisode {
			result.UnlockTypes[episodeNo] = unlockTypeFree
		} else {
			result.UnlockTypes[episodeNo] = unlockTypeLocked
		}
	}
	if userID <= 0 {
		return result, nil
	}

	var user model.AppUser
	if err := r.db.First(&user, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return result, nil
		}
		return nil, err
	}

	var unlocks []model.UserUnlock
	if err := r.db.Where("app_id = ? AND user_id = ? AND drama_id = ?", user.AppID, userID, drama.ID).
		Find(&unlocks).Error; err != nil {
		return nil, err
	}
	for _, unlock := range unlocks {
		if unlock.EpisodeNo < drama.PaywallEpisode || unlock.EpisodeNo > drama.EpisodeCount {
			continue
		}
		result.UnlockTypes[unlock.EpisodeNo] = normalizedUnlockType(unlock.UnlockType)
	}

	var app model.App
	if err := r.db.First(&app, user.AppID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return result, nil
		}
		return nil, err
	}
	if app.MonetizationType == monetizationTypeIAA {
		result.CanUnlockAd = app.Status == appStatusEnabled && strings.TrimSpace(app.AdPlacementID) != ""
		return result, nil
	}
	if app.MonetizationType != monetizationTypeIAP || app.Status != appStatusEnabled {
		return result, nil
	}

	active, err := hasActiveSubscription(r.db, app.ID, userID)
	if err != nil {
		return nil, err
	}
	result.Subscription = active
	if active {
		for episodeNo := drama.PaywallEpisode; episodeNo <= drama.EpisodeCount; episodeNo++ {
			if result.UnlockTypes[episodeNo] == unlockTypeLocked {
				result.UnlockTypes[episodeNo] = unlockTypeSubscription
			}
		}
	}
	return result, nil
}

func (r *entitlementResolver) resolveEpisode(db *gorm.DB, appID, userID, dramaID int64, episodeNo, paywallEpisode int) (bool, string, error) {
	if episodeNo < paywallEpisode {
		return true, unlockTypeFree, nil
	}
	var unlock model.UserUnlock
	err := db.Where("app_id = ? AND user_id = ? AND drama_id = ? AND episode_no = ?", appID, userID, dramaID, episodeNo).
		First(&unlock).Error
	if err == nil {
		return true, normalizedUnlockType(unlock.UnlockType), nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return false, "", err
	}
	return false, unlockTypeLocked, nil
}

func normalizedUnlockType(unlockType string) string {
	if unlockType == "" {
		return unlockTypeBeans
	}
	return unlockType
}

func hasActiveSubscription(db *gorm.DB, appID, userID int64) (bool, error) {
	var count int64
	err := db.Model(&model.UserSubscription{}).
		Where("app_id = ? AND user_id = ? AND status = ? AND expire_at > ?", appID, userID, "active", datetime.NowUTC()).
		Count(&count).Error
	return count > 0, err
}
