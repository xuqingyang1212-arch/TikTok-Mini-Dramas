package handler

import (
	"scaffold-admin/internal/pkg/response"
	"scaffold-admin/internal/service"

	"github.com/gin-gonic/gin"
)

// ─── List Dramas ────────────────────────────────────────────────────────────

func ListDramas(c *gin.Context) {
	page := QueryInt(c, "page", 1)
	pageSize := QueryInt(c, "pageSize", 20)

	createdAtFrom, createdAtTo := ParseChinaDateRange(c, "createdAtFrom", "createdAtTo")

	filter := service.DramaListFilter{
		DramaID:       TrimQuery(c, "dramaId"),
		Name:          TrimQuery(c, "name"),
		Language:      TrimQuery(c, "language"),
		Status:        TrimQuery(c, "status"),
		CreatedAtFrom: createdAtFrom,
		CreatedAtTo:   createdAtTo,
		Page:          page,
		PageSize:      pageSize,
	}

	list, total, err := Svc.Drama.List(filter)
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	response.OKPage(c, total, list)
}

// ─── Get Drama ──────────────────────────────────────────────────────────────

func GetDrama(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}

	drama, err := Svc.Drama.GetByID(id)
	if err == service.ErrDramaNotFound {
		response.FailNotFound(c, "剧集不存在")
		return
	}
	if err != nil {
		response.FailServer(c, "查询失败")
		return
	}
	response.OK(c, drama)
}

// ─── Create Drama ───────────────────────────────────────────────────────────

type createDramaReq struct {
	Name           string `json:"name" binding:"required"`
	CoverURL       string `json:"coverUrl"`
	Language       string `json:"language" binding:"required"`
	PaywallEpisode int    `json:"paywallEpisode"`
}

func CreateDrama(c *gin.Context) {
	var req createDramaReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误")
		return
	}

	// 卡点必须>=1
	paywallEp := req.PaywallEpisode
	if paywallEp < 1 {
		paywallEp = 2 // 默认卡点第2集
	}

	drama, err := Svc.Drama.Create(service.CreateDramaInput{
		Name:           req.Name,
		CoverURL:       req.CoverURL,
		Language:       req.Language,
		PaywallEpisode: paywallEp,
	})
	if err != nil {
		response.FailServer(c, "创建失败")
		return
	}
	response.OK(c, drama)
}

// ─── Update Drama ───────────────────────────────────────────────────────────

type updateDramaReq struct {
	Name           *string `json:"name"`
	CoverURL       *string `json:"coverUrl"`
	Language       *string `json:"language"`
	PaywallEpisode *int    `json:"paywallEpisode"`
}

func UpdateDrama(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}

	var req updateDramaReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailBadRequest(c, "参数错误")
		return
	}

	// 卡点校验：必须>=1
	if req.PaywallEpisode != nil && *req.PaywallEpisode < 1 {
		response.FailBadRequest(c, "付费卡点必须大于0")
		return
	}

	err := Svc.Drama.Update(id, service.UpdateDramaInput{
		Name:           req.Name,
		CoverURL:       req.CoverURL,
		Language:       req.Language,
		PaywallEpisode: req.PaywallEpisode,
	})
	if err == service.ErrDramaNotFound {
		response.FailNotFound(c, "剧集不存在")
		return
	}
	if err == service.ErrDramaPaywallExceedsEps {
		response.FailBadRequest(c, "付费卡点不能超过总集数")
		return
	}
	if err != nil {
		response.FailServer(c, "更新失败")
		return
	}
	response.OK(c, nil)
}

// ─── Toggle Drama Status ────────────────────────────────────────────────────

func ToggleDramaStatus(c *gin.Context) {
	id, ok := ParseID(c, "id")
	if !ok {
		return
	}

	err := Svc.Drama.ToggleStatus(id)
	if err == service.ErrDramaNotFound {
		response.FailNotFound(c, "剧集不存在")
		return
	}
	if err == service.ErrDramaNoEpisodes {
		response.FailBadRequest(c, "总集数为0，不可上架")
		return
	}
	if err == service.ErrDramaPaywallExceedsEps {
		response.FailBadRequest(c, "付费卡点超过总集数，不可上架")
		return
	}
	if err != nil {
		response.FailServer(c, "操作失败")
		return
	}
	response.OK(c, nil)
}
