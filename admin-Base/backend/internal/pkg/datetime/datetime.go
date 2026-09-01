package datetime

import (
	"encoding/json"
	"time"
)

const RFC3339Millis = "2006-01-02T15:04:05.000Z07:00"

var chinaLocation = time.FixedZone("Asia/Shanghai", 8*60*60)

// Time marshals every API time as UTC RFC3339 with exactly millisecond precision.
type Time time.Time

func From(t time.Time) Time {
	return Time(t.UTC())
}

func FromPtr(t *time.Time) *Time {
	if t == nil {
		return nil
	}
	value := From(*t)
	return &value
}

func (t Time) MarshalJSON() ([]byte, error) {
	return json.Marshal(FormatUTC(time.Time(t)))
}

func FormatUTC(t time.Time) string {
	return t.UTC().Format(RFC3339Millis)
}

// FormatChinaSecond converts an API UTC timestamp to the China operating
// timezone without exposing stored milliseconds in exports.
func FormatChinaSecond(value string) string {
	if value == "" {
		return ""
	}
	parsed, err := time.Parse(RFC3339Millis, value)
	if err != nil {
		return value
	}
	return parsed.In(chinaLocation).Format("2006-01-02 15:04:05")
}

func NowUTC() time.Time {
	return time.Now().UTC()
}

// ParseChinaDateRange converts inclusive China-calendar dates into a UTC
// half-open interval [from, toExclusive), preserving all database milliseconds.
func ParseChinaDateRange(fromDate, toDate string) (from, toExclusive *time.Time) {
	if fromDate != "" {
		if parsed, err := time.ParseInLocation(time.DateOnly, fromDate, chinaLocation); err == nil {
			value := parsed.UTC()
			from = &value
		}
	}
	if toDate != "" {
		if parsed, err := time.ParseInLocation(time.DateOnly, toDate, chinaLocation); err == nil {
			value := parsed.AddDate(0, 0, 1).UTC()
			toExclusive = &value
		}
	}
	return from, toExclusive
}

func ChinaNow() time.Time {
	return time.Now().In(chinaLocation)
}
