package service

import (
	"testing"

	"scaffold-admin/internal/model"
)

func TestSubscriptionOrderAmountUsesSnapshot(t *testing.T) {
	order := model.PaymentOrder{Amount: 7.25, PlanID: 1, DeviceOS: "Google"}
	plans := map[int64]model.SubscriptionPlan{
		1: {ID: 1, ApplePrice: 3.99, GooglePrice: 4.99},
	}

	if got := subscriptionOrderAmount(order, plans); got != 7.25 {
		t.Fatalf("subscriptionOrderAmount() = %v, want snapshot amount 7.25", got)
	}
}

func TestSubscriptionOrderAmountPreservesZeroPriceSnapshot(t *testing.T) {
	order := model.PaymentOrder{Amount: 0, PlanID: 1, DeviceOS: "Google", PlanSnapshot: `{}`}
	plans := map[int64]model.SubscriptionPlan{
		1: {ID: 1, ApplePrice: 3.99, GooglePrice: 4.99},
	}

	if got := subscriptionOrderAmount(order, plans); got != 0 {
		t.Fatalf("subscriptionOrderAmount() = %v, want snapshot amount 0", got)
	}
}

func TestSubscriptionOrderAmountFallsBackToDevicePrice(t *testing.T) {
	plans := map[int64]model.SubscriptionPlan{
		1: {ID: 1, ApplePrice: 3.99, GooglePrice: 4.99},
	}

	tests := []struct {
		name     string
		deviceOS string
		want     float64
	}{
		{name: "Apple", deviceOS: "Apple", want: 3.99},
		{name: "Google", deviceOS: "Google", want: 4.99},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			order := model.PaymentOrder{PlanID: 1, DeviceOS: tt.deviceOS}
			if got := subscriptionOrderAmount(order, plans); got != tt.want {
				t.Fatalf("subscriptionOrderAmount() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestSubscriptionOrderAmountWithoutPlanReturnsZero(t *testing.T) {
	order := model.PaymentOrder{PlanID: 99, DeviceOS: "Apple"}
	if got := subscriptionOrderAmount(order, nil); got != 0 {
		t.Fatalf("subscriptionOrderAmount() = %v, want 0", got)
	}
}
