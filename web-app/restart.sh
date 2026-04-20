#!/bin/bash
# 重启 Agent Designer V2 开发服务
# 命令：./restart.sh

APP_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🔄 重启 Agent Designer V2 开发服务..."
echo ""

# 先停止
"$APP_DIR/stop.sh"

echo ""

# 再启动
"$APP_DIR/start.sh"
