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
#  OpenAI 兼容接口，配置 AI_API_BASE + AI_API_KEY + AI_MODEL 即启用；未配置则跳过。
# ============================================================
AI_BASE = os.environ.get("AI_API_BASE", "").rstrip("/")
AI_KEY = os.environ.get("AI_API_KEY", "")
AI_MODEL = os.environ.get("AI_MODEL", "deepseek-chat")

AI_SYS = (
    "你是喜事达（Cstar）工具平台的资深评审。平台是进出口物流/报关/合规领域的内部+对客户工具集，"
    "由各部门管理层用 AI 自行开发。请只按 JSON 输出，对一个工具的‘价值’严格打分（每项 0-100 整数）：\n"
    "- customer 客户价值：是否解决客户真实、且在市场上不易找到的需求；越独特实用越高。\n"
    "- craft 用心程度：是否认真打磨（完整流程、细节、可用性），还是只套模板/凑几句提示词交差；敷衍的给低分。\n"
    "- business 业务价值：对喜事达实际业务（获客/效率/专业形象/留存）的贡献。\n"
    "再给一句 note（中文，50字内）说明理由与改进建议。"
    "严格输出：{\"customer\":int,\"craft\":int,\"business\":int,\"note\":\"...\"}，不要多余文字。"
)


def ai_enabled():
    return bool(AI_BASE and AI_KEY)


def ai_value_score(tool, bundle):
    """调用大模型对工具价值打分；返回 {customer,craft,business,note} 或 None。"""
    if not ai_enabled():
        return None
    import urllib.request
    content = (bundle or "")[:12000]
    user = "工具名：%s\n一句话简介：%s\n前端源码片段（用于判断用心程度/功能完整度）：\n%s" % (
        tool.name, tool.summary or "", content)
    body = json.dumps({
        "model": AI_MODEL,
        "messages": [{"role": "system", "content": AI_SYS}, {"role": "user", "content": user}],
        "temperature": 0.2, "max_tokens": 400,
    }).encode("utf-8")
    req = urllib.request.Request(AI_BASE + "/chat/completions", data=body,
                                 headers={"Authorization": "Bearer " + AI_KEY, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            d = json.loads(r.read().decode("utf-8"))
        text = d["choices"][0]["message"]["content"]
        m = re.search(r"\{.*\}", text, re.S)
        obj = json.loads(m.group(0))
        cl = lambda x: max(0, min(100, int(round(float(x)))))
        return {"customer": cl(obj.get("customer", 0)), "craft": cl(obj.get("craft", 0)),
                "business": cl(obj.get("business", 0)), "note": (obj.get("note") or "")[:200]}
    except Exception:
        return None


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


def rescore_value(tool, db, commit=True):
    """读取工具源码 → 价值评分（有大模型 key 用 AI，否则用内置逻辑）→ 写 value_score/value_detail。"""
    de = _resolve_dir_entry(tool, db)
    html, bundle = (_bundle_from_dir(de[0], de[1], de[2]) if de else (None, None))
    if html is None:
        html, bundle = _http_fallback(tool)
    res = ai_value_score(tool, bundle or "")
    by = "AI(%s)" % AI_MODEL
    if not res:
        res = heuristic_value(tool, bundle or "")     # 自动逻辑兜底，保证总有分、无需人工
        by = "自动逻辑评估"
    val = round((res["customer"] + res["craft"] + res["business"]) / 3)
    tool.value_score = val
    tool.value_detail = json.dumps(dict(res, by=by, at=_now()), ensure_ascii=False)
    tool.updated_at = _now()
    if commit:
        db.commit()
    return val


def rescore_value_all(db, only_unrated=False):
    n = 0
    for t in db.query(models.Tool).all():
        if only_unrated and (t.value_score is not None and t.value_score >= 0):
            continue
        try:
            if rescore_value(t, db, commit=False) is not None:
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
