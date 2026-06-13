---
name: cstar-tool-standard
description: 喜事达工具平台（bot.cstar.com）前端统一标准 v2.0。当你要为喜事达/Cstar 开发、设计、改造或上线任何内部小工具、网页应用、计算器、表单或仪表板时，务必使用本技能，以保证配色、风格、交互、基本功能与平台一致——即使用户没有明说"按标准来"。涵盖统一配色与字体（装箱软件风格：深蓝页头+玫红主操作色+青色辅助）、cstar-ui.css 共享样式、弹窗嵌入模式、四项功能基线（示例数据/输入校验/导出打印/响应式+本地保存）以及部署前自检清单与提交方式。Use this skill whenever building or restyling a tool for Cstar / 喜事达 / bot.cstar.com.
---

# 喜事达工具平台 · 前端统一标准 v2.0

平台地址 **bot.cstar.com** 上挂着多个由不同同事开发的小工具（AEO 合规、装箱、危化判定、出口研判、HS 速查、单证生成等）。为了让客户和内部看到统一、专业的体验，所有工具的前端必须遵循同一套标准。本技能告诉你怎么做。

设计基准为「Cstar 装箱软件」——**深蓝导航/页头 + 玫红主操作色 + 青色辅助强调 + 柔和投影卡片 + 8px 圆角 + Inter 字体**，以 cstar.com 品牌为准。
（v2.0 变更：主操作色由青色改为玫红 `#e84368`；青色降为辅助强调色；页头由青色渐变改为深蓝渐变并带玫红强调线；卡片改为柔和投影、圆角 8px；字体首选 Inter。组件类名不变，旧工具引入新版 cstar-ui.css 即自动焕新。）

## 工作流程（按此顺序）

1. **优先复制起步模板**：`assets/tool-template.html` 已内置统一样式与全部功能基线。新工具直接基于它改，比从零写更快也更不容易跑偏。
2. 引入共享样式表，套用 `cs-` 组件类（见下）。
3. 实现四项功能基线（见下，附原因）。
4. 上线前对照"部署前自检清单"逐项打勾。
5. 通过 bot.cstar.com 首页「上传工具 / 提交工具更新」入口提交，由平台维护者审核部署。

## 〇、标准功能库 cstar-tool.js（数据存储等，强烈推荐）

除了统一样式，平台还提供一个**共享 JS 标准功能库**，把"每个工具都要重复写"的功能做成现成接口，引入即用，免去重复造轮子：

```html
<script src="/cstar-tool.js"></script>   <!-- 线上：https://bot.cstar.com/cstar-tool.js -->
```

全局对象 `Cstar`，提供这些标准功能：

- **数据存储 `Cstar.store`**：`save(key,obj)` / `load(key,dflt)` / `remove(key)`；`bindForm(key, [输入框id...])` 一行实现表单内容**自动暂存 + 刷新恢复**（不丢数据）。
- **历史台账 `Cstar.records(key)`**：`add` / `all` / `get` / `update` / `remove` / `clear`；`search({text,fields,from,to,dateField})` 按关键词与日期范围筛选；`exportCSV(file,cols)` / `exportExcel(file,cols)` 一键导出台账。
- **表单校验 `Cstar.validate([{id,required,pattern,msg}])`**：自动给非法项加 `cs-field-error`，返回 `{ok,errors,firstError}`。
- **电子签名 `Cstar.signature(canvasId)`**：手写签名（鼠标/触屏），`clear/isEmpty/toDataURL/fromDataURL`。
- **自动编号 `Cstar.serial(prefix, seed)`** → `CSTAR-<前缀>-YYYYMMDD-XXXX`。
- **导出 `Cstar.exportPDF(elId,file)`（A4 分页）/ `exportWord(elId,file)` / `exportExcel(tableEl,file)` / `exportExcelData(cols,rows,file)` / `exportJSON` / `print()`**。
- **照片水印 `Cstar.watermarkPhoto(file, 附加文字)`** → 返回带「时间+文字」水印的压缩图 dataURL（证据留痕）。
- **署名（必备）`Cstar.stamp({tool, version, author, changelog})`**：在页脚显示「工具名 + 版本号 + 作者姓名」，并供生成的单据/导出引用 `Cstar.stampLine()`。**每个工具都必须声明作者姓名与版本号。**
- **版本更新说明（发新版必备）**：发布新版本时必须在软件内附带更新说明。标准做法：给 `Cstar.stamp` 传 `changelog:[{version,date,notes:["修复…","新增…"]}]`，页脚版本号即变为可点击弹出「版本更新说明」；也可在帮助/关于页列明。至少包含当前版本的版本号、日期与变更点。
- **嵌入模式**：引入库即自动处理 `?embed=1`（无需再写那段脚本）。

数据存储是默认标准：凡是有输入的工具都应 `bindForm` 自动暂存；凡是会产生"一条条记录"的工具都应用 `records` 做本机台账并支持导出。`assets/cstar-tool.js` 是其副本。

## 一、配色与字体（统一标准 · 装箱软件风格）

**玫红作主操作色（按钮/主要 CTA），青色作辅助强调（标题/链接/边框点缀/状态），深蓝作导航/页头。** 不要用紫等非品牌色作主色调。

| 用途 | 颜色 | 变量 |
|------|------|------|
| 主操作色（按钮主色/主要 CTA） | `#e84368` 玫红 | `--cs-rose`（兼容 `--cs-red`） |
| 主操作色深（hover） | `#c72d53` | `--cs-rose-dark` |
| 辅助强调（标题/链接/状态/边框点缀） | `#007892` 青 | `--cs-teal` |
| 辅助强调深 / 浅 | `#005f73` / `#0a9bbd` | `--cs-teal-dark` / `--cs-teal-light` |
| 导航 / 页头 / 深色块 | `#252f45` / `#303c58` 深蓝 | `--cs-navy` / `--cs-navy-soft` |
| 正文 / 次要文字 | `#212121` / `#667085` | `--cs-ink` / `--cs-muted` |
| 边框 / 浅块 / 页面背景 | `#d3dce6` / `#f5f7fb` / `#f5f5f5` | `--cs-line` / `--cs-soft` / `--cs-page` |
| 成功 / 警告 / 危险 | `#168821` / `#ff5d00` / `#e31d1c` | `--cs-ok` / `--cs-warn` / `--cs-danger` |

字体：`Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", Roboto, sans-serif`
圆角：卡片 8px、输入/按钮 6px。
卡片：白底 + 柔和投影 `0 16px 40px rgba(37,47,69,.12)`（立体、有层次，呼应装箱软件 panel）。

## 二、引入共享样式表 cstar-ui.css

不要自己从零写配色和组件——直接引入平台维护的共享样式表，自动获得统一配色、字体与组件。`assets/cstar-ui.css` 是其副本，线上同源地址为 `https://bot.cstar.com/cstar-ui.css`。

```html
<head>
  <link rel="stylesheet" href="/cstar-ui.css">
</head>
<body class="cstar-ui">   <!-- 加 cstar-ui 才套用统一字体与背景 -->
```

常用组件类（均以 `cs-` 前缀，不会与你已有样式冲突）：

- 布局：`cs-wrap`、`cs-grid-2`（左输入右结果）、`cs-row`（两列）
- 页头：`cs-header`（深蓝渐变标题条 + 底部玫红强调线，含 `<h1>` 与副标题 `<p>`）
- 卡片：`cs-card` + `cs-card-body`（白底柔和投影）
- 表单：`cs-label`、`cs-input`、`cs-select`、`cs-textarea`（聚焦为青色描边）
- 按钮：`cs-btn` + `cs-btn-primary`（玫红，主操作）/ `cs-btn-accent`（青色，次操作）/ `cs-btn-soft` / `cs-btn-ghost`（白底描边，可加 `cs-btn-block`）
- 徽章：`cs-badge` + `cs-badge-ok/warn/danger/info`
- 提示条：`cs-note` + `cs-note-info/warn/danger`
- 表格：`cs-table`；校验错误：`cs-field-error`（加在输入框）+ `cs-error-text`（错误文字）

完整类清单见 `assets/cstar-ui.css` 顶部注释。

## 三、嵌入模式（必须支持）

平台首页用弹窗以 `?embed=1` 内嵌你的工具。此时要隐藏工具自带的大页头，避免"双标题"。在 `<head>` 加这段（cstar-ui.css 已内置 `html.embed-mode .cs-header{display:none}`，用 `cs-header` 即自动生效）：

```html
<script>
  document.documentElement.classList.toggle("embed-mode",
    new URLSearchParams(location.search).get("embed") === "1");
</script>
```

## 四、四项功能基线（参照装箱软件，每个工具都要有）

这些不是装饰，而是让工具真正可用、可演示、可信赖的最低要求。参考实现都在 `assets/tool-template.html` 里。

1. **示例/演示数据按钮** —— 一键填入样例。原因：方便同事试用、向客户演示，不必每次手动编数据。
2. **输入校验 + 错误提示** —— 必填项、格式、范围校验，用 `cs-field-error` + `cs-error-text` 给出友好提示。原因：脏输入会算出错误结论，提前拦住比事后解释强。
3. **导出 / 打印** —— 结果可导出（CSV/TXT）或 `window.print()` 打印。原因：工具的产出常要交给客户或存档。
4. **响应式 + 本地保存** —— 手机可用（cstar-ui.css 已含断点）；输入用 `localStorage` 自动暂存、加载时恢复。原因：手机现场要能用；半路刷新或断网不该丢数据。

## 五、部署前自检清单

### 第 1 步：前端统一
- [ ] 引入 `/cstar-ui.css`，`body` 加 `cstar-ui`
- [ ] **声明作者姓名 + 版本号**：`Cstar.stamp({tool, version, author})`（页脚署名，缺一不可）
- [ ] **版本更新说明**：新版本在软件内可查看更新说明（推荐 `Cstar.stamp` 的 `changelog` 参数；含版本号/日期/变更点）
- [ ] 主操作色玫红 `#e84368`、辅助强调青 `#007892`、页头深蓝 `#252f45`，无紫等非品牌主色
- [ ] 页头用 `cs-header`（深蓝+玫红强调线），支持 `?embed=1`（弹窗内无双标题）
- [ ] 字体 Inter、圆角 8px、按钮（主操作玫红）、卡片（柔和投影）观感与装箱软件一致

### 第 2 步：功能测试 + 基本功能基线
- [ ] 四项基线齐全：示例数据 / 输入校验 / 导出打印 / 响应式+本地保存
- [ ] 核心流程、边界值、异常输入都测过一遍

两步都打勾后，再提交上线。

## 六、提交上线

把工具打包成单个 `.zip`，到 bot.cstar.com 首页底部「For Developers」模块：
- 新工具点 **「⬆ 上传新工具」**
- 现有工具出新版点 **「🔄 提交工具更新」**（选目标工具）

上传只进待审核暂存区、不会立即公开；平台维护者按本标准审核测试后部署。
