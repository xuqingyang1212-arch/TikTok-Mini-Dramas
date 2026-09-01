package response

import (
	"fmt"
	"net/http"
	"reflect"
	"strings"
	"time"

	"scaffold-admin/internal/pkg/datetime"

	"github.com/gin-gonic/gin"
)

type R struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

type PageData struct {
	Total int64 `json:"total"`
	List  any   `json:"list"`
}

var (
	timeType     = reflect.TypeOf(time.Time{})
	datetimeType = reflect.TypeOf(datetime.Time{})
)

// normalizeTimes is the final response boundary: every nested time.Time is
// converted to a fixed-millisecond RFC3339 UTC string without changing DTOs.
func normalizeTimes(value any) any {
	return normalizeValue(reflect.ValueOf(value))
}

func normalizeValue(value reflect.Value) any {
	if !value.IsValid() {
		return nil
	}
	if value.Type() == timeType {
		return datetime.FormatUTC(value.Interface().(time.Time))
	}
	if value.Type() == datetimeType {
		return value.Interface()
	}
	if value.Kind() == reflect.Interface {
		if value.IsNil() {
			return nil
		}
		return normalizeValue(value.Elem())
	}
	if value.Kind() == reflect.Pointer {
		if value.IsNil() {
			return nil
		}
		return normalizeValue(value.Elem())
	}

	switch value.Kind() {
	case reflect.Struct:
		out := make(map[string]any)
		typeInfo := value.Type()
		for i := 0; i < value.NumField(); i++ {
			fieldInfo := typeInfo.Field(i)
			if fieldInfo.PkgPath != "" {
				continue
			}
			name, options := jsonField(fieldInfo)
			if name == "-" {
				continue
			}
			fieldValue := value.Field(i)
			if options["omitempty"] && fieldValue.IsZero() {
				continue
			}
			out[name] = normalizeValue(fieldValue)
		}
		return out
	case reflect.Slice, reflect.Array:
		if value.Kind() == reflect.Slice && value.IsNil() {
			return nil
		}
		out := make([]any, value.Len())
		for i := 0; i < value.Len(); i++ {
			out[i] = normalizeValue(value.Index(i))
		}
		return out
	case reflect.Map:
		if value.IsNil() {
			return nil
		}
		out := make(map[string]any, value.Len())
		iter := value.MapRange()
		for iter.Next() {
			out[toString(iter.Key().Interface())] = normalizeValue(iter.Value())
		}
		return out
	default:
		return value.Interface()
	}
}

func jsonField(field reflect.StructField) (string, map[string]bool) {
	name := field.Name
	options := make(map[string]bool)
	if tag := field.Tag.Get("json"); tag != "" {
		parts := strings.Split(tag, ",")
		if parts[0] != "" {
			name = parts[0]
		}
		for _, option := range parts[1:] {
			options[option] = true
		}
	}
	return name, options
}

func toString(value any) string {
	if text, ok := value.(string); ok {
		return text
	}
	return fmt.Sprint(value)
}

func OK(c *gin.Context, data any) {
	c.JSON(http.StatusOK, R{Code: 0, Message: "success", Data: normalizeTimes(data)})
}

func OKPage(c *gin.Context, total int64, list any) {
	c.JSON(http.StatusOK, R{Code: 0, Message: "success", Data: PageData{Total: total, List: normalizeTimes(list)}})
}

func OKMsg(c *gin.Context, msg string) {
	c.JSON(http.StatusOK, R{Code: 0, Message: msg})
}

func Fail(c *gin.Context, code int, msg string) {
	c.JSON(http.StatusOK, R{Code: code, Message: msg})
}

func FailBadRequest(c *gin.Context, msg string) {
	c.JSON(http.StatusBadRequest, R{Code: 400, Message: msg})
}

func FailUnauthorized(c *gin.Context, msg string) {
	c.JSON(http.StatusUnauthorized, R{Code: 401, Message: msg})
}

func FailForbidden(c *gin.Context, msg string) {
	c.JSON(http.StatusForbidden, R{Code: 403, Message: msg})
}

func FailNotFound(c *gin.Context, msg string) {
	c.JSON(http.StatusNotFound, R{Code: 404, Message: msg})
}

func FailServer(c *gin.Context, msg string) {
	c.JSON(http.StatusInternalServerError, R{Code: 500, Message: msg})
}
