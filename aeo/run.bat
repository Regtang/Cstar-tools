@echo off
REM 喜事达AEO认证管理平台 —— 一键启动（Windows）
cd /d %~dp0
echo [1/3] 安装依赖 ...
python -m pip install -r requirements.txt
echo [2/3] 进入后端 ...
cd backend
echo [3/3] 启动服务 ...
echo 访问地址：http://127.0.0.1:8000   ^(默认账号 admin / admin123^)
python -m uvicorn main:app --host 0.0.0.0 --port 8000
pause
