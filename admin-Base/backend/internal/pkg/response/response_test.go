package response

import (
	"testing"
	"time"

	"scaffold-admin/internal/pkg/datetime"
)

type nestedTimes struct {
	CreatedAt time.Time     `json:"createdAt"`
	UpdatedAt *time.Time    `json:"updatedAt,omitempty"`
	CustomAt  datetime.Time `json:"customAt"`
	HiddenAt  *time.Time    `json:"hiddenAt,omitempty"`
	Ignored   time.Time     `json:"-"`
}

type EmbeddedPayload struct {
	Version int    `json:"version"`
	Title   string `json:"title"`
}

type responseWithEmbeddedPayload struct {
	EmbeddedPayload
	ID string `json:"id"`
}

func TestNormalizeTimesFlattensAnonymousStructs(t *testing.T) {
	value := responseWithEmbeddedPayload{
		EmbeddedPayload: EmbeddedPayload{Version: 2, Title: "Drama"},
		ID:              "album-1",
	}

	got, ok := normalizeTimes(value).(map[string]any)
	if !ok {
		t.Fatalf("normalizeTimes() type = %T, want map[string]any", normalizeTimes(value))
	}
	if got["version"] != 2 || got["title"] != "Drama" || got["id"] != "album-1" {
		t.Fatalf("normalizeTimes() = %#v", got)
	}
	if _, exists := got["embeddedPayload"]; exists {
		t.Fatal("anonymous struct should be flattened")
	}
}

func TestNormalizeTimes(t *testing.T) {
	created := time.Date(2026, 8, 31, 18, 0, 0, 971000000, time.FixedZone("UTC+8", 8*60*60))
	updated := created.Add(time.Second)
	value := nestedTimes{
		CreatedAt: created,
		UpdatedAt: &updated,
		CustomAt:  datetime.From(created),
	}

	got, ok := normalizeTimes(value).(map[string]any)
	if !ok {
		t.Fatalf("normalizeTimes() type = %T, want map[string]any", normalizeTimes(value))
	}
	if got["createdAt"] != "2026-08-31T10:00:00.971Z" {
		t.Fatalf("createdAt = %v", got["createdAt"])
	}
	if got["updatedAt"] != "2026-08-31T10:00:01.971Z" {
		t.Fatalf("updatedAt = %v", got["updatedAt"])
	}
	if _, ok := got["hiddenAt"]; ok {
		t.Fatal("omitempty nil field should be omitted")
	}
	if _, ok := got["Ignored"]; ok {
		t.Fatal("json ignored field should be omitted")
	}
	if _, ok := got["customAt"].(datetime.Time); !ok {
		t.Fatalf("customAt type = %T, want datetime.Time", got["customAt"])
	}
}
