package handler

import (
	"fmt"
	"io"
	"net/http"
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
	upload(c, uploadOptions{
		directory: "images", maxBytes: 10 * 1024 * 1024,
		allowed:     map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true},
		invalidType: "只支持 jpg/jpeg/png/gif/webp 格式的图片", tooLarge: "图片大小不能超过 10MB",
	})
}

type uploadOptions struct {
	directory, invalidType, tooLarge string
	maxBytes                         int64
	allowed                          map[string]bool
}

func upload(c *gin.Context, options uploadOptions) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, options.maxBytes+1024*1024)
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		response.FailBadRequest(c, "请选择要上传的文件")
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !options.allowed[ext] {
		response.FailBadRequest(c, options.invalidType)
		return
	}
	if header.Size < 0 || header.Size > options.maxBytes {
		response.FailBadRequest(c, options.tooLarge)
		return
	}

	dateDir := time.Now().UTC().Format("2006/01/02")
	fullDir := filepath.Join(config.MediaStorageDir(), options.directory, dateDir)
	if err := os.MkdirAll(fullDir, 0755); err != nil {
		response.FailServer(c, "创建目录失败")
		return
	}

	filename := fmt.Sprintf("%d%s", snowflake.NextID(), ext)
	filePath := filepath.Join(fullDir, filename)

	dst, err := os.OpenFile(filePath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0644)
	if err != nil {
		response.FailServer(c, "保存文件失败")
		return
	}
	saved := false
	defer func() {
		if !saved {
			_ = os.Remove(filePath)
		}
	}()
	written, copyErr := io.Copy(dst, io.LimitReader(file, options.maxBytes+1))
	closeErr := dst.Close()
	if copyErr != nil || closeErr != nil {
		response.FailServer(c, "保存文件失败")
		return
	}
	if written > options.maxBytes {
		response.FailBadRequest(c, options.tooLarge)
		return
	}
	saved = true

	url := fmt.Sprintf("/media/%s/%s/%s", options.directory, dateDir, filename)
	payload := gin.H{"url": url}
	if options.directory == "videos" {
		payload["size"] = written
	}
	response.OK(c, payload)
}

// UploadVideo handles single video file upload
// Returns the URL path to access the uploaded file
func UploadVideo(c *gin.Context) {
	upload(c, uploadOptions{
		directory: "videos", maxBytes: 500 * 1024 * 1024,
		allowed:     map[string]bool{".mp4": true, ".mov": true, ".webm": true, ".avi": true, ".mkv": true},
		invalidType: "只支持 mp4/mov/webm/avi/mkv 格式的视频", tooLarge: "视频大小不能超过 500MB",
	})
}
