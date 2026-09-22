package handler

import (
	"testing"

	"scaffold-admin/internal/service"
)

func TestMediaEventReportJSONFieldsExportAsIndentedJSON(t *testing.T) {
	item := service.MediaEventReportItem{
		Params: map[string]any{
			"event":  "play",
			"nested": map[string]any{"episode": float64(3)},
		},
		Result: map[string]any{
			"simulated": true,
			"reportEvent": map[string]any{
				"callbackResult": map[string]any{"isSuccess": true},
			},
		},
	}

	tests := map[string]string{
		"params": "{\n  \"event\": \"play\",\n  \"nested\": {\n    \"episode\": 3\n  }\n}",
		"result": "{\n  \"reportEvent\": {\n    \"callbackResult\": {\n      \"isSuccess\": true\n    }\n  },\n  \"simulated\": true\n}",
	}
	for column, want := range tests {
		got, ok := mediaEventReportColumnValue(column, item).(string)
		if !ok {
			t.Fatalf("%s export value has type %T, want string", column, mediaEventReportColumnValue(column, item))
		}
		if got != want {
			t.Fatalf("%s export value = %q, want %q", column, got, want)
		}
	}
}
