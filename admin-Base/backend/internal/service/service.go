// Package service provides the business logic layer between HTTP handlers and
// the data layer. Each domain has its own service interface + implementation,
// keeping handlers thin (parse request → call service → write response).
package service

import "gorm.io/gorm"

// Services groups all domain services for dependency injection.
// Extend this struct + New() when adding new domains to a derived project.
type Services struct {
	User          UserService
	Role          RoleService
	App           AppService
	AppUser       AppUserService
	Drama         DramaService
	Episode       EpisodeService
	Mini          MiniService
	AdUnlock      AdUnlockService
	PaymentConfig PaymentConfigService
	Subscription  SubscriptionService
	MiniPayment   MiniPaymentService
	RechargeOrder RechargeOrderService
}

// New creates a Services instance backed by the given GORM DB.
func New(db *gorm.DB) *Services {
	paymentConfig := &paymentConfigService{db: db}
	entitlements := &entitlementResolver{db: db}
	miniPayment := &miniPaymentService{db: db, payConfig: paymentConfig, entitlements: entitlements}
	return &Services{
		User:          &userService{db: db},
		Role:          &roleService{db: db},
		App:           &appService{db: db},
		AppUser:       &appUserService{db: db},
		Drama:         &dramaService{db: db},
		Episode:       &episodeService{db: db},
		Mini:          &miniService{db: db, payment: miniPayment, entitlements: entitlements},
		AdUnlock:      &adUnlockService{db: db, entitlements: entitlements},
		PaymentConfig: paymentConfig,
		Subscription:  &subscriptionService{db: db},
		MiniPayment:   miniPayment,
		RechargeOrder: &rechargeOrderService{db: db},
	}
}
