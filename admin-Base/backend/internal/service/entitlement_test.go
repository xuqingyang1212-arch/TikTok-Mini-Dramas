package service

import (
	"testing"

	"scaffold-admin/internal/model"
)

func TestExistingPaymentOrderCanSettleAfterModeSwitch(t *testing.T) {
	order := model.PaymentOrder{PayStatus: "pending", OrderType: "unlock"}
	if !canSettlePaymentOrder(order) {
		t.Fatal("pending order created before a mode switch must remain settleable")
	}

	for _, status := range []string{"paid", "failed", "cancelled"} {
		order.PayStatus = status
		if canSettlePaymentOrder(order) {
			t.Fatalf("terminal order with status %q must not be settled again", status)
		}
	}
}

func TestApplyCurrentEntitlementsKeepsHistoricalRightsAcrossModes(t *testing.T) {
	drama := model.Drama{EpisodeCount: 5, PaywallEpisode: 2}

	tests := []struct {
		name               string
		app                model.App
		activeSubscription bool
		initial            map[int]string
		want               map[int]string
		wantCanUnlockAd    bool
	}{
		{
			name:               "active subscription remains valid after switching to IAA",
			app:                model.App{MonetizationType: monetizationTypeIAA, AdPlacementID: "reward-slot", Status: appStatusEnabled},
			activeSubscription: true,
			initial:            map[int]string{1: unlockTypeFree, 2: unlockTypeBeans, 3: unlockTypeAd, 4: unlockTypeLocked, 5: unlockTypeLocked},
			want:               map[int]string{1: unlockTypeFree, 2: unlockTypeBeans, 3: unlockTypeAd, 4: unlockTypeSubscription, 5: unlockTypeSubscription},
			wantCanUnlockAd:    true,
		},
		{
			name:               "ad unlock remains valid after switching to IAP",
			app:                model.App{MonetizationType: monetizationTypeIAP, Status: appStatusEnabled},
			activeSubscription: false,
			initial:            map[int]string{1: unlockTypeFree, 2: unlockTypeAd, 3: unlockTypeLocked, 4: unlockTypeLocked, 5: unlockTypeLocked},
			want:               map[int]string{1: unlockTypeFree, 2: unlockTypeAd, 3: unlockTypeLocked, 4: unlockTypeLocked, 5: unlockTypeLocked},
			wantCanUnlockAd:    false,
		},
		{
			name:               "expired subscription falls back to IAA entry",
			app:                model.App{MonetizationType: monetizationTypeIAA, AdPlacementID: "reward-slot", Status: appStatusEnabled},
			activeSubscription: false,
			initial:            map[int]string{1: unlockTypeFree, 2: unlockTypeLocked, 3: unlockTypeLocked, 4: unlockTypeLocked, 5: unlockTypeLocked},
			want:               map[int]string{1: unlockTypeFree, 2: unlockTypeLocked, 3: unlockTypeLocked, 4: unlockTypeLocked, 5: unlockTypeLocked},
			wantCanUnlockAd:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := &entitlementContext{UnlockTypes: tt.initial}
			applyCurrentEntitlements(result, drama, tt.app, tt.activeSubscription)

			if result.Subscription != tt.activeSubscription {
				t.Fatalf("Subscription = %v, want %v", result.Subscription, tt.activeSubscription)
			}
			if result.CanUnlockAd != tt.wantCanUnlockAd {
				t.Fatalf("CanUnlockAd = %v, want %v", result.CanUnlockAd, tt.wantCanUnlockAd)
			}
			for episodeNo, want := range tt.want {
				if got := result.UnlockTypes[episodeNo]; got != want {
					t.Errorf("episode %d unlock type = %q, want %q", episodeNo, got, want)
				}
			}
		})
	}
}

func TestApplyCurrentEntitlementsDoesNotActivateDisabledAppSubscription(t *testing.T) {
	drama := model.Drama{EpisodeCount: 3, PaywallEpisode: 2}
	result := &entitlementContext{UnlockTypes: map[int]string{
		1: unlockTypeFree,
		2: unlockTypeLocked,
		3: unlockTypeLocked,
	}}

	applyCurrentEntitlements(result, drama, model.App{
		MonetizationType: monetizationTypeIAA,
		AdPlacementID:    "reward-slot",
		Status:           "禁用",
	}, false)

	if result.Subscription {
		t.Fatal("disabled app must not expose subscription access")
	}
	if result.CanUnlockAd {
		t.Fatal("disabled app must not expose ad unlock")
	}
}
