#!/usr/bin/env bash
# 安全地为 bot.regs.com 的 nginx 配置加入 /tools/ 反向代理块。
# 自动：定位配置 → 备份 → 幂等插入 → nginx -t 自检 → 通过则 reload，失败则回滚。
set -u

CF=$(grep -rl 'root /var/www/portal' /etc/nginx/ 2>/dev/null | head -1)
if [ -z "$CF" ]; then echo "✗ 找不到 bot.regs.com 的 nginx 配置"; exit 1; fi
echo "配置文件: $CF"

if grep -q 'location /tools/' "$CF"; then
  echo "已包含 /tools/ 块，无需修改。"
  nginx -t && systemctl reload nginx && echo "NGINX_OK"
  exit 0
fi

BAK="${CF}.bak.$(date +%s)"
cp "$CF" "$BAK"
echo "已备份到: $BAK"

python3 - "$CF" <<'PY'
import sys, re
p = sys.argv[1]
s = open(p).read()
block = '''    # 平台托管工具（反代到容器，按注册表+可见性提供文件）
    location /tools/ {
        proxy_pass http://127.0.0.1:8000/tools/;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

'''
m = re.search(r'^[ \t]*location / \{', s, re.M)
if not m:
    print("✗ 未找到 'location / {' 块，未修改")
    sys.exit(2)
s = s[:m.start()] + block + s[m.start():]
open(p, 'w').write(s)
print("已插入 /tools/ 块")
PY

if [ $? -ne 0 ]; then echo "✗ 插入失败，恢复备份"; cp "$BAK" "$CF"; exit 1; fi

if nginx -t; then
  systemctl reload nginx
  echo "NGINX_OK"
else
  echo "✗ nginx 配置测试失败，已回滚"
  cp "$BAK" "$CF"
  nginx -t && systemctl reload nginx
  exit 1
fi
