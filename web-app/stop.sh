#!/bin/bash
# 停止 Agent Designer V2 开发服务
# 命令：./stop.sh

set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$APP_DIR/dev-server.pid"
PORT=3000

echo "🛑 停止 Agent Designer V2 开发服务..."

FOUND=0

# 方式1: 通过 PID 文件停止
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 $PID 2>/dev/null; then
        kill $PID 2>/dev/null || true
        sleep 1
        # 如果还在，强制终止
        if kill -0 $PID 2>/dev/null; then
            kill -9 $PID 2>/dev/null || true
        fi
        echo "✅ 已通过 PID 文件停止进程 (PID: $PID)"
        FOUND=1
    fi
    rm -f "$PID_FILE"
fi

# 方式2: 通过端口查找并停止
PIDS=$(lsof -t -i :$PORT -sTCP:LISTEN 2>/dev/null || true)
if [ -n "$PIDS" ]; then
    for PID in $PIDS; do
        if kill -0 $PID 2>/dev/null; then
            kill $PID 2>/dev/null || true
            sleep 1
            if kill -0 $PID 2>/dev/null; then
                kill -9 $PID 2>/dev/null || true
            fi
            echo "✅ 已通过端口查找停止进程 (PID: $PID)"
            FOUND=1
        fi
    done
fi

if [ "$FOUND" -eq 1 ]; then
    echo "   端口 $PORT 已释放"
else
    echo "⚠️  未找到运行中的服务 (端口 $PORT)"
fi
