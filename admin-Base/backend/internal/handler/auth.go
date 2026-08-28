package handler

import (
	"regexp"
	"strings"

	"scaffold-admin/internal/consts"
	"scaffold-admin/internal/middleware"
	"scaffold-admin/internal/model"
	"scaffold-admin/internal/pkg/response"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var emailRe = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// ─── Login (Email Only) ──────────────────────────────────────────────────────
// 演示模式：只需邮箱即可登录，新邮箱自动注册并赋予超级管理员权限

type LoginReq struct {
	Email string `json:"email" binding:"required"`
}

func AuthLogin(c *gin.Context) {
	var req LoginReq
	if !BindOrFail(c, &req) {
		return
	}

	email := normalizeEmail(req.Email)
	if !emailRe.MatchString(email) {
		response.FailBadRequest(c, "邮箱格式不正确")
		return
	}

	var user model.User
	err := model.DB.Where("email = ?", email).First(&user).Error

	if err == gorm.ErrRecordNotFound {
		// 新用户：自动注册
		user = model.User{
			Name:   extractNameFromEmail(email),
			Email:  email,
			Status: consts.UserStatusActive,
		}
		if err := model.DB.Create(&user).Error; err != nil {
			response.FailServer(c, "创建用户失败")
			return
		}

		// 分配超级管理员角色
		var superAdminRole model.Role
		if err := model.DB.Where("name = ?", "超级管理员").First(&superAdminRole).Error; err == nil {
			model.DB.Create(&model.UserRole{
				UserID: user.ID,
				RoleID: superAdminRole.ID,
			})
		}
	} else if err != nil {
		response.FailServer(c, "查询用户失败")
		return
	}

	if user.Status != consts.UserStatusActive {
		response.Fail(c, 403, "账号已禁用")
		return
	}

	sessionToken := middleware.GenerateSessionToken()
	model.DB.Model(&user).Update("session_token", sessionToken)

	token, err := middleware.GenerateToken(user.ID, user.Name, sessionToken)
	if err != nil {
		response.FailServer(c, "生成令牌失败")
		return
	}

	response.OK(c, gin.H{
		"token": token,
		"user":  user,
	})
}

// extractNameFromEmail 从邮箱提取用户名（@前的部分）
func extractNameFromEmail(email string) string {
	parts := strings.Split(email, "@")
	if len(parts) > 0 {
		return parts[0]
	}
	return email
}

// ─── Current User ────────────────────────────────────────────────────────────

func GetCurrentUser(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var user model.User
	if err := model.DB.Preload("Roles").First(&user, userID).Error; err != nil {
		response.FailNotFound(c, "用户不存在")
		return
	}

	perms, _ := c.Get("permissions")
	response.OK(c, gin.H{
		"user":        user,
		"permissions": perms,
	})
}
