package service

import (
	"time"

	"scaffold-admin/internal/model"
	"scaffold-admin/internal/pkg/datetime"
)

type unlockRecordRow struct {
	UnlockType  string
	SortID      int64
	DramaID     int64
	UnlockCount int
	EpisodeList string
	BeansCost   int
	UnlockedAt  time.Time
	OrderNo     string
	AdSessionNo string
}

const unlockRecordsQuery = `
	SELECT unlock_type, sort_id, drama_id, unlock_count, episode_list, beans_cost,
	       unlocked_at, order_no, ad_session_no
	FROM (
		SELECT 'beans' AS unlock_type, id AS sort_id, drama_id, unlock_count, episode_list, beans_cost,
		       COALESCE(paid_at, created_at) AS unlocked_at, order_no, '' AS ad_session_no
		FROM payment_orders
		WHERE app_id = ? AND user_id = ? AND pay_status = 'paid' AND order_type = 'unlock'
		UNION ALL
		SELECT 'ad' AS unlock_type, u.id AS sort_id, u.drama_id, 1 AS unlock_count,
		       CAST(u.episode_no AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS episode_list, 0 AS beans_cost,
		       u.created_at AS unlocked_at, '' AS order_no,
		       COALESCE(s.session_no, '') AS ad_session_no
		FROM user_unlocks u
		LEFT JOIN ad_unlock_sessions s ON s.id = u.ad_session_id
		WHERE u.app_id = ? AND u.user_id = ? AND u.unlock_type = 'ad'
	) AS unlock_records`

func (s *appUserService) queryUnlockRecords(appID, userID int64, unlockType string, limit, offset int) ([]AppUserUnlockRecord, int64, error) {
	var beansTotal int64
	if unlockType == "" || unlockType == unlockTypeBeans {
		if err := s.db.Model(&model.PaymentOrder{}).
			Where("app_id = ? AND user_id = ? AND pay_status = ? AND order_type = ?", appID, userID, "paid", "unlock").
			Count(&beansTotal).Error; err != nil {
			return nil, 0, err
		}
	}
	var adTotal int64
	if unlockType == "" || unlockType == unlockTypeAd {
		if err := s.db.Model(&model.UserUnlock{}).
			Where("app_id = ? AND user_id = ? AND unlock_type = ?", appID, userID, unlockTypeAd).
			Count(&adTotal).Error; err != nil {
			return nil, 0, err
		}
	}
	total := beansTotal + adTotal
	if total == 0 {
		return []AppUserUnlockRecord{}, 0, nil
	}

	query := unlockRecordsQuery
	args := []any{appID, userID, appID, userID}
	if unlockType != "" {
		query += " WHERE unlock_type = ?"
		args = append(args, unlockType)
	}
	query += " ORDER BY unlocked_at DESC, unlock_type ASC, sort_id DESC"
	if limit > 0 {
		query += " LIMIT ? OFFSET ?"
		args = append(args, limit, offset)
	}
	var rows []unlockRecordRow
	if err := s.db.Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}

	dramaIDs := make([]int64, 0, len(rows))
	for _, row := range rows {
		if row.DramaID > 0 {
			dramaIDs = append(dramaIDs, row.DramaID)
		}
	}
	dramaNames := make(map[int64]string, len(dramaIDs))
	if len(dramaIDs) > 0 {
		var dramas []model.Drama
		if err := s.db.Where("id IN ?", dramaIDs).Find(&dramas).Error; err != nil {
			return nil, 0, err
		}
		for _, drama := range dramas {
			dramaNames[drama.ID] = drama.Name
		}
	}

	items := make([]AppUserUnlockRecord, 0, len(rows))
	for _, row := range rows {
		items = append(items, AppUserUnlockRecord{
			DramaName:   dramaNames[row.DramaID],
			UnlockType:  row.UnlockType,
			UnlockCount: row.UnlockCount,
			Episodes:    decodeEpisodes(row.EpisodeList),
			BeansCost:   row.BeansCost,
			UnlockedAt:  datetime.FormatUTC(row.UnlockedAt),
			OrderNo:     row.OrderNo,
			AdSessionNo: row.AdSessionNo,
		})
	}
	return items, total, nil
}
