#!/bin/bash
# 喜事达AEO认证管理平台 —— 一键启动器（macOS 双击运行）
cd "$(dirname "$0")"

clear
echo "==================================================="
echo "   喜事达AEO认证管理平台 — 正在启动，请稍候…"
echo "==================================================="
echo ""

# 选择 Python
PY=$(command -v python3 || command -v python)
if [ -z "$PY" ]; then
  echo "⚠️  未检测到 Python。"
  echo "请先安装 Python 3：打开 https://www.python.org/downloads/ 下载安装后，再双击本启动器。"
  echo ""
  read -n 1 -s -r -p "按任意键关闭本窗口…"
  exit 1
fi

echo "[1/2] 检查并安装依赖（首次较慢，请耐心等待）…"
$PY -m pip install -q -r requirements.txt 2>/dev/null || $PY -m pip install -q --break-system-packages -r requirements.txt

echo "[2/2] 启动服务…"
echo ""
echo "==================================================="
echo "  启动成功后，请用浏览器打开： http://127.0.0.1:8000"
echo "  登录账号： admin     密码： admin123"
echo ""
echo "  ★ 本窗口请勿关闭，关闭即停止服务。"
echo "  ★ 想停止服务：按 Control + C，或直接关闭本窗口。"
echo "==================================================="
echo ""

cd backend
exec $PY -m uvicorn main:app --host 127.0.0.1 --port 8000
