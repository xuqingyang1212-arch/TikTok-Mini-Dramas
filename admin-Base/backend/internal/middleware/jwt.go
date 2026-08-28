package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"strings"
	"time"

	"scaffold-admin/internal/config"
	"scaffold-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID       int64  `json:"user_id"`
	UserName     string `json:"user_name"`
	SessionToken string `json:"session_token"`
	jwt.RegisteredClaims
}

func GenerateSessionToken() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func GenerateToken(userID int64, userName string, sessionToken string) (string, error) {
	cfg := config.Global.JWT
	claims := Claims{
		UserID:       userID,
		UserName:     userName,
		SessionToken: sessionToken,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(cfg.ExpireHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.Secret))
}

func ParseToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		return []byte(config.Global.JWT.Secret), nil
	})
	if err != nil {
		return nil, err
	}
	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}
	return nil, jwt.ErrSignatureInvalid
}

func JWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		if auth == "" {
			response.FailUnauthorized(c, "缺少认证令牌")
			c.Abort()
			return
		}
		tokenStr := strings.TrimPrefix(auth, "Bearer ")
		claims, err := ParseToken(tokenStr)
		if err != nil {
			response.FailUnauthorized(c, "令牌无效或已过期")
			c.Abort()
			return
		}
		c.Set("userID", claims.UserID)
		c.Set("userName", claims.UserName)
		c.Set("sessionToken", claims.SessionToken)
		c.Next()
	}
}

func GetUserID(c *gin.Context) int64 {
	v, _ := c.Get("userID")
	id, _ := v.(int64)
	return id
}

func GetUserName(c *gin.Context) string {
	v, _ := c.Get("userName")
	name, _ := v.(string)
	return name
}
