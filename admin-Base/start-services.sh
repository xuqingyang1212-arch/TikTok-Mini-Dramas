#!/bin/bash

# 定位到项目目录
cd "$(dirname "$0")"

# 杀掉旧进程
pkill -f "./server" 2>/dev/null
pkill -f "next dev" 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:8080 | xargs kill -9 2>/dev/null
sleep 1

# 启动后端
cd backend
nohup ./server > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# 启动前端
nohup npx next dev --hostname 0.0.0.0 --port 3000 > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!

sleep 3

# 验证
echo "=== 服务状态 ==="
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo "✓ 后端已启动 (PID: $BACKEND_PID)"
else
    echo "✗ 后端启动失败"
fi

if kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "✓ 前端已启动 (PID: $FRONTEND_PID)"
else
    echo "✗ 前端启动失败"
fi

echo ""
echo "=== 访问链接 ==="
echo "本地: http://localhost:3000"
IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
echo "局域网: http://$IP:3000"
