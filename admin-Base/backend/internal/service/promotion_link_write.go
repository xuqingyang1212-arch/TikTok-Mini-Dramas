package service

import (
	"errors"
	"net/url"
	"strconv"
	"strings"

	"scaffold-admin/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrPromotionAppNotFound     = errors.New("promotion app not found")
	ErrPromotionAppDisabled     = errors.New("promotion app disabled")
	ErrPromotionDramaNotFound   = errors.New("promotion drama not found")
	ErrPromotionDramaNotOnShelf = errors.New("promotion drama is not on shelf")
	ErrPromotionPaywallInvalid  = errors.New("promotion paywall episode is invalid")
	ErrPromotionBeansRequired   = errors.New("promotion beans per episode is required")
	ErrPromotionBeansInvalid    = errors.New("promotion beans per episode is invalid")
	ErrPromotionCreatorNotFound = errors.New("promotion creator not found")
	ErrPromotionLinkNotFound    = errors.New("promotion link not found")
	ErrPromotionUserNotFound    = errors.New("promotion user not found")
	ErrPromotionAppMismatch     = errors.New("promotion app mismatch")
)

type CreatePromotionLinkInput struct {
	Name           string
	AppID          int64
	DramaID        int64
	PaywallEpisode int
	BeansPerEp     *int
	CreatedBy      int64
	MobileBaseURL  string
}

type CreatePromotionLinkResult = PromotionLinkListItem

type UserActivationResult struct {
	UserID                 string  `json:"userId"`
	CurrentPromotionLinkID *string `json:"currentPromotionLinkId"`
	AttributionUpdated     bool    `json:"attributionUpdated"`
}

func validatePromotionConfig(input CreatePromotionLinkInput, episodeCount int, monetizationType string) error {
	if input.PaywallEpisode < 1 || input.PaywallEpisode > episodeCount {
		return ErrPromotionPaywallInvalid
	}
	if monetizationType != "IAP" {
		return nil
	}
	if input.BeansPerEp == nil {
		return ErrPromotionBeansRequired
	}
	if *input.BeansPerEp < 10 || *input.BeansPerEp > 500 {
		return ErrPromotionBeansInvalid
	}
	return nil
}

func (s *promotionLinkService) Create(input CreatePromotionLinkInput) (*CreatePromotionLinkResult, error) {
	var result CreatePromotionLinkResult
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var app model.App
		if err := tx.First(&app, input.AppID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrPromotionAppNotFound
			}
			return err
		}
		if app.Status != "启用" {
			return ErrPromotionAppDisabled
		}

		var drama model.Drama
		if err := tx.First(&drama, input.DramaID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrPromotionDramaNotFound
			}
			return err
		}
		if drama.Status != "上架" {
			return ErrPromotionDramaNotOnShelf
		}
		if err := validatePromotionConfig(input, drama.EpisodeCount, app.MonetizationType); err != nil {
			return err
		}
		if app.MonetizationType != "IAP" {
			input.BeansPerEp = nil
		}

		var creator model.User
		if err := tx.First(&creator, input.CreatedBy).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrPromotionCreatorNotFound
			}
			return err
		}

		name := strings.TrimSpace(input.Name)
		if name == "" {
			name = drama.Name + "-" + creator.Name
		}
		link := model.PromotionLink{
			Name:           name,
			AppID:          app.ID,
			DramaID:        drama.ID,
			PaywallEpisode: input.PaywallEpisode,
			BeansPerEp:     input.BeansPerEp,
			CreatedBy:      creator.ID,
		}
		if err := tx.Create(&link).Error; err != nil {
			return err
		}

		promotionURL, err := buildPromotionURL(input.MobileBaseURL, drama.ID, link.LinkID)
		if err != nil {
			return err
		}
		link.PromotionURL = promotionURL
		if err := tx.Model(&link).Update("promotion_url", link.PromotionURL).Error; err != nil {
			return err
		}
		result = CreatePromotionLinkResult{
			LinkID:           strconv.FormatInt(link.LinkID, 10),
			Name:             link.Name,
			AppID:            strconv.FormatInt(app.ID, 10),
			TiktokAppID:      app.TiktokAppID,
			AppName:          app.Name,
			MonetizationType: app.MonetizationType,
			DramaID:          strconv.FormatInt(drama.ID, 10),
			DramaName:        drama.Name,
			PaywallEpisode:   link.PaywallEpisode,
			BeansPerEp:       link.BeansPerEp,
			CreatorName:      creator.Name,
			PromotionURL:     link.PromotionURL,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func buildPromotionURL(mobileBaseURL string, dramaID, linkID int64) (string, error) {
	target, err := url.Parse(strings.TrimRight(mobileBaseURL, "/") + "/player")
	if err != nil || target.Scheme == "" || target.Host == "" {
		return "", errors.New("invalid mobile base URL")
	}
	query := target.Query()
	query.Set("dramaId", strconv.FormatInt(dramaID, 10))
	query.Set("linkId", strconv.FormatInt(linkID, 10))
	target.RawQuery = query.Encode()
	return target.String(), nil
}

func (s *promotionLinkService) RefreshPromotionURLs(mobileBaseURL string) error {
	var links []model.PromotionLink
	if err := s.db.Select("link_id", "drama_id", "promotion_url").Find(&links).Error; err != nil {
		return err
	}
	return s.db.Transaction(func(tx *gorm.DB) error {
		for _, link := range links {
			promotionURL, err := buildPromotionURL(mobileBaseURL, link.DramaID, link.LinkID)
			if err != nil {
				return err
			}
			if link.PromotionURL == promotionURL {
				continue
			}
			if err := tx.Model(&model.PromotionLink{}).Where("link_id = ?", link.LinkID).Update("promotion_url", promotionURL).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *promotionLinkService) ReportUserActivation(userID int64, linkID *int64) (*UserActivationResult, error) {
	var result UserActivationResult
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var user model.AppUser
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&user, userID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrPromotionUserNotFound
			}
			return err
		}

		result.UserID = strconv.FormatInt(user.ID, 10)
		result.AttributionUpdated = false
		if user.CurrentPromotionLinkID != nil {
			current := strconv.FormatInt(*user.CurrentPromotionLinkID, 10)
			result.CurrentPromotionLinkID = &current
		}
		if linkID == nil {
			return nil
		}

		var link model.PromotionLink
		if err := tx.First(&link, "link_id = ?", *linkID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrPromotionLinkNotFound
			}
			return err
		}
		if user.AppID != link.AppID {
			return ErrPromotionAppMismatch
		}

		updated := promotionAttributionChanged(user.CurrentPromotionLinkID, link.LinkID)
		if updated {
			previousLinkID := user.CurrentPromotionLinkID
			if err := tx.Model(&user).Update("current_promotion_link_id", link.LinkID).Error; err != nil {
				return err
			}
			if err := tx.Create(&model.PromotionAttributionHistory{
				UserID:         user.ID,
				PreviousLinkID: previousLinkID,
				LinkID:         link.LinkID,
			}).Error; err != nil {
				return err
			}
		}

		current := strconv.FormatInt(link.LinkID, 10)
		result.CurrentPromotionLinkID = &current
		result.AttributionUpdated = updated
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func promotionAttributionChanged(currentLinkID *int64, incomingLinkID int64) bool {
	return currentLinkID == nil || *currentLinkID != incomingLinkID
}
