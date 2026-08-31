package handler

import "testing"

func TestParseMiniLanguage(t *testing.T) {
	tests := []struct {
		name       string
		header     string
		wantLocale string
	}{
		{name: "empty defaults to English", wantLocale: "en-US"},
		{name: "Chinese short tag", header: "zh", wantLocale: "zh-CN"},
		{name: "Chinese regional tag", header: "zh-Hant-TW", wantLocale: "zh-CN"},
		{name: "English regional tag", header: "en-US", wantLocale: "en-US"},
		{name: "supported fallback in list", header: "fr-FR, zh-CN;q=0.9", wantLocale: "zh-CN"},
		{name: "quality takes priority", header: "zh-CN;q=0.5, en-US;q=0.9", wantLocale: "en-US"},
		{name: "zero quality is ignored", header: "zh;q=0", wantLocale: "en-US"},
		{name: "unsupported defaults to English", header: "ja-JP", wantLocale: "en-US"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseMiniLanguage(tt.header)
			if got.Locale != tt.wantLocale {
				t.Fatalf("parseMiniLanguage(%q) = %#v, want locale %q", tt.header, got, tt.wantLocale)
			}
		})
	}
}
