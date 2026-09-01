package handler

import (
	"strconv"
	"strings"
	"time"

	"scaffold-admin/internal/pkg/datetime"
	"scaffold-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
)

// BindOrFail binds JSON body into dest and writes 400 on failure. Returns false if binding failed.
func BindOrFail(c *gin.Context, dest any) bool {
	if err := c.ShouldBindJSON(dest); err != nil {
		response.FailBadRequest(c, "参数错误")
		return false
	}
	return true
}

// ParseID extracts and validates an int64 path parameter.
// Returns 0 and writes 400 if the parameter is missing or invalid.
func ParseID(c *gin.Context, param string) (int64, bool) {
	raw := c.Param(param)
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		response.FailBadRequest(c, "无效的"+param)
		return 0, false
	}
	return id, true
}

// TrimQuery returns a trimmed query parameter (empty string if not present).
// 所有文本筛选项在进入 service 之前都应该经此 trim，符合"前后空格删除、中间空格保留"的规范。
func TrimQuery(c *gin.Context, key string) string {
	return strings.TrimSpace(c.Query(key))
}

// QueryInt returns an int query parameter with a default value.
func QueryInt(c *gin.Context, key string, def int) int {
	raw := c.Query(key)
	if raw == "" {
		return def
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return def
	}
	return v
}

// QueryInt64 returns an int64 query parameter with a default value.
func QueryInt64(c *gin.Context, key string, def int64) int64 {
	raw := c.Query(key)
	if raw == "" {
		return def
	}
	v, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return def
	}
	return v
}

// ParseChinaDateRange interprets admin date filters in the China operating timezone.
func ParseChinaDateRange(c *gin.Context, fromKey, toKey string) (from, toExclusive *time.Time) {
	return datetime.ParseChinaDateRange(c.Query(fromKey), c.Query(toKey))
}
