package response

import (
	"net/http"

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

func OK(c *gin.Context, data any) {
	c.JSON(http.StatusOK, R{Code: 0, Message: "success", Data: data})
}

func OKPage(c *gin.Context, total int64, list any) {
	c.JSON(http.StatusOK, R{Code: 0, Message: "success", Data: PageData{Total: total, List: list}})
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
