#!/bin/bash
# TikTok Mini Drama 后台 - 一键启动脚本
# 使用方法: ./start-all.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
MYSQL_BASE="/Users/xuqingyang/.local/mysql"
MYSQL_SOCKET="/tmp/mysql.sock"

echo "=========================================="
echo "  TikTok Mini Drama 后台 - 启动服务"
echo "=========================================="

# 获取本机 IP
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
echo "📍 本机 IP: $LOCAL_IP"
echo ""

# 1. 启动 MySQL
echo "🔵 [1/3] 启动 MySQL..."
if pgrep -f "mysqld.*--datadir=$MYSQL_BASE/data" > /dev/null; then
    echo "   MySQL 已在运行"
else
    $MYSQL_BASE/bin/mysqld \
        --user=$(whoami) \
        --basedir=$MYSQL_BASE \
        --datadir=$MYSQL_BASE/data \
        --port=3306 \
        --socket=$MYSQL_SOCKET &
    sleep 4
    echo "   MySQL 启动完成"
fi

# 创建数据库
echo "   创建数据库 tiktok_mini_drama..."
$MYSQL_BASE/bin/mysql -u root --socket=$MYSQL_SOCKET -e \
    "CREATE DATABASE IF NOT EXISTS tiktok_mini_drama CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || true

# 2. 启动后端
echo ""
echo "🔵 [2/3] 启动后端 (Go Gin :8080)..."
cd "$PROJECT_DIR/backend"
if [ ! -f config.yaml ]; then
    cp config.yaml.example config.yaml
    # 修改 config.yaml 使用 socket 连接
    # 由于演示项目，这里直接使用默认配置
fi
go run ./cmd/server &
BACKEND_PID=$!
sleep 3
echo "   后端启动完成 (PID: $BACKEND_PID)"

# 3. 启动前端
echo ""
echo "🔵 [3/3] 启动前端 (Next.js :3000)..."
cd "$PROJECT_DIR"
pnpm install --silent 2>/dev/null
pnpm dev &
FRONTEND_PID=$!
sleep 3
echo "   前端启动完成 (PID: $FRONTEND_PID)"

echo ""
echo "=========================================="
echo "  ✅ 全部服务已启动"
echo "=========================================="
echo ""
echo "📱 访问地址:"
echo "   本机:   http://localhost:3000"
echo "   局域网: http://$LOCAL_IP:3000"
echo ""
echo "🔐 默认登录:"
echo "   邮箱:   admin@admin.com"
echo "   验证码: 123456"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo ""

# 等待中断
wait
