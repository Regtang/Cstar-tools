#!/bin/bash
# 喜事达工具平台 · 一键部署（双击运行）
# 把本地最新代码部署到香港服务器，结果写入同文件夹的 cstar-deploy.log
# v2：网络步骤自动重试（应对国内→香港 SSH/SCP 偶发抽风）
HOST="ubuntu@43.129.179.78"
LOG="$HOME/Desktop/喜事达运维/cstar-deploy.log"
SRC="$HOME/Desktop/xishida-aeo"
exec > >(tee "$LOG") 2>&1

# —— 更稳的 SSH：连接超时 + 保活；失败自动重试 ——
SSH_OPTS="-o ConnectTimeout=20 -o ServerAliveInterval=5 -o ServerAliveCountMax=3 -o ConnectionAttempts=2"
sshx(){ ssh $SSH_OPTS "$HOST" "$@"; }
scpx(){ scp $SSH_OPTS -q "$@"; }
retry(){ local max=6 n=1; while true; do "$@" && return 0; [ $n -ge $max ] && return 1; echo "  …第 $n 次失败，5 秒后重试（网络抖动）"; sleep 5; n=$((n+1)); done; }

echo "============================================================"
echo "  喜事达工具平台 · 部署开始  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"

echo "[1/4] 上传后端代码 + AEO 前端..."
retry scpx "$SRC"/backend/*.py "$HOST:~/xishida-aeo/backend/" || { echo "✗ 后端上传失败（已重试多次，检查网络/SSH密钥）"; exit 1; }
retry scpx "$SRC"/requirements.txt "$SRC"/docker-compose.yml "$HOST:~/xishida-aeo/" || echo "  ⚠ requirements/compose 上传失败（不影响其余）"
# —— 自动版本号 + 前端缓存刷新（每次部署自动 +1 并强制浏览器取新文件）——
VF="$SRC/frontend/VERSION"
CUR=$(cat "$VF" 2>/dev/null || echo "1.0")
MAJ=${CUR%.*}; PATCH=${CUR##*.}; PATCH=$((PATCH+1)); NEWV="$MAJ.$PATCH"
echo "$NEWV" > "$VF"
printf '/* 自动生成：每次部署覆盖 */\nwindow.APP_VERSION="v%s";\nwindow.APP_BUILD="%s";\n' "$NEWV" "$(date '+%Y-%m-%d %H:%M')" > "$SRC/frontend/version.js"
sed -i '' -E "s/(app\.js\?v=)[0-9.]+/\1$NEWV/; s/(styles\.css\?v=)[0-9.]+/\1$NEWV/; s/(version\.js\?v=)[0-9.]+/\1$NEWV/" "$SRC/frontend/index.html"
echo "  版本号自动升级 → v$NEWV"
retry sshx 'mkdir -p ~/xishida-aeo/frontend'
retry scpx "$SRC"/frontend/* "$HOST:~/xishida-aeo/frontend/" || { echo "✗ AEO前端上传失败（已重试多次）"; exit 1; }

echo "[2/4] 上传前端文件..."
retry sshx 'sudo rm -rf ~/portal_stage && mkdir -p ~/portal_stage'
retry scpx "$SRC"/portal/* "$HOST:~/portal_stage/" || { echo "✗ 前端上传失败（已重试多次）"; exit 1; }

echo "[2b] 上传装箱软件(packer)..."
PK="$HOME/Desktop/cstar-tools/packer"
if [ -d "$PK" ]; then
  retry sshx 'rm -rf ~/packer_stage && mkdir -p ~/packer_stage'
  if retry scpx -r "$PK"/. "$HOST:~/packer_stage/"; then
    sshx 'if [ -d /var/www/packer ]; then sudo cp -r ~/packer_stage/. /var/www/packer/; sudo chown -R www-data:www-data /var/www/packer; sudo chmod -R a+rX /var/www/packer; echo "  packer 已更新"; else echo "  ⚠ 服务器无 /var/www/packer，已跳过"; fi'
  else
    echo "  ⚠ packer 上传失败（不影响其余部署）"
  fi
fi

echo "[3/4] 服务器重建并发布..."
retry sshx 'set -e; cd ~/xishida-aeo; sudo docker compose up -d --build >/dev/null 2>&1; \
  sudo cp ~/portal_stage/* /var/www/portal/; \
  sudo chown www-data:www-data /var/www/portal/*; sudo chmod a+rX /var/www/portal/*' || { echo "✗ 服务器重建失败（已重试多次）"; exit 1; }

echo "[4/5] 健康检查..."
sleep 5
retry sshx 'echo -n "  后端: "; curl -s http://127.0.0.1:8000/api/health; echo; \
  echo -n "  工具数: "; curl -s http://127.0.0.1:8000/api/catalog | grep -o "slug" | wc -l'

# —— 把已部署代码同步进 GitHub 仓库副本，确保部署与推送始终一致 ——
echo "[5/5] 同步代码到 GitHub 仓库副本..."
REPO="$HOME/Desktop/cstar-tools/aeo"
if [ -d "$REPO" ]; then
  cp "$SRC"/backend/*.py "$REPO"/backend/ 2>/dev/null && echo "  ✓ 后端已同步"
  [ -d "$REPO/portal" ]   && cp "$SRC"/portal/*   "$REPO"/portal/   2>/dev/null && echo "  ✓ 门户已同步"
  [ -d "$REPO/frontend" ] && cp "$SRC"/frontend/* "$REPO"/frontend/ 2>/dev/null && echo "  ✓ AEO前端已同步"
  echo "  → 已镜像到 $REPO（双击『同步GitHub.command』即可推送到 GitHub）"
else
  echo "  ⚠ 未找到 $REPO，跳过（不影响部署）"
fi

echo "============================================================"
echo "  ✓ 部署完成  $(date '+%Y-%m-%d %H:%M:%S')"
echo "  （本窗口可关闭；结果已写入 喜事达运维/cstar-deploy.log）"
echo "  提示：如改了代码，再双击『同步GitHub.command』即可推送（已自动镜像）"
echo "============================================================"
