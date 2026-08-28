package handler

import (
	"errors"
	"regexp"

	"scaffold-admin/internal/pkg/pagination"
	"scaffold-admin/internal/pkg/response"
	"scaffold-admin/internal/service"

	"github.com/gin-gonic/gin"
)

// 创建/重置用户密码时的格式校验。登录流程改为邮箱 + 验证码后，密码仅用于账号存档字段。
var passwordRe = regexp.MustCompile(`^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~` + "`" + `]{6,24}$`)

func ListUsers(c *gin.Context) {
	p := pagination.Parse(c)
	users, total, err := Svc.User.List(service.UserListFilter{
		Name:     TrimQuery(c, "name"),
		Email:    TrimQuery(c, "email"),
		Status:   TrimQuery(c, "status"),
		Role:     TrimQuery(c, "role"),
		Page:     p.Page,
		PageSize: p.PageSize,
	})
	if err != nil {
		response.FailServer(c, "查询用户失败")
		return
	}
	response.OKPage(c, total, users)
}

type CreateUserReq struct {
	Name     string  `json:"name"     binding:"required"`
	Email    string  `json:"email"    binding:"required"`
	Password string  `json:"password" binding:"required"`
	RoleIDs  []int64 `json:"roleIds"`
}

func CreateUser(c *gin.Context) {
	var req CreateUserReq
	if !BindOrFail(c, &req) {
		return
	}
	if !emailRe.MatchString(req.Email) {
		response.FailBadRequest(c, "邮箱格式不正确")
		return
	}
	if !passwordRe.MatchString(req.Password) {
		response.FailBadRequest(c, "密码需 6~24 位，可由数字、字母、常规符号任意组合")
		return
	}

	user, err := Svc.User.Create(service.CreateUserInput{
		Name:     req.Name,
		Email:    req.Email,
		Password: req.Password,
		RoleIDs:  req.RoleIDs,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrEmailExists):
			response.FailBadRequest(c, "该邮箱已注册")
		default:
			response.FailServer(c, "创建用户失败")
		}
		return
	}
	response.OK(c, user)
}

type UpdateUserReq struct {
	RoleIDs []int64 `json:"roleIds"`
	Status  string  `json:"status"`
}

func UpdateUser(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	var req UpdateUserReq
	if !BindOrFail(c, &req) {
		return
	}

	user, err := Svc.User.Update(id, service.UpdateUserInput{
		Status:  req.Status,
		RoleIDs: req.RoleIDs,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrUserNotFound):
			response.FailNotFound(c, "用户不存在")
		default:
			response.FailServer(c, "更新用户失败")
		}
		return
	}
	response.OK(c, user)
}
