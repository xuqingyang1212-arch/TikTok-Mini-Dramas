package handler

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"scaffold-admin/internal/config"
	"scaffold-admin/internal/pkg/response"
	"scaffold-admin/internal/pkg/snowflake"

	"github.com/gin-gonic/gin"
)

// UploadImage handles single image file upload
// Returns the URL path to access the uploaded file
func UploadImage(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		response.FailBadRequest(c, "请选择要上传的文件")
		return
	}
	defer file.Close()

	// Validate file type
	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowedExts := map[string]bool{
		".jpg":  true,
		".jpeg": true,
		".png":  true,
		".gif":  true,
		".webp": true,
	}
	if !allowedExts[ext] {
		response.FailBadRequest(c, "只支持 jpg/jpeg/png/gif/webp 格式的图片")
		return
	}

	// Validate file size (max 10MB)
	if header.Size > 10*1024*1024 {
		response.FailBadRequest(c, "图片大小不能超过 10MB")
		return
	}

	// Generate unique filename: date + snowflake ID + ext
	dateDir := time.Now().Format("2006/01/02")
	fullDir := filepath.Join(config.MediaStorageDir(), "images", dateDir)
	if err := os.MkdirAll(fullDir, 0755); err != nil {
		response.FailServer(c, "创建目录失败")
		return
	}

	filename := fmt.Sprintf("%d%s", snowflake.NextID(), ext)
	filePath := filepath.Join(fullDir, filename)

	// Save file
	dst, err := os.Create(filePath)
	if err != nil {
		response.FailServer(c, "保存文件失败")
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		response.FailServer(c, "保存文件失败")
		return
	}

	// Return URL (relative path that can be served by static file handler)
	url := fmt.Sprintf("/media/images/%s/%s", dateDir, filename)
	response.OK(c, gin.H{"url": url})
}

// UploadVideo handles single video file upload
// Returns the URL path to access the uploaded file
func UploadVideo(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		response.FailBadRequest(c, "请选择要上传的文件")
		return
	}
	defer file.Close()

	// Validate file type
	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowedExts := map[string]bool{
		".mp4":  true,
		".mov":  true,
		".webm": true,
		".avi":  true,
		".mkv":  true,
	}
	if !allowedExts[ext] {
		response.FailBadRequest(c, "只支持 mp4/mov/webm/avi/mkv 格式的视频")
		return
	}

	// Validate file size (max 500MB)
	if header.Size > 500*1024*1024 {
		response.FailBadRequest(c, "视频大小不能超过 500MB")
		return
	}

	// Generate unique filename: date + snowflake ID + ext
	dateDir := time.Now().Format("2006/01/02")
	fullDir := filepath.Join(config.MediaStorageDir(), "videos", dateDir)
	if err := os.MkdirAll(fullDir, 0755); err != nil {
		response.FailServer(c, "创建目录失败")
		return
	}

	filename := fmt.Sprintf("%d%s", snowflake.NextID(), ext)
	filePath := filepath.Join(fullDir, filename)

	// Save file
	dst, err := os.Create(filePath)
	if err != nil {
		response.FailServer(c, "保存文件失败")
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		response.FailServer(c, "保存文件失败")
		return
	}

	// Return URL
	url := fmt.Sprintf("/media/videos/%s/%s", dateDir, filename)
	response.OK(c, gin.H{"url": url, "size": header.Size})
}
