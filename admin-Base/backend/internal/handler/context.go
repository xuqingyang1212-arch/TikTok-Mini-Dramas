package handler

import (
	"scaffold-admin/internal/service"

	"gorm.io/gorm"
)

type Application struct {
	services *service.Services
	db       *gorm.DB
}

func NewApplication(services *service.Services, db *gorm.DB) *Application {
	return &Application{services: services, db: db}
}
