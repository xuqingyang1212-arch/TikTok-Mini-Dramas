package model

import "time"

const (
	DramaSubmissionAppID = "tt60ac80b7ca957b06"

	DramaAlbumCompleted    = 3
	DramaReviewUnsubmitted = 0
	DramaReviewPending     = 1
	DramaReviewApproved    = 2
	DramaReviewRejected    = 3
	DramaReviewWithdrawn   = 4
	DramaPublishOnline     = 1
	DramaPublishOffline    = 2
)

// DramaSubmission records the simulated TikTok album created from a local drama.
type DramaSubmission struct {
	AlbumID       int64     `gorm:"column:album_id;primaryKey" json:"albumId"`
	AppID         string    `gorm:"column:app_id;size:128;not null" json:"appId"`
	DramaID       int64     `gorm:"column:drama_id;not null;uniqueIndex" json:"dramaId"`
	SubmittedName string    `gorm:"column:submitted_name;size:256;not null" json:"submittedName"`
	Language      string    `gorm:"size:32;not null" json:"language"`
	Year          int       `gorm:"not null" json:"year"`
	Description   string    `gorm:"column:description;type:text;not null" json:"description"`
	DramaType     int       `gorm:"column:drama_type;not null" json:"dramaType"`
	TagList       []int     `gorm:"column:tag_list;type:json;serializer:json;not null" json:"tagList"`
	Version       int       `gorm:"not null;default:1" json:"version"`
	AlbumStatus   int       `gorm:"column:album_status;not null;default:3" json:"albumStatus"`
	ReviewID      int64     `gorm:"column:review_id;not null;uniqueIndex" json:"reviewId"`
	ReviewStatus  int       `gorm:"column:review_status;not null" json:"reviewStatus"`
	PublishStatus int       `gorm:"column:publish_status;not null" json:"publishStatus"`
	CreatedAt     time.Time `gorm:"column:created_at;not null;index" json:"createdAt"`
	UpdatedAt     time.Time `gorm:"column:updated_at;not null" json:"updatedAt"`
}

func (DramaSubmission) TableName() string {
	return "drama_submissions"
}
