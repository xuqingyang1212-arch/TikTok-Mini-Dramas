package service

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"scaffold-admin/internal/model"
	"scaffold-admin/internal/pkg/datetime"
	"scaffold-admin/internal/pkg/snowflake"

	"gorm.io/gorm"
)

// ─── Types ──────────────────────────────────────────────────────────────────

type AppUserListFilter struct {
	AppID   int64
	UserID  string
	OpenID  string
	UnionID string
	// 订阅状态筛选：active/expired/canceled/paused/grace/on_hold/revoked/none（未订阅）
	SubscriptionStatus string
	CreatedAtFrom      *time.Time
	CreatedAtTo        *time.Time
	Page               int
	PageSize           int
}

type AppUserListItem struct {
	ID        string        `json:"id"`
	UserID    string        `json:"userId"`
	AppID     int64         `json:"appId"`
	AppName   string        `json:"appName"`
	OpenID    string        `json:"openId"`
	UnionID   string        `json:"unionId"`
	CreatedAt datetime.Time `json:"createdAt"`
	// 当前订阅状态："active"（生效中）/"expired"（已过期）/""（未订阅）
	SubscriptionStatus   string         `json:"subscriptionStatus"`
	SubscriptionExpireAt *datetime.Time `json:"subscriptionExpireAt"`
}

// ─── User Detail (用户详情弹窗) ─────────────────────────────────────────────

// AppUserSubscriptionRecord 会员订阅记录（仅成功订单）
type AppUserSubscriptionRecord struct {
	Period  string  `json:"period"`  // weekly/monthly/quarterly/yearly
	Amount  float64 `json:"amount"`  // 实付金额（按设备系统取 Apple/Google 价）
	PaidAt  string  `json:"paidAt"`  // 支付时间
	OrderNo string  `json:"orderNo"` // 关联订单号
}

// AppUserUnlockRecord 永久解锁记录。Beans 按订单聚合，广告按单集展示。
type AppUserUnlockRecord struct {
	DramaName   string `json:"dramaName"`   // 剧集名称
	UnlockType  string `json:"unlockType"`  // beans/ad
	UnlockCount int    `json:"unlockCount"` // 解锁集数
	Episodes    []int  `json:"episodes"`    // 具体集数（用于展示 第n~m集）
	BeansCost   int    `json:"beansCost"`   // 消耗 Beans，广告解锁为 0
	UnlockedAt  string `json:"unlockedAt"`  // 支付或广告完成时间
	OrderNo     string `json:"orderNo"`     // Beans 订单号
	AdSessionNo string `json:"adSessionNo"` // 广告会话号
}

// AppUserWatchRecord 阅读记录
type AppUserWatchRecord struct {
	DramaName  string `json:"dramaName"`  // 剧集名称
	EpisodeNo  int    `json:"episodeNo"`  // 集数
	UnlockType string `json:"unlockType"` // 解锁方式 free/subscription/beans/ad/locked
	WatchedAt  string `json:"watchedAt"`  // 观看时间
}

// AppUserDetail 用户详情弹窗返回结构
type AppUserDetail struct {
	ID                   string                      `json:"id"`
	UserID               string                      `json:"userId"`
	AppID                int64                       `json:"appId"`
	AppName              string                      `json:"appName"`
	OpenID               string                      `json:"openId"`
	UnionID              string                      `json:"unionId"`
	CreatedAt            datetime.Time               `json:"createdAt"`
	SubscriptionStatus   string                      `json:"subscriptionStatus"`
	SubscriptionExpireAt *datetime.Time              `json:"subscriptionExpireAt"`
	Subscriptions        []AppUserSubscriptionRecord `json:"subscriptions"`
	Unlocks              []AppUserUnlockRecord       `json:"unlocks"`
	WatchLogs            []AppUserWatchRecord        `json:"watchLogs"`
}

type CreateAppUserInput struct {
	AppID  int64
	OpenID string
}

type AppUserService interface {
	List(filter AppUserListFilter) ([]AppUserListItem, int64, error)
	GetByID(id int64) (*model.AppUser, error)
	Detail(id int64) (*AppUserDetail, error)
	Subscriptions(id int64, page, pageSize int) ([]AppUserSubscriptionRecord, int64, error)
	Unlocks(id int64, unlockType string, page, pageSize int) ([]AppUserUnlockRecord, int64, error)
	WatchLogs(id int64, page, pageSize int) ([]AppUserWatchRecord, int64, error)
	Create(input CreateAppUserInput) (*model.AppUser, error)
	GetOrCreateByOpenID(appID int64, openID string) (*model.AppUser, bool, error)
}

// ─── Errors ─────────────────────────────────────────────────────────────────

var (
	ErrAppUserNotFound    = errors.New("app user not found")
	ErrAppUserOpenIDExist = errors.New("openid already exists")
)

// ─── Implementation ─────────────────────────────────────────────────────────

type appUserService struct {
	db *gorm.DB
}

func (s *appUserService) List(f AppUserListFilter) ([]AppUserListItem, int64, error) {
	db := s.db.Model(&model.AppUser{}).
		Joins("LEFT JOIN apps ON apps.id = app_users.app_id")

	if f.AppID > 0 {
		db = db.Where("app_users.app_id = ?", f.AppID)
	}
	if f.UserID != "" {
		db = db.Where("CAST(app_users.id AS CHAR) LIKE ?", "%"+f.UserID+"%")
	}
	if f.OpenID != "" {
		db = db.Where("app_users.open_id LIKE ?", "%"+f.OpenID+"%")
	}
	if f.UnionID != "" {
		db = db.Where("app_users.union_id LIKE ?", "%"+f.UnionID+"%")
	}
	if f.CreatedAtFrom != nil {
		db = db.Where("app_users.created_at >= ?", f.CreatedAtFrom)
	}
	if f.CreatedAtTo != nil {
		db = db.Where("app_users.created_at < ?", f.CreatedAtTo)
	}

	// 订阅状态筛选（基于 user_subscriptions 子查询）
	if f.SubscriptionStatus != "" {
		now := datetime.NowUTC()
		switch f.SubscriptionStatus {
		case "active":
			db = db.Where("app_users.id IN (?)",
				s.db.Model(&model.UserSubscription{}).Select("user_id").
					Where("status = ? AND expire_at > ?", "active", now))
		case "expired":
			// 有订阅记录，但当前没有任何生效中的订阅（含 status=expired 或已到期）
			db = db.
				Where("app_users.id IN (?)",
					s.db.Model(&model.UserSubscription{}).Select("user_id")).
				Where("app_users.id NOT IN (?)",
					s.db.Model(&model.UserSubscription{}).Select("user_id").
						Where("status = ? AND expire_at > ?", "active", now))
		case "none":
			db = db.Where("app_users.id NOT IN (?)",
				s.db.Model(&model.UserSubscription{}).Select("user_id"))
		default:
			// canceled/paused/grace/on_hold/revoked 等：直接匹配订阅状态字段
			db = db.Where("app_users.id IN (?)",
				s.db.Model(&model.UserSubscription{}).Select("user_id").
					Where("status = ?", f.SubscriptionStatus))
		}
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page, size := normalizePage(f.Page, f.PageSize)
	var results []struct {
		ID        int64     `gorm:"column:id"`
		AppID     int64     `gorm:"column:app_id"`
		AppName   string    `gorm:"column:app_name"`
		OpenID    string    `gorm:"column:open_id"`
		UnionID   string    `gorm:"column:union_id"`
		CreatedAt time.Time `gorm:"column:created_at"`
	}
	err := db.Select("app_users.id, app_users.app_id, apps.name as app_name, app_users.open_id, app_users.union_id, app_users.created_at").
		Order("app_users.created_at DESC").
		Offset((page - 1) * size).
		Limit(size).
		Scan(&results).Error
	if err != nil {
		return nil, 0, err
	}

	items := make([]AppUserListItem, len(results))
	for i, r := range results {
		idStr := fmt.Sprintf("%d", r.ID)
		items[i] = AppUserListItem{
			ID:        idStr,
			UserID:    idStr,
			AppID:     r.AppID,
			AppName:   r.AppName,
			OpenID:    r.OpenID,
			UnionID:   r.UnionID,
			CreatedAt: datetime.From(r.CreatedAt),
		}
	}

	// 批量填充订阅状态与到期时间，避免 N+1 查询
	userIDs := make([]int64, len(results))
	for i, r := range results {
		userIDs[i] = r.ID
	}
	statusMap, err := s.subscriptionStatusMap(userIDs)
	if err != nil {
		return nil, 0, err
	}
	for i := range items {
		if st, ok := statusMap[results[i].ID]; ok {
			items[i].SubscriptionStatus = st.status
			items[i].SubscriptionExpireAt = datetime.FromPtr(st.expireAt)
		}
	}
	return items, total, nil
}

// subUserStatus 单个用户的订阅状态汇总
type subUserStatus struct {
	status   string     // active/expired/""
	expireAt *time.Time // 有订阅记录时为有效订阅或历史订阅中最晚的到期时间
}

// subscriptionStatusMap 批量计算多个用户的当前订阅状态。
// 判定规则：存在 status=active 且 expire_at>now 的订阅记为 active，
// 取其中到期最晚的一条作为到期时间；否则若历史上存在过订阅则记为 expired，
// 并保留历史订阅中最晚的到期时间。
func (s *appUserService) subscriptionStatusMap(userIDs []int64) (map[int64]subUserStatus, error) {
	result := make(map[int64]subUserStatus)
	if len(userIDs) == 0 {
		return result, nil
	}
	var subs []model.UserSubscription
	if err := s.db.Where("user_id IN ?", userIDs).
		Order("expire_at DESC").Find(&subs).Error; err != nil {
		return nil, err
	}

	now := datetime.NowUTC()
	for i := range subs {
		sub := subs[i]
		cur := result[sub.UserID]
		active := sub.Status == "active" && sub.ExpireAt.After(now)
		if active {
			// 已按 expire_at 倒序，首个 active 即到期最晚
			if cur.status != "active" {
				expire := sub.ExpireAt
				result[sub.UserID] = subUserStatus{status: "active", expireAt: &expire}
			}
		} else if cur.status == "" {
			expire := sub.ExpireAt
			result[sub.UserID] = subUserStatus{status: "expired", expireAt: &expire}
		}
	}
	return result, nil
}

func (s *appUserService) GetByID(id int64) (*model.AppUser, error) {
	var user model.AppUser
	if err := s.db.Preload("App").First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAppUserNotFound
		}
		return nil, err
	}
	return &user, nil
}

// Detail 返回用户详情：基础信息 + 会员订阅 + 永久解锁 + 阅读记录。
func (s *appUserService) Detail(id int64) (*AppUserDetail, error) {
	var user model.AppUser
	if err := s.db.Preload("App").First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAppUserNotFound
		}
		return nil, err
	}

	appName := ""
	if user.App != nil {
		appName = user.App.Name
	}

	detail := &AppUserDetail{
		ID:            fmt.Sprintf("%d", user.ID),
		UserID:        fmt.Sprintf("%d", user.ID),
		AppID:         user.AppID,
		AppName:       appName,
		OpenID:        user.OpenID,
		UnionID:       user.UnionID,
		CreatedAt:     datetime.From(user.CreatedAt),
		Subscriptions: make([]AppUserSubscriptionRecord, 0),
		Unlocks:       make([]AppUserUnlockRecord, 0),
		WatchLogs:     make([]AppUserWatchRecord, 0),
	}

	// 当前订阅状态与到期时间
	statusMap, err := s.subscriptionStatusMap([]int64{user.ID})
	if err != nil {
		return nil, err
	}
	if st, ok := statusMap[user.ID]; ok {
		detail.SubscriptionStatus = st.status
		detail.SubscriptionExpireAt = datetime.FromPtr(st.expireAt)
	}

	// ── 成功订阅记录 ──
	subscriptionRecords, _, err := s.querySubscriptionRecords(id, 0, 0)
	if err != nil {
		return nil, err
	}
	detail.Subscriptions = subscriptionRecords

	// ── 永久解锁记录（Beans 按订单、广告按单集）──
	unlockRecords, _, err := s.queryUnlockRecords(user.AppID, id, "", 0, 0)
	if err != nil {
		return nil, err
	}
	detail.Unlocks = unlockRecords

	// ── 阅读记录 ──
	watchRecords, _, err := s.queryWatchRecords(id, 0, 0)
	if err != nil {
		return nil, err
	}
	detail.WatchLogs = watchRecords

	return detail, nil
}

// Unlocks 分页返回用户指定类型的永久解锁记录。
func (s *appUserService) Unlocks(id int64, unlockType string, page, pageSize int) ([]AppUserUnlockRecord, int64, error) {
	pg, size := normalizePage(page, pageSize)

	var user model.AppUser
	if err := s.db.Select("id", "app_id").First(&user, id).Error; err != nil {
		return nil, 0, err
	}
	return s.queryUnlockRecords(user.AppID, id, unlockType, size, (pg-1)*size)
}

func (s *appUserService) Create(in CreateAppUserInput) (*model.AppUser, error) {
	user := model.AppUser{
		ID:      snowflake.NextID(),
		AppID:   in.AppID,
		OpenID:  in.OpenID,
		UnionID: generateUnionID(),
	}
	if err := s.db.Create(&user).Error; err != nil {
		if isDuplicate(err) {
			return nil, ErrAppUserOpenIDExist
		}
		return nil, err
	}
	return &user, nil
}

func (s *appUserService) GetOrCreateByOpenID(appID int64, openID string) (*model.AppUser, bool, error) {
	var user model.AppUser
	err := s.db.Where("open_id = ?", openID).First(&user).Error
	if err == nil {
		return &user, false, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, err
	}

	newUser, err := s.Create(CreateAppUserInput{
		AppID:  appID,
		OpenID: openID,
	})
	if err != nil {
		return nil, false, err
	}
	return newUser, true, nil
}

// generateUnionID 生成 TikTok 风格的 union_id（演示项目随机生成）。
// 真实场景下同一开发者账号下的同一 TikTok 用户在不同小程序共享同一 union_id。
func generateUnionID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("union_%d", snowflake.NextID())
	}
	return "u_" + hex.EncodeToString(b)
}
