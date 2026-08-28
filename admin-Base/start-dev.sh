#!/bin/bash
# 一键启动前后端服务（后台常驻，脱离终端 SIGHUP）
# 用法: bash start-dev.sh

set -e
ROOT="/Users/xuqingyang/Documents/cursor文件/tiktok mini drama 后台/admin-Base"
cd "$ROOT"

# ---------- 后端 ----------
if lsof -i :8080 -t >/dev/null 2>&1; then
  echo "[backend] already running on :8080"
else
  echo "[backend] starting..."
  cd "$ROOT/backend"
  if [ ! -f server ]; then
    go build -o server ./cmd/server
  fi
  nohup ./server > /tmp/tiktok-backend.log 2>&1 &
  disown
  cd "$ROOT"
fi

# ---------- 前端 ----------
if lsof -i :3000 -t >/dev/null 2>&1; then
  echo "[frontend] already running on :3000"
else
  echo "[frontend] starting..."
  nohup npm run dev > /tmp/tiktok-frontend.log 2>&1 &
  disown
fi

# ---------- 等待就绪 ----------
for i in $(seq 1 20); do
  sleep 1
  if lsof -i :3000 -t >/dev/null 2>&1 && lsof -i :8080 -t >/dev/null 2>&1; then
    echo "[ok] frontend + backend ready"
    IP=$(ipconfig getifaddr en0 2>/dev/null || echo "127.0.0.1")
    echo "  Local:  http://localhost:3000"
    echo "  LAN:    http://$IP:3000"
    exit 0
  fi
done

echo "[warn] services not fully ready, check logs:"
echo "  frontend: /tmp/tiktok-frontend.log"
echo "  backend:  /tmp/tiktok-backend.log"
exit 1
