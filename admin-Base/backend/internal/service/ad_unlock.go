package service

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"scaffold-admin/internal/model"
	"scaffold-admin/internal/pkg/datetime"
	"scaffold-admin/internal/pkg/snowflake"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrMonetizationNotSupported = errors.New("monetization method not supported")
	ErrAdPlacementNotConfigured = errors.New("ad placement not configured")
	ErrAdSessionNotFound        = errors.New("ad unlock session not found")
	ErrAdSessionCanceled        = errors.New("ad unlock session canceled")
	ErrAdSessionExpired         = errors.New("ad unlock session expired")
	ErrAdSessionOwnerMismatch   = errors.New("ad unlock session owner mismatch")
)

const adUnlockSessionTTL = 10 * time.Minute

type AdUnlockSessionResult struct {
	SessionNo     string `json:"sessionNo,omitempty"`
	Status        string `json:"status"`
	DramaID       string `json:"dramaId"`
	EpisodeNo     int    `json:"episodeNo"`
	AdPlacementID string `json:"adPlacementId,omitempty"`
	ExpireAt      string `json:"expireAt,omitempty"`
	UnlockType    string `json:"unlockType,omitempty"`
	IsUnlocked    bool   `json:"isUnlocked"`
}

type AdUnlockService interface {
	Create(userID, dramaID int64, episodeNo int) (*AdUnlockSessionResult, error)
	Complete(sessionNo string, userID int64) (*AdUnlockSessionResult, error)
	Cancel(sessionNo string, userID int64) (*AdUnlockSessionResult, error)
	ExpirePending() (int64, error)
}

type adUnlockService struct {
	db           *gorm.DB
	entitlements *entitlementResolver
}

func newAdSessionNo() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return "AD" + strings.ToUpper(hex.EncodeToString(buf)), nil
}

func adSessionActiveKey(appID, userID, dramaID int64, episodeNo int) string {
	return fmt.Sprintf("%d:%d:%d:%d", appID, userID, dramaID, episodeNo)
}

// loadIAAUser 校验用户所属应用当前可使用 IAA。
func (s *adUnlockService) loadIAAUser(userID int64) (*model.AppUser, error) {
	ctx, err := loadAppContext(s.db, userID, false)
	if err != nil {
		return nil, err
	}
	if err := requireIAAApp(ctx.App); err != nil {
		return nil, err
	}
	return &ctx.User, nil
}

func adSessionResult(session model.AdUnlockSession, unlockType string, unlocked bool) *AdUnlockSessionResult {
	result := &AdUnlockSessionResult{
		SessionNo:     session.SessionNo,
		Status:        session.Status,
		DramaID:       fmt.Sprintf("%d", session.DramaID),
		EpisodeNo:     session.EpisodeNo,
		AdPlacementID: session.AdPlacementID,
		ExpireAt:      datetime.FormatUTC(session.ExpireAt),
		UnlockType:    unlockType,
		IsUnlocked:    unlocked,
	}
	if session.Status != "pending" {
		result.AdPlacementID = ""
	}
	return result
}

func (s *adUnlockService) Create(userID, dramaID int64, episodeNo int) (*AdUnlockSessionResult, error) {
	user, err := s.loadIAAUser(userID)
	if err != nil {
		return nil, err
	}

	var drama model.Drama
	if err := s.db.Where("id = ? AND status = ?", dramaID, "上架").First(&drama).Error; err != nil {
		return nil, ErrDramaNotAvailable
	}
	if episodeNo < 1 || episodeNo > drama.EpisodeCount {
		return nil, ErrEpisodeNotFound
	}
	var episode model.Episode
	if err := s.db.Where("drama_id = ? AND episode_no = ?", dramaID, episodeNo).First(&episode).Error; err != nil {
		return nil, ErrEpisodeNotFound
	}

	var result *AdUnlockSessionResult
	err = s.db.Transaction(func(tx *gorm.DB) error {
		var currentApp model.App
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&currentApp, user.AppID).Error; err != nil {
			return ErrAppNotFound
		}
		if err := requireIAAApp(currentApp); err != nil {
			return err
		}

		now := datetime.NowUTC()
		if err := tx.Model(&model.AdUnlockSession{}).
			Where("app_id = ? AND user_id = ? AND drama_id = ? AND episode_no = ? AND status = ? AND expire_at <= ?",
				currentApp.ID, user.ID, drama.ID, episodeNo, "pending", now).
			Updates(map[string]any{"status": "expired", "active_key": nil, "updated_at": now}).Error; err != nil {
			return err
		}

		unlocked, unlockType, err := s.entitlements.resolveEpisode(tx, currentApp.ID, user.ID, drama.ID, episodeNo, drama.PaywallEpisode)
		if err != nil {
			return err
		}
		if unlocked {
			result = &AdUnlockSessionResult{
				Status:     "already_unlocked",
				DramaID:    fmt.Sprintf("%d", drama.ID),
				EpisodeNo:  episodeNo,
				UnlockType: unlockType,
				IsUnlocked: true,
			}
			return nil
		}

		var existing model.AdUnlockSession
		err = tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where(
			"app_id = ? AND user_id = ? AND drama_id = ? AND episode_no = ? AND status = ? AND expire_at > ?",
			currentApp.ID, user.ID, drama.ID, episodeNo, "pending", now,
		).Order("created_at DESC").First(&existing).Error
		if err == nil {
			result = adSessionResult(existing, "locked", false)
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		sessionNo, err := newAdSessionNo()
		if err != nil {
			return err
		}
		activeKey := adSessionActiveKey(currentApp.ID, user.ID, drama.ID, episodeNo)
		session := model.AdUnlockSession{
			ID:            snowflake.NextID(),
			SessionNo:     sessionNo,
			AppID:         currentApp.ID,
			UserID:        user.ID,
			DramaID:       drama.ID,
			EpisodeNo:     episodeNo,
			AdPlacementID: currentApp.AdPlacementID,
			Status:        "pending",
			ActiveKey:     &activeKey,
			ExpireAt:      now.Add(adUnlockSessionTTL),
			CreatedAt:     now,
			UpdatedAt:     now,
		}
		if err := tx.Create(&session).Error; err != nil {
			if isDuplicate(err) {
				var current model.AdUnlockSession
				if findErr := tx.Where("active_key = ? AND status = ?", activeKey, "pending").First(&current).Error; findErr == nil {
					result = adSessionResult(current, "locked", false)
					return nil
				}
			}
			return err
		}
		result = adSessionResult(session, "locked", false)
		return nil
	})
	return result, err
}

func (s *adUnlockService) Complete(sessionNo string, userID int64) (*AdUnlockSessionResult, error) {
	var sessionRef model.AdUnlockSession
	if err := s.db.Select("app_id").Where("session_no = ?", sessionNo).First(&sessionRef).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAdSessionNotFound
		}
		return nil, err
	}

	var result *AdUnlockSessionResult
	expired := false
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var app model.App
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&app, sessionRef.AppID).Error; err != nil {
			return ErrAppNotFound
		}
		if app.Status != "启用" || app.MonetizationType != "IAA" {
			return ErrMonetizationNotSupported
		}

		var session model.AdUnlockSession
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("session_no = ?", sessionNo).First(&session).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrAdSessionNotFound
			}
			return err
		}
		if session.UserID != userID {
			return ErrAdSessionOwnerMismatch
		}

		var existingUnlock model.UserUnlock
		actualUnlockType := func() string {
			unlockType := existingUnlock.UnlockType
			if unlockType == "" {
				unlockType = "beans"
			}
			return unlockType
		}
		loadExistingUnlock := func() error {
			return tx.Where("app_id = ? AND user_id = ? AND drama_id = ? AND episode_no = ?",
				session.AppID, session.UserID, session.DramaID, session.EpisodeNo).First(&existingUnlock).Error
		}

		switch session.Status {
		case "completed":
			if err := loadExistingUnlock(); err != nil {
				return err
			}
			result = adSessionResult(session, actualUnlockType(), true)
			return nil
		case "canceled":
			return ErrAdSessionCanceled
		case "expired":
			return ErrAdSessionExpired
		case "pending":
		default:
			return ErrAdSessionNotFound
		}

		now := datetime.NowUTC()
		if !session.ExpireAt.After(now) {
			if err := tx.Model(&session).Updates(map[string]any{"status": "expired", "active_key": nil, "updated_at": now}).Error; err != nil {
				return err
			}
			expired = true
			return nil
		}

		var user model.AppUser
		if err := tx.First(&user, session.UserID).Error; err != nil || user.AppID != session.AppID {
			return ErrAdSessionOwnerMismatch
		}

		var unlock model.UserUnlock
		err := loadExistingUnlock()
		if err == nil {
			unlock = existingUnlock
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			unlock = model.UserUnlock{
				ID:          snowflake.NextID(),
				AppID:       session.AppID,
				UserID:      session.UserID,
				DramaID:     session.DramaID,
				EpisodeNo:   session.EpisodeNo,
				UnlockType:  "ad",
				AdSessionID: session.ID,
				CreatedAt:   now,
			}
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&unlock).Error; err != nil {
				return err
			}
			if err := tx.Where("app_id = ? AND user_id = ? AND drama_id = ? AND episode_no = ?",
				session.AppID, session.UserID, session.DramaID, session.EpisodeNo).First(&unlock).Error; err != nil {
				return err
			}
		} else if err != nil {
			return err
		}

		session.Status = "completed"
		session.ActiveKey = nil
		session.CompletedAt = &now
		session.UpdatedAt = now
		if err := tx.Save(&session).Error; err != nil {
			return err
		}
		unlockType := unlock.UnlockType
		if unlockType == "" {
			unlockType = "beans"
		}
		result = adSessionResult(session, unlockType, true)
		return nil
	})
	if err != nil {
		return nil, err
	}
	if expired {
		return nil, ErrAdSessionExpired
	}
	return result, nil
}

func (s *adUnlockService) Cancel(sessionNo string, userID int64) (*AdUnlockSessionResult, error) {
	var result *AdUnlockSessionResult
	expired := false
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var session model.AdUnlockSession
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("session_no = ?", sessionNo).First(&session).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrAdSessionNotFound
			}
			return err
		}
		if session.UserID != userID {
			return ErrAdSessionOwnerMismatch
		}
		completedResult := func() (*AdUnlockSessionResult, error) {
			var unlock model.UserUnlock
			if err := tx.Where("app_id = ? AND user_id = ? AND drama_id = ? AND episode_no = ?",
				session.AppID, session.UserID, session.DramaID, session.EpisodeNo).First(&unlock).Error; err != nil {
				return nil, err
			}
			unlockType := unlock.UnlockType
			if unlockType == "" {
				unlockType = "beans"
			}
			return adSessionResult(session, unlockType, true), nil
		}
		switch session.Status {
		case "completed":
			var err error
			result, err = completedResult()
			return err
		case "canceled":
			result = adSessionResult(session, "locked", false)
			return nil
		case "expired":
			expired = true
			return nil
		case "pending":
		default:
			return ErrAdSessionNotFound
		}

		now := datetime.NowUTC()
		if !session.ExpireAt.After(now) {
			if err := tx.Model(&session).Updates(map[string]any{"status": "expired", "active_key": nil, "updated_at": now}).Error; err != nil {
				return err
			}
			expired = true
			return nil
		}
		session.Status = "canceled"
		session.ActiveKey = nil
		session.UpdatedAt = now
		if err := tx.Save(&session).Error; err != nil {
			return err
		}
		result = adSessionResult(session, "locked", false)
		return nil
	})
	if err != nil {
		return nil, err
	}
	if expired {
		return nil, ErrAdSessionExpired
	}
	return result, nil
}

func (s *adUnlockService) ExpirePending() (int64, error) {
	now := datetime.NowUTC()
	res := s.db.Model(&model.AdUnlockSession{}).
		Where("status = ? AND expire_at <= ?", "pending", now).
		Updates(map[string]any{"status": "expired", "active_key": nil, "updated_at": now})
	return res.RowsAffected, res.Error
}
