package service

import (
	"errors"

	"scaffold-admin/internal/model"

	"gorm.io/gorm"
)

type promotionOperations struct {
	PaywallEpisode int
	BeansPerEp     *int
}

type promotionLinkLoader func(db *gorm.DB, linkID, appID int64) (model.PromotionLink, error)

func loadPromotionLink(db *gorm.DB, linkID, appID int64) (model.PromotionLink, error) {
	var link model.PromotionLink
	err := db.Where("link_id = ? AND app_id = ?", linkID, appID).First(&link).Error
	return link, err
}

func resolvePromotionOperations(db *gorm.DB, user model.AppUser, drama model.Drama) (promotionOperations, error) {
	return resolvePromotionOperationsWith(db, user, drama, loadPromotionLink)
}

func resolvePromotionOperationsWith(db *gorm.DB, user model.AppUser, drama model.Drama, load promotionLinkLoader) (promotionOperations, error) {
	result := promotionOperations{PaywallEpisode: drama.PaywallEpisode}
	if user.CurrentPromotionLinkID == nil {
		return result, nil
	}

	link, err := load(db, *user.CurrentPromotionLinkID, user.AppID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return result, nil
		}
		return result, err
	}
	result.BeansPerEp = link.BeansPerEp
	if link.DramaID == drama.ID {
		result.PaywallEpisode = link.PaywallEpisode
	}
	return result, nil
}
