package handler

import (
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

type miniLanguagePreference struct {
	Locale string
}

var defaultMiniLanguage = miniLanguagePreference{
	Locale: "en-US",
}

func parseMiniLanguage(header string) miniLanguagePreference {
	best := defaultMiniLanguage
	bestQuality := -1.0
	found := false

	for _, item := range strings.Split(header, ",") {
		parts := strings.Split(item, ";")
		tag := strings.ToLower(strings.TrimSpace(parts[0]))
		quality := 1.0
		for _, parameter := range parts[1:] {
			pair := strings.SplitN(strings.TrimSpace(parameter), "=", 2)
			if len(pair) != 2 || !strings.EqualFold(strings.TrimSpace(pair[0]), "q") {
				continue
			}
			parsed, err := strconv.ParseFloat(strings.TrimSpace(pair[1]), 64)
			if err != nil || parsed < 0 || parsed > 1 {
				quality = 0
			} else {
				quality = parsed
			}
		}
		if quality <= 0 {
			continue
		}

		var candidate miniLanguagePreference
		switch {
		case tag == "zh" || strings.HasPrefix(tag, "zh-"):
			candidate = miniLanguagePreference{Locale: "zh-CN"}
		case tag == "en" || strings.HasPrefix(tag, "en-"):
			candidate = defaultMiniLanguage
		default:
			continue
		}

		if !found || quality > bestQuality {
			best = candidate
			bestQuality = quality
			found = true
		}
	}

	return best
}

func miniLanguageMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		preference := parseMiniLanguage(c.GetHeader("Accept-Language"))
		c.Set("miniLanguage", preference.Locale)
		c.Next()
	}
}
