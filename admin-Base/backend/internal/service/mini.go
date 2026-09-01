package service

import (
	"errors"
	"fmt"

	"scaffold-admin/internal/model"
	"scaffold-admin/internal/pkg/datetime"
	"scaffold-admin/internal/pkg/snowflake"

	"gorm.io/gorm"
)

// ─── Errors ─────────────────────────────────────────────────────────────────

var (
	ErrAppDisabled = errors.New("app is disabled")
)

// ─── Types ──────────────────────────────────────────────────────────────────

type MiniLoginResult struct {
	UserID string `json:"userId"`
	IsNew  bool   `json:"isNew"`
	// 会员状态
	Subscription MiniSubscriptionStatus `json:"subscription"`
}

// MiniSubscriptionStatus 用户当前会员状态
type MiniSubscriptionStatus struct {
	Active   bool   `json:"active"`             // 是否在有效会员周期内
	Period   string `json:"period,omitempty"`   // 订阅周期：weekly/monthly/quarterly/yearly
	ExpireAt string `json:"expireAt,omitempty"` // 会员到期时间（RFC3339），active=false 时为空
}

// MiniUserProfile 用户信息（个人中心用）
type MiniUserProfile struct {
	UserID       string                 `json:"userId"`
	OpenID       string                 `json:"openId"`
	AppName      string                 `json:"appName"`
	ClientKey    string                 `json:"clientKey"`
	CreatedAt    string                 `json:"createdAt"`
	Subscription MiniSubscriptionStatus `json:"subscription"`
}

type MiniDramaItem struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	CoverURL       string `json:"coverUrl"`
	Language       string `json:"language"`
	EpisodeCount   int    `json:"episodeCount"`
	PaywallEpisode int    `json:"paywallEpisode"`
}

type MiniDramaDetail struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	CoverURL       string `json:"coverUrl"`
	Language       string `json:"language"`
	EpisodeCount   int    `json:"episodeCount"`
	PaywallEpisode int    `json:"paywallEpisode"`
}

type MiniEpisodeItem struct {
	EpisodeNo     int    `json:"episodeNo"`
	VideoURL      string `json:"videoUrl"`
	Duration      int    `json:"duration"`
	IsFree        bool   `json:"isFree"`        // 是否免费
	IsUnlocked    bool   `json:"isUnlocked"`    // 当前用户是否可观看（免费/订阅/永久权益）
	CanUnlockByAd bool   `json:"canUnlockByAd"` // 当前未解锁集是否允许观看广告解锁
	// 解锁来源：free=免费集, beans=Beans购买, subscription=会员, ad=广告, locked=未解锁
	UnlockType string `json:"unlockType"`
}

type MiniAppItem struct {
	Name             string `json:"name"`
	ClientKey        string `json:"clientKey"`
	MonetizationType string `json:"monetizationType"`
	AdPlacementID    string `json:"adPlacementId"`
}

// MiniUnlockStatus 用户在某部剧的逐集解锁详情
type MiniUnlockStatus struct {
	DramaID        string `json:"dramaId"`
	EpisodeCount   int    `json:"episodeCount"`
	PaywallEpisode int    `json:"paywallEpisode"`
	// 会员解锁：true 时所有集均由会员解锁
	BySubscription bool              `json:"bySubscription"`
	UnlockedCount  int               `json:"unlockedCount"`  // 已解锁集数
	RemainingCount int               `json:"remainingCount"` // 剩余未解锁集数
	Episodes       []MiniEpisodeItem `json:"episodes"`
}

// MiniWatchReportResult 观看上报结果
type MiniWatchReportResult struct {
	LogID      string `json:"logId"`
	DramaID    string `json:"dramaId"`
	EpisodeNo  int    `json:"episodeNo"`
	UnlockType string `json:"unlockType"` // free/beans/subscription/ad/locked
	WatchedAt  string `json:"watchedAt"`  // YYYY-MM-DDTHH:mm:ss.SSSZ
}

// ─── Interface ──────────────────────────────────────────────────────────────

type MiniService interface {
	// App
	ListApps() ([]MiniAppItem, error)

	// Auth
	Login(appID, openID string) (*MiniLoginResult, error)

	// Drama
	ListDramas(page, pageSize int) ([]MiniDramaItem, int64, error)
	GetDrama(id int64) (*MiniDramaDetail, error)

	// Episode
	ListEpisodes(dramaID, userID int64) ([]MiniEpisodeItem, int, error)
	GetEpisode(dramaID, userID int64, episodeNo int) (*MiniEpisodeItem, error)

	// 用户在某部剧的逐集解锁详情
	UnlockStatus(dramaID, userID int64) (*MiniUnlockStatus, error)

	// 用户信息（个人中心刷新会员状态用）
	GetUserProfile(userID int64) (*MiniUserProfile, error)

	// 观看上报：记录用户开始播放某剧某一集
	ReportWatch(userID, dramaID int64, episodeNo int) (*MiniWatchReportResult, error)
}

// ─── Implementation ─────────────────────────────────────────────────────────

type miniService struct {
	db           *gorm.DB
	payment      MiniPaymentService
	entitlements *entitlementResolver
}

// ListApps 获取可用小程序列表（仅返回已启用的）
func (s *miniService) ListApps() ([]MiniAppItem, error) {
	var apps []model.App
	err := s.db.Where("status = ?", "启用").Order("created_at DESC").Find(&apps).Error
	if err != nil {
		return nil, err
	}

	items := make([]MiniAppItem, len(apps))
	for i, a := range apps {
		items[i] = MiniAppItem{
			Name:             a.Name,
			ClientKey:        a.ClientKey,
			MonetizationType: a.MonetizationType,
			AdPlacementID:    a.AdPlacementID,
		}
	}
	return items, nil
}

// Login 小程序用户登录/注册
// 如果用户存在则返回已有用户，否则创建新用户
func (s *miniService) Login(appID, openID string) (*MiniLoginResult, error) {
	// 1. 查找小程序
	var app model.App
	if err := s.db.Where("client_key = ?", appID).First(&app).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAppNotFound
		}
		return nil, err
	}

	// 2. 检查小程序状态
	if app.Status != "启用" {
		return nil, ErrAppDisabled
	}

	// 3. 查找或创建用户
	var user model.AppUser
	err := s.db.Where("app_id = ? AND open_id = ?", app.ID, openID).First(&user).Error

	if err == nil {
		// 用户已存在
		return &MiniLoginResult{
			UserID:       fmt.Sprintf("%d", user.ID),
			IsNew:        false,
			Subscription: s.subStatus(user.ID),
		}, nil
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	// 4. 创建新用户
	// union_id 按 open_id 维度绑定：同一 TikTok 账号（相同 open_id）在不同小程序
	// 下共享同一 union_id；若该 open_id 从未出现过则新生成一个。
	unionID := s.resolveUnionID(openID)
	user = model.AppUser{
		ID:      snowflake.NextID(),
		AppID:   app.ID,
		OpenID:  openID,
		UnionID: unionID,
	}
	if err := s.db.Create(&user).Error; err != nil {
		return nil, err
	}

	return &MiniLoginResult{
		UserID:       fmt.Sprintf("%d", user.ID),
		IsNew:        true,
		Subscription: MiniSubscriptionStatus{Active: false},
	}, nil
}

// resolveUnionID 解析 open_id 对应的 union_id：
// 若已有相同 open_id 的用户（其他小程序注册过）则复用其 union_id，
// 否则生成一个新的 union_id。
func (s *miniService) resolveUnionID(openID string) string {
	var existing model.AppUser
	err := s.db.Select("union_id").
		Where("open_id = ? AND union_id <> ''", openID).
		First(&existing).Error
	if err == nil && existing.UnionID != "" {
		return existing.UnionID
	}
	return generateUnionID()
}

// ListDramas 获取已上架剧集列表，按创建时间倒序
func (s *miniService) ListDramas(page, pageSize int) ([]MiniDramaItem, int64, error) {
	var total int64
	if err := s.db.Model(&model.Drama{}).Where("status = ?", "上架").Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var dramas []model.Drama
	offset := (page - 1) * pageSize
	err := s.db.Where("status = ?", "上架").
		Order("created_at DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&dramas).Error
	if err != nil {
		return nil, 0, err
	}

	items := make([]MiniDramaItem, len(dramas))
	for i, d := range dramas {
		items[i] = MiniDramaItem{
			ID:             fmt.Sprintf("%d", d.ID),
			Name:           d.Name,
			CoverURL:       d.CoverURL,
			Language:       d.Language,
			EpisodeCount:   d.EpisodeCount,
			PaywallEpisode: d.PaywallEpisode,
		}
	}

	return items, total, nil
}

// GetDrama 获取剧集详情（仅返回已上架的）
func (s *miniService) GetDrama(id int64) (*MiniDramaDetail, error) {
	var drama model.Drama
	err := s.db.Where("id = ? AND status = ?", id, "上架").First(&drama).Error
	if err != nil {
		return nil, err
	}

	return &MiniDramaDetail{
		ID:             fmt.Sprintf("%d", drama.ID),
		Name:           drama.Name,
		CoverURL:       drama.CoverURL,
		Language:       drama.Language,
		EpisodeCount:   drama.EpisodeCount,
		PaywallEpisode: drama.PaywallEpisode,
	}, nil
}

func buildMiniEpisodeItem(episode model.Episode, paywallEpisode int, entitlements *entitlementContext) MiniEpisodeItem {
	unlockType := entitlements.UnlockTypes[episode.EpisodeNo]
	if unlockType == "" {
		unlockType = unlockTypeLocked
	}
	unlocked := unlockType != unlockTypeLocked
	videoURL := episode.VideoURL
	if !unlocked {
		videoURL = ""
	}
	return MiniEpisodeItem{
		EpisodeNo:     episode.EpisodeNo,
		VideoURL:      videoURL,
		Duration:      episode.Duration,
		IsFree:        episode.EpisodeNo < paywallEpisode,
		IsUnlocked:    unlocked,
		CanUnlockByAd: !unlocked && entitlements.CanUnlockAd,
		UnlockType:    unlockType,
	}
}

// subStatus 组装用户会员状态
func (s *miniService) subStatus(userID int64) MiniSubscriptionStatus {
	if s.payment == nil {
		return MiniSubscriptionStatus{Active: false}
	}
	st := s.payment.SubscriptionStatus(userID)
	out := MiniSubscriptionStatus{Active: st.Active, Period: st.Period}
	if st.Active && st.ExpireAt != nil {
		out.ExpireAt = datetime.FormatUTC(*st.ExpireAt)
	}
	return out
}

// UnlockStatus 返回用户在某部剧的逐集解锁详情
func (s *miniService) UnlockStatus(dramaID, userID int64) (*MiniUnlockStatus, error) {
	var drama model.Drama
	if err := s.db.Where("id = ? AND status = ?", dramaID, "上架").First(&drama).Error; err != nil {
		return nil, err
	}

	var episodes []model.Episode
	if err := s.db.Where("drama_id = ?", dramaID).Order("episode_no ASC").Find(&episodes).Error; err != nil {
		return nil, err
	}

	entitlements, err := s.entitlements.resolve(drama, userID)
	if err != nil {
		return nil, err
	}
	items := make([]MiniEpisodeItem, len(episodes))
	unlockedCount := 0
	for i, episode := range episodes {
		items[i] = buildMiniEpisodeItem(episode, drama.PaywallEpisode, entitlements)
		if items[i].IsUnlocked {
			unlockedCount++
		}
	}

	return &MiniUnlockStatus{
		DramaID:        fmt.Sprintf("%d", drama.ID),
		EpisodeCount:   drama.EpisodeCount,
		PaywallEpisode: drama.PaywallEpisode,
		BySubscription: entitlements.Subscription,
		UnlockedCount:  unlockedCount,
		RemainingCount: drama.EpisodeCount - unlockedCount,
		Episodes:       items,
	}, nil
}

// ReportWatch 记录一条观看上报。前端在某集开始播放时调用。
// 解锁方式由服务端依据当前解锁状态判定（免费/Beans/会员/广告），不采信前端上报。
func (s *miniService) ReportWatch(userID, dramaID int64, episodeNo int) (*MiniWatchReportResult, error) {
	// 校验用户，并取其所属小程序
	var user model.AppUser
	if err := s.db.First(&user, userID).Error; err != nil {
		return nil, ErrAppUserNotFound
	}

	// 校验剧集（须为已上架）
	var drama model.Drama
	if err := s.db.Where("id = ? AND status = ?", dramaID, "上架").First(&drama).Error; err != nil {
		return nil, ErrDramaNotAvailable
	}

	// 校验集数：须为该剧存在的集
	if episodeNo < 1 || episodeNo > drama.EpisodeCount {
		return nil, ErrEpisodeNotFound
	}
	var ep model.Episode
	if err := s.db.Where("drama_id = ? AND episode_no = ?", dramaID, episodeNo).First(&ep).Error; err != nil {
		return nil, ErrEpisodeNotFound
	}

	// 服务端判定解锁方式：free / beans / subscription / ad / locked
	entitlements, err := s.entitlements.resolve(drama, userID)
	if err != nil {
		return nil, err
	}
	unlockType := entitlements.UnlockTypes[episodeNo]
	if unlockType == "" {
		unlockType = unlockTypeLocked
	}
	// 未解锁的集不上报（前端不应对未解锁内容触发观看上报）
	if unlockType == unlockTypeLocked {
		return nil, ErrEpisodeLocked
	}

	now := datetime.NowUTC()
	logEntry := model.WatchLog{
		ID:         snowflake.NextID(),
		AppID:      user.AppID,
		UserID:     userID,
		DramaID:    dramaID,
		EpisodeNo:  episodeNo,
		UnlockType: unlockType,
		WatchedAt:  now,
		CreatedAt:  now,
	}
	if err := s.db.Create(&logEntry).Error; err != nil {
		return nil, err
	}

	return &MiniWatchReportResult{
		LogID:      fmt.Sprintf("%d", logEntry.ID),
		DramaID:    fmt.Sprintf("%d", dramaID),
		EpisodeNo:  episodeNo,
		UnlockType: unlockType,
		WatchedAt:  datetime.FormatUTC(now),
	}, nil
}

// GetUserProfile 返回用户信息及当前会员状态
func (s *miniService) GetUserProfile(userID int64) (*MiniUserProfile, error) {
	var user model.AppUser
	if err := s.db.First(&user, userID).Error; err != nil {
		return nil, ErrAppUserNotFound
	}

	profile := &MiniUserProfile{
		UserID:       fmt.Sprintf("%d", user.ID),
		OpenID:       user.OpenID,
		CreatedAt:    datetime.FormatUTC(user.CreatedAt),
		Subscription: s.subStatus(user.ID),
	}

	var app model.App
	if err := s.db.First(&app, user.AppID).Error; err == nil {
		profile.AppName = app.Name
		profile.ClientKey = app.ClientKey
	}

	return profile, nil
}

// ListEpisodes 获取剧集的所有单集
func (s *miniService) ListEpisodes(dramaID, userID int64) ([]MiniEpisodeItem, int, error) {
	// 先检查剧集是否上架，并获取付费卡点
	var drama model.Drama
	if err := s.db.Where("id = ? AND status = ?", dramaID, "上架").First(&drama).Error; err != nil {
		return nil, 0, err
	}

	var episodes []model.Episode
	err := s.db.Where("drama_id = ?", dramaID).Order("episode_no ASC").Find(&episodes).Error
	if err != nil {
		return nil, 0, err
	}

	entitlements, err := s.entitlements.resolve(drama, userID)
	if err != nil {
		return nil, 0, err
	}
	items := make([]MiniEpisodeItem, len(episodes))
	for i, episode := range episodes {
		items[i] = buildMiniEpisodeItem(episode, drama.PaywallEpisode, entitlements)
	}

	return items, drama.PaywallEpisode, nil
}

// GetEpisode 获取单集播放信息
func (s *miniService) GetEpisode(dramaID, userID int64, episodeNo int) (*MiniEpisodeItem, error) {
	// 先检查剧集是否上架，并获取付费卡点
	var drama model.Drama
	if err := s.db.Where("id = ? AND status = ?", dramaID, "上架").First(&drama).Error; err != nil {
		return nil, err
	}

	var episode model.Episode
	err := s.db.Where("drama_id = ? AND episode_no = ?", dramaID, episodeNo).First(&episode).Error
	if err != nil {
		return nil, err
	}

	entitlements, err := s.entitlements.resolve(drama, userID)
	if err != nil {
		return nil, err
	}
	item := buildMiniEpisodeItem(episode, drama.PaywallEpisode, entitlements)
	return &item, nil
}
