package service

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"scaffold-admin/internal/model"
	"scaffold-admin/internal/pkg/snowflake"

	"gorm.io/gorm"
)

// ─── Types ──────────────────────────────────────────────────────────────────

type EpisodeItem struct {
	ID        string `json:"id"`
	DramaID   string `json:"dramaId"`
	EpisodeNo int    `json:"episodeNo"`
	VideoURL  string `json:"videoUrl"`
	Duration  int    `json:"duration"`
	FileSize  int64  `json:"fileSize"`
}

type CreateEpisodeInput struct {
	DramaID   int64
	EpisodeNo int
	VideoURL  string
	Duration  int
	FileSize  int64
}

type BatchCreateEpisodeInput struct {
	DramaID  int64
	Episodes []EpisodeUpload
}

type EpisodeUpload struct {
	EpisodeNo int
	VideoURL  string
	Duration  int
	FileSize  int64
}

type EpisodeService interface {
	ListByDrama(dramaID int64) ([]EpisodeItem, error)
	Create(input CreateEpisodeInput) (*model.Episode, error)
	BatchCreate(input BatchCreateEpisodeInput) ([]EpisodeItem, error)
	Update(id int64, videoURL string, duration int, fileSize int64) error
	Delete(id int64) error
}

// ─── Errors ─────────────────────────────────────────────────────────────────

var (
	ErrEpisodeNotFound      = errors.New("episode not found")
	ErrEpisodeNonContinuous = errors.New("episode numbers must be continuous starting from current max+1")
	ErrEpisodeDuplicate     = errors.New("episode number already exists")
	ErrEpisodeNotLast       = errors.New("only the last episode can be deleted")
)

// MediaStorageDir is the external directory for new media files
const MediaStorageDir = "/Users/xuqingyang/Documents/cursor文件/媒体文件存储/tiktok mini drama"

// deleteMediaFile removes a media file from disk
// Supports both old /uploads/... paths and new /media/... paths
func deleteMediaFile(urlPath string) {
	if urlPath == "" {
		return
	}
	var localPath string
	if strings.HasPrefix(urlPath, "/media/") {
		// New path: /media/videos/2026/08/03/xxx.mp4
		// Local: MediaStorageDir + /videos/2026/08/03/xxx.mp4
		localPath = filepath.Join(MediaStorageDir, strings.TrimPrefix(urlPath, "/media"))
	} else if strings.HasPrefix(urlPath, "/uploads/") {
		// Legacy path: /uploads/videos/2026/07/31/xxx.mp4
		// Local: ./uploads/videos/2026/07/31/xxx.mp4
		localPath = "." + urlPath
	} else {
		return
	}
	if absPath, err := filepath.Abs(localPath); err == nil {
		if _, err := os.Stat(absPath); err == nil {
			os.Remove(absPath)
		}
	}
}

// ─── Implementation ─────────────────────────────────────────────────────────

type episodeService struct {
	db *gorm.DB
}

func (s *episodeService) ListByDrama(dramaID int64) ([]EpisodeItem, error) {
	var episodes []model.Episode
	err := s.db.Where("drama_id = ?", dramaID).Order("episode_no ASC").Find(&episodes).Error
	if err != nil {
		return nil, err
	}

	items := make([]EpisodeItem, len(episodes))
	for i, e := range episodes {
		items[i] = EpisodeItem{
			ID:        fmt.Sprintf("%d", e.ID),
			DramaID:   fmt.Sprintf("%d", e.DramaID),
			EpisodeNo: e.EpisodeNo,
			VideoURL:  e.VideoURL,
			Duration:  e.Duration,
			FileSize:  e.FileSize,
		}
	}
	return items, nil
}

func (s *episodeService) getMaxEpisodeNo(dramaID int64) (int, error) {
	var maxNo int
	err := s.db.Model(&model.Episode{}).
		Where("drama_id = ?", dramaID).
		Select("COALESCE(MAX(episode_no), 0)").
		Scan(&maxNo).Error
	return maxNo, err
}

func (s *episodeService) updateDramaEpisodeCount(dramaID int64) error {
	var count int64
	if err := s.db.Model(&model.Episode{}).Where("drama_id = ?", dramaID).Count(&count).Error; err != nil {
		return err
	}
	return s.db.Model(&model.Drama{}).Where("id = ?", dramaID).Update("episode_count", count).Error
}

func (s *episodeService) Create(input CreateEpisodeInput) (*model.Episode, error) {
	// Check if episode number already exists
	var exists int64
	if err := s.db.Model(&model.Episode{}).
		Where("drama_id = ? AND episode_no = ?", input.DramaID, input.EpisodeNo).
		Count(&exists).Error; err != nil {
		return nil, err
	}
	if exists > 0 {
		return nil, ErrEpisodeDuplicate
	}

	episode := model.Episode{
		ID:        snowflake.NextID(),
		DramaID:   input.DramaID,
		EpisodeNo: input.EpisodeNo,
		VideoURL:  input.VideoURL,
		Duration:  input.Duration,
		FileSize:  input.FileSize,
	}
	if err := s.db.Create(&episode).Error; err != nil {
		return nil, err
	}

	// Update drama episode count
	if err := s.updateDramaEpisodeCount(input.DramaID); err != nil {
		return nil, err
	}

	return &episode, nil
}

func (s *episodeService) BatchCreate(input BatchCreateEpisodeInput) ([]EpisodeItem, error) {
	if len(input.Episodes) == 0 {
		return nil, errors.New("no episodes to create")
	}

	// Get current max episode number
	maxNo, err := s.getMaxEpisodeNo(input.DramaID)
	if err != nil {
		return nil, err
	}

	// Sort episodes by episode number
	episodes := make([]EpisodeUpload, len(input.Episodes))
	copy(episodes, input.Episodes)
	sort.Slice(episodes, func(i, j int) bool {
		return episodes[i].EpisodeNo < episodes[j].EpisodeNo
	})

	// Validate continuity: must start from maxNo+1 and be continuous
	expectedNo := maxNo + 1
	for _, ep := range episodes {
		if ep.EpisodeNo != expectedNo {
			return nil, fmt.Errorf("%w: expected episode %d, got %d", ErrEpisodeNonContinuous, expectedNo, ep.EpisodeNo)
		}
		expectedNo++
	}

	// Create episodes in transaction
	var created []model.Episode
	err = s.db.Transaction(func(tx *gorm.DB) error {
		for _, ep := range episodes {
			episode := model.Episode{
				ID:        snowflake.NextID(),
				DramaID:   input.DramaID,
				EpisodeNo: ep.EpisodeNo,
				VideoURL:  ep.VideoURL,
				Duration:  ep.Duration,
				FileSize:  ep.FileSize,
			}
			if err := tx.Create(&episode).Error; err != nil {
				return err
			}
			created = append(created, episode)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	// Update drama episode count
	if err := s.updateDramaEpisodeCount(input.DramaID); err != nil {
		return nil, err
	}

	// Convert to items
	items := make([]EpisodeItem, len(created))
	for i, e := range created {
		items[i] = EpisodeItem{
			ID:        fmt.Sprintf("%d", e.ID),
			DramaID:   fmt.Sprintf("%d", e.DramaID),
			EpisodeNo: e.EpisodeNo,
			VideoURL:  e.VideoURL,
			Duration:  e.Duration,
			FileSize:  e.FileSize,
		}
	}
	return items, nil
}

func (s *episodeService) Update(id int64, videoURL string, duration int, fileSize int64) error {
	var episode model.Episode
	if err := s.db.First(&episode, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrEpisodeNotFound
		}
		return err
	}

	// Store old video URL before update
	oldVideoURL := episode.VideoURL

	if err := s.db.Model(&episode).Updates(map[string]interface{}{
		"video_url": videoURL,
		"duration":  duration,
		"file_size": fileSize,
	}).Error; err != nil {
		return err
	}

	// Delete old video file if URL changed
	if oldVideoURL != "" && oldVideoURL != videoURL {
		deleteMediaFile(oldVideoURL)
	}

	return nil
}

func (s *episodeService) Delete(id int64) error {
	var episode model.Episode
	if err := s.db.First(&episode, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrEpisodeNotFound
		}
		return err
	}

	// 只允许删除最后一集，保证集数连续、不留空洞。
	maxNo, err := s.getMaxEpisodeNo(episode.DramaID)
	if err != nil {
		return err
	}
	if episode.EpisodeNo != maxNo {
		return ErrEpisodeNotLast
	}

	// Store video URL before deleting from DB
	videoURL := episode.VideoURL
	dramaID := episode.DramaID

	if err := s.db.Delete(&episode).Error; err != nil {
		return err
	}

	// Delete video file from disk
	deleteMediaFile(videoURL)

	// Update drama episode count
	return s.updateDramaEpisodeCount(dramaID)
}
