package model

import "time"

// Episode 剧集单集
type Episode struct {
	ID        int64     `gorm:"primaryKey" json:"id"`                                                     // 雪花ID
	DramaID   int64     `gorm:"index;not null;uniqueIndex:uk_episode_drama_no,priority:1" json:"dramaId"` // 所属剧集ID
	EpisodeNo int       `gorm:"not null;uniqueIndex:uk_episode_drama_no,priority:2" json:"episodeNo"`     // 集数序号（从1开始）
	VideoURL  string    `gorm:"size:512;not null" json:"videoUrl"`                                        // 视频文件URL
	Duration  int       `gorm:"default:0" json:"duration"`                                                // 视频时长（秒）
	FileSize  int64     `gorm:"default:0" json:"fileSize"`                                                // 文件大小（字节）
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// TableName 指定表名
func (Episode) TableName() string {
	return "episodes"
}
