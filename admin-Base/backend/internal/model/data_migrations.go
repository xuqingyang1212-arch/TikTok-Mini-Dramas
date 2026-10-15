package model

import (
	"errors"
	"fmt"
	"time"

	"scaffold-admin/internal/config"
	"scaffold-admin/internal/pkg/snowflake"

	"gorm.io/gorm"
)

const (
	normalizeSubmissionAppReferencesMigration = "20261015_normalize_submission_app_references"
	dropLegacySubmissionAppReferenceMigration = "20261015_drop_legacy_submission_app_reference"
	normalizeSubmissionReviewStateMigration   = "20261015_normalize_submission_review_state"
	normalizeAppSubjectReferencesMigration    = "20261015_normalize_app_subject_references"
	dropAppUserUnionIDMigration               = "20261015_drop_app_user_union_id"
)

type dataMigration struct {
	Key string `gorm:"column:key;primaryKey;size:128"`
}

func (dataMigration) TableName() string { return "data_migrations" }

func runPreSchemaMigrations(db *gorm.DB) error {
	if err := db.AutoMigrate(&dataMigration{}); err != nil {
		return fmt.Errorf("prepare data migrations: %w", err)
	}
	applied, err := dataMigrationApplied(db, normalizeSubmissionAppReferencesMigration)
	if err != nil {
		return err
	}
	if !applied {
		if err := normalizeSubmissionAppReferences(db); err != nil {
			return err
		}
		if err := recordDataMigration(db, normalizeSubmissionAppReferencesMigration); err != nil {
			return err
		}
	}

	applied, err = dataMigrationApplied(db, normalizeAppSubjectReferencesMigration)
	if err != nil || applied {
		return err
	}
	if err := normalizeAppSubjectReferences(db); err != nil {
		return err
	}
	return recordDataMigration(db, normalizeAppSubjectReferencesMigration)
}

func runPostSchemaMigrations(db *gorm.DB) error {
	applied, err := dataMigrationApplied(db, dropLegacySubmissionAppReferenceMigration)
	if err != nil {
		return err
	}
	if !applied {
		if db.Migrator().HasColumn(&DramaSubmission{}, "app_id") {
			if err := db.Exec("ALTER TABLE drama_submissions DROP COLUMN app_id").Error; err != nil {
				return fmt.Errorf("drop legacy submission app reference: %w", err)
			}
		}
		if err := recordDataMigration(db, dropLegacySubmissionAppReferenceMigration); err != nil {
			return err
		}
	}

	applied, err = dataMigrationApplied(db, normalizeSubmissionReviewStateMigration)
	if err != nil {
		return err
	}
	if !applied {
		if err := normalizeSubmissionReviewState(db); err != nil {
			return err
		}
		if err := recordDataMigration(db, normalizeSubmissionReviewStateMigration); err != nil {
			return err
		}
	}

	applied, err = dataMigrationApplied(db, dropAppUserUnionIDMigration)
	if err != nil || applied {
		return err
	}
	if db.Migrator().HasColumn(&AppUser{}, "union_id") {
		if err := db.Migrator().DropColumn(&AppUser{}, "union_id"); err != nil {
			return fmt.Errorf("drop app user union ID: %w", err)
		}
	}
	return recordDataMigration(db, dropAppUserUnionIDMigration)
}

func dataMigrationApplied(db *gorm.DB, name string) (bool, error) {
	var count int64
	if err := db.Model(&dataMigration{}).Where("`key` = ?", name).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func recordDataMigration(db *gorm.DB, name string) error {
	return db.Create(&dataMigration{Key: name}).Error
}

func normalizeAppSubjectReferences(db *gorm.DB) error {
	if !db.Migrator().HasTable(&App{}) {
		return nil
	}
	if !db.Migrator().HasTable(&SubjectInfo{}) {
		if err := db.AutoMigrate(&SubjectInfo{}); err != nil {
			return fmt.Errorf("prepare subject information: %w", err)
		}
	}

	defaultSubject := defaultSubjectInfo()
	if err := db.Where("subject_id = ?", defaultSubject.SubjectID).FirstOrCreate(&defaultSubject).Error; err != nil {
		return fmt.Errorf("initialize default subject: %w", err)
	}
	if !db.Migrator().HasColumn(&App{}, "subject_id") {
		if err := db.Exec("ALTER TABLE apps ADD COLUMN subject_id VARCHAR(64) NULL AFTER client_secret").Error; err != nil {
			return fmt.Errorf("add app subject reference: %w", err)
		}
	}
	if err := db.Model(&App{}).
		Where("subject_id IS NULL OR subject_id = ''").
		Update("subject_id", defaultSubject.SubjectID).Error; err != nil {
		return fmt.Errorf("backfill app subject references: %w", err)
	}
	if err := requireNoMissingSubjectReferences(db); err != nil {
		return err
	}
	if err := db.Exec("ALTER TABLE apps MODIFY COLUMN subject_id VARCHAR(64) NOT NULL").Error; err != nil {
		return fmt.Errorf("finalize app subject reference: %w", err)
	}
	if db.Migrator().HasColumn(&App{}, "company") {
		if err := db.Migrator().DropColumn(&App{}, "company"); err != nil {
			return fmt.Errorf("drop legacy app company: %w", err)
		}
	}
	return nil
}

func requireNoMissingSubjectReferences(db *gorm.DB) error {
	var missing int64
	if err := db.Raw(`
		SELECT COUNT(*)
		FROM apps
		LEFT JOIN subject_infos ON subject_infos.subject_id = apps.subject_id
		WHERE apps.subject_id IS NULL
		   OR apps.subject_id = ''
		   OR subject_infos.subject_id IS NULL
	`).Scan(&missing).Error; err != nil {
		return fmt.Errorf("validate app subject references: %w", err)
	}
	if missing > 0 {
		return fmt.Errorf("cannot normalize app subject references: %d app records are missing a subject", missing)
	}
	return nil
}

func normalizeSubmissionAppReferences(db *gorm.DB) error {
	if db.Migrator().HasTable(&DramaSubmission{}) && db.Migrator().HasColumn(&DramaSubmission{}, "app_id") {
		if !db.Migrator().HasColumn(&DramaSubmission{}, "source_app_id") {
			if err := db.Exec("ALTER TABLE drama_submissions ADD COLUMN source_app_id BIGINT NULL AFTER album_id").Error; err != nil {
				return fmt.Errorf("add submission source app reference: %w", err)
			}
		}
		if err := db.Exec(`
			UPDATE drama_submissions AS submissions
			JOIN apps ON apps.app_id = submissions.app_id
			SET submissions.source_app_id = apps.id
			WHERE submissions.source_app_id IS NULL OR submissions.source_app_id = 0
		`).Error; err != nil {
			return fmt.Errorf("backfill submission source app reference: %w", err)
		}
		if err := requireNoMissingAppReferences(db, "drama_submissions", "source_app_id"); err != nil {
			return err
		}
		if err := db.Exec("ALTER TABLE drama_submissions MODIFY COLUMN source_app_id BIGINT NOT NULL").Error; err != nil {
			return fmt.Errorf("finalize submission source app reference: %w", err)
		}
		if err := db.Exec("ALTER TABLE drama_submissions DROP COLUMN app_id").Error; err != nil {
			return fmt.Errorf("drop legacy submission app reference: %w", err)
		}
	}

	if db.Migrator().HasTable(&DramaSubmissionAuthorization{}) {
		legacyAuthorizationTable := !db.Migrator().HasColumn(&DramaSubmissionAuthorization{}, "status")
		columnType, err := databaseColumnType(db, "drama_submission_authorizations", "target_app_id")
		if err != nil {
			return err
		}
		if columnType == "varchar" {
			if err := db.Exec("ALTER TABLE drama_submission_authorizations ADD COLUMN target_app_pk BIGINT NULL AFTER album_id").Error; err != nil && !isDuplicateColumnError(err) {
				return fmt.Errorf("add authorization app reference: %w", err)
			}
			if err := db.Exec(`
				UPDATE drama_submission_authorizations AS authorizations
				JOIN apps ON apps.app_id = authorizations.target_app_id
				SET authorizations.target_app_pk = apps.id
				WHERE authorizations.target_app_pk IS NULL OR authorizations.target_app_pk = 0
			`).Error; err != nil {
				return fmt.Errorf("backfill authorization app reference: %w", err)
			}
			if err := requireNoMissingAppReferences(db, "drama_submission_authorizations", "target_app_pk"); err != nil {
				return err
			}
			if db.Migrator().HasIndex(&DramaSubmissionAuthorization{}, "idx_drama_submission_authorization") {
				if err := db.Migrator().DropIndex(&DramaSubmissionAuthorization{}, "idx_drama_submission_authorization"); err != nil {
					return fmt.Errorf("drop legacy authorization index: %w", err)
				}
			}
			if err := db.Exec("ALTER TABLE drama_submission_authorizations DROP COLUMN target_app_id, CHANGE COLUMN target_app_pk target_app_id BIGINT NOT NULL").Error; err != nil {
				return fmt.Errorf("finalize authorization app reference: %w", err)
			}
		}
		if legacyAuthorizationTable {
			if err := db.Exec("ALTER TABLE drama_submission_authorizations ADD COLUMN status VARCHAR(24) NOT NULL DEFAULT 'authorized'").Error; err != nil {
				return fmt.Errorf("add authorization status: %w", err)
			}
		}
	}
	return nil
}

func normalizeSubmissionReviewState(db *gorm.DB) error {
	if err := backfillDramaSubmissionVersions(db); err != nil {
		return err
	}
	if db.Migrator().HasTable(&DramaSubmission{}) {
		if err := db.Exec(`
			UPDATE drama_submissions AS submissions
			JOIN (
				SELECT album_id, MAX(version) AS online_version
				FROM drama_submission_versions
				WHERE review_status = ?
				GROUP BY album_id
			) AS approved ON approved.album_id = submissions.album_id
			SET submissions.online_version = approved.online_version
			WHERE submissions.online_version = 0
		`, DramaReviewApproved).Error; err != nil {
			return fmt.Errorf("backfill drama submission online version: %w", err)
		}
		if err := dropColumnIfPresent(db, "drama_submissions", "review_id"); err != nil {
			return err
		}
		if err := dropColumnIfPresent(db, "drama_submissions", "review_status"); err != nil {
			return err
		}
	}
	if db.Migrator().HasTable(&DramaSubmissionMedia{}) {
		if err := db.Model(&DramaSubmissionMedia{}).Where("upload_status = ?", "ready").Update("upload_status", DramaSubmissionMediaSuccess).Error; err != nil {
			return fmt.Errorf("normalize submission upload status: %w", err)
		}
		if err := dropColumnIfPresent(db, "drama_submission_media", "review_status"); err != nil {
			return err
		}
		if err := dropColumnIfPresent(db, "drama_submission_media", "rejection_reason"); err != nil {
			return err
		}
	}
	return nil
}

type legacyDramaSubmission struct {
	AlbumID       int64
	DramaID       int64
	SubmittedName string
	Language      string
	Year          int
	Description   string
	DramaType     int
	TagList       []int `gorm:"serializer:json"`
	Version       int
	ReviewID      int64
	ReviewStatus  int
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

func backfillDramaSubmissionVersions(db *gorm.DB) error {
	if !db.Migrator().HasTable(&DramaSubmission{}) || !db.Migrator().HasColumn(&DramaSubmission{}, "review_status") {
		return nil
	}
	var submissions []legacyDramaSubmission
	if err := db.Table("drama_submissions").Find(&submissions).Error; err != nil {
		return fmt.Errorf("read legacy drama submissions: %w", err)
	}
	for _, submission := range submissions {
		var count int64
		if err := db.Model(&DramaSubmissionVersion{}).Where("album_id = ? AND version = ?", submission.AlbumID, submission.Version).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			continue
		}
		var cover DramaSubmissionMedia
		if err := db.Where("album_id = ? AND version = ? AND media_type = ?", submission.AlbumID, submission.Version, DramaSubmissionMediaCover).First(&cover).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		version := DramaSubmissionVersion{
			ID: snowflake.NextID(), AlbumID: submission.AlbumID, Version: submission.Version,
			SubmittedName: submission.SubmittedName, CoverURL: cover.SourceURL, Language: submission.Language,
			Year: submission.Year, Description: submission.Description, DramaType: submission.DramaType,
			TagList: append([]int(nil), submission.TagList...), ReviewID: submission.ReviewID,
			ReviewStatus: submission.ReviewStatus, WorkflowStatus: workflowStatusFromReview(submission.ReviewStatus),
			RemoteVersion: submission.Version, CreatedAt: submission.CreatedAt, UpdatedAt: submission.UpdatedAt,
		}
		submittedAt := submission.CreatedAt
		version.SubmittedAt = &submittedAt
		if submission.ReviewStatus == DramaReviewApproved || submission.ReviewStatus == DramaReviewRejected {
			reviewedAt := submission.UpdatedAt
			version.ReviewedAt = &reviewedAt
		}
		if submission.ReviewStatus == DramaReviewWithdrawn {
			withdrawnAt := submission.UpdatedAt
			version.WithdrawnAt = &withdrawnAt
		}
		if err := db.Create(&version).Error; err != nil {
			return fmt.Errorf("backfill drama submission version: %w", err)
		}
	}
	return nil
}

func workflowStatusFromReview(reviewStatus int) string {
	switch reviewStatus {
	case DramaReviewApproved:
		return DramaSubmissionWorkflowApproved
	case DramaReviewRejected:
		return DramaSubmissionWorkflowRejected
	case DramaReviewWithdrawn:
		return DramaSubmissionWorkflowWithdrawn
	case DramaReviewUnsubmitted:
		return DramaSubmissionWorkflowDraft
	default:
		return DramaSubmissionWorkflowReviewing
	}
}

func requireNoMissingAppReferences(db *gorm.DB, table, column string) error {
	var count int64
	if err := db.Table(table).Where(column + " IS NULL OR " + column + " = 0").Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return fmt.Errorf("migrate %s: %d rows do not match an internal app; verify source app %q and existing TikTok App IDs", table, count, config.DramaSubmissionSourceTikTokAppID())
	}
	return nil
}

func databaseColumnType(db *gorm.DB, table, column string) (string, error) {
	var value string
	if err := db.Raw(`
		SELECT DATA_TYPE FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
	`, table, column).Scan(&value).Error; err != nil {
		return "", err
	}
	return value, nil
}

func dropColumnIfPresent(db *gorm.DB, table, column string) error {
	if !db.Migrator().HasColumn(table, column) {
		return nil
	}
	if err := db.Migrator().DropColumn(table, column); err != nil {
		return fmt.Errorf("drop %s.%s: %w", table, column, err)
	}
	return nil
}

func isDuplicateColumnError(err error) bool {
	return err != nil && (errors.Is(err, gorm.ErrDuplicatedKey) || containsFold(err.Error(), "duplicate column"))
}

func containsFold(value, search string) bool {
	return len(value) >= len(search) && (value == search || containsFoldAt(value, search))
}

func containsFoldAt(value, search string) bool {
	for i := 0; i+len(search) <= len(value); i++ {
		match := true
		for j := range search {
			left, right := value[i+j], search[j]
			if left >= 'A' && left <= 'Z' {
				left += 'a' - 'A'
			}
			if right >= 'A' && right <= 'Z' {
				right += 'a' - 'A'
			}
			if left != right {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	return false
}
