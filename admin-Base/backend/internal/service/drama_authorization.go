package service

import (
	"errors"
	"fmt"
	"sort"
	"strings"

	"scaffold-admin/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type dramaAuthorizationTarget struct {
	AppID       int64
	TikTokAppID string
}

type dramaAuthorizationResult struct {
	AppID     int64
	Succeeded bool
	Error     string
}

type dramaAuthorizationGateway interface {
	Add(albumID int64, targets []dramaAuthorizationTarget) ([]dramaAuthorizationResult, error)
	Remove(albumID int64, targets []dramaAuthorizationTarget) ([]dramaAuthorizationResult, error)
}

type demoDramaAuthorizationGateway struct{}

func (demoDramaAuthorizationGateway) Add(_ int64, targets []dramaAuthorizationTarget) ([]dramaAuthorizationResult, error) {
	return successfulAuthorizationResults(targets), nil
}

func (demoDramaAuthorizationGateway) Remove(_ int64, targets []dramaAuthorizationTarget) ([]dramaAuthorizationResult, error) {
	return successfulAuthorizationResults(targets), nil
}

func successfulAuthorizationResults(targets []dramaAuthorizationTarget) []dramaAuthorizationResult {
	results := make([]dramaAuthorizationResult, len(targets))
	for i, target := range targets {
		results[i] = dramaAuthorizationResult{AppID: target.AppID, Succeeded: true}
	}
	return results
}

type dramaAuthorizationService struct {
	db      *gorm.DB
	gateway dramaAuthorizationGateway
}

func newDramaAuthorizationService(db *gorm.DB) *dramaAuthorizationService {
	return &dramaAuthorizationService{db: db, gateway: demoDramaAuthorizationGateway{}}
}

func (s *dramaAuthorizationService) GetDetail(albumID int64) (*DramaSubmissionAuthorizationDetail, error) {
	var submission model.DramaSubmission
	if err := s.db.First(&submission, "album_id = ?", albumID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDramaSubmissionNotFound
		}
		return nil, err
	}
	return s.loadDetail(albumID, submission.SourceAppID)
}

func (s *dramaAuthorizationService) SyncSelection(albumID int64, targetTikTokAppIDs []string) (*DramaSubmissionAuthorizationDetail, error) {
	var submission model.DramaSubmission
	if err := s.db.First(&submission, "album_id = ?", albumID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDramaSubmissionNotFound
		}
		return nil, err
	}

	requested, err := s.resolveRequestedApps(submission.SourceAppID, targetTikTokAppIDs)
	if err != nil {
		return nil, err
	}
	authorized, err := s.loadAuthorizedTargets(albumID)
	if err != nil {
		return nil, err
	}

	toAdd := make([]dramaAuthorizationTarget, 0)
	for id, target := range requested {
		if _, exists := authorized[id]; !exists {
			toAdd = append(toAdd, target)
		}
	}
	toRemove := make([]dramaAuthorizationTarget, 0)
	for id, target := range authorized {
		if _, keep := requested[id]; !keep {
			toRemove = append(toRemove, target)
		}
	}
	sortAuthorizationTargets(toAdd)
	sortAuthorizationTargets(toRemove)

	if err := s.applyAdd(albumID, toAdd); err != nil {
		return nil, err
	}
	if err := s.applyRemove(albumID, toRemove); err != nil {
		return nil, err
	}
	return s.loadDetail(albumID, submission.SourceAppID)
}

func (s *dramaAuthorizationService) GrantAlbumToAllApps(albumID int64) error {
	var submission model.DramaSubmission
	if err := s.db.First(&submission, "album_id = ?", albumID).Error; err != nil {
		return err
	}
	var apps []model.App
	if err := s.db.Where("id <> ?", submission.SourceAppID).Find(&apps).Error; err != nil {
		return err
	}
	targets := appAuthorizationTargets(apps)
	return s.applyAdd(albumID, targets)
}

func (s *dramaAuthorizationService) GrantAppToAllSubmissions(appID int64) error {
	var app model.App
	if err := s.db.First(&app, appID).Error; err != nil {
		return err
	}
	var submissions []model.DramaSubmission
	if err := s.db.Where("source_app_id <> ?", appID).Find(&submissions).Error; err != nil {
		return err
	}
	for _, submission := range submissions {
		if err := s.applyAdd(submission.AlbumID, []dramaAuthorizationTarget{{AppID: app.ID, TikTokAppID: app.TiktokAppID}}); err != nil {
			return err
		}
	}
	return nil
}

func (s *dramaAuthorizationService) resolveRequestedApps(sourceAppID int64, targetTikTokAppIDs []string) (map[int64]dramaAuthorizationTarget, error) {
	unique := make(map[string]struct{}, len(targetTikTokAppIDs))
	cleaned := make([]string, 0, len(targetTikTokAppIDs))
	for _, value := range targetTikTokAppIDs {
		value = strings.TrimSpace(value)
		if value == "" {
			return nil, ErrDramaSubmissionInvalidApp
		}
		if _, exists := unique[value]; exists {
			continue
		}
		unique[value] = struct{}{}
		cleaned = append(cleaned, value)
	}
	if len(cleaned) == 0 {
		return map[int64]dramaAuthorizationTarget{}, nil
	}
	var apps []model.App
	if err := s.db.Where("app_id IN ?", cleaned).Find(&apps).Error; err != nil {
		return nil, err
	}
	if len(apps) != len(cleaned) {
		return nil, ErrDramaSubmissionInvalidApp
	}
	requested := make(map[int64]dramaAuthorizationTarget, len(apps))
	for _, app := range apps {
		if app.ID == sourceAppID {
			return nil, ErrDramaSubmissionInvalidApp
		}
		requested[app.ID] = dramaAuthorizationTarget{AppID: app.ID, TikTokAppID: app.TiktokAppID}
	}
	return requested, nil
}

func (s *dramaAuthorizationService) loadAuthorizedTargets(albumID int64) (map[int64]dramaAuthorizationTarget, error) {
	type row struct {
		ID          int64
		TikTokAppID string
	}
	var rows []row
	if err := s.db.Table("drama_submission_authorizations AS authorizations").
		Select("apps.id, apps.app_id AS tik_tok_app_id").
		Joins("JOIN apps ON apps.id = authorizations.target_app_id").
		Where("authorizations.album_id = ? AND authorizations.status = ?", albumID, model.DramaAuthorizationAuthorized).
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	result := make(map[int64]dramaAuthorizationTarget, len(rows))
	for _, row := range rows {
		result[row.ID] = dramaAuthorizationTarget{AppID: row.ID, TikTokAppID: row.TikTokAppID}
	}
	return result, nil
}

func (s *dramaAuthorizationService) applyAdd(albumID int64, targets []dramaAuthorizationTarget) error {
	if len(targets) == 0 {
		return nil
	}
	results, gatewayErr := s.gateway.Add(albumID, targets)
	return s.persistResults(albumID, targets, results, true, gatewayErr)
}

func (s *dramaAuthorizationService) applyRemove(albumID int64, targets []dramaAuthorizationTarget) error {
	if len(targets) == 0 {
		return nil
	}
	results, gatewayErr := s.gateway.Remove(albumID, targets)
	return s.persistResults(albumID, targets, results, false, gatewayErr)
}

func (s *dramaAuthorizationService) persistResults(albumID int64, targets []dramaAuthorizationTarget, results []dramaAuthorizationResult, adding bool, gatewayErr error) error {
	returned := make(map[int64]dramaAuthorizationResult, len(results))
	for _, result := range results {
		returned[result.AppID] = result
	}
	return s.db.Transaction(func(tx *gorm.DB) error {
		for _, target := range targets {
			result, exists := returned[target.AppID]
			if !exists {
				result = dramaAuthorizationResult{AppID: target.AppID, Error: "TikTok 未返回该小程序的授权结果"}
			}
			if gatewayErr != nil && result.Error == "" {
				result.Error = gatewayErr.Error()
			}
			status := authorizationStatusForResult(adding, result.Succeeded)
			record := model.DramaSubmissionAuthorization{AlbumID: albumID, TargetAppID: target.AppID, Status: status, LastError: result.Error}
			if err := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "album_id"}, {Name: "target_app_id"}},
				DoUpdates: clause.AssignmentColumns([]string{"status", "last_error", "updated_at"}),
			}).Create(&record).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func authorizationStatusForResult(adding, succeeded bool) string {
	if adding == succeeded {
		return model.DramaAuthorizationAuthorized
	}
	return model.DramaAuthorizationUnauthorized
}

func (s *dramaAuthorizationService) loadDetail(albumID, sourceAppID int64) (*DramaSubmissionAuthorizationDetail, error) {
	var apps []model.App
	if err := s.db.Order("name ASC").Find(&apps).Error; err != nil {
		return nil, err
	}
	var authorizations []model.DramaSubmissionAuthorization
	if err := s.db.Where("album_id = ?", albumID).Find(&authorizations).Error; err != nil {
		return nil, err
	}
	states := make(map[int64]model.DramaSubmissionAuthorization, len(authorizations))
	for _, authorization := range authorizations {
		states[authorization.TargetAppID] = authorization
	}
	items := make([]DramaSubmissionAuthorizationItem, 0, len(apps))
	for _, app := range apps {
		state := states[app.ID]
		isSource := app.ID == sourceAppID
		items = append(items, DramaSubmissionAuthorizationItem{
			AppID: app.TiktokAppID, AppName: app.Name, MonetizationType: app.MonetizationType,
			IsSourceApp: isSource, Authorized: isSource || state.Status == model.DramaAuthorizationAuthorized,
			AuthorizationError: state.LastError,
		})
	}
	sort.SliceStable(items, func(i, j int) bool {
		if items[i].IsSourceApp != items[j].IsSourceApp {
			return items[i].IsSourceApp
		}
		return items[i].AppName < items[j].AppName
	})
	return &DramaSubmissionAuthorizationDetail{AlbumID: fmt.Sprintf("%d", albumID), Apps: items}, nil
}

func appAuthorizationTargets(apps []model.App) []dramaAuthorizationTarget {
	targets := make([]dramaAuthorizationTarget, len(apps))
	for i, app := range apps {
		targets[i] = dramaAuthorizationTarget{AppID: app.ID, TikTokAppID: app.TiktokAppID}
	}
	sortAuthorizationTargets(targets)
	return targets
}

func sortAuthorizationTargets(targets []dramaAuthorizationTarget) {
	sort.Slice(targets, func(i, j int) bool { return targets[i].AppID < targets[j].AppID })
}
