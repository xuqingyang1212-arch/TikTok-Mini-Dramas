package service

import "testing"

func TestPromotionLinkIDString(t *testing.T) {
	if got := promotionLinkIDString(nil); got != nil {
		t.Fatalf("promotionLinkIDString(nil) = %v, want nil", *got)
	}

	linkID := int64(10000001)
	got := promotionLinkIDString(&linkID)
	if got == nil || *got != "10000001" {
		t.Fatalf("promotionLinkIDString(%d) = %v, want 10000001", linkID, got)
	}
}
