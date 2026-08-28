package model

import "time"

type User struct {
	ID           int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	Name         string    `gorm:"size:128;not null" json:"name"`
	Email        string    `gorm:"size:255;uniqueIndex" json:"email"`
	Password     string    `gorm:"size:255;not null;default:''" json:"-"`
	Status       string    `gorm:"size:16;not null;default:启用" json:"status"` // 启用 | 禁用
	SessionToken string    `gorm:"size:64;not null;default:''" json:"-"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`

	Roles []Role `gorm:"many2many:user_roles" json:"roles,omitempty"`
}

type Role struct {
	ID        int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	Name      string    `gorm:"size:128;not null;uniqueIndex" json:"name"`
	Remark    string    `gorm:"size:500" json:"remark"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`

	Users       []User           `gorm:"many2many:user_roles" json:"users,omitempty"`
	Permissions []RolePermission `gorm:"foreignKey:RoleID" json:"permissions,omitempty"`
}

type UserRole struct {
	UserID int64 `gorm:"primaryKey" json:"userId"`
	RoleID int64 `gorm:"primaryKey" json:"roleId"`
}

type RolePermission struct {
	ID            int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	RoleID        int64  `gorm:"index;not null" json:"roleId"`
	PermissionKey string `gorm:"size:128;not null" json:"permissionKey"`
}
