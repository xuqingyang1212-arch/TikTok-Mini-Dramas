#!/bin/bash
# 服务管理脚本（基于 launchd，开机自启 + 崩溃自动重启）
# 用法: bash service.sh [status|restart|stop|start|rebuild]
UID_NUM=$(id -u)
BE=com.tiktok.drama.backend
FE=com.tiktok.drama.frontend
BE_PLIST=~/Library/LaunchAgents/$BE.plist
FE_PLIST=~/Library/LaunchAgents/$FE.plist
ROOT="/Users/xuqingyang/Documents/cursor文件/tiktok mini drama 后台/admin-Base"

case "$1" in
  status|"")
    echo "backend  : $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/api/v1/health)  http://localhost:8080"
    echo "frontend : $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/)  http://localhost:3000"
    echo "LAN      : http://$(ipconfig getifaddr en0 2>/dev/null):3000"
    ;;
  stop)
    launchctl bootout gui/$UID_NUM $BE_PLIST 2>/dev/null
    launchctl bootout gui/$UID_NUM $FE_PLIST 2>/dev/null
    echo "stopped"
    ;;
  start)
    launchctl bootstrap gui/$UID_NUM $BE_PLIST 2>/dev/null
    launchctl bootstrap gui/$UID_NUM $FE_PLIST 2>/dev/null
    echo "started"
    ;;
  restart)
    launchctl kickstart -k gui/$UID_NUM/$BE
    launchctl kickstart -k gui/$UID_NUM/$FE
    echo "restarted"
    ;;
  rebuild)
    cd "$ROOT/backend" && go build -o server ./cmd/server && echo "backend rebuilt"
    launchctl kickstart -k gui/$UID_NUM/$BE && echo "backend restarted"
    ;;
  *)
    echo "usage: bash service.sh [status|restart|stop|start|rebuild]"
    ;;
esac
