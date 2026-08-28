package pagination

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type Params struct {
	Page     int
	PageSize int
}

func Parse(c *gin.Context) Params {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	page, pageSize = Clamp(page, pageSize)
	return Params{Page: page, PageSize: pageSize}
}

// Clamp 是全站统一的分页兜底规则（单一真相源）：
// page<1 默认 1；pageSize<1 默认 10；pageSize>100 截断 100。
// handler 层的 Parse 与 service 层的分页均复用此函数，避免规则漂移。
func Clamp(page, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}

func (p Params) Offset() int {
	return (p.Page - 1) * p.PageSize
}

func Paginate(p Params) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		return db.Offset(p.Offset()).Limit(p.PageSize)
	}
}

// CountAndFind counts total rows, then applies ordering + pagination and populates dest.
// db should already have filters applied; dest must be a pointer to a slice.
// Optional preloads can be passed as extra string arguments.
func CountAndFind(db *gorm.DB, p Params, order string, dest any, preloads ...string) (int64, error) {
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return 0, err
	}
	q := db.Order(order).Scopes(Paginate(p))
	for _, rel := range preloads {
		q = q.Preload(rel)
	}
	err := q.Find(dest).Error
	return total, err
}
