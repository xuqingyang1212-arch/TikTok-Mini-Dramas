package middleware

import (
	"scaffold-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
)

// UserPermissions is populated after JWT validation by the auth service.
// Stored in gin context as "permissions" ([]string).

func getPermList(c *gin.Context) ([]string, bool) {
	perms, exists := c.Get("permissions")
	if !exists {
		return nil, false
	}
	list, ok := perms.([]string)
	return list, ok
}

// HasPerm reports whether the current request has the given permission key.
// It is meant to be used inside a handler for dynamic permission checks (e.g.
// when the required key depends on a query or body parameter).
func HasPerm(c *gin.Context, permKey string) bool {
	list, ok := getPermList(c)
	if !ok {
		return false
	}
	for _, p := range list {
		if p == permKey {
			return true
		}
	}
	return false
}

// EnsurePerm checks HasPerm and, when the permission is missing, writes a 403
// response and returns false. Handlers should `return` immediately after a
// false result. This is the handler-level counterpart of RequirePerm.
func EnsurePerm(c *gin.Context, permKey string) bool {
	if _, ok := getPermList(c); !ok {
		response.FailForbidden(c, "无权限信息")
		return false
	}
	if !HasPerm(c, permKey) {
		response.FailForbidden(c, "无操作权限")
		return false
	}
	return true
}

func RequirePerm(permKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !EnsurePerm(c, permKey) {
			c.Abort()
		}
	}
}
