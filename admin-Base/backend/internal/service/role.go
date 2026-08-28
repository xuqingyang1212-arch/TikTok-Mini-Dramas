package service

import (
	"errors"
	"strings"

	"scaffold-admin/internal/consts"
	"scaffold-admin/internal/model"

	"gorm.io/gorm"
)

// ─── Types ──────────────────────────────────────────────────────────────────

type RoleListFilter struct {
	Name     string
	Page     int
	PageSize int
}

type CreateRoleInput struct {
	Name        string
	Remark      string
	Permissions []string
}

type UpdateRoleInput struct {
	Name        string
	Remark      string
	Permissions []string
}

type RoleService interface {
	List(filter RoleListFilter) ([]model.Role, int64, error)
	Create(input CreateRoleInput) (*model.Role, error)
	Update(id int64, input UpdateRoleInput) error
	SyncSuperAdminPermissions() error
}

// ─── Errors ─────────────────────────────────────────────────────────────────

var (
	ErrRoleNameExists = errors.New("role name already exists")
	ErrRoleNotFound   = errors.New("role not found")
)

// SuperAdminRoleName 是启动时权限同步目标角色名。
const SuperAdminRoleName = "超级管理员"

// ─── Implementation ─────────────────────────────────────────────────────────

type roleService struct {
	db *gorm.DB
}

func (s *roleService) List(f RoleListFilter) ([]model.Role, int64, error) {
	db := s.db.Model(&model.Role{})
	if f.Name != "" {
		db = db.Where("name LIKE ?", "%"+f.Name+"%")
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page, size := normalizePage(f.Page, f.PageSize)
	var roles []model.Role
	err := db.Order("created_at DESC").
		Offset((page - 1) * size).
		Limit(size).
		Preload("Users").
		Preload("Permissions").
		Find(&roles).Error
	return roles, total, err
}

func (s *roleService) Create(in CreateRoleInput) (*model.Role, error) {
	role := model.Role{Name: in.Name, Remark: in.Remark}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&role).Error; err != nil {
			return err
		}
		return syncRolePermissions(tx, role.ID, in.Permissions)
	})
	if err != nil {
		if isDuplicate(err) {
			return nil, ErrRoleNameExists
		}
		return nil, err
	}
	return &role, nil
}

func (s *roleService) Update(id int64, in UpdateRoleInput) error {
	var role model.Role
	if err := s.db.First(&role, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrRoleNotFound
		}
		return err
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&role).Updates(map[string]any{
			"name":   in.Name,
			"remark": in.Remark,
		}).Error; err != nil {
			return err
		}
		return syncRolePermissions(tx, id, in.Permissions)
	})
	if err != nil && isDuplicate(err) {
		return ErrRoleNameExists
	}
	return err
}

// SyncSuperAdminPermissions 以 consts.AllLeafKeys() 为准，补齐超管角色的权限点。
// 启动时调用，保证新增权限点后无需改种子 SQL。幂等。
func (s *roleService) SyncSuperAdminPermissions() error {
	var role model.Role
	if err := s.db.Where("name = ?", SuperAdminRoleName).First(&role).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// 尚未种入超管角色（首次启动，SQL 未跑），此处不视为错误。
			return nil
		}
		return err
	}

	var existing []model.RolePermission
	if err := s.db.Where("role_id = ?", role.ID).Find(&existing).Error; err != nil {
		return err
	}
	have := make(map[string]struct{}, len(existing))
	for _, p := range existing {
		have[p.PermissionKey] = struct{}{}
	}

	var toAdd []model.RolePermission
	for _, key := range consts.AllLeafKeys() {
		if _, ok := have[key]; !ok {
			toAdd = append(toAdd, model.RolePermission{RoleID: role.ID, PermissionKey: key})
		}
	}
	if len(toAdd) == 0 {
		return nil
	}
	return s.db.Create(&toAdd).Error
}

// syncRolePermissions 整体覆盖指定角色的 role_permissions 行。
func syncRolePermissions(tx *gorm.DB, roleID int64, keys []string) error {
	if err := tx.Where("role_id = ?", roleID).Delete(&model.RolePermission{}).Error; err != nil {
		return err
	}
	if len(keys) == 0 {
		return nil
	}
	rows := make([]model.RolePermission, 0, len(keys))
	for _, k := range keys {
		rows = append(rows, model.RolePermission{RoleID: roleID, PermissionKey: k})
	}
	return tx.Create(&rows).Error
}

func isDuplicate(err error) bool {
	return err != nil && strings.Contains(err.Error(), "Duplicate")
}
