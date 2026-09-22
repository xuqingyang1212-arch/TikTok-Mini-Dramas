package service

import (
	"encoding/json"
	"errors"
	"testing"

	"scaffold-admin/internal/model"
)

func TestValidateMediaEventReport(t *testing.T) {
	valid := MediaEventReportInput{
		ReportID:  "report_01-abc",
		UserID:    1,
		DramaID:   2,
		EpisodeNo: 3,
		EventName: "ep_play",
		Status:    model.MediaEventReportSuccess,
		Params:    json.RawMessage(`{"episode_number":3}`),
		Result:    json.RawMessage(`{"isSuccess":true}`),
	}
	if err := validateMediaEventReport(valid); err != nil {
		t.Fatalf("validateMediaEventReport(valid) error = %v", err)
	}

	tests := []struct {
		name   string
		mutate func(*MediaEventReportInput)
	}{
		{name: "invalid report ID", mutate: func(input *MediaEventReportInput) { input.ReportID = "contains space" }},
		{name: "invalid event name", mutate: func(input *MediaEventReportInput) { input.EventName = "EP.Play" }},
		{name: "invalid status", mutate: func(input *MediaEventReportInput) { input.Status = "pending" }},
		{name: "zero episode", mutate: func(input *MediaEventReportInput) { input.EpisodeNo = 0 }},
		{name: "params must be object", mutate: func(input *MediaEventReportInput) { input.Params = json.RawMessage(`[]`) }},
		{name: "result must be object", mutate: func(input *MediaEventReportInput) { input.Result = json.RawMessage(`null`) }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			input := valid
			tt.mutate(&input)
			if err := validateMediaEventReport(input); !errors.Is(err, ErrMediaReportInvalid) {
				t.Fatalf("error = %v, want ErrMediaReportInvalid", err)
			}
		})
	}
}

func TestJSONEqualIgnoresObjectKeyOrder(t *testing.T) {
	if !jsonEqual([]byte(`{"a":1,"b":2}`), []byte(`{"b":2,"a":1}`)) {
		t.Fatal("equivalent JSON objects should compare equal")
	}
	if jsonEqual([]byte(`{"a":1}`), []byte(`{"a":2}`)) {
		t.Fatal("different JSON objects should not compare equal")
	}
}
