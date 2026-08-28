package middleware

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// LoadPermissions queries user's roles and aggregates permission keys into context.
func LoadPermissions(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := GetUserID(c)
		if userID == 0 {
			c.Next()
			return
		}

		var permKeys []string
		db.Raw(`
			SELECT DISTINCT rp.permission_key
			FROM user_roles ur
			JOIN role_permissions rp ON ur.role_id = rp.role_id
			WHERE ur.user_id = ?
		`, userID).Scan(&permKeys)

		c.Set("permissions", permKeys)
		c.Next()
	}
}
