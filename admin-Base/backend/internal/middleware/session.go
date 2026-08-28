package middleware

import (
	"scaffold-admin/internal/model"
	"scaffold-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
)

func SessionGuard() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("userID")
		sessToken, _ := c.Get("sessionToken")

		uid, _ := userID.(int64)
		st, _ := sessToken.(string)

		if uid == 0 || st == "" {
			response.FailUnauthorized(c, "令牌无效")
			c.Abort()
			return
		}

		var user model.User
		if err := model.DB.Select("id, session_token").First(&user, uid).Error; err != nil {
			response.FailUnauthorized(c, "用户不存在")
			c.Abort()
			return
		}

		if user.SessionToken != st {
			c.JSON(409, response.R{Code: 409, Message: "您的账号已在其他设备登录，当前会话已失效"})
			c.Abort()
			return
		}

		c.Next()
	}
}
