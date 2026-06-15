#!/bin/bash
# 喜事达工具平台 · 一键同步到 GitHub（双击运行）
REPO="$HOME/Desktop/cstar-tools"
LOG="$HOME/Desktop/喜事达运维/cstar-sync.log"
exec > >(tee "$LOG") 2>&1

echo "============================================================"
echo "  同步到 GitHub 开始  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
cd "$REPO" || { echo "✗ 找不到仓库目录 $REPO"; exit 1; }
git add -A
if git diff --cached --quiet; then
  echo "本地无新改动，推送已有提交…"
else
  git -c commit.gpgsign=false commit -m "同步 $(date '+%Y-%m-%d %H:%M')" >/dev/null
  echo "已提交本地改动。"
fi
git push origin main && echo "✓ 推送成功" || echo "✗ 推送失败（如提示密码：用户名 Regtang，密码用 GitHub 令牌）"
echo "============================================================"
echo "  同步完成  $(date '+%Y-%m-%d %H:%M:%S')"
echo "  （本窗口可关闭；结果已写入 喜事达运维/cstar-sync.log）"
echo "============================================================"
