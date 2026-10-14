package model

import "time"

const (
	DramaSubmissionWorkflowDraft        = "draft"
	DramaSubmissionWorkflowUploading    = "uploading"
	DramaSubmissionWorkflowUploadFailed = "upload_failed"
	DramaSubmissionWorkflowAlbumReady   = "album_ready"
	DramaSubmissionWorkflowAlbumFailed  = "album_failed"
	DramaSubmissionWorkflowReviewReady  = "review_ready"
	DramaSubmissionWorkflowReviewFailed = "review_failed"
	DramaSubmissionWorkflowReviewing    = "reviewing"
	DramaSubmissionWorkflowApproved     = "approved"
	DramaSubmissionWorkflowRejected     = "rejected"
	DramaSubmissionWorkflowWithdrawn    = "withdrawn"
)

// DramaSubmissionVersion is an immutable snapshot of one local version candidate.
// RemoteVersion remains zero until the simulated album create/update succeeds.
// Every resubmission creates a new local candidate; historical versions remain unchanged.
type DramaSubmissionVersion struct {
	ID              int64      `gorm:"primaryKey" json:"id"`
	AlbumID         int64      `gorm:"column:album_id;not null;uniqueIndex:uk_submission_version,priority:1;index" json:"albumId"`
	Version         int        `gorm:"not null;uniqueIndex:uk_submission_version,priority:2" json:"version"`
	SubmittedName   string     `gorm:"column:submitted_name;size:256;not null" json:"submittedName"`
	CoverURL        string     `gorm:"column:cover_url;size:512;not null" json:"coverUrl"`
	Language        string     `gorm:"size:32;not null" json:"language"`
	Year            int        `gorm:"not null" json:"year"`
	Description     string     `gorm:"column:description;type:text;not null" json:"description"`
	DramaType       int        `gorm:"column:drama_type;not null" json:"dramaType"`
	TagList         []int      `gorm:"column:tag_list;type:json;serializer:json;not null" json:"tagList"`
	ReviewID        int64      `gorm:"column:review_id;not null;uniqueIndex" json:"reviewId"`
	ReviewStatus    int        `gorm:"column:review_status;not null" json:"reviewStatus"`
	SubmittedAt     *time.Time `gorm:"column:submitted_at" json:"submittedAt"`
	ReviewedAt      *time.Time `gorm:"column:reviewed_at" json:"reviewedAt"`
	WithdrawnAt     *time.Time `gorm:"column:withdrawn_at" json:"withdrawnAt"`
	WorkflowStatus  string     `gorm:"column:workflow_status;size:32;not null;default:'draft';index" json:"workflowStatus"`
	WorkflowError   string     `gorm:"column:workflow_error;size:512;not null;default:''" json:"workflowError"`
	RemoteVersion   int        `gorm:"column:remote_version;not null;default:0" json:"remoteVersion"`
	RejectionReason string     `gorm:"column:rejection_reason;size:512;not null;default:''" json:"rejectionReason"`
	CreatedAt       time.Time  `gorm:"column:created_at;not null" json:"createdAt"`
	UpdatedAt       time.Time  `gorm:"column:updated_at;not null" json:"updatedAt"`
}

func (DramaSubmissionVersion) TableName() string {
	return "drama_submission_versions"
}
