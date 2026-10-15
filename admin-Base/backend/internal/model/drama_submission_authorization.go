package model

import "time"

const (
	DramaAuthorizationAuthorized   = "authorized"
	DramaAuthorizationUnauthorized = "unauthorized"
)

// DramaSubmissionAuthorization records the latest persisted authorization result for a target app.
type DramaSubmissionAuthorization struct {
	ID          int64     `gorm:"primaryKey" json:"id"`
	AlbumID     int64     `gorm:"column:album_id;not null;uniqueIndex:idx_drama_submission_authorization" json:"albumId"`
	TargetAppID int64     `gorm:"column:target_app_id;not null;uniqueIndex:idx_drama_submission_authorization" json:"targetAppId"`
	Status      string    `gorm:"column:status;size:24;not null;default:'unauthorized'" json:"status"`
	LastError   string    `gorm:"column:last_error;size:512;not null;default:''" json:"lastError"`
	CreatedAt   time.Time `gorm:"column:created_at;not null" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"column:updated_at;not null" json:"updatedAt"`
}

func (DramaSubmissionAuthorization) TableName() string {
	return "drama_submission_authorizations"
}
