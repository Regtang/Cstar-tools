# Cstar 工具平台（喜事达进出口数字工具集）

部署于 **https://bot.regs.com** 的进出口供应链工具与平台源代码。

## 上线工具一览

| 工具 | 版本 | 作者/部门 | 说明 | 线上地址 | 源文件 |
|------|------|-----------|------|----------|--------|
| AEO 认证管理平台 | — | 关务部 | 海关高级认证企业（AEO）合规管理：32 项标准自评、内部审计、整改闭环、关务/物流/财务记录、贸易安全、多角色登录。Python(FastAPI)+SQLite，Docker 部署。 | `/aeo/` | `aeo/`（全栈） |
| Cstar 装箱软件 | — | 仓储物流部 | 集装箱装箱计划：自动装箱、重货优先、3D 可视化、多箱计划。纯前端 PWA，可离线。 | `/packer/` | `packer/` |
| 危化判定（MSDS/UN） | v1.1.0 | 关务部 | 进出口危化品监管判定：按 SDS、UN 号、CAS、成分与监管清单输出证件与申报路径。 | `/msds-un-app.html` | `aeo/portal/msds-un-app.html`、`msds-un/` |
| 出口海关研判助手 | — | 关务部 | 出口报关合规研判：风险点、所需单证、归类提示、处置建议。 | `/export-customs-app.html` | `aeo/portal/export-customs-app.html`、`export-customs/` |
| 集装箱设备交接单 EIR | v1.2.0 | 老瑞 | 集装箱进出场/提还空重电子交接：ISO 6346 箱号校验、箱况示意图、CEDEX/IICL 箱损代码、带水印照片、电子签名、堆存滞箱提醒、可搜台账+CSV/Excel/Word/PDF、CEDEX 报文、二维码。 | `/container-eir-app.html` | `aeo/portal/container-eir-app.html`、`container-eir/` |

> 单文件工具的"权威源码"在 `aeo/portal/`（部署目录）；根目录的 `msds-un/`、`export-customs/`、`container-eir/` 是同一文件的独立副本，便于单独查阅。

## 平台与前端标准

| 路径 | 说明 |
|------|------|
| `aeo/portal/index.html` | 站点首页（导览入口，数据驱动渲染 + 上传/更新工具 + 待审核角标） |
| `aeo/portal/admin.html` | 管理后台（审核发布/版本回滚/工具管理，仅管理员） |
| `aeo/portal/submit.html` | 同事提交工具页（新工具 / 更新现有工具） |
| `aeo/portal/cstar-ui.css` | 统一样式表（线上 `/cstar-ui.css`） |
| `aeo/portal/cstar-tool.js` | 共享标准功能库：数据存储/台账/校验/签名/署名/导出 CSV·Excel·Word·PDF（线上 `/cstar-tool.js`） |
| `aeo/portal/tool-template.html` | 新工具起步模板 |
| `前端标准/` | 前端统一标准文档 + 共享库副本（供查阅/分享） |
| `AGENTS.md` | 给 AI 编码助手（Codex 等）的开发规范（克隆即自动读取） |
| `docs/` | 平台架构升级方案等设计文档 |

> Claude/Cowork 同事可安装 `cstar-tool-standard.skill`；Codex 等同事看 `AGENTS.md` + 引用线上 `/cstar-ui.css`、`/cstar-tool.js`。每个工具必须声明**作者姓名 + 版本号**（`Cstar.stamp`）。

## 安全须知（重要）

本仓库已剔除所有密钥与敏感文件，**请勿**提交以下内容（已写入 `.gitignore`）：

- `.env` / `.env.production`（真实令牌密钥、管理员密码、邮箱授权码）
- `deploy/certs/`、`*.pem`、`*.key`（TLS 证书与私钥）
- `backend/.secret_key`、`*.db`（数据库，含用户密码哈希）

部署时复制 `aeo/.env.example` 为 `.env` 再填入真实值。

## 各工具快速启动

**AEO 平台（本地）**：`cd aeo && docker compose up -d`，访问 http://localhost:8000

**装箱软件**：直接用浏览器打开 `packer/index.html`，或用任意静态服务器托管。

**危化判定**：直接用浏览器打开 `msds-un/msds-un-app.html`。

## 日常同步到 GitHub

平台维护者改完代码后，只需在 Mac 终端运行一条（令牌已存入钥匙串，不再需要密码）：

```
cd ~/Desktop/cstar-tools && git push
```

## 线上部署

服务器为腾讯云香港轻量（Ubuntu 24.04），nginx 反代 + Docker。详见 `aeo/deploy/` 下的上线手册。
