package service

import (
	"errors"
	"testing"
)

func TestCreateSubscriptionRejectsBlankTierID(t *testing.T) {
	service := &subscriptionService{}

	_, err := service.Create(CreateSubscriptionPlanInput{TierID: "  \t"})
	if !errors.Is(err, ErrSubscriptionTierRequired) {
		t.Fatalf("Create() error = %v, want ErrSubscriptionTierRequired", err)
	}
}

func TestUpdateSubscriptionRejectsBlankTierID(t *testing.T) {
	service := &subscriptionService{}
	blank := "  "

	err := service.Update(1, UpdateSubscriptionPlanInput{TierID: &blank})
	if !errors.Is(err, ErrSubscriptionTierRequired) {
		t.Fatalf("Update() error = %v, want ErrSubscriptionTierRequired", err)
	}
}
