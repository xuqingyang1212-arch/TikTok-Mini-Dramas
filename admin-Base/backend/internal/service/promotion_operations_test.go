package service

import (
	"errors"
	"reflect"
	"testing"

	"scaffold-admin/internal/model"

	"gorm.io/gorm"
)

type promotionOperationsQuery struct {
	link  model.PromotionLink
	err   error
	calls int
}

func (q *promotionOperationsQuery) load(_ *gorm.DB, linkID, appID int64) (model.PromotionLink, error) {
	q.calls++
	if q.link.LinkID != linkID || q.link.AppID != appID {
		return model.PromotionLink{}, gorm.ErrRecordNotFound
	}
	return q.link, q.err
}

func TestResolvePromotionOperations(t *testing.T) {
	beans := 120
	link := model.PromotionLink{LinkID: 10000001, AppID: 10, DramaID: 20, PaywallEpisode: 6, BeansPerEp: &beans}

	tests := []struct {
		name        string
		user        model.AppUser
		drama       model.Drama
		query       promotionOperationsQuery
		wantPaywall int
		wantBeans   *int
		wantCalls   int
		wantErr     error
	}{
		{name: "no attribution keeps defaults", user: model.AppUser{AppID: 10}, drama: model.Drama{ID: 20, PaywallEpisode: 3}, query: promotionOperationsQuery{link: link}, wantPaywall: 3},
		{name: "linked drama overrides paywall and price", user: model.AppUser{AppID: 10, CurrentPromotionLinkID: int64Ptr(10000001)}, drama: model.Drama{ID: 20, PaywallEpisode: 3}, query: promotionOperationsQuery{link: link}, wantPaywall: 6, wantBeans: &beans, wantCalls: 1},
		{name: "other drama only overrides price", user: model.AppUser{AppID: 10, CurrentPromotionLinkID: int64Ptr(10000001)}, drama: model.Drama{ID: 21, PaywallEpisode: 4}, query: promotionOperationsQuery{link: link}, wantPaywall: 4, wantBeans: &beans, wantCalls: 1},
		{name: "missing or cross-app link keeps defaults", user: model.AppUser{AppID: 11, CurrentPromotionLinkID: int64Ptr(10000001)}, drama: model.Drama{ID: 20, PaywallEpisode: 3}, query: promotionOperationsQuery{link: link}, wantPaywall: 3, wantCalls: 1},
		{name: "database error is returned", user: model.AppUser{AppID: 10, CurrentPromotionLinkID: int64Ptr(10000001)}, drama: model.Drama{ID: 20, PaywallEpisode: 3}, query: promotionOperationsQuery{link: link, err: errors.New("database unavailable")}, wantPaywall: 3, wantCalls: 1, wantErr: errors.New("database unavailable")},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			operations, err := resolvePromotionOperationsWith(nil, tt.user, tt.drama, tt.query.load)
			if (err == nil) != (tt.wantErr == nil) || err != nil && err.Error() != tt.wantErr.Error() {
				t.Fatalf("resolvePromotionOperationsWith() error = %v, want %v", err, tt.wantErr)
			}
			if operations.PaywallEpisode != tt.wantPaywall || !reflect.DeepEqual(operations.BeansPerEp, tt.wantBeans) {
				t.Fatalf("operations = %+v, want paywall=%d beans=%v", operations, tt.wantPaywall, tt.wantBeans)
			}
			if tt.query.calls != tt.wantCalls {
				t.Fatalf("query calls = %d, want %d", tt.query.calls, tt.wantCalls)
			}
		})
	}
}

func int64Ptr(value int64) *int64 { return &value }
