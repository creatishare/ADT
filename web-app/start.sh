#!/bin/bash
# 启动 Agent Designer V2 开发服务
# 命令：./start.sh 

set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$APP_DIR/dev-server.log"
PID_FILE="$APP_DIR/dev-server.pid"
PORT=3000

echo "🚀 启动 Agent Designer V2 开发服务..."

# 检查端口是否已被占用
if lsof -i :$PORT -sTCP:LISTEN >/dev/null 2>&1; then
    EXISTING_PID=$(lsof -t -i :$PORT -sTCP:LISTEN 2>/dev/null | head -1)
    echo "⚠️  端口 $PORT 已被占用 (PID: $EXISTING_PID)"
    echo "   如需重启，请运行 ./restart.sh"
    exit 1
fi

# 如果存在旧的日志，先备份
if [ -f "$LOG_FILE" ]; then
    mv "$LOG_FILE" "$LOG_FILE.bak" 2>/dev/null || true
fi

cd "$APP_DIR"

echo "   目录: $APP_DIR"
echo "   日志: $LOG_FILE"

# 使用 nohup 后台启动
nohup npm run dev > "$LOG_FILE" 2>&1 &
NEW_PID=$!

# 等待服务就绪
sleep 2

if kill -0 $NEW_PID 2>/dev/null; then
    echo $NEW_PID > "$PID_FILE"
    echo "✅ 服务已启动 (PID: $NEW_PID)"
    echo "   本地访问: http://localhost:$PORT"
    echo "   网络访问: http://$(hostname -I 2>/dev/null | awk '{print $1}' | head -1):$PORT"
    echo ""
    echo "   查看实时日志: tail -f $LOG_FILE"
    echo "   停止服务:     ./stop.sh"
else
    echo "❌ 服务启动失败，请检查日志:"
    tail -n 20 "$LOG_FILE"
    exit 1
fi
