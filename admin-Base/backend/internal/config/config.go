package config

import (
	"os"
	"strconv"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Database DatabaseConfig `yaml:"database"`
	JWT      JWTConfig      `yaml:"jwt"`
	Demo     DemoConfig     `yaml:"demo"`
	Storage  StorageConfig  `yaml:"storage"`
}

type ServerConfig struct {
	Port int    `yaml:"port"`
	Mode string `yaml:"mode"`
}

type DatabaseConfig struct {
	Host         string `yaml:"host"`
	Port         int    `yaml:"port"`
	User         string `yaml:"user"`
	Password     string `yaml:"password"`
	DBName       string `yaml:"dbname"`
	Charset      string `yaml:"charset"`
	MaxIdleConns int    `yaml:"max_idle_conns"`
	MaxOpenConns int    `yaml:"max_open_conns"`
	Socket       string `yaml:"socket"` // Unix socket path (optional)
}

type JWTConfig struct {
	Secret      string `yaml:"secret"`
	ExpireHours int    `yaml:"expire_hours"`
}

// DemoConfig 演示模式配置
// 演示模式下跳过所有外部接口对接（TikTok OAuth、支付网关等）
type DemoConfig struct {
	Enabled         bool   `yaml:"enabled"`
	DefaultCoins    int    `yaml:"default_coins"`
	AutoLogin       bool   `yaml:"auto_login"`
	AutoPayment     bool   `yaml:"auto_payment"`
	FixedVerifyCode string `yaml:"fixed_verify_code"`
}

// StorageConfig 文件存储配置
type StorageConfig struct {
	Type  string             `yaml:"type"` // local | oss | s3
	Local LocalStorageConfig `yaml:"local"`
	OSS   OSSConfig          `yaml:"oss"`
}

// MediaStorageDir returns the configured local media directory.
func MediaStorageDir() string {
	if dir := Global.Storage.Local.UploadDir; dir != "" {
		return dir
	}
	return "./uploads"
}

type LocalStorageConfig struct {
	UploadDir string `yaml:"upload_dir"`
	BaseURL   string `yaml:"base_url"`
}

type OSSConfig struct {
	Endpoint  string `yaml:"endpoint"`
	AccessKey string `yaml:"access_key"`
	SecretKey string `yaml:"secret_key"`
	Bucket    string `yaml:"bucket"`
	BaseURL   string `yaml:"base_url"`
}

// IsDemoMode 快捷判断是否为演示模式
func IsDemoMode() bool {
	return Global.Demo.Enabled
}

// DSN 返回 MySQL 连接字符串
// 如果配置了 Socket，优先使用 Unix socket 连接
func (d *DatabaseConfig) DSN() string {
	if d.Socket != "" {
		// Unix socket: user:password@unix(/path/to/socket)/dbname?charset=...
		return d.User + ":" + d.Password + "@unix(" + d.Socket + ")/" + d.DBName + "?charset=" + d.Charset + "&parseTime=True&loc=UTC&time_zone=%27%2B00%3A00%27"
	}
	// TCP: user:password@tcp(host:port)/dbname?charset=...
	return d.User + ":" + d.Password + "@tcp(" + d.Host + ":" + strconv.Itoa(d.Port) + ")/" + d.DBName + "?charset=" + d.Charset + "&parseTime=True&loc=UTC&time_zone=%27%2B00%3A00%27"
}

var Global Config

func Load(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	if err := yaml.Unmarshal(data, &Global); err != nil {
		return err
	}
	applyEnvOverrides(&Global)
	return nil
}

// applyEnvOverrides lets deployments override sensitive / host-dependent fields
// without committing them into config.yaml. Env values take precedence over YAML.
func applyEnvOverrides(c *Config) {
	// Server
	if v := os.Getenv("SERVER_PORT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			c.Server.Port = n
		}
	}
	if v := os.Getenv("SERVER_MODE"); v != "" {
		c.Server.Mode = v
	}

	// Database
	if v := os.Getenv("DB_HOST"); v != "" {
		c.Database.Host = v
	}
	if v := os.Getenv("DB_PORT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			c.Database.Port = n
		}
	}
	if v := os.Getenv("DB_USER"); v != "" {
		c.Database.User = v
	}
	if v := os.Getenv("DB_PASSWORD"); v != "" {
		c.Database.Password = v
	}
	if v := os.Getenv("DB_NAME"); v != "" {
		c.Database.DBName = v
	}
	if v := os.Getenv("DB_SOCKET"); v != "" {
		c.Database.Socket = v
	}

	// JWT
	if v := os.Getenv("JWT_SECRET"); v != "" {
		c.JWT.Secret = v
	}
	if v := os.Getenv("JWT_EXPIRE_HOURS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			c.JWT.ExpireHours = n
		}
	}

	// Demo
	if v := os.Getenv("DEMO_ENABLED"); v == "false" {
		c.Demo.Enabled = false
	}
}
