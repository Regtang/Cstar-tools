# AGENTS.md — 喜事达工具平台开发规范（给 AI 编码助手）

本文件供任何 AI 编码助手（Codex、Claude、Cursor 等）阅读。**在本仓库内开发、设计或改造任何挂到 bot.regs.com 的小工具时，必须遵循以下统一标准**，以保证所有工具的配色、风格、交互、基本功能与平台一致。

设计基准来自门户网站与「Cstar 装箱软件」，以 cstar.com 品牌为准。

## 起步：先复制模板

新工具直接基于 `aeo/portal/tool-template.html`（或 `前端标准/tool-template.html`）改——它已内置统一样式与全部功能基线，比从零写更快、更不易跑偏。

## 〇、标准功能库 cstar-tool.js（含数据存储，强烈推荐）

平台提供共享 JS 库，把每个工具都要重复写的功能做成现成接口（任何 AI/工具通用）：

```html
<script src="/cstar-tool.js"></script>   <!-- 线上：https://bot.regs.com/cstar-tool.js -->
```

全局 `Cstar` 提供：
- **数据存储** `Cstar.store.bindForm(key,[id...])` 表单自动暂存+恢复；`store.save/load/remove`。
- **历史台账** `Cstar.records(key)`：add/all/get/update/remove/clear、`search({text,fields,from,to,dateField})`、`exportCSV`/`exportExcel`。
- **校验** `Cstar.validate([{id,required,pattern,msg}])`（自动标红 `cs-field-error`）。
- **电子签名** `Cstar.signature(canvasId)`；**自动编号** `Cstar.serial(prefix,seed)`。
- **导出** `Cstar.exportPDF(elId,file)`（A4分页）/`exportWord`/`exportExcel`/`exportExcelData`/`exportJSON`/`print`。
- **照片水印** `Cstar.watermarkPhoto(file, 文字)`；引入库即自动处理 `?embed=1` 嵌入模式。
- **署名（必备）** `Cstar.stamp({tool, version, author})`：页脚显示工具名+版本号+作者姓名。**每个工具必须声明作者姓名与版本号**，可用 `Cstar.stampLine()` 写进单据/导出。
- **版本更新说明（发新版必备）**：发布新版本时软件内必须带更新说明——`Cstar.stamp` 支持 `changelog:[{version,date,notes:[…]}]` 参数（页脚版本号可点击弹出）；或在帮助/关于页列明版本号、日期与变更点。

凡有输入的工具用 `bindForm` 自动暂存；凡产生记录的工具用 `records` 做台账并支持导出。参考实现见 `前端标准/tool-template.html`。

## 一、配色与字体（不要用蓝/紫等非品牌色作主色）

| 用途 | 颜色 | 变量 |
|------|------|------|
| 主色（按钮/链接/页头/强调） | `#007892` 青 | `--cs-teal` |
| 主色深 / 浅 | `#005f73` / `#0a9bbd` | `--cs-teal-dark` / `--cs-teal-light` |
| 强调/警示 | `#e54c5e` 红 | `--cs-red` |
| 顶栏/页脚/深色块 | `#252f45` 深蓝 | `--cs-navy` |
| 正文 / 次要文字 | `#1f2a37` / `#5b6b7a` | `--cs-ink` / `--cs-muted` |
| 边框 / 页面背景 | `#e6ebf1` / `#f5f8fa` | `--cs-line` / `--cs-soft` |
| 成功 / 警告 / 危险 | `#168821` / `#f29900` / `#e31d1c` | `--cs-ok` / `--cs-warn` / `--cs-danger` |

字体：`-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", Roboto, sans-serif`
圆角：卡片 14px、输入/按钮 10px。

## 二、引入共享样式表

不要从零写配色和组件，直接引入平台共享样式表（线上公开、同源）：

```html
<head>
  <link rel="stylesheet" href="/cstar-ui.css">   <!-- 线上：https://bot.regs.com/cstar-ui.css -->
</head>
<body class="cstar-ui">
```

组件类（均 `cs-` 前缀）：布局 `cs-wrap`/`cs-grid-2`/`cs-row`；页头 `cs-header`；卡片 `cs-card`+`cs-card-body`；表单 `cs-label`/`cs-input`/`cs-select`/`cs-textarea`；按钮 `cs-btn`+`cs-btn-primary`/`cs-btn-accent`/`cs-btn-soft`/`cs-btn-ghost`；徽章 `cs-badge-*`；提示条 `cs-note-*`；表格 `cs-table`；校验 `cs-field-error`+`cs-error-text`。完整清单见 `aeo/portal/cstar-ui.css` 顶部注释。

## 三、嵌入模式（必须支持）

首页用弹窗以 `?embed=1` 内嵌工具，需隐藏自带页头避免双标题。用 `cs-header` 即自动生效（cstar-ui.css 已内置），并在 `<head>` 加：

```html
<script>
  document.documentElement.classList.toggle("embed-mode",
    new URLSearchParams(location.search).get("embed") === "1");
</script>
```

## 四、四项功能基线（参照装箱软件，每个工具都要有）

1. **示例/演示数据按钮**——一键填样例，方便试用与演示。
2. **输入校验 + 错误提示**——必填/格式/范围校验，用 `cs-field-error`+`cs-error-text` 友好提示。
3. **导出 / 打印**——结果可导出 CSV/TXT 或 `window.print()`。
4. **响应式 + 本地保存**——手机可用；输入用 `localStorage` 自动暂存、加载恢复。

参考实现见 `tool-template.html`。

## 五、部署前自检

前端统一：引入 cstar-ui.css + `body.cstar-ui`、主色青强调红无蓝紫、`cs-header` 且支持 `?embed=1`、观感与门户/装箱一致。
功能测试：四项基线齐全；核心流程/边界值/异常输入都测过。

## 六、提交上线

打包成单个 `.zip`，到 bot.regs.com 首页「For Developers」模块：新工具点「上传新工具」，现有工具出新版点「提交工具更新」（选目标工具）。上传只进待审核暂存区、不立即公开，维护者审核测试后部署。

> 详见 `前端标准/前端统一标准.md`。Claude/Cowork 用户也可安装 `cstar-tool-standard.skill` 获得同样的自动指引。
