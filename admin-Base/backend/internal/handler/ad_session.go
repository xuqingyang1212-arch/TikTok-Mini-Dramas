package handler

import (
	"fmt"
	"strings"

	"scaffold-admin/internal/pkg/datetime"
	"scaffold-admin/internal/pkg/response"
	"scaffold-admin/internal/pkg/xlsxstream"
	"scaffold-admin/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

func parseAdSessionFilter(c *gin.Context) service.AdSessionFilter {
	createdAtFrom, createdAtTo := ParseChinaDateRange(c, "createdAtFrom", "createdAtTo")
	return service.AdSessionFilter{
		UserID:            TrimQuery(c, "userId"),
		AttributionLinkID: TrimQuery(c, "linkId"),
		AppID:             QueryInt64(c, "appId", 0),
		DramaID:           TrimQuery(c, "dramaId"),
		Status:            parseAdSessionStatus(TrimQuery(c, "status")),
		CreatedAtFrom:     createdAtFrom,
		CreatedAtTo:       createdAtTo,
		Page:              QueryInt(c, "page", 1),
		PageSize:          QueryInt(c, "pageSize", 20),
	}
}

func parseAdSessionStatus(status string) string {
	status = strings.ToLower(status)
	switch status {
	case "pending", "completed", "canceled", "expired":
		return status
	default:
		return ""
	}
}

func (a *Application) ListAdSessions(c *gin.Context) {
	items, total, err := a.services.AdSession.List(parseAdSessionFilter(c))
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	response.OKPage(c, total, items)
}

var defaultAdSessionColumns = []string{
	"userId", "attributionLinkId", "appName", "dramaId", "episodeNo", "status", "createdAt", "completedAt", "sessionNo",
}

var validAdSessionColumns = map[string]bool{
	"userId": true, "attributionLinkId": true, "appName": true, "dramaId": true,
	"episodeNo": true, "status": true, "createdAt": true, "completedAt": true,
	"sessionNo": true,
}

func parseAdSessionExportColumns(raw string) []string {
	if raw == "" {
		return defaultAdSessionColumns
	}
	parts := splitCSV(raw)
	columns := make([]string, 0, len(parts))
	seen := make(map[string]bool, len(parts))
	for _, part := range parts {
		if validAdSessionColumns[part] && !seen[part] {
			columns = append(columns, part)
			seen[part] = true
		}
	}
	if len(columns) == 0 {
		return defaultAdSessionColumns
	}
	return columns
}

func adSessionColumnLabel(column string) string {
	switch column {
	case "userId":
		return "用户ID"
	case "attributionLinkId":
		return "Linkid"
	case "appName":
		return "小程序"
	case "dramaId":
		return "剧集"
	case "episodeNo":
		return "集数"
	case "status":
		return "会话状态"
	case "createdAt":
		return "创建时间"
	case "completedAt":
		return "广告完成时间"
	case "sessionNo":
		return "会话ID"
	default:
		return column
	}
}

func adSessionStatusLabel(status string) string {
	switch status {
	case "pending":
		return "待完成"
	case "completed":
		return "已完成"
	case "canceled":
		return "已取消"
	case "expired":
		return "已过期"
	default:
		return status
	}
}

func adSessionColumnValue(column string, item service.AdSessionItem) interface{} {
	switch column {
	case "userId":
		return item.UserID
	case "attributionLinkId":
		if item.AttributionLinkID != nil {
			return *item.AttributionLinkID
		}
		return ""
	case "appName":
		return item.AppName
	case "dramaId":
		if item.DramaName != "" {
			return item.DramaName
		}
		return item.DramaID
	case "episodeNo":
		return item.EpisodeNo
	case "status":
		return adSessionStatusLabel(item.Status)
	case "createdAt":
		return datetime.FormatChinaSecond(item.CreatedAt)
	case "completedAt":
		return datetime.FormatChinaSecond(item.CompletedAt)
	case "sessionNo":
		return item.SessionNo
	default:
		return ""
	}
}

func (a *Application) ExportAdSessions(c *gin.Context) {
	columns := parseAdSessionExportColumns(c.Query("columns"))
	headers := make([]any, len(columns))
	for index, column := range columns {
		headers[index] = adSessionColumnLabel(column)
	}
	filename := fmt.Sprintf("ad-sessions-%s.xlsx", datetime.ChinaNow().Format("20060102150405"))
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	if err := xlsxstream.Write(c.Writer, xlsxstream.Options{Sheet: "广告会话", Headers: headers}, func(_ *excelize.File, yield func(xlsxstream.Row) error) error {
		return a.services.AdSession.Iterate(parseAdSessionFilter(c), 500, func(items []service.AdSessionItem) error {
			for _, item := range items {
				values := make([]any, len(columns))
				for index, column := range columns {
					values[index] = adSessionColumnValue(column, item)
				}
				if err := yield(xlsxstream.Row{Values: values}); err != nil {
					return err
				}
			}
			return nil
		})
	}); err != nil {
		response.FailServer(c, "导出失败")
	}
}
