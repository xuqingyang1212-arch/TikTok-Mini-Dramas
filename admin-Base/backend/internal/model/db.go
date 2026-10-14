package model

import (
	"database/sql"
	"fmt"
	"time"

	"scaffold-admin/internal/config"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Open(cfg config.Config) (*gorm.DB, error) {
	logLevel := logger.Warn
	if cfg.Server.Mode == "debug" {
		logLevel = logger.Info
	}
	db, err := gorm.Open(mysql.Open(cfg.Database.DSN()), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logLevel),
		DisableForeignKeyConstraintWhenMigrating: true,
		NowFunc:                                  func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		return nil, fmt.Errorf("connect database: %w", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("get database pool: %w", err)
	}
	sqlDB.SetMaxIdleConns(cfg.Database.MaxIdleConns)
	sqlDB.SetMaxOpenConns(cfg.Database.MaxOpenConns)
	if err := db.Exec("SET SESSION sort_buffer_size = 8388608").Error; err != nil {
		return nil, fmt.Errorf("configure database session: %w", err)
	}
	return db, nil
}

func MigrateSchema(db *gorm.DB) error {
	return db.AutoMigrate(
		&User{},
		&Role{},
		&UserRole{},
		&RolePermission{},
		&App{},
		&AppUser{},
		&Drama{},
		&Episode{},
		&DramaSubmission{},
		&DramaSubmissionVersion{},
		&DramaSubmissionMedia{},
		&PaymentConfig{},
		&SubscriptionPlan{},
		&UserUnlock{},
		&AdUnlockSession{},
		&UserSubscription{},
		&PaymentOrder{},
		&WatchLog{},
		&PromotionLink{},
		&PromotionAttributionHistory{},
		&MediaEventReport{},
	)
}

const firstPromotionLinkID int64 = 10000001

func SetupCurrentData(db *gorm.DB) error {
	if err := db.Model(&DramaSubmissionMedia{}).Where("upload_status = ?", "ready").Update("upload_status", DramaSubmissionMediaSuccess).Error; err != nil {
		return fmt.Errorf("normalize drama submission media upload status: %w", err)
	}
	if err := backfillDramaSubmissionVersions(db); err != nil {
		return err
	}

	var nextID sql.NullInt64
	if err := db.Raw(`
		SELECT AUTO_INCREMENT
		FROM information_schema.TABLES
		WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'promotion_links'
	`).Scan(&nextID).Error; err != nil {
		return fmt.Errorf("read promotion link sequence: %w", err)
	}
	if !promotionLinkSequenceNeedsInitialization(nextID) {
		return nil
	}
	if err := db.Exec(fmt.Sprintf("ALTER TABLE promotion_links AUTO_INCREMENT = %d", firstPromotionLinkID)).Error; err != nil {
		return fmt.Errorf("initialize promotion link sequence: %w", err)
	}
	return nil
}

func backfillDramaSubmissionVersions(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var submissions []DramaSubmission
		if err := tx.Find(&submissions).Error; err != nil {
			return err
		}
		for _, submission := range submissions {
			var count int64
			if err := tx.Model(&DramaSubmissionVersion{}).
				Where("album_id = ? AND version = ?", submission.AlbumID, submission.Version).
				Count(&count).Error; err != nil {
				return err
			}
			if count > 0 {
				var existing DramaSubmissionVersion
				if err := tx.Where("album_id = ? AND version = ?", submission.AlbumID, submission.Version).First(&existing).Error; err != nil {
					return err
				}
				if existing.WorkflowStatus == "" {
					existing.WorkflowStatus = workflowStatusFromReview(submission.ReviewStatus)
				}
				if existing.RemoteVersion == 0 {
					existing.RemoteVersion = existing.Version
				}
				if err := tx.Model(&existing).Updates(map[string]any{"workflow_status": existing.WorkflowStatus, "remote_version": existing.RemoteVersion}).Error; err != nil {
					return err
				}
				continue
			}
			var cover DramaSubmissionMedia
			if err := tx.Where("album_id = ? AND version = ? AND media_type = ?", submission.AlbumID, submission.Version, DramaSubmissionMediaCover).
				First(&cover).Error; err != nil && err != gorm.ErrRecordNotFound {
				return err
			}
			workflowStatus := workflowStatusFromReview(submission.ReviewStatus)
			version := DramaSubmissionVersion{
				ID: submission.AlbumID, AlbumID: submission.AlbumID, Version: submission.Version,
				SubmittedName: submission.SubmittedName, CoverURL: cover.SourceURL, Language: submission.Language,
				Year: submission.Year, Description: submission.Description, DramaType: submission.DramaType,
				TagList: append([]int(nil), submission.TagList...), ReviewID: submission.ReviewID,
				ReviewStatus: submission.ReviewStatus, WorkflowStatus: workflowStatus, RemoteVersion: submission.Version, CreatedAt: submission.CreatedAt, UpdatedAt: submission.UpdatedAt,
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
			if err := tx.Create(&version).Error; err != nil {
				return err
			}
			updates := map[string]any{"workflow_status": version.WorkflowStatus, "remote_version": version.RemoteVersion}
			if err := tx.Model(&version).Updates(updates).Error; err != nil {
				return err
			}
		}
		return nil
	})
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

func promotionLinkSequenceNeedsInitialization(nextID sql.NullInt64) bool {
	return !nextID.Valid || nextID.Int64 < firstPromotionLinkID
}
