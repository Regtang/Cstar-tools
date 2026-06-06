#!/usr/bin/env bash
# 喜事达AEO认证管理平台 —— 一键启动（macOS / Linux）
set -e
cd "$(dirname "$0")"

echo "[1/3] 检查 Python ..."
PY=$(command -v python3 || command -v python)
if [ -z "$PY" ]; then echo "未找到 Python，请先安装 Python 3.9+"; exit 1; fi

echo "[2/3] 安装依赖 ..."
$PY -m pip install -r requirements.txt

echo "[3/3] 启动服务 ..."
cd backend
echo "访问地址：http://127.0.0.1:8000   （默认账号 admin / admin123）"
$PY -m uvicorn main:app --host 0.0.0.0 --port 8000
