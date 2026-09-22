package service

import "testing"

func TestPromotionAttributionChanged(t *testing.T) {
	current := int64(10000001)

	tests := []struct {
		name     string
		current  *int64
		incoming int64
		want     bool
	}{
		{name: "first attribution", current: nil, incoming: 10000001, want: true},
		{name: "same Linkid", current: &current, incoming: 10000001, want: false},
		{name: "different Linkid", current: &current, incoming: 10000002, want: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := promotionAttributionChanged(tt.current, tt.incoming); got != tt.want {
				t.Fatalf("promotionAttributionChanged() = %v, want %v", got, tt.want)
			}
		})
	}
}
