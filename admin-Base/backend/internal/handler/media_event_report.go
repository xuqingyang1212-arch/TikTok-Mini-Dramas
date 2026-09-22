package handler

import (
	"encoding/json"
	"fmt"
	"strings"

	"scaffold-admin/internal/pkg/datetime"
	"scaffold-admin/internal/pkg/response"
	"scaffold-admin/internal/pkg/xlsxstream"
	"scaffold-admin/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

func parseMediaEventReportFilter(c *gin.Context) service.MediaEventReportFilter {
	reportedAtFrom, reportedAtTo := ParseChinaDateRange(c, "reportedAtFrom", "reportedAtTo")
	return service.MediaEventReportFilter{
		UserID:            TrimQuery(c, "userId"),
		AttributionLinkID: TrimQuery(c, "linkId"),
		AppID:             QueryInt64(c, "appId", 0),
		Drama:             TrimQuery(c, "drama"),
		EventName:         TrimQuery(c, "eventName"),
		Status:            parseMediaEventReportStatus(TrimQuery(c, "status")),
		ReportedAtFrom:    reportedAtFrom,
		ReportedAtTo:      reportedAtTo,
		Page:              QueryInt(c, "page", 1),
		PageSize:          QueryInt(c, "pageSize", 20),
	}
}

func parseMediaEventReportStatus(status string) string {
	status = strings.ToLower(status)
	switch status {
	case "success", "failed", "unsupported":
		return status
	default:
		return ""
	}
}

func (a *Application) ListMediaEventReports(c *gin.Context) {
	items, total, err := a.services.MediaEventReport.List(parseMediaEventReportFilter(c))
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	response.OKPage(c, total, items)
}

var mediaEventReportExportColumns = []string{
	"userId", "appName", "monetizationType", "attributionLinkId", "dramaName", "dramaId", "episodeNo", "eventName", "status", "reportedAt", "params", "result",
}

func mediaEventReportColumnLabel(column string) string {
	switch column {
	case "userId":
		return "用户ID"
	case "appName":
		return "小程序"
	case "monetizationType":
		return "变现类型"
	case "attributionLinkId":
		return "Linkid"
	case "dramaName":
		return "剧集名称"
	case "dramaId":
		return "剧集ID"
	case "episodeNo":
		return "集数"
	case "eventName":
		return "事件名称"
	case "status":
		return "上报状态"
	case "reportedAt":
		return "上报时间"
	case "params":
		return "SDK 原始参数"
	case "result":
		return "SDK 上报结果"
	default:
		return column
	}
}

func mediaEventReportStatusLabel(status string) string {
	switch status {
	case "success":
		return "成功"
	case "failed":
		return "失败"
	case "unsupported":
		return "不支持"
	default:
		return status
	}
}

func mediaEventReportColumnValue(column string, item service.MediaEventReportItem) interface{} {
	switch column {
	case "userId":
		return item.UserID
	case "appName":
		return item.AppName
	case "monetizationType":
		return item.MonetizationType
	case "attributionLinkId":
		if item.AttributionLinkID != nil {
			return *item.AttributionLinkID
		}
		return ""
	case "dramaName":
		return item.DramaName
	case "dramaId":
		return item.DramaID
	case "episodeNo":
		return item.EpisodeNo
	case "eventName":
		return item.EventName
	case "status":
		return mediaEventReportStatusLabel(item.Status)
	case "reportedAt":
		return datetime.FormatChinaSecond(item.ReportedAt)
	case "params":
		return formatMediaEventJSON(item.Params)
	case "result":
		return formatMediaEventJSON(item.Result)
	default:
		return ""
	}
}

func formatMediaEventJSON(value map[string]any) string {
	raw, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return "{}"
	}
	return string(raw)
}

func (a *Application) ExportMediaEventReports(c *gin.Context) {
	headers := make([]any, len(mediaEventReportExportColumns))
	for index, column := range mediaEventReportExportColumns {
		headers[index] = mediaEventReportColumnLabel(column)
	}
	paramsColumnIndex := len(mediaEventReportExportColumns) - 1
	filename := fmt.Sprintf("media-event-reports-%s.xlsx", datetime.ChinaNow().Format("20060102150405"))
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	if err := xlsxstream.Write(c.Writer, xlsxstream.Options{
		Sheet: "媒体事件", Headers: headers,
		StreamSetup: func(file *excelize.File, stream *excelize.StreamWriter) error {
			if err := stream.SetColWidth(paramsColumnIndex, paramsColumnIndex+1, 60); err != nil {
				return err
			}
			return nil
		},
	}, func(file *excelize.File, yield func(xlsxstream.Row) error) error {
		jsonStyle, err := file.NewStyle(&excelize.Style{Alignment: &excelize.Alignment{Vertical: "top", WrapText: false}})
		if err != nil {
			return err
		}
		return a.services.MediaEventReport.Iterate(parseMediaEventReportFilter(c), 500, func(items []service.MediaEventReportItem) error {
			for _, item := range items {
				values := make([]any, len(mediaEventReportExportColumns))
				for index, column := range mediaEventReportExportColumns {
					value := mediaEventReportColumnValue(column, item)
					if index >= paramsColumnIndex-1 {
						value = excelize.Cell{StyleID: jsonStyle, Value: value}
					}
					values[index] = value
				}
				if err := yield(xlsxstream.Row{Values: values, Options: []excelize.RowOpts{{Height: 18}}}); err != nil {
					return err
				}
			}
			return nil
		})
	}); err != nil {
		response.FailServer(c, "导出失败")
	}
}
