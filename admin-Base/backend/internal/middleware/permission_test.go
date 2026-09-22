package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRequireAnyPerm(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name        string
		permissions any
		set         bool
		wantStatus  int
		wantReached bool
	}{
		{name: "first permission", permissions: []string{"drama:add"}, set: true, wantStatus: http.StatusNoContent, wantReached: true},
		{name: "second permission", permissions: []string{"drama:edit"}, set: true, wantStatus: http.StatusNoContent, wantReached: true},
		{name: "unrelated permission", permissions: []string{"drama:list"}, set: true, wantStatus: http.StatusForbidden},
		{name: "missing permission context", wantStatus: http.StatusForbidden},
		{name: "invalid permission context", permissions: "drama:add", set: true, wantStatus: http.StatusForbidden},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reached := false
			router := gin.New()
			router.GET("/upload", func(c *gin.Context) {
				if tt.set {
					c.Set("permissions", tt.permissions)
				}
				c.Next()
			}, RequireAnyPerm("drama:add", "drama:edit"), func(c *gin.Context) {
				reached = true
				c.Status(http.StatusNoContent)
			})

			response := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, "/upload", nil)
			router.ServeHTTP(response, request)

			if response.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", response.Code, tt.wantStatus)
			}
			if reached != tt.wantReached {
				t.Fatalf("handler reached = %v, want %v", reached, tt.wantReached)
			}
		})
	}
}
