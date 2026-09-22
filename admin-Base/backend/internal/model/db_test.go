package model

import (
	"database/sql"
	"testing"
)

func TestPromotionLinkSequenceNeedsInitialization(t *testing.T) {
	tests := []struct {
		name string
		next sql.NullInt64
		want bool
	}{
		{name: "uninitialized empty table", next: sql.NullInt64{}, want: true},
		{name: "default sequence", next: sql.NullInt64{Int64: 1, Valid: true}, want: true},
		{name: "required first ID", next: sql.NullInt64{Int64: firstPromotionLinkID, Valid: true}, want: false},
		{name: "advanced sequence", next: sql.NullInt64{Int64: firstPromotionLinkID + 42, Valid: true}, want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := promotionLinkSequenceNeedsInitialization(tt.next); got != tt.want {
				t.Fatalf("promotionLinkSequenceNeedsInitialization(%v) = %v, want %v", tt.next, got, tt.want)
			}
		})
	}
}
