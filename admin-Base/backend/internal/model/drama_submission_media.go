package model

import "time"

const (
	DramaSubmissionMediaCover      = "cover"
	DramaSubmissionMediaEpisode    = "episode"
	DramaSubmissionMediaProcessing = "processing"
	DramaSubmissionMediaSuccess    = "success"
	DramaSubmissionMediaFailed     = "failed"
)

// DramaSubmissionMedia records the simulated TikTok upload result for a submitted resource.
type DramaSubmissionMedia struct {
	ID              int64      `gorm:"primaryKey" json:"id"`
	AlbumID         int64      `gorm:"column:album_id;not null;index;uniqueIndex:uk_submission_media,priority:1" json:"albumId"`
	Version         int        `gorm:"not null;uniqueIndex:uk_submission_media,priority:2" json:"version"`
	MediaType       string     `gorm:"column:media_type;size:16;not null;uniqueIndex:uk_submission_media,priority:3" json:"mediaType"`
	EpisodeID       int64      `gorm:"column:episode_id;not null;default:0;uniqueIndex:uk_submission_media,priority:4" json:"episodeId"`
	EpisodeNo       int        `gorm:"column:episode_no;not null;default:0" json:"episodeNo"`
	SourceURL       string     `gorm:"column:source_url;size:512;not null" json:"sourceUrl"`
	UploadStatus    string     `gorm:"column:upload_status;size:16;not null" json:"uploadStatus"`
	JobID           string     `gorm:"column:job_id;size:128" json:"jobId"`
	VID             string     `gorm:"column:vid;size:128" json:"vid"`
	ReviewStatus    int        `gorm:"column:review_status;not null;default:0" json:"reviewStatus"`
	RejectionReason string     `gorm:"column:rejection_reason;size:512;not null;default:''" json:"rejectionReason"`
	SourceMediaID   int64      `gorm:"column:source_media_id;not null;default:0;index" json:"sourceMediaId"`
	UploadError     string     `gorm:"column:upload_error;size:512;not null;default:''" json:"uploadError"`
	RetryCount      int        `gorm:"column:retry_count;not null;default:0" json:"retryCount"`
	LastAttemptAt   *time.Time `gorm:"column:last_attempt_at" json:"lastAttemptAt"`
	CreatedAt       time.Time  `gorm:"column:created_at;not null" json:"createdAt"`
	UpdatedAt       time.Time  `gorm:"column:updated_at;not null" json:"updatedAt"`
}

func (DramaSubmissionMedia) TableName() string {
	return "drama_submission_media"
}
