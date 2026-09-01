package datetime

import (
	"encoding/json"
	"testing"
	"time"
)

func TestFormatUTCUsesFixedMilliseconds(t *testing.T) {
	input := time.Date(2026, time.August, 31, 18, 0, 0, 971234000, time.FixedZone("UTC+8", 8*60*60))
	if got, want := FormatUTC(input), "2026-08-31T10:00:00.971Z"; got != want {
		t.Fatalf("FormatUTC() = %q, want %q", got, want)
	}

	encoded, err := json.Marshal(From(input))
	if err != nil {
		t.Fatalf("MarshalJSON() error = %v", err)
	}
	if got, want := string(encoded), `"2026-08-31T10:00:00.971Z"`; got != want {
		t.Fatalf("MarshalJSON() = %s, want %s", got, want)
	}
}

func TestFormatChinaSecond(t *testing.T) {
	if got, want := FormatChinaSecond("2026-08-31T10:00:00.971Z"), "2026-08-31 18:00:00"; got != want {
		t.Fatalf("FormatChinaSecond() = %q, want %q", got, want)
	}
	if got := FormatChinaSecond(""); got != "" {
		t.Fatalf("FormatChinaSecond(empty) = %q, want empty", got)
	}
}

func TestParseChinaDateRange(t *testing.T) {
	from, toExclusive := ParseChinaDateRange("2026-08-31", "2026-08-31")
	if from == nil || toExclusive == nil {
		t.Fatal("ParseChinaDateRange() returned nil boundary")
	}
	if got, want := from.Format(time.RFC3339Nano), "2026-08-30T16:00:00Z"; got != want {
		t.Fatalf("from = %q, want %q", got, want)
	}
	if got, want := toExclusive.Format(time.RFC3339Nano), "2026-08-31T16:00:00Z"; got != want {
		t.Fatalf("toExclusive = %q, want %q", got, want)
	}

	lastMillisecond := toExclusive.Add(-time.Millisecond)
	if lastMillisecond.Before(*from) || !lastMillisecond.Before(*toExclusive) {
		t.Fatalf("last millisecond %s is outside half-open range", lastMillisecond)
	}
	if toExclusive.Add(-time.Nanosecond).Before(*toExclusive) == false {
		t.Fatal("exclusive boundary comparison is invalid")
	}
}

func TestParseChinaDateRangeIgnoresInvalidDates(t *testing.T) {
	from, toExclusive := ParseChinaDateRange("not-a-date", "2026-02-30")
	if from != nil || toExclusive != nil {
		t.Fatalf("invalid dates returned boundaries: from=%v to=%v", from, toExclusive)
	}
}
