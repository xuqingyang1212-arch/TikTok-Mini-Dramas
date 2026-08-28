package middleware

import (
	"bytes"
	"crypto/sha256"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"

	"scaffold-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
)

// 需要跳过去重检查的路径前缀 / 后缀。
// 默认为空切片；业务扩展时如有"长耗时/允许快速重试"的接口，在此追加白名单。
var (
	skipPrefixes = []string{}
	skipSuffixes = []string{}
)

type dedupEntry struct {
	expireAt time.Time
}

var (
	dedupMu    sync.Mutex
	dedupStore = make(map[string]*dedupEntry)
)

func init() {
	go func() {
		for range time.Tick(30 * time.Second) {
			dedupMu.Lock()
			now := time.Now()
			for k, v := range dedupStore {
				if now.After(v.expireAt) {
					delete(dedupStore, k)
				}
			}
			dedupMu.Unlock()
		}
	}()
}

// PreventDuplicateSubmit rejects duplicate write requests (POST/PUT/DELETE)
// from the same user to the same path within a short time window.
func PreventDuplicateSubmit(window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == "GET" || c.Request.Method == "OPTIONS" || c.Request.Method == "HEAD" {
			c.Next()
			return
		}

		path := c.Request.URL.Path
		for _, prefix := range skipPrefixes {
			if strings.HasPrefix(path, prefix) {
				c.Next()
				return
			}
		}
		for _, suffix := range skipSuffixes {
			if strings.HasSuffix(path, suffix) {
				c.Next()
				return
			}
		}

		userID := GetUserID(c)
		if userID == 0 {
			c.Next()
			return
		}

		bodyBytes, _ := io.ReadAll(c.Request.Body)
		c.Request.Body = io.NopCloser(bytes.NewReader(bodyBytes))

		bodyHash := sha256.Sum256(bodyBytes)
		key := fmt.Sprintf("%d:%s:%s:%x", userID, c.Request.Method, c.Request.URL.Path, bodyHash[:8])

		dedupMu.Lock()
		entry, exists := dedupStore[key]
		now := time.Now()
		if exists && now.Before(entry.expireAt) {
			dedupMu.Unlock()
			response.Fail(c, 429, "请勿重复提交")
			c.Abort()
			return
		}
		dedupStore[key] = &dedupEntry{expireAt: now.Add(window)}
		dedupMu.Unlock()

		c.Next()
	}
}
