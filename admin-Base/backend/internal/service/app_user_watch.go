package service

import (
	"scaffold-admin/internal/model"
	"scaffold-admin/internal/pkg/datetime"
)

func (s *appUserService) queryWatchRecords(userID int64, limit, offset int) ([]AppUserWatchRecord, int64, error) {
	base := s.db.Model(&model.WatchLog{}).Where("user_id = ?", userID)

	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var logs []model.WatchLog
	query := base.Order("watched_at DESC")
	if limit > 0 {
		query = query.Offset(offset).Limit(limit)
	}
	if err := query.Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	dramaIDs := make([]int64, 0, len(logs))
	for _, log := range logs {
		dramaIDs = append(dramaIDs, log.DramaID)
	}
	dramaNames := map[int64]string{}
	if len(dramaIDs) > 0 {
		var dramas []model.Drama
		if err := s.db.Where("id IN ?", dramaIDs).Find(&dramas).Error; err != nil {
			return nil, 0, err
		}
		for _, drama := range dramas {
			dramaNames[drama.ID] = drama.Name
		}
	}

	items := make([]AppUserWatchRecord, 0, len(logs))
	for _, log := range logs {
		items = append(items, AppUserWatchRecord{
			DramaName:  dramaNames[log.DramaID],
			EpisodeNo:  log.EpisodeNo,
			UnlockType: log.UnlockType,
			WatchedAt:  datetime.FormatUTC(log.WatchedAt),
		})
	}
	return items, total, nil
}

// WatchLogs 分页返回用户阅读记录。
func (s *appUserService) WatchLogs(id int64, page, pageSize int) ([]AppUserWatchRecord, int64, error) {
	pg, size := normalizePage(page, pageSize)
	return s.queryWatchRecords(id, size, (pg-1)*size)
}
