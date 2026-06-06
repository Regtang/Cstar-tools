# 喜事达AEO认证管理平台

面向**生产制造型企业**申请**中国海关高级认证企业（AEO）**的合规管理软件。
依据《海关高级认证企业标准》（海关总署公告2022年第106号）与《海关注册登记备案企业信用管理办法》（海关总署令第251号）设计。

这是一套**真正的全栈管理系统**：FastAPI 后端 + SQLite 数据库 + 多角色登录权限 + REST API + Web 前端，数据持久化在服务器端数据库，支持多用户并发使用。

---

## 一、快速启动

环境要求：Python 3.9 及以上。

### macOS / Linux
```bash
cd xishida-aeo
bash run.sh
```

### Windows
双击 `run.bat`，或在命令行：
```bat
cd xishida-aeo
run.bat
```

### 手动启动
```bash
pip install -r requirements.txt
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

启动后浏览器访问：**http://127.0.0.1:8000**

---

## 二、默认账号（首次运行自动创建）

| 用户名 | 密码 | 角色 | 可写模块 |
|--------|------|------|----------|
| admin | admin123 | 系统管理员 | 全部 + 用户/日志/数据管理 |
| guanwu | 123456 | 关务部 | 标准自评、关务、物流、制度、整改 |
| neishen | 123456 | 内审部 | 标准自评、内审、整改 |
| caiwu | 123456 | 财务部 | 财务、标准自评 |
| wuliu | 123456 | 物流部 | 物流与集装箱 |
| anbao | 123456 | 安保/贸易安全部 | 商业伙伴、培训 |

> 所有角色均可**查看**全部业务模块（只读），仅在授权模块可**编辑**。
> 正式使用前请在「用户管理」中修改默认密码并创建真实账号。

---

## 三、功能模块

**认证总览**：认证驾驶舱（综合达标度、四大类达标率、风险预警）、标准自评（32 项条款）、内部审计、整改跟踪（三步闭环）。

**业务记录系统**：关务单证管理（报关单、差错率、留存3年）、物流与集装箱（七点检查、可追溯）、财务状况记录（资产负债率趋势）。

**贸易安全**：安全管控矩阵、风险热力图、商业伙伴安全评估。

**合规支撑**：制度与档案库、培训管理。

**系统**：用户管理（多角色）、操作日志（合规留痕）、设置（改密码 / 装载或清空示例数据）。

---

## 四、技术架构

```
xishida-aeo/
├── backend/
│   ├── main.py        FastAPI 应用、REST API、静态托管
│   ├── database.py    SQLite + SQLAlchemy
│   ├── models.py      数据模型（10 张业务表 + 用户 + 日志）
│   ├── auth.py        密码哈希、令牌、RBAC 权限
│   ├── seed.py        初始化用户/标准框架/示例数据
│   └── aeo.db         运行后自动生成的数据库（首次启动创建）
├── frontend/
│   ├── index.html     登录 + 应用骨架
│   ├── app.js         SPA 逻辑（按权限渲染、调用 API）
│   └── styles.css     样式
├── requirements.txt
├── run.sh / run.bat
└── README.md
```

- 认证：PBKDF2 密码哈希 + HMAC 签名令牌（纯标准库，无额外加密依赖）。
- 权限：按「模块」控制读 / 写，后端接口强制校验，前端按权限渲染导航与按钮。
- 数据：所有数据存于 `backend/aeo.db`（SQLite）。备份只需复制该文件。

---

## 五、生产部署（推荐 Docker，可内外网使用）

### 方式 A：Docker Compose（一键，推荐）
```bash
cd xishida-aeo
cp .env.example .env        # 修改密钥与管理员密码
docker compose up -d        # 构建并后台启动
```
访问 `http://服务器IP:8000`。数据保存在命名卷 `aeo-data`，升级容器不丢数据。

### 方式 B：直接用 uvicorn（多进程）
```bash
pip install -r requirements.txt
export AEO_SECRET_KEY="$(openssl rand -hex 32)"
export AEO_ADMIN_PASSWORD="你的强密码"
export AEO_DATA_DIR=/var/lib/xishida-aeo     # 数据库存放目录
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 对外发布建议
- 前置 **Nginx 反向代理并启用 HTTPS**（Let's Encrypt 证书）。
- 防火墙仅放行 443；8000 端口只对内网或本机开放。
- 如前后端分离部署到不同域名，设置环境变量 `AEO_CORS=https://你的前端域名`。
- 健康检查探针：`GET /api/health` 返回 `{"status":"ok"}`。

### 环境变量一览
| 变量 | 说明 | 默认 |
|------|------|------|
| `AEO_SECRET_KEY` | 令牌签名密钥，**生产必设**且多副本保持一致 | 随机生成到 `.secret_key` |
| `AEO_ADMIN_PASSWORD` | 默认管理员初始密码（仅首次建库生效） | `admin123` |
| `AEO_DATA_DIR` | 数据库与密钥存放目录 | `backend/` |
| `AEO_CORS` | 允许的跨域来源，逗号分隔 | 空（仅同源） |

### 升级到 PostgreSQL（高并发场景）
修改 `backend/database.py` 连接串为 `postgresql+psycopg://user:pwd@host/db`，安装驱动 `psycopg[binary]` 即可，模型层无需改动。

---

## 六、测试

```bash
pip install -r requirements-dev.txt
python -m pytest -q          # 覆盖登录、RBAC、增删改查、聚合、用户与日志，共 16 项
```

---

## 七、数据安全与留存

- 系统记录每一次新增/修改/删除及登录操作（「操作日志」），满足合规留痕要求。
- 标准要求业务数据自办结海关手续之日起保存 3 年以上，请定期备份数据库文件（或 Docker 数据卷）。
- 令牌签名密钥：生产用 `AEO_SECRET_KEY`；本地运行自动生成 `.secret_key`，请勿泄露。
- **上线前务必**：修改默认管理员密码、为每位使用者单独建账号、删除或禁用不用的演示账号。

---

## 八、界面主题

界面采用**喜事达（CSTAR）品牌配色**：petrol 蓝绿主色（#007892）+ 珊瑚红强调色（#e54c5e），深海军蓝背景，与 www.cstar.com 视觉统一。
