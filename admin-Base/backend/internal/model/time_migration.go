package model

import (
	"fmt"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const utcMigrationKey = "20260831_convert_legacy_utc8_to_utc"

type DataMigration struct {
	Key string `gorm:"primaryKey;size:128"`
}

func (DataMigration) TableName() string { return "data_migrations" }

var legacyTimeColumns = map[string][]string{
	"users":              {"created_at", "updated_at"},
	"roles":              {"created_at", "updated_at"},
	"apps":               {"created_at", "updated_at"},
	"app_users":          {"created_at", "updated_at"},
	"dramas":             {"created_at", "updated_at"},
	"episodes":           {"created_at", "updated_at"},
	"payment_configs":    {"created_at", "updated_at"},
	"subscription_plans": {"created_at", "updated_at"},
	"user_unlocks":       {"created_at"},
	"ad_unlock_sessions": {"expire_at", "completed_at", "created_at", "updated_at"},
	"user_subscriptions": {"start_at", "expire_at", "created_at", "updated_at"},
	"payment_orders":     {"created_at", "updated_at", "paid_at"},
	"watch_logs":         {"watched_at", "created_at"},
}

// migrateLegacyTimesToUTC performs the one-time conversion from the project's
// former UTC+8 wall-clock DATETIME values to UTC. The marker and all updates
// share one transaction, so the migration is atomic and cannot run twice.
func migrateLegacyTimesToUTC() error {
	if err := DB.AutoMigrate(&DataMigration{}); err != nil {
		return err
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		marker := DataMigration{Key: utcMigrationKey}
		result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&marker)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return nil
		}

		for table, columns := range legacyTimeColumns {
			if !tx.Migrator().HasTable(table) {
				continue
			}
			assignments := make([]string, 0, len(columns))
			for _, column := range columns {
				assignments = append(assignments,
					fmt.Sprintf("`%s` = CASE WHEN `%s` IS NULL THEN NULL ELSE DATE_SUB(`%s`, INTERVAL 8 HOUR) END", column, column, column))
			}
			query := fmt.Sprintf("UPDATE `%s` SET %s", table, joinSQL(assignments))
			if err := tx.Exec(query).Error; err != nil {
				return fmt.Errorf("convert %s timestamps: %w", table, err)
			}
		}

		return nil
	})
}

func joinSQL(values []string) string {
	result := ""
	for index, value := range values {
		if index > 0 {
			result += ", "
		}
		result += value
	}
	return result
}
