package service

import (
	"errors"

	"scaffold-admin/internal/consts"
	"scaffold-admin/internal/model"
	"scaffold-admin/internal/pkg/pagination"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// ─── Types ──────────────────────────────────────────────────────────────────

// UserListFilter 是 List 接口的筛选/分页参数。
// Name/Email 为模糊匹配；Status/Role 为精确匹配。
type UserListFilter struct {
	Name     string
	Email    string
	Status   string
	Role     string // 按角色名过滤
	Page     int
	PageSize int
}

// CreateUserInput 是创建用户的业务入参。RoleIDs 可空。
type CreateUserInput struct {
	Name     string
	Email    string
	Password string
	RoleIDs  []int64
}

// UpdateUserInput 是更新用户的业务入参。
// 所有字段均为可选："" / nil 表示该字段不更新；RoleIDs 非 nil 时整体覆盖。
type UpdateUserInput struct {
	Status  string
	RoleIDs []int64 // nil = 不更新；非 nil（哪怕为空切片）= 全量覆盖
}

type UserService interface {
	List(filter UserListFilter) ([]model.User, int64, error)
	GetByID(id int64) (*model.User, error)
	GetByEmail(email string) (*model.User, error)
	Create(input CreateUserInput) (*model.User, error)
	Update(id int64, input UpdateUserInput) (*model.User, error)
}

// ─── Errors ─────────────────────────────────────────────────────────────────

var (
	ErrEmailExists  = errors.New("email already exists")
	ErrUserNotFound = errors.New("user not found")
)

// ─── Implementation ─────────────────────────────────────────────────────────

type userService struct {
	db *gorm.DB
}

func (s *userService) List(f UserListFilter) ([]model.User, int64, error) {
	db := s.db.Model(&model.User{})

	if f.Name != "" {
		db = db.Where("name LIKE ?", "%"+f.Name+"%")
	}
	if f.Email != "" {
		db = db.Where("email LIKE ?", "%"+f.Email+"%")
	}
	if f.Status != "" {
		db = db.Where("status = ?", f.Status)
	}
	if f.Role != "" {
		db = db.Where("id IN (SELECT user_id FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE r.name = ?)", f.Role)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page, size := normalizePage(f.Page, f.PageSize)
	var users []model.User
	err := db.Order("created_at DESC").
		Offset((page - 1) * size).
		Limit(size).
		Preload("Roles").
		Find(&users).Error
	return users, total, err
}

func (s *userService) GetByID(id int64) (*model.User, error) {
	var u model.User
	err := s.db.Preload("Roles").First(&u, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrUserNotFound
	}
	return &u, err
}

func (s *userService) GetByEmail(email string) (*model.User, error) {
	var u model.User
	err := s.db.Where("email = ?", email).First(&u).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrUserNotFound
	}
	return &u, err
}

func (s *userService) Create(in CreateUserInput) (*model.User, error) {
	var existing model.User
	if err := s.db.Where("email = ?", in.Email).First(&existing).Error; err == nil {
		return nil, ErrEmailExists
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	u := model.User{
		Name:     in.Name,
		Email:    in.Email,
		Password: string(hash),
		Status:   consts.UserStatusActive,
	}
	txErr := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&u).Error; err != nil {
			return err
		}
		for _, rid := range in.RoleIDs {
			if err := tx.Create(&model.UserRole{UserID: u.ID, RoleID: rid}).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if txErr != nil {
		return nil, txErr
	}

	s.db.Preload("Roles").First(&u, u.ID)
	return &u, nil
}

func (s *userService) Update(id int64, in UpdateUserInput) (*model.User, error) {
	var u model.User
	if err := s.db.First(&u, id).Error; err != nil {
		return nil, ErrUserNotFound
	}

	txErr := s.db.Transaction(func(tx *gorm.DB) error {
		if in.Status != "" {
			if err := tx.Model(&u).Update("status", in.Status).Error; err != nil {
				return err
			}
		}
		if in.RoleIDs != nil {
			if err := tx.Where("user_id = ?", id).Delete(&model.UserRole{}).Error; err != nil {
				return err
			}
			for _, rid := range in.RoleIDs {
				if err := tx.Create(&model.UserRole{UserID: id, RoleID: rid}).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
	if txErr != nil {
		return nil, txErr
	}

	s.db.Preload("Roles").First(&u, id)
	return &u, nil
}

// normalizePage 兜底：page<1 默认 1；pageSize<1 默认 10；>100 截断 100。
// 复用 pkg/pagination.Clamp 作为单一真相源，保证与 handler 层 Parse 规则一致。
func normalizePage(page, size int) (int, int) {
	return pagination.Clamp(page, size)
}
