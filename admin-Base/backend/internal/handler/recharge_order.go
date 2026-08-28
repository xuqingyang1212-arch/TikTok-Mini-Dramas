package handler

import (
	"fmt"
	"time"

	"scaffold-admin/internal/pkg/response"
	"scaffold-admin/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

// parseRechargeOrderFilter 解析充值订单筛选条件（列表与导出共用）。
func parseRechargeOrderFilter(c *gin.Context) service.RechargeOrderFilter {
	var createdAtFrom, createdAtTo *time.Time
	if from := c.Query("createdAtFrom"); from != "" {
		if t, err := time.Parse("2006-01-02", from); err == nil {
			createdAtFrom = &t
		}
	}
	if to := c.Query("createdAtTo"); to != "" {
		if t, err := time.Parse("2006-01-02", to); err == nil {
			end := t.Add(24*time.Hour - time.Second)
			createdAtTo = &end
		}
	}
	return service.RechargeOrderFilter{
		AppID:             QueryInt64(c, "appId", 0),
		OrderNo:           TrimQuery(c, "orderNo"),
		ThirdPartyOrderNo: TrimQuery(c, "thirdPartyOrderNo"),
		DramaID:           TrimQuery(c, "dramaId"),
		UserID:            TrimQuery(c, "userId"),
		OrderType:         TrimQuery(c, "orderType"),
		PayStatus:         TrimQuery(c, "payStatus"),
		DeviceOS:          TrimQuery(c, "deviceOs"),
		CreatedAtFrom:     createdAtFrom,
		CreatedAtTo:       createdAtTo,
		Page:              QueryInt(c, "page", 1),
		PageSize:          QueryInt(c, "pageSize", 20),
	}
}

// ListRechargeOrders 充值订单列表
// GET /api/v1/recharge-orders
func ListRechargeOrders(c *gin.Context) {
	filter := parseRechargeOrderFilter(c)
	list, total, err := Svc.RechargeOrder.List(filter)
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	response.OKPage(c, total, list)
}

// orderTypeLabel / payStatusLabel / deviceOSLabel 导出时的中文映射。
func orderTypeLabel(t string) string {
	switch t {
	case "unlock":
		return "Beans 解锁"
	case "subscription":
		return "订阅"
	default:
		return t
	}
}

func payStatusLabel(s string) string {
	switch s {
	case "pending":
		return "待支付"
	case "paid":
		return "支付成功"
	case "failed":
		return "支付失败"
	case "cancelled":
		return "已取消"
	default:
		return s
	}
}

// formatEpisodeRange 将 "2,3,4,5,6" 压缩为 "第2-6集"。
func formatEpisodeRange(list string) string {
	if list == "" {
		return ""
	}
	parts := splitCSV(list)
	nums := make([]int, 0, len(parts))
	for _, p := range parts {
		var n int
		if _, err := fmt.Sscanf(p, "%d", &n); err == nil {
			nums = append(nums, n)
		}
	}
	if len(nums) == 0 {
		return ""
	}
	segs := []string{}
	start := nums[0]
	prev := nums[0]
	for i := 1; i < len(nums); i++ {
		if nums[i] == prev+1 {
			prev = nums[i]
			continue
		}
		segs = append(segs, epSeg(start, prev))
		start = nums[i]
		prev = nums[i]
	}
	segs = append(segs, epSeg(start, prev))
	out := "第"
	for i, s := range segs {
		if i > 0 {
			out += ","
		}
		out += s
	}
	return out + "集"
}

func epSeg(a, b int) string {
	if a == b {
		return fmt.Sprintf("%d", a)
	}
	return fmt.Sprintf("%d-%d", a, b)
}

func splitCSV(s string) []string {
	out := []string{}
	cur := ""
	for _, r := range s {
		if r == ',' {
			if cur != "" {
				out = append(out, cur)
			}
			cur = ""
			continue
		}
		cur += string(r)
	}
	if cur != "" {
		out = append(out, cur)
	}
	return out
}

// ExportRechargeOrders 按当前筛选导出充值订单为 .xlsx。
// GET /api/v1/recharge-orders/export
func ExportRechargeOrders(c *gin.Context) {
	filter := parseRechargeOrderFilter(c)
	items, err := Svc.RechargeOrder.ListAll(filter)
	if err != nil {
		response.FailServer(c, "导出失败")
		return
	}

	f := excelize.NewFile()
	defer f.Close()
	sheet := "充值订单"
	f.SetSheetName("Sheet1", sheet)

	// 按前端「列设置」当前可见列导出：columns 传列 key（逗号分隔，保持顺序）。
	// 未传时回退到默认全量列，保证向后兼容。
	cols := parseExportColumns(c.Query("columns"))
	for i, col := range cols {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, rechargeColumnLabel(col))
	}
	for r, it := range items {
		row := r + 2
		for cIdx, col := range cols {
			cell, _ := excelize.CoordinatesToCellName(cIdx+1, row)
			f.SetCellValue(sheet, cell, rechargeColumnValue(col, it))
		}
	}

	filename := fmt.Sprintf("recharge-orders-%s.xlsx", time.Now().Format("20060102150405"))
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	if err := f.Write(c.Writer); err != nil {
		response.FailServer(c, "导出失败")
		return
	}
}

// 导出列的默认顺序（与前端 ALL_COLUMNS 的默认可见列一致）。
var defaultRechargeColumns = []string{
	"userId", "appName", "orderType", "drama", "beansCost", "subscribeAmount",
	"deviceOs", "payStatus", "createdAt", "orderNo", "thirdPartyOrderNo",
}

// 前端可能传入的全部合法列 key，用于过滤非法参数。
var validRechargeColumns = map[string]bool{
	"userId": true, "appName": true, "orderType": true, "drama": true,
	"episodeList": true, "beansCost": true, "period": true,
	"subscribeAmount": true, "deviceOs": true, "payStatus": true,
	"createdAt": true, "paidAt": true, "orderNo": true, "thirdPartyOrderNo": true,
}

func parseExportColumns(raw string) []string {
	if raw == "" {
		return defaultRechargeColumns
	}
	parts := splitCSV(raw)
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if validRechargeColumns[p] {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return defaultRechargeColumns
	}
	return out
}

func rechargeColumnLabel(col string) string {
	switch col {
	case "userId":
		return "用户ID"
	case "appName":
		return "小程序"
	case "orderType":
		return "订单类型"
	case "drama":
		return "充值剧集"
	case "episodeList":
		return "解锁集数"
	case "beansCost":
		return "消耗Beans"
	case "period":
		return "订阅周期"
	case "subscribeAmount":
		return "订阅金额"
	case "deviceOs":
		return "设备系统"
	case "payStatus":
		return "支付状态"
	case "createdAt":
		return "创建时间"
	case "paidAt":
		return "支付时间"
	case "orderNo":
		return "订单号"
	case "thirdPartyOrderNo":
		return "第三方订单号"
	default:
		return col
	}
}

func periodLabel(p string) string {
	switch p {
	case "weekly", "week":
		return "周"
	case "monthly", "month":
		return "月"
	case "quarterly", "quarter":
		return "季度"
	case "half_yearly", "half_year":
		return "半年"
	case "yearly", "year":
		return "年"
	default:
		return p
	}
}

func rechargeColumnValue(col string, it service.RechargeOrderItem) interface{} {
	switch col {
	case "userId":
		return it.UserID
	case "appName":
		return it.AppName
	case "orderType":
		return orderTypeLabel(it.OrderType)
	case "drama":
		drama := it.DramaName
		if drama == "" {
			drama = it.DramaID
		}
		return drama
	case "episodeList":
		if it.OrderType == "unlock" {
			return formatEpisodeRange(it.EpisodeList)
		}
		return ""
	case "beansCost":
		if it.OrderType == "unlock" {
			return it.BeansCost
		}
		return ""
	case "period":
		if it.OrderType == "subscription" {
			return periodLabel(it.Period)
		}
		return ""
	case "subscribeAmount":
		if it.OrderType == "subscription" {
			return fmt.Sprintf("%.2f", it.SubscribeAmount)
		}
		return ""
	case "deviceOs":
		return it.DeviceOS
	case "payStatus":
		return payStatusLabel(it.PayStatus)
	case "createdAt":
		return it.CreatedAt
	case "paidAt":
		return it.PaidAt
	case "orderNo":
		return it.OrderNo
	case "thirdPartyOrderNo":
		return it.ThirdPartyOrderNo
	default:
		return ""
	}
}
