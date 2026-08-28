package handler

import (
	"errors"

	"scaffold-admin/internal/consts"
	"scaffold-admin/internal/pkg/pagination"
	"scaffold-admin/internal/pkg/response"
	"scaffold-admin/internal/service"

	"github.com/gin-gonic/gin"
)

func ListRoles(c *gin.Context) {
	p := pagination.Parse(c)
	roles, total, err := Svc.Role.List(service.RoleListFilter{
		Name:     TrimQuery(c, "name"),
		Page:     p.Page,
		PageSize: p.PageSize,
	})
	if err != nil {
		response.FailServer(c, "查询角色失败")
		return
	}
	response.OKPage(c, total, roles)
}

type RoleReq struct {
	Name        string   `json:"name" binding:"required"`
	Remark      string   `json:"remark"`
	Permissions []string `json:"permissions"`
}

func CreateRole(c *gin.Context) {
	var req RoleReq
	if !BindOrFail(c, &req) {
		return
	}
	role, err := Svc.Role.Create(service.CreateRoleInput{
		Name:        req.Name,
		Remark:      req.Remark,
		Permissions: req.Permissions,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrRoleNameExists):
			response.Fail(c, 400, "角色名称已存在")
		default:
			response.FailServer(c, "创建角色失败")
		}
		return
	}
	response.OK(c, role)
}

func UpdateRole(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}
	var req RoleReq
	if !BindOrFail(c, &req) {
		return
	}
	if err := Svc.Role.Update(id, service.UpdateRoleInput{
		Name:        req.Name,
		Remark:      req.Remark,
		Permissions: req.Permissions,
	}); err != nil {
		switch {
		case errors.Is(err, service.ErrRoleNotFound):
			response.FailNotFound(c, "角色不存在")
		case errors.Is(err, service.ErrRoleNameExists):
			response.Fail(c, 400, "角色名称已存在")
		default:
			response.FailServer(c, "更新角色失败")
		}
		return
	}
	response.OKMsg(c, "更新成功")
}

// GetPermissionTree 返回后台功能权限树。
// 真相源来自 internal/consts/permissions.go 的 PermissionTree 声明，新增权限
// 点只需改那一处。
func GetPermissionTree(c *gin.Context) {
	response.OK(c, consts.PermissionTree)
}
