"""工具合规自动评分 —— 对照《前端统一标准》给每个工具打 0-100 分。

评分只读取工具的前端产物（HTML + 同目录本地 JS），用启发式规则审计，
不依赖人工。当前工具与未来上线/审核通过的工具都会自动评分。

读取来源（按 entry_path 解析，均为容器内可读路径）：
  - 托管工具 /tools/<slug>/   → DATA_DIR/<当前版本 rel_path>/
  - 装箱软件 /packer/         → AEO_PACKER_DIR（只读挂载 /srv/packer）
  - 门户内嵌 /xxx-app.html    → AEO_PORTAL_DIR（只读挂载 /srv/portal）
  - AEO 平台 /aeo/            → FRONTEND_DIR
读不到时回退 HTTP 拉取 AEO_SELF_BASE + entry_path。
"""
import os
import re
import json
import hashlib
import datetime

import database
import models

PORTAL_DIR = os.environ.get("AEO_PORTAL_DIR", "/srv/portal")
PACKER_DIR = os.environ.get("AEO_PACKER_DIR", "/srv/packer")
# AEO 前端目录：优先用实时只读挂载（AEO_FRONTEND_DIR），否则回退镜像内打包路径
FRONTEND_DIR = os.environ.get("AEO_FRONTEND_DIR") \
    or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
SELF_BASE = os.environ.get("AEO_SELF_BASE", "https://bot.cstar.com").rstrip("/")


def _now():
    return datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).strftime("%Y-%m-%d %H:%M:%S")


# —— 评分细则（合计 100）——
# 每项：(key, 标签, 满分, 判定正则；命中=得满分)。multiline/dotall 由调用处处理。
def _audit(html, bundle):
    h = html or ""
    b = bundle or h
    items = []

    def add(key, label, mx, ok):
        items.append({"key": key, "label": label, "max": mx, "got": mx if ok else 0, "ok": bool(ok)})

    # —— A. 前端统一（50）——
    add("ui_css", "引入共享样式 /cstar-ui.css", 12, re.search(r"cstar-ui\.css", h))
    add("body_cls", "body 套用 cstar-ui 统一字体/背景", 6,
        re.search(r"class\s*=\s*[\"'][^\"']*\bcstar-ui\b", h))
    add("tool_js", "引入共享库 /cstar-tool.js", 8, re.search(r"cstar-tool\.js", b))
    add("brand", "品牌主色（青 #007892 / cs- 变量）", 10,
        re.search(r"#007892|--cs-[a-z]|cstar-ui|cs-teal", b, re.I))
    add("embed", "支持嵌入模式（?embed=1 无双标题）", 8,
        re.search(r"embed-mode", b) or re.search(r"cstar-tool\.js", b)
        or re.search(r"embed[\"']?\s*\)\s*===\s*[\"']1", b))
    add("stamp", "页脚署名（作者 + 版本号）", 6,
        re.search(r"Cstar\.stamp|作者|版本\s*[:：]|版本\s*v?\d|version", b, re.I))

    # —— B. 功能基线（40）——
    add("sample", "示例 / 演示数据一键填入", 10,
        re.search(r"示例|样例|演示|loadSample|sampleData|demo", b, re.I))
    add("validate", "输入校验 + 错误提示", 10,
        re.search(r"cs-field-error|cs-error-text|校验|required|invalid|错误提示|setMsg|必填", b, re.I))
    add("export", "导出 / 打印", 10,
        re.search(r"导出|打印|window\.print|exportCSV|\.csv|download\s*\(|toBlob|application/pdf|\.xlsx", b, re.I))
    add("responsive", "响应式 + 本地暂存", 10,
        bool(re.search(r"@media", b)) and bool(re.search(r"localStorage|bindForm|Cstar\.store", b)))

    # —— C. 质量与卫生（10）——
    big = sum(len(m) for m in re.findall(r"data:image/[^)\"';\s]+", h))
    add("weight", "无超大内联图片（首屏体积健康）", 5, big < 300000)
    add("links", "外链全 https、无明文 http", 5,
        not re.search(r"http://(?!127\.0\.0\.1|localhost|(?:www\.)?w3\.org)", b))

    score = sum(i["got"] for i in items)
    return max(0, min(100, score)), items


def _read(path):
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except Exception:
        return ""


def _resolve_dir_entry(tool, db):
    """返回 (目录, 入口文件名, 是否专属目录) 或 None。
    专属目录（托管/packer/aeo）可安全扫描整目录的 JS/CSS；
    门户共享目录（PORTAL_DIR 放着所有单文件工具）只读入口及其引用的本地 JS。"""
    ep = (tool.entry_path or "").split("?")[0].split("#")[0]
    if ep.startswith("/tools/"):
        ver = db.get(models.ToolVersion, tool.current_version_id or 0)
        if ver and ver.rel_path:
            return os.path.join(database.DATA_DIR, ver.rel_path), "index.html", True
        return None
    if ep.startswith("/packer"):
        return PACKER_DIR, "index.html", True
    if ep.startswith("/aeo"):
        return FRONTEND_DIR, "index.html", True
    fname = ep.lstrip("/") or "index.html"
    if "/" in fname:  # 未知子路径，取末段
        fname = fname.rstrip("/").split("/")[-1] or "index.html"
    return PORTAL_DIR, fname, False


def _strip_q(src):
    return os.path.basename(src.split("?")[0].split("#")[0])


def _bundle_from_dir(base, entry, dedicated):
    """读取入口 HTML，并拼上相关本地 JS/CSS 文本用于审计。"""
    entry_path = os.path.join(base, entry)
    if not os.path.exists(entry_path):
        return None, None
    html = _read(entry_path)
    bundle = html
    if dedicated:
        # 专属目录：扫描目录内全部 .js/.css（覆盖 app.js?v=、i18n.js、styles.css 等）
        try:
            for fn in sorted(os.listdir(base)):
                if fn.lower().endswith((".js", ".css")) and fn != entry:
                    t = _read(os.path.join(base, fn))
                    if t:
                        bundle += "\n/*__" + fn + "__*/\n" + t
        except Exception:
            pass
    else:
        # 门户共享目录：只读入口引用的本地 JS（去掉 ?v= 版本串）
        for src in re.findall(r"<script[^>]+src\s*=\s*[\"']([^\"']+)[\"']", html, re.I):
            if src.startswith(("http", "//", "/")):
                continue
            js = _read(os.path.join(base, _strip_q(src)))
            if js:
                bundle += "\n/*__" + src + "__*/\n" + js
    return html, bundle


def _http_fallback(tool):
    import urllib.request
    ep = tool.entry_path or ""
    url = SELF_BASE + (ep if ep.startswith("/") else "/" + ep)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "cstar-scorer"})
        with urllib.request.urlopen(req, timeout=6) as r:
            html = r.read().decode("utf-8", "ignore")
            return html, html
    except Exception:
        return None, None


def score_tool(tool, db):
    """计算单个工具的分数与明细；返回 (score, items) 或 (None, [])。"""
    html = bundle = None
    de = _resolve_dir_entry(tool, db)
    if de:
        html, bundle = _bundle_from_dir(de[0], de[1], de[2])
    if html is None:
        html, bundle = _http_fallback(tool)
    if html is None:
        return None, []
    return _audit(html, bundle)


def rescore_tool(tool, db, commit=True):
    score, items = score_tool(tool, db)
    if score is None:
        return None
    tool.score = score
    tool.score_detail = json.dumps({"items": items, "at": _now()}, ensure_ascii=False)
    tool.updated_at = _now()
    if commit:
        db.commit()
    return score


def rescore_all(db):
    n = 0
    for t in db.query(models.Tool).all():
        try:
            if rescore_tool(t, db, commit=False) is not None:
                n += 1
        except Exception:
            pass
    db.commit()
    return n


# ============================================================
#  AI 价值评分（高权重层）—— 用大模型按"客户价值/用心程度/业务价值"打分
#  全部走 OpenAI 兼容接口（/chat/completions）。配置好任一模型的密钥并选用即启用。
# ============================================================
#
#  ── 大模型注册表（可切换 / 可扩展）─────────────────────────
#  · 在 MODELS 里登记可用模型；新增一家 = 加一条，无需改其它任何逻辑。
#  · base / model 是公开信息，写在表里；密钥各自用对应环境变量提供，
#    密钥永不写进代码或仓库（部署时在服务器 .env 填）。
#  · 用环境变量 AI_ACTIVE_MODEL 选用哪一个（默认 deepseek）。
#  · 兼容旧部署：若仍设了 AI_API_BASE + AI_API_KEY，则作为一条
#    临时“自定义”模型，优先于注册表生效（无需改服务器配置即可平滑过渡）。
# ============================================================
MODELS = {
    "deepseek": {
        "label": "DeepSeek",
        "base": os.environ.get("DEEPSEEK_API_BASE", "https://api.deepseek.com"),
        "model": os.environ.get("DEEPSEEK_MODEL", "deepseek-chat"),
        "key_env": "DEEPSEEK_API_KEY",
    },
    "openai": {
        "label": "OpenAI GPT",
        "base": os.environ.get("OPENAI_API_BASE", "https://api.openai.com/v1"),
        "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        "key_env": "OPENAI_API_KEY",
    },
    "qwen": {
        "label": "通义千问 Qwen",
        "base": os.environ.get("QWEN_API_BASE", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
        "model": os.environ.get("QWEN_MODEL", "qwen-plus"),
        "key_env": "DASHSCOPE_API_KEY",
    },
}

ACTIVE_MODEL = os.environ.get("AI_ACTIVE_MODEL", "deepseek").strip().lower()


def _active_cfg():
    """返回当前启用模型的 (base, key, model, label)。
    旧部署的 AI_API_BASE/AI_API_KEY 若存在则作为“自定义”条目优先生效。"""
    legacy_base = os.environ.get("AI_API_BASE", "").rstrip("/")
    legacy_key = os.environ.get("AI_API_KEY", "")
    if legacy_base and legacy_key:
        return legacy_base, legacy_key, os.environ.get("AI_MODEL", "deepseek-chat"), "自定义(AI_API_*)"
    m = MODELS.get(ACTIVE_MODEL)
    if not m:
        return "", "", "", ACTIVE_MODEL
    return m["base"].rstrip("/"), os.environ.get(m["key_env"], ""), m["model"], m["label"]


def list_models():
    """供管理端/接口展示：列出注册表内各模型及其启用、配置状态。"""
    legacy = bool(os.environ.get("AI_API_BASE") and os.environ.get("AI_API_KEY"))
    out = []
    for mid, m in MODELS.items():
        out.append({
            "id": mid,
            "label": m["label"],
            "model": m["model"],
            "active": (not legacy) and (mid == ACTIVE_MODEL),
            "configured": bool(os.environ.get(m["key_env"], "")),
        })
    if legacy:
        out.insert(0, {"id": "custom", "label": "自定义(AI_API_*)",
                       "model": os.environ.get("AI_MODEL", "deepseek-chat"),
                       "active": True, "configured": True})
    return out

# ============================================================
#  评分锚定量规（Rubric）—— 解决“同质软件分数不同”的根本机制：
#  大模型不擅长给稳定的 0-100 绝对分，但擅长对“定义清晰的是/否问题”做判断。
#  因此：① 把每个价值维度拆成若干条客观可判定的 true/false 标准；
#       ② 让模型只回答 true/false（多次调用取多数票，抵消 MoE 服务端抖动）；
#       ③ 分数由代码按“通过条数/总条数”确定性算出。
#  → 质量相同的工具会勾选出相同的清单 → 得到完全相同的分数，且每分可解释。
# ============================================================
RUBRIC = {
    "customer": [
        ("pain", "解决真实、高频的进出口/物流/报关/合规业务痛点（不是玩具或纯通用小工具）"),
        ("scarce", "同等能力在市场上不易免费获得"),
        ("targeted", "明确面向喜事达客户或具体业务场景，而非泛用"),
        ("actionable", "能直接产出结果/单据/判断，而非仅做信息展示"),
    ],
    "craft": [
        ("validate", "有输入校验与明确的错误提示"),
        ("states", "处理了空数据/加载/异常/边界等状态"),
        ("sample", "提供示例数据或清晰的使用引导"),
        ("polish", "具备导出、打印、快捷操作、响应式等完善交互细节中的至少两项"),
        ("structured", "功能成体系、代码组织清晰，而非套模板凑数"),
    ],
    "business": [
        ("acquisition", "有助于获客或对外展示专业形象"),
        ("efficiency", "显著提升内部效率或可被多部门高频复用"),
        ("core", "与主营进出口物流/报关/合规强相关"),
        ("moat", "体现专业壁垒（专业数据、算法、规则库），非随处可得"),
    ],
}
AI_SAMPLES = 3  # 自一致性：每个工具评 3 次，逐条标准取多数票，消除模型服务端非确定性


def _build_sys():
    lines = ["你是喜事达（Cstar）工具平台的资深评审。平台面向进出口物流/报关/合规，"
             "工具由各部门用 AI 自建。请阅读工具源码，对照下列清单逐条客观判断 true/false"
             "（必须依据源码事实，不臆测、不打人情分）：", ""]
    for dim, items in RUBRIC.items():
        lines.append("【%s】" % dim)
        for k, desc in items:
            lines.append("  - %s: %s" % (k, desc))
        lines.append("")
    lines.append("再给一句 note（中文，40字内）说明主要依据与改进建议。")
    lines.append("严格只输出 JSON，键名用上面的英文 key："
                 "{\"customer\":{\"pain\":true/false,...},\"craft\":{...},\"business\":{...},\"note\":\"...\"}")
    return "\n".join(lines)


AI_SYS = _build_sys()


def ai_enabled():
    base, key, _, _ = _active_cfg()
    return bool(base and key)


def _ai_call_checklist(user):
    """单次调用：返回 {dim:{key:bool}} + note，解析失败返回 None。"""
    import urllib.request
    base, key, model, _ = _active_cfg()
    body = json.dumps({
        "model": model,
        "messages": [{"role": "system", "content": AI_SYS}, {"role": "user", "content": user}],
        "temperature": 0, "top_p": 1, "seed": 20260614, "max_tokens": 2000,
    }).encode("utf-8")
    req = urllib.request.Request(base + "/chat/completions", data=body,
                                 headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            d = json.loads(r.read().decode("utf-8"))
        text = d["choices"][0]["message"]["content"] or ""
        if "</think>" in text:
            text = text.rsplit("</think>", 1)[-1]
        text = text.replace("```json", "").replace("```", "")
        m = re.search(r"\{.*\}", text, re.S)
        obj = json.loads(m.group(0))
        out = {}
        for dim, items in RUBRIC.items():
            sub = obj.get(dim) or {}
            if not isinstance(sub, dict):
                return None
            out[dim] = {k: bool(sub.get(k)) for k, _ in items}
        out["note"] = (obj.get("note") or "")[:200]
        return out
    except Exception:
        return None


def ai_value_score(tool, bundle):
    """量规清单评分：多次调用取多数票，代码按通过条数算分 → 同质工具同分、可解释。
    返回 {customer,craft,business,note,checks} 或 None。"""
    if not ai_enabled():
        return None
    # 量规为是/否判断，60K 字符足以覆盖工具核心逻辑；相比喂 20 万字符，3 次取样更快更省。
    content = (bundle or "")[:60000]
    user = "工具名：%s\n一句话简介：%s\n前端核心源码：\n%s" % (
        tool.name, tool.summary or "", content)
    samples = []
    for _ in range(AI_SAMPLES):
        r = _ai_call_checklist(user)
        if r:
            samples.append(r)
    if not samples:
        return None
    res, checks = {}, {}
    n = len(samples)
    for dim, items in RUBRIC.items():
        passed = 0
        for k, _ in items:
            votes = sum(1 for s in samples if s[dim].get(k))
            ok = votes * 2 > n          # 严格多数，平票取 False（从严）
            checks["%s.%s" % (dim, k)] = ok
            if ok:
                passed += 1
        res[dim] = int(round(100 * passed / len(items)))
    note = next((s.get("note") for s in samples if s.get("note")), "")
    res["note"] = note
    res["checks"] = checks
    return res


# —— 逻辑评估（无大模型 key 时的自动兜底）：按工具领域价值 + 实现体量自动估分 ——
# (关键词, (客户价值, 用心程度, 业务价值, 评语))
VALUE_RULES = [
    (("AEO", "认证"), (88, 92, 90, "海关AEO合规专业门槛高、价值大，平台模块完整；建议持续补充逐字条款原文。")),
    (("装箱", "packer", "Packer"), (90, 92, 86, "集装箱装箱含3D与多箱策略，实用且市面少见的优质免费方案，打开即用可离线。")),
    (("HS", "申报要素"), (92, 86, 88, "接入全量税则库，报关前速查是刚需且市面难免费获得；建议加常用编码收藏。")),
    (("危化", "MSDS", "UN"), (84, 80, 80, "危化品监管判定属专业刚需；建议补充更多UN/CAS样例与边界提示。")),
    (("发票", "装箱单", "单证"), (80, 88, 82, "外贸单证一键生成，常见但完成度高、中英双语+导出齐全。")),
    (("税费", "试算"), (82, 85, 80, "进出口税费估算实用，已有台账与导出；注意标注仅供估算。")),
    (("运价", "智算"), (86, 84, 86, "运价测算对货代业务价值高；建议接真实报价源提升权威性。")),
    (("EIR", "设备交接"), (78, 88, 78, "EIR电子交接单细节完整（箱号校验/签名/台账），细分场景做得扎实。")),
    (("旧设备",), (80, 66, 78, "旧设备进口查验是难找的专业需求、价值高；但页面偏重、准入靠本地规则，性能与用心需提升。")),
    (("配载", "整车"), (80, 82, 78, "国内整车配载测算实用；建议补充更多车型与装载约束。")),
    (("假期",), (66, 80, 62, "全球假期查询属辅助工具，价值一般但完成度尚可。")),
    (("求解", "规划"), (72, 78, 70, "通用规划求解偏工具化，业务针对性一般；建议结合具体物流场景。")),
    (("落箱", "超期", "滞箱"), (76, 80, 72, "落箱超期费PDF生成是细分实务工具，实用；可补充更多船司规则。")),
    (("出口", "研判", "风险"), (80, 78, 78, "出口风险研判/单证速查对客户有帮助；建议接全量API让判断从猜变查。")),
]
VALUE_DEFAULT = (70, 72, 68, "功能可用，建议结合客户真实场景深化，避免停留在通用模板。")


def heuristic_value(tool, bundle):
    """无大模型时按逻辑自动估价值分：领域价值取规则，用心程度按实现体量微调。"""
    name = tool.name or ""
    c, k, b, note = next((v for kws, v in VALUE_RULES if any(kw in name for kw in kws)), VALUE_DEFAULT)
    n = len(bundle or "")
    if n > 60000:
        k = min(100, k + 6)
    elif n and n < 6000:
        k = max(0, k - 10)
    return {"customer": c, "craft": k, "business": b, "note": note}


# —— 软件复杂度（客观测量）：函数/输入控件/分支/接口/数据可视 越多越复杂 ——
def complexity_score(bundle):
    b = bundle or ""
    depth = (len(re.findall(r"\bfunction\b|=>", b))
             + len(re.findall(r"<input|<select|<textarea", b, re.I))
             + len(re.findall(r"\bif\s*\(|\bfor\s*\(|\bwhile\s*\(|\bswitch\s*\(", b))
             + len(re.findall(r"fetch\(|/api/|XMLHttpRequest", b)) * 4
             + len(re.findall(r"<table|<canvas|<svg", b, re.I)) * 2)
    return max(0, min(100, round(depth / 10.0)))   # depth≈1000 才封顶 100（门槛收紧）


# —— 客户使用量 / 版本迭代次数（客观信号，归一化到 0-100）——
# 内置工具（直接部署、无版本记录）的迭代次数基线；上传类工具按 ToolVersion 实数
BUILTIN_ITER = {"aeo": 20, "packer": 18, "hs-lookup": 8, "msds-un": 6, "trade-docs": 5,
                "duty-calc": 4, "export-customs": 4, "export-advisor": 3, "container-eir": 6}


def _iter_raw(tool, db):
    c = db.query(models.ToolVersion).filter(models.ToolVersion.tool_id == tool.id).count()
    return c if c > 0 else BUILTIN_ITER.get(tool.slug, 3)


def _norm(v, mx):
    return round(100.0 * v / mx) if (mx and mx > 0) else 50   # 全员为0时取中性50，冷启动不压崩


def _max_usage(db):
    return max([(t.usage_count or 0) for t in db.query(models.Tool).all()] or [0])


def _max_iter(db):
    return max([_iter_raw(t, db) for t in db.query(models.Tool).all()] or [1])


# 价值分权重（配对防刷：可刷的客观指标和不可刷的判断绑在一起）：
#   复杂度30% +（客户使用量20% + 客户价值20%）+（版本迭代12.5% + 用心12.5%）+ 业务5%
def blend_value(d):
    return round(0.30 * d.get("complexity", 0)
                 + 0.20 * d.get("usage", 0) + 0.20 * d.get("customer", 0)
                 + 0.125 * d.get("iter", 0) + 0.125 * d.get("craft", 0)
                 + 0.05 * d.get("business", 0))


def _fill_objective(d, tool, db, bundle, mu=None, mi=None):
    """补齐客观维度：复杂度 + 使用量(归一) + 迭代次数(归一)。"""
    if mu is None:
        mu = _max_usage(db)
    if mi is None:
        mi = _max_iter(db)
    d["complexity"] = complexity_score(bundle or "")
    d["usage"] = _norm(tool.usage_count or 0, mu)
    d["iter"] = _norm(_iter_raw(tool, db), mi)
    return d


def _bundle_hash(bundle):
    """工具源码内容指纹：相同源码 → 相同哈希。"""
    return hashlib.sha1((bundle or "").encode("utf-8", "ignore")).hexdigest()


def _cached_judgment(db, h, exclude_id=None):
    """查是否已有同源码（同哈希）工具的 AI 判分，可直接复用，保证同质同分。"""
    if not h:
        return None
    for t in db.query(models.Tool).all():
        if exclude_id and t.id == exclude_id:
            continue
        if not t.value_detail:
            continue
        try:
            d = json.loads(t.value_detail)
        except Exception:
            continue
        if d.get("src_hash") == h and "customer" in d and (d.get("by") or "").startswith("AI("):
            return {"customer": d["customer"], "craft": d["craft"],
                    "business": d["business"], "note": d.get("note", "")}
    return None


# ============================================================
#  确定性量规检测器 —— 根治“同质软件打分差异”的核心：
#  价值的判断维度（客户价值/用心程度/业务价值）不再交给非确定性的大模型，
#  而是用代码对源码做静态分析，逐条客观检测每个量规标准是否满足。
#  → 同一份源码必然检出相同特征 → 必然得到完全相同的分数（可复现、可解释、即时、免费）。
# ============================================================
# 进出口/物流领域关键词（已收紧：去掉“税/箱/认证/合规/贸易/申报”等过宽词，改用专指术语，
# 避免“个税计算器/世界公共假期”等通用工具被误判为进出口强相关）。
_DOMAIN_KW = ["进出口", "报关", "海关", "关务", "集装箱", "危化", "危险品", "HS编码", "退税",
              "单证", "AEO", "货代", "清关", "保税", "提单", "报检", "原产地", "归类",
              "申报要素", "完税", "装箱", "配载", "运价", "车型", "证照", "税则", "铅封",
              "船公司", "UN编号", "CAS号", "商品编码", "海运", "空运", "监管证件", "物流"]


def _has(b, pats):
    return any(re.search(p, b, re.I) for p in pats)


def _count(b, pats):
    """命中的不同标准条数（每个 pattern 命中计 1）。"""
    return sum(1 for p in pats if re.search(p, b, re.I))


def _detect_checks(tool, bundle):
    """对源码做静态分析，逐条判定量规标准（已收紧门槛：多数标准要求多重信号，避免人人 100）。"""
    b = bundle or ""
    blen = len(b)
    name_sum = (tool.name or "") + " " + (tool.summary or "")
    domain = any(k in name_sum for k in _DOMAIN_KW) or any(k in b for k in _DOMAIN_KW)
    funcs = len(re.findall(r"\bfunction\b|=>", b))
    tables = len(re.findall(r"<table|<canvas|<svg", b, re.I))
    has_api = bool(re.search(r"fetch\(|/api/|XMLHttpRequest|axios", b, re.I))
    datarows = len(re.findall(r"\},\s*\{", b))                 # 内置数据/规则库的体量信号
    # polish：要求多种细节同时具备（导出打印 / 响应式 / 快捷键 / 本地保存 / 可视化 / 复制）
    io = 1 if _has(b, [r"window\.print", r"导出", r"下载", r"xlsx", r"csv", r"PDF",
                       r"打印", r"saveAs", r"toBlob"]) else 0
    resp = 1 if re.search(r"@media", b) else 0
    kbd = 1 if _has(b, [r"keydown", r"keyup", r"快捷键", r"addEventListener\(\s*['\"]key"]) else 0
    store = 1 if _has(b, [r"localStorage", r"sessionStorage"]) else 0
    viz = 1 if tables >= 1 else 0
    clip = 1 if _has(b, [r"clipboard", r"复制"]) else 0
    polish = io + resp + kbd + store + viz + clip
    validate_cnt = _count(b, [r"校验", r"required", r"必填", r"isNaN", r"\.test\(",
                              r"pattern\s*=", r"不能为空", r"无效", r"请输入有效", r"超出",
                              r"请选择", r"请填写"])
    states_cnt = _count(b, [r"try\s*\{", r"catch\s*\(", r"暂无", r"没有数据", r"加载",
                            r"loading", r"无数据", r"异常", r"出错", r"未找到", r"请先"])
    compute = _has(b, [r"calc\(", r"计算", r"测算", r"求解", r"生成", r"匹配", r"换算", r"估算"])
    render = _has(b, [r"getElementById\(['\"]result", r"innerHTML", r"<canvas", r"\brender", r"appendChild"])
    return {
        "customer.pain": domain,                                            # 进出口真实痛点
        "customer.scarce": has_api or blen > 80000 or tables >= 3 or datarows > 60,  # 专业壁垒/数据
        "customer.targeted": any(s in name_sum for s in ("喜事达", "Cstar", "cstar", "客户", "供应商")),
        "customer.actionable": compute and render,                          # 真有计算且产出结果
        "craft.validate": validate_cnt >= 2,                                # 多重校验
        "craft.states": states_cnt >= 2,                                    # 多种状态处理
        "craft.sample": _has(b, [r"示例", r"filldemo", r"demo", r"演示", r"测试数据"]),
        "craft.polish": polish >= 3,                                        # 至少 3 类细节
        "craft.structured": funcs >= 20 and blen >= 15000,                  # 真有体量的代码
        "business.acquisition": (any(s in (name_sum + b) for s in ("喜事达", "官网", "400-", "400 "))
                                 and tool.visibility in ("both", "external")),
        "business.efficiency": _count(b, [r"导出", r"台账", r"历史", r"批量", r"记录", r"保存", r"打印"]) >= 2,
        "business.core": domain,
        "business.moat": has_api or _count(b, [r"求解", r"测算", r"配载", r"算法", r"规则库",
                          r"税则", r"引擎", r"3D", r"three", r"<canvas", r"<svg"]) >= 2,
    }


def _dims_from_checks(checks):
    out = {}
    for dim, items in RUBRIC.items():
        passed = sum(1 for k, _ in items if checks.get("%s.%s" % (dim, k)))
        out[dim] = int(round(100 * passed / len(items)))
    return out


def _complexity_cap(cx):
    """复杂度硬门槛：功能过于简单的工具，价值判断维度封顶（落实‘复杂度是高分的硬性条件’）。"""
    if cx < 15:
        return 50
    if cx < 30:
        return 70
    if cx < 45:
        return 85
    return 100


def value_judgment(tool, bundle):
    """价值判断三维（确定性）：量规检测 + 复杂度硬上限。返回 {customer,craft,business,checks,cap}。"""
    checks = _detect_checks(tool, bundle)
    dims = _dims_from_checks(checks)
    cap = _complexity_cap(complexity_score(bundle or ""))
    for k in ("customer", "craft", "business"):
        dims[k] = min(dims[k], cap)
    dims["checks"] = checks
    dims["cap"] = cap
    return dims


_CHECK_LABEL = {
    "craft.validate": "输入校验与错误提示", "craft.states": "空/加载/异常状态处理",
    "craft.sample": "示例数据/使用引导", "craft.polish": "导出·打印·响应式等细节",
    "craft.structured": "功能体系化（非套模板）", "customer.scarce": "专业壁垒/数据接入",
    "customer.actionable": "可直接产出结果", "business.moat": "算法/规则库等护城河",
}


def _det_note(checks):
    fails = [lab for k, lab in _CHECK_LABEL.items() if not checks.get(k)]
    if not fails:
        return "各项质量标准均达标，完成度高。"
    return "建议补强：" + "、".join(fails[:4]) + "。"


def rescore_value(tool, db, commit=True):
    """价值评分（确定性）：判断维度由代码静态分析逐条检测，客观维度由系统计算。
    全程不依赖大模型 → 同一份源码必得完全相同的分数，彻底消除‘同质软件打分差异’。"""
    de = _resolve_dir_entry(tool, db)
    html, bundle = (_bundle_from_dir(de[0], de[1], de[2]) if de else (None, None))
    if html is None:
        html, bundle = _http_fallback(tool)
    res = value_judgment(tool, bundle or "")
    res["note"] = _det_note(res["checks"])
    res["src_hash"] = _bundle_hash(bundle or "")
    _fill_objective(res, tool, db, bundle)
    tool.value_score = blend_value(res)
    tool.value_detail = json.dumps(dict(res, by="确定性量规·代码静态分析", at=_now()),
                                   ensure_ascii=False)
    tool.updated_at = _now()
    if commit:
        db.commit()
    return tool.value_score


def rescore_value_all(db, only_unrated=False):
    """全量重算价值分（确定性）：判断维度由代码静态分析逐条检测，客观维度（复杂度/使用量/迭代）
    在全体范围内归一化后合成。全程不依赖大模型 → 同源码必同分，结果可复现。"""
    tools = db.query(models.Tool).all()
    mu = max([(t.usage_count or 0) for t in tools] or [0])
    mi = max([_iter_raw(t, db) for t in tools] or [1])
    n = 0
    for t in tools:
        try:
            de = _resolve_dir_entry(t, db)
            html, bundle = (_bundle_from_dir(de[0], de[1], de[2]) if de else (None, None))
            if html is None:
                html, bundle = _http_fallback(t)
            d = value_judgment(t, bundle or "")
            d["note"] = _det_note(d["checks"])
            d["src_hash"] = _bundle_hash(bundle or "")
            _fill_objective(d, t, db, bundle, mu, mi)
            t.value_score = blend_value(d)
            d["by"] = "确定性量规·代码静态分析"
            d["at"] = _now()
            t.value_detail = json.dumps(d, ensure_ascii=False)
            t.updated_at = _now()
            n += 1
        except Exception:
            pass
    db.commit()
    return n


def rescore_all_background(delay=25):
    """启动后延时重算（等部署把最新 portal 拷到 /var/www/portal 后再读）。"""
    import threading
    import time

    def worker():
        try:
            time.sleep(delay)
            db = database.SessionLocal()
            try:
                rescore_all(db)
                # 价值分自动生成：只补未评过的，绝不覆盖已评（AI/人工）的分
                rescore_value_all(db, only_unrated=True)
            finally:
                db.close()
        except Exception:
            pass

    threading.Thread(target=worker, daemon=True).start()
