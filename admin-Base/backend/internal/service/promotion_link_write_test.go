package service

import (
	"errors"
	"net/url"
	"testing"
)

func intPtr(value int) *int { return &value }

func TestBuildPromotionURL(t *testing.T) {
	result, err := buildPromotionURL("http://localhost:3001/", 123, 10000001)
	if err != nil {
		t.Fatalf("buildPromotionURL() error = %v", err)
	}
	parsed, err := url.Parse(result)
	if err != nil {
		t.Fatalf("url.Parse() error = %v", err)
	}
	if parsed.Path != "/player" || parsed.Query().Get("dramaId") != "123" || parsed.Query().Get("linkId") != "10000001" {
		t.Fatalf("buildPromotionURL() = %q", result)
	}
	if parsed.Query().Has("linkid") || parsed.Query().Has("episode") {
		t.Fatalf("buildPromotionURL() has unsupported parameters: %q", parsed.RawQuery)
	}
}

func TestBuildPromotionURLRejectsInvalidBase(t *testing.T) {
	if _, err := buildPromotionURL("localhost:3001", 123, 10000001); err == nil {
		t.Fatal("buildPromotionURL() expected invalid base URL error")
	}
}

func TestValidatePromotionConfig(t *testing.T) {
	tests := []struct {
		name             string
		monetizationType string
		paywall          int
		beans            *int
		episodeCount     int
		wantErr          error
	}{
		{name: "IAP valid minimum", monetizationType: "IAP", paywall: 1, beans: intPtr(10), episodeCount: 20},
		{name: "IAP valid maximum", monetizationType: "IAP", paywall: 20, beans: intPtr(500), episodeCount: 20},
		{name: "IAA does not require beans", monetizationType: "IAA", paywall: 2, episodeCount: 20},
		{name: "paywall below range", monetizationType: "IAA", paywall: 0, episodeCount: 20, wantErr: ErrPromotionPaywallInvalid},
		{name: "paywall above range", monetizationType: "IAP", paywall: 21, beans: intPtr(100), episodeCount: 20, wantErr: ErrPromotionPaywallInvalid},
		{name: "IAP beans missing", monetizationType: "IAP", paywall: 2, episodeCount: 20, wantErr: ErrPromotionBeansRequired},
		{name: "IAP beans below range", monetizationType: "IAP", paywall: 2, beans: intPtr(9), episodeCount: 20, wantErr: ErrPromotionBeansInvalid},
		{name: "IAP beans above range", monetizationType: "IAP", paywall: 2, beans: intPtr(501), episodeCount: 20, wantErr: ErrPromotionBeansInvalid},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validatePromotionConfig(CreatePromotionLinkInput{
				PaywallEpisode: tt.paywall,
				BeansPerEp:     tt.beans,
			}, tt.episodeCount, tt.monetizationType)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("validatePromotionConfig() error = %v, want %v", err, tt.wantErr)
			}
		})
	}
}
