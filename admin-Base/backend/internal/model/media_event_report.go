package model

import "time"

const (
	MediaEventReportSuccess     = "success"
	MediaEventReportFailed      = "failed"
	MediaEventReportUnsupported = "unsupported"
)

// MediaEventReport records the mini app's media SDK reporting result for reconciliation.
type MediaEventReport struct {
	ID                int64     `gorm:"primaryKey" json:"id"`
	ReportID          string    `gorm:"column:report_id;size:64;not null;uniqueIndex:uk_media_report_app,priority:2" json:"reportId"`
	AppID             int64     `gorm:"column:app_id;not null;uniqueIndex:uk_media_report_app,priority:1;index" json:"appId"`
	UserID            int64     `gorm:"column:user_id;not null;index" json:"userId"`
	AttributionLinkID *int64    `gorm:"column:attribution_link_id;index" json:"attributionLinkId,omitempty"`
	DramaID           int64     `gorm:"column:drama_id;not null;index" json:"dramaId"`
	EpisodeNo         int       `gorm:"column:episode_no;not null" json:"episodeNo"`
	EventName         string    `gorm:"column:event_name;size:64;not null;index" json:"eventName"`
	Status            string    `gorm:"column:status;size:16;not null;index" json:"status"`
	ParamsJSON        []byte    `gorm:"column:params_json;type:json;not null" json:"params"`
	ResultJSON        []byte    `gorm:"column:result_json;type:json;not null" json:"result"`
	CreatedAt         time.Time `gorm:"column:created_at;not null;index" json:"createdAt"`
}

func (MediaEventReport) TableName() string {
	return "media_event_reports"
}
