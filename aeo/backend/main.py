"""喜事达AEO认证管理平台 —— FastAPI 应用入口。

运行：  cd backend && uvicorn main:app --reload
访问：  http://127.0.0.1:8000
"""
import os
import re
import ssl
import hmac
import json
import uuid
import shutil
import zipfile
import smtplib
import datetime
from email.mime.text import MIMEText
from email.header import Header

from fastapi import FastAPI, Depends, HTTPException, Body, UploadFile, File, Form, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session

import database
import models
import auth
import seed
import scoring
from auth import current_user, can

# 建表 + 初始化用户与标准框架
seed.run()
# 启动后延时自动给所有工具评分（等部署把最新前端拷到 /var/www 后再读）
scoring.rescore_all_background()

app = FastAPI(title="喜事达AEO认证管理平台", version="1.0")

# CORS：默认仅同源；如需前后端分离部署，用 AEO_CORS 配置允许的来源（逗号分隔）
_cors = os.environ.get("AEO_CORS", "").strip()
if _cors:
    app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in _cors.split(",")],
                       allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "xishida-aeo", "version": "1.0"}


# ============ HS 全量税则/申报要素 代理（供 HS 速查工具调用，无需登录） ============
HS_RATE_API = os.environ.get("HS_RATE_API", "https://www.cstar.com/findRateDeclByPage")


@app.post("/api/hs/search")
def hs_search(body: dict = Body(default={})):
    """代理喜事达全量税则/申报要素查询接口 findRateDeclByPage，规避跨域并统一入口。"""
    import urllib.request
    q = (body.get("q") or "").strip()
    code = (body.get("goodsCode") or "").strip()
    name = (body.get("goodsName") or "").strip()
    try:
        page = int(body.get("page") or body.get("current") or 1)
        size = min(int(body.get("size") or 30), 100)
    except (TypeError, ValueError):
        page, size = 1, 30
    kw = q or code or name
    payload = {
        "current": page, "size": size,
        "records": [{
            "goodsCode": code, "goodsName": name, "codeName": kw,
            "querySource": 1, "searchType": "1&2", "searchTypeName": kw,
        }],
    }
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    ctx = ssl.create_default_context()
    last = None
    # 上游偶发握手/读取超时，重试 1 次（共 2 次）以平滑网络抖动
    for _ in range(2):
        req = urllib.request.Request(
            HS_RATE_API, data=data, method="POST",
            headers={"Content-Type": "application/json;charset=UTF-8", "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=12, context=ctx) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001
            last = e
    raise HTTPException(502, f"全量税则服务调用失败：{last}")

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")


TZ_CN = datetime.timezone(datetime.timedelta(hours=8))   # 北京时间（服务器/容器为 UTC）


def now():
    return datetime.datetime.now(TZ_CN).strftime("%Y-%m-%d %H:%M:%S")


def to_dict(obj):
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


def write_log(db, user, action, entity, ref=""):
    db.add(models.AuditLog(ts=now(), user=user.username, role=user.role,
                           action=action, entity=entity, ref=str(ref)))
    db.commit()


# ---------- 邮件（SMTP，配置走环境变量；Gmail 示例：host=smtp.gmail.com port=587） ----------
def _smtp_cfg():
    return {
        "host": os.environ.get("AEO_SMTP_HOST", "").strip(),
        "port": int(os.environ.get("AEO_SMTP_PORT", "587") or 587),
        "user": os.environ.get("AEO_SMTP_USER", "").strip(),
        "pwd":  os.environ.get("AEO_SMTP_PASS", ""),
        "from": (os.environ.get("AEO_SMTP_FROM", "").strip()
                 or os.environ.get("AEO_SMTP_USER", "").strip()),
    }


def email_enabled():
    c = _smtp_cfg()
    return bool(c["host"] and c["user"] and c["pwd"])


def send_email(to_addr, subject, html):
    c = _smtp_cfg()
    if not email_enabled():
        raise RuntimeError("SMTP 未配置")
    msg = MIMEText(html, "html", "utf-8")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = c["from"]
    msg["To"] = to_addr
    # 465/994 为隐式 SSL（网易企业邮等）；587/25 为 STARTTLS（Gmail 等）。可用 AEO_SMTP_SSL 强制。
    use_ssl = (c["port"] in (465, 994)
               or os.environ.get("AEO_SMTP_SSL", "").lower() in ("1", "true", "yes"))
    if use_ssl:
        srv = smtplib.SMTP_SSL(c["host"], c["port"], timeout=20)
    else:
        srv = smtplib.SMTP(c["host"], c["port"], timeout=20)
        srv.starttls(context=ssl.create_default_context())
    srv.login(c["user"], c["pwd"])
    srv.sendmail(c["from"], [to_addr], msg.as_string())
    srv.quit()


def public_base():
    return os.environ.get("AEO_PUBLIC_URL", "https://bot.cstar.com").rstrip("/")


# ============ 认证 ============
class LoginIn(BaseModel):
    username: str
    password: str


@app.post("/api/login")
def login(body: LoginIn, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == body.username).first()
    if not user or not auth.verify_pw(body.password, user.password):
        raise HTTPException(401, "用户名或密码错误")
    write_log(db, user, "登录", "auth")
    return {"token": auth.make_token(user.id), "user": _me(user)}


class RegisterIn(BaseModel):
    username: str
    password: str
    name: str = ""
    email: str = ""


@app.post("/api/register")
def register(body: RegisterIn, db: Session = Depends(database.get_db)):
    """外部客户自助注册。仅创建 customer 角色账号——只能使用公开工具，
    无法访问任何 AEO 合规数据。"""
    username = (body.username or "").strip()
    email = (body.email or "").strip()
    if len(username) < 3:
        raise HTTPException(400, "用户名至少3个字符")
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(400, "请填写有效的邮箱（用于找回密码）")
    if len(body.password or "") < 6:
        raise HTTPException(400, "密码至少6位")
    if db.query(models.User).filter(models.User.username == username).first():
        raise HTTPException(400, "该用户名已被注册")
    user = models.User(username=username, password=auth.hash_pw(body.password),
                       name=(body.name or username), role="customer",
                       dept="外部客户", email=email)
    db.add(user)
    db.commit()
    db.refresh(user)
    write_log(db, user, "注册", "auth", user.username)
    return {"token": auth.make_token(user.id), "user": _me(user)}


def _me(user):
    return {
        "id": user.id, "username": user.username, "name": user.name,
        "email": getattr(user, "email", "") or "",
        "role": user.role, "roleName": auth.ROLE_NAMES.get(user.role, user.role),
        "dept": user.dept, "isAdmin": user.role == "admin",
        "isPlatformAdmin": user.role in ("admin", "platform"),
        "isStaff": auth.is_staff(user.role), "isCustomer": not auth.is_staff(user.role),
        "writable": auth.writable_modules(user.role),
    }


# ---------- 忘记 / 重置密码 ----------
class ForgotIn(BaseModel):
    account: str = ""   # 用户名或邮箱


@app.post("/api/forgot-password")
def forgot_password(body: ForgotIn, db: Session = Depends(database.get_db)):
    """请求重置：向账号绑定的邮箱发送重置链接。防枚举：无论账号是否存在都返回成功。"""
    acc = (body.account or "").strip()
    if acc:
        user = (db.query(models.User)
                .filter((models.User.username == acc) | (models.User.email == acc))
                .first())
        if user and (user.email or "") and email_enabled():
            token = auth.make_reset_token(user.id)
            link = f"{public_base()}/account.html?reset={token}"
            html = ("<p>您好，</p>"
                    "<p>您在<b>喜事达工具平台</b>请求重置密码。请在 30 分钟内点击以下链接设置新密码："
                    f"</p><p><a href='{link}'>{link}</a></p>"
                    "<p>如非本人操作，请忽略本邮件。</p>")
            try:
                send_email(user.email, "喜事达工具平台 · 重置密码", html)
                write_log(db, user, "发送重置邮件", "auth", user.email)
                print(f"[SMTP] 重置邮件已发送 -> {user.email}", flush=True)
            except Exception as e:
                write_log(db, user, "重置邮件失败", "auth", str(e)[:90])
                print(f"[SMTP][ERROR] 发送失败 -> {user.email}: {type(e).__name__}: {e}", flush=True)
    return {"ok": True, "emailEnabled": email_enabled()}


class ResetIn(BaseModel):
    token: str
    password: str


@app.post("/api/reset-password")
def reset_password(body: ResetIn, db: Session = Depends(database.get_db)):
    uid = auth.parse_reset_token(body.token)
    if not uid:
        raise HTTPException(400, "重置链接无效或已过期，请重新申请")
    if len(body.password or "") < 6:
        raise HTTPException(400, "密码至少6位")
    user = db.get(models.User, uid)
    if not user:
        raise HTTPException(400, "用户不存在")
    user.password = auth.hash_pw(body.password)
    db.commit()
    write_log(db, user, "重置密码", "auth")
    return {"ok": True}


@app.get("/api/me")
def me(user=Depends(current_user)):
    return _me(user)


class PwIn(BaseModel):
    old: str
    new: str


@app.post("/api/me/password")
def change_pw(body: PwIn, db: Session = Depends(database.get_db), user=Depends(current_user)):
    if not auth.verify_pw(body.old, user.password):
        raise HTTPException(400, "原密码错误")
    if len(body.new) < 6:
        raise HTTPException(400, "新密码至少6位")
    user.password = auth.hash_pw(body.new)
    db.commit()
    write_log(db, user, "修改密码", "auth")
    return {"ok": True}


# ============ 通用业务实体 CRUD ============
def _check(user, module, write=False):
    if not can(user.role, module, write):
        raise HTTPException(403, "无权限操作该模块")


def _make_routes(entity: str):
    Model = models.ENTITY_MODEL[entity]
    module = models.ENTITY_MODULE[entity]
    fields = models.ENTITY_FIELDS[entity]

    @app.get(f"/api/{entity}", name=f"list_{entity}")
    def _list(db: Session = Depends(database.get_db), user=Depends(current_user)):
        _check(user, module)
        return [to_dict(x) for x in db.query(Model).all()]

    @app.post(f"/api/{entity}", name=f"create_{entity}")
    def _create(data: dict = Body(...), db: Session = Depends(database.get_db), user=Depends(current_user)):
        _check(user, module, True)
        obj = Model(**{k: data[k] for k in fields if k in data})
        db.add(obj)
        db.commit()
        db.refresh(obj)
        write_log(db, user, "新增", entity, obj.id)
        return to_dict(obj)

    @app.put(f"/api/{entity}/{{item_id}}", name=f"update_{entity}")
    def _update(item_id: int, data: dict = Body(...), db: Session = Depends(database.get_db), user=Depends(current_user)):
        _check(user, module, True)
        obj = db.get(Model, item_id)
        if not obj:
            raise HTTPException(404, "记录不存在")
        for k in fields:
            if k in data:
                setattr(obj, k, data[k])
        db.commit()
        db.refresh(obj)
        write_log(db, user, "修改", entity, item_id)
        return to_dict(obj)

    @app.delete(f"/api/{entity}/{{item_id}}", name=f"delete_{entity}")
    def _delete(item_id: int, db: Session = Depends(database.get_db), user=Depends(current_user)):
        _check(user, module, True)
        obj = db.get(Model, item_id)
        if not obj:
            raise HTTPException(404, "记录不存在")
        db.delete(obj)
        db.commit()
        write_log(db, user, "删除", entity, item_id)
        return {"ok": True}


for _ent in models.ENTITY_MODEL:
    _make_routes(_ent)


# 整改：推进一步
@app.post("/api/rectify/{item_id}/advance")
def advance_rectify(item_id: int, db: Session = Depends(database.get_db), user=Depends(current_user)):
    _check(user, "rectify", True)
    obj = db.get(models.Rectify, item_id)
    if not obj:
        raise HTTPException(404, "记录不存在")
    obj.step = min(3, (obj.step or 1) + 1)
    db.commit()
    write_log(db, user, "整改推进", "rectify", item_id)
    return to_dict(obj)


# ============ 装箱软件：用户云端方案（按账号隔离，员工/客户均可用） ============
class PackerProjIn(BaseModel):
    name: str = "装箱方案"
    data: dict = {}


@app.get("/api/packer/projects")
def packer_list(db: Session = Depends(database.get_db), user=Depends(current_user)):
    rows = (db.query(models.PackerProject)
            .filter(models.PackerProject.owner == user.id)
            .order_by(models.PackerProject.id.desc()).all())
    return [{"id": r.id, "name": r.name, "updated_at": r.updated_at} for r in rows]


@app.get("/api/packer/projects/{pid}")
def packer_get(pid: int, db: Session = Depends(database.get_db), user=Depends(current_user)):
    r = db.get(models.PackerProject, pid)
    if not r or r.owner != user.id:
        raise HTTPException(404, "方案不存在")
    return {"id": r.id, "name": r.name, "data": r.data, "updated_at": r.updated_at}


@app.post("/api/packer/projects")
def packer_create(body: PackerProjIn, db: Session = Depends(database.get_db), user=Depends(current_user)):
    r = models.PackerProject(owner=user.id, name=(body.name or "装箱方案"),
                             data=body.data or {}, updated_at=now())
    db.add(r)
    db.commit()
    db.refresh(r)
    return {"id": r.id}


@app.put("/api/packer/projects/{pid}")
def packer_update(pid: int, body: PackerProjIn, db: Session = Depends(database.get_db), user=Depends(current_user)):
    r = db.get(models.PackerProject, pid)
    if not r or r.owner != user.id:
        raise HTTPException(404, "方案不存在")
    r.name = body.name or r.name
    r.data = body.data or {}
    r.updated_at = now()
    db.commit()
    return {"ok": True}


@app.delete("/api/packer/projects/{pid}")
def packer_delete(pid: int, db: Session = Depends(database.get_db), user=Depends(current_user)):
    r = db.get(models.PackerProject, pid)
    if not r or r.owner != user.id:
        raise HTTPException(404, "方案不存在")
    db.delete(r)
    db.commit()
    return {"ok": True}


# ============ 仪表盘聚合 ============
@app.get("/api/dashboard")
def dashboard(db: Session = Depends(database.get_db), user=Depends(auth.staff_only)):
    all_stds = db.query(models.Standard).all()
    # 附加标准为加分项，不计入核心达标率与通过判定
    stds = [s for s in all_stds if s.cat != "附加标准"]
    bonus = [s for s in all_stds if s.cat == "附加标准"]
    ok = sum(1 for s in stds if s.status == "达标")
    mid = sum(1 for s in stds if s.status == "基本达标")
    bad = sum(1 for s in stds if s.status == "不达标")
    pending = sum(1 for s in stds if s.status not in ("达标", "基本达标", "不达标"))
    total = len(stds)
    bonus_got = sum(1 for s in bonus if s.status == "达标")
    cats = []
    for cat in ["内部控制", "财务状况", "守法规范", "贸易安全"]:
        items = [s for s in stds if s.cat == cat]
        c_ok = sum(1 for s in items if s.status == "达标")
        cats.append({"cat": cat, "ok": c_ok, "total": len(items),
                     "rate": round(c_ok / len(items) * 100) if items else 0})
    rects = db.query(models.Rectify).all()
    open_rect = [to_dict(r) for r in rects if (r.step or 1) < 3]
    decls = db.query(models.Decl).all()
    return {
        "ok": ok, "mid": mid, "bad": bad, "pending": pending, "total": total,
        "bonusGot": bonus_got, "bonusTotal": len(bonus),
        "pass": bad == 0 and pending == 0 and mid <= 3,
        "overall": round((ok + mid * 0.6) / total * 100) if total else 0,
        "cats": cats,
        "openRectify": open_rect,
        "counts": {
            "decls": len(decls),
            "declErr": sum(1 for d in decls if d.err != "正常"),
            "partnersPending": db.query(models.Partner).filter(models.Partner.sec != "已评估").count(),
            "docs": db.query(models.DocFile).count(),
            "finance": db.query(models.Finance).count(),
        },
        "latestFinance": (lambda f: f and {"y": f.y, "rate": f.rate})(
            db.query(models.Finance).order_by(models.Finance.y.desc()).first()),
    }


# ============ 用户管理（仅管理员） ============
def _admin(user=Depends(current_user)):
    if user.role != "admin":
        raise HTTPException(403, "仅管理员可访问")
    return user


# 平台管理（工具平台审核/发布/工具管理）：AEO 管理员 或 独立平台管理员
def _platform(user=Depends(current_user)):
    if user.role not in ("admin", "platform"):
        raise HTTPException(403, "仅平台管理员可访问")
    return user


@app.get("/api/users")
def list_users(db: Session = Depends(database.get_db), user=Depends(_admin)):
    return [{"id": u.id, "username": u.username, "name": u.name,
             "role": u.role, "roleName": auth.ROLE_NAMES.get(u.role, u.role),
             "dept": u.dept, "email": getattr(u, "email", "") or ""}
            for u in db.query(models.User).all()]


@app.post("/api/users")
def create_user(data: dict = Body(...), db: Session = Depends(database.get_db), user=Depends(_admin)):
    if db.query(models.User).filter(models.User.username == data.get("username")).first():
        raise HTTPException(400, "用户名已存在")
    if not data.get("username") or not data.get("password"):
        raise HTTPException(400, "用户名与密码必填")
    u = models.User(username=data["username"], password=auth.hash_pw(data["password"]),
                    name=data.get("name", ""), role=data.get("role", "customs"),
                    dept=data.get("dept", ""), email=data.get("email", ""))
    db.add(u)
    db.commit()
    db.refresh(u)
    write_log(db, user, "新增用户", "users", u.username)
    return {"ok": True, "id": u.id}


@app.put("/api/users/{uid}")
def update_user(uid: int, data: dict = Body(...), db: Session = Depends(database.get_db), user=Depends(_admin)):
    u = db.get(models.User, uid)
    if not u:
        raise HTTPException(404, "用户不存在")
    u.name = data.get("name", u.name)
    u.role = data.get("role", u.role)
    u.dept = data.get("dept", u.dept)
    if "email" in data:
        u.email = data.get("email", "")
    if data.get("password"):
        u.password = auth.hash_pw(data["password"])
    db.commit()
    write_log(db, user, "修改用户", "users", u.username)
    return {"ok": True}


@app.delete("/api/users/{uid}")
def delete_user(uid: int, db: Session = Depends(database.get_db), user=Depends(_admin)):
    u = db.get(models.User, uid)
    if not u:
        raise HTTPException(404, "用户不存在")
    if u.username == "admin":
        raise HTTPException(400, "默认管理员不可删除")
    db.delete(u)
    db.commit()
    write_log(db, user, "删除用户", "users", u.username)
    return {"ok": True}


# ============ 工具目录（注册表驱动；按身份过滤内部/外部） ============
def _composite(auto, value):
    """综合分：自动合规分占 30%（及格底线），人工价值分占 70%（高权重）。
    价值分未评时，先用自动分作临时分。"""
    a = auto if (auto is not None and auto >= 0) else None
    v = value if (value is not None and value >= 0) else None
    if v is None:
        return a
    if a is None:
        a = 0
    return round(a * 0.3 + v * 0.7)


def _tool_public(t):
    auto = t.score if (t.score is not None and t.score >= 0) else None
    value = t.value_score if (t.value_score is not None and t.value_score >= 0) else None
    items = []
    if t.score_detail:
        try:
            items = (json.loads(t.score_detail) or {}).get("items", [])
        except Exception:
            items = []
    vdetail = {}
    if t.value_detail:
        try:
            vdetail = json.loads(t.value_detail) or {}
        except Exception:
            vdetail = {}
    return {"slug": t.slug, "name": t.name, "category": t.category, "summary": t.summary,
            "icon": t.icon, "color": t.color, "bar": t.bar, "visibility": t.visibility,
            "entryKind": t.entry_kind, "entryPath": t.entry_path,
            "score": _composite(auto, value),       # 综合分（卡片显示）
            "autoScore": auto, "scoreItems": items,  # 自动合规层
            "valueScore": value, "valueDetail": vdetail,  # 人工价值层
            "valueRated": value is not None}


@app.get("/api/catalog")
def catalog(db: Session = Depends(database.get_db), user=Depends(auth.optional_user)):
    """工具目录：匿名/外部客户只见 external+both；内部员工见全部 online 工具。"""
    staff = bool(user) and auth.is_staff(user.role)
    q = db.query(models.Tool).filter(models.Tool.status == "online")
    tools = sorted(q.all(), key=lambda t: (t.sort_order, t.id))
    if not staff:
        tools = [t for t in tools if t.visibility in ("external", "both")]
    return {"isStaff": staff, "tools": [_tool_public(t) for t in tools]}


@app.post("/api/admin/tools/rescore")
def admin_rescore_all(db: Session = Depends(database.get_db), user=Depends(_platform)):
    """对所有工具按《前端统一标准》重新自动评分。"""
    n = scoring.rescore_all(db)
    write_log(db, user, "重算工具评分", "tools", f"{n} 个")
    return {"ok": True, "scored": n}


@app.post("/api/admin/tools/{tid}/rescore")
def admin_rescore_one(tid: int, db: Session = Depends(database.get_db), user=Depends(_platform)):
    t = db.get(models.Tool, tid)
    if not t:
        raise HTTPException(404, "工具不存在")
    score = scoring.rescore_tool(t, db)
    return {"ok": True, "score": score,
            "items": (json.loads(t.score_detail) or {}).get("items", []) if t.score_detail else []}


@app.post("/api/admin/tools/{tid}/value")
def admin_set_value(tid: int, data: dict = Body(...), db: Session = Depends(database.get_db), user=Depends(_platform)):
    """人工价值评分（高权重层）：客户价值 / 用心程度 / 业务价值，各 0-100，取均值为价值分。"""
    t = db.get(models.Tool, tid)
    if not t:
        raise HTTPException(404, "工具不存在")

    def cl(x):
        try:
            return max(0, min(100, int(round(float(x)))))
        except Exception:
            return 0
    customer, craft, business = cl(data.get("customer", 0)), cl(data.get("craft", 0)), cl(data.get("business", 0))
    note = (data.get("note") or "")[:500]
    value = round((customer + craft + business) / 3)
    t.value_score = value
    t.value_detail = json.dumps({"customer": customer, "craft": craft, "business": business,
                                 "note": note, "by": user.username, "at": now()}, ensure_ascii=False)
    t.updated_at = now()
    db.commit()
    write_log(db, user, "工具价值评分", "tools", f"{t.slug}={value}")
    auto = t.score if (t.score or -1) >= 0 else None
    return {"ok": True, "valueScore": value, "score": _composite(auto, value)}


@app.post("/api/admin/tools/{tid}/ai-value")
def admin_ai_value(tid: int, db: Session = Depends(database.get_db), user=Depends(_platform)):
    """让 AI 重新对该工具做价值评分。"""
    t = db.get(models.Tool, tid)
    if not t:
        raise HTTPException(404, "工具不存在")
    if not scoring.ai_enabled():
        raise HTTPException(400, "未配置大模型（请在服务器环境设置 AI_API_BASE / AI_API_KEY）")
    val = scoring.rescore_value(t, db)
    if val is None:
        raise HTTPException(502, "AI 评分失败（模型无响应或返回格式异常）")
    auto = t.score if (t.score or -1) >= 0 else None
    detail = json.loads(t.value_detail) if t.value_detail else {}
    write_log(db, user, "AI价值评分", "tools", f"{t.slug}={val}")
    return {"ok": True, "valueScore": val, "score": _composite(auto, val), "detail": detail}


@app.post("/api/admin/tools/ai-value-all")
def admin_ai_value_all(db: Session = Depends(database.get_db), user=Depends(_platform)):
    """让 AI 给所有工具（重新）评价值分。"""
    if not scoring.ai_enabled():
        raise HTTPException(400, "未配置大模型（请在服务器环境设置 AI_API_BASE / AI_API_KEY）")
    n = scoring.rescore_value_all(db, only_unrated=False)
    write_log(db, user, "AI价值评分(全部)", "tools", f"{n} 个")
    return {"ok": True, "scored": n}


@app.get("/api/admin/tools")
def admin_list_tools(db: Session = Depends(database.get_db), user=Depends(_platform)):
    return [to_dict(t) for t in db.query(models.Tool).order_by(models.Tool.sort_order).all()]


@app.post("/api/admin/tools")
def admin_create_tool(data: dict = Body(...), db: Session = Depends(database.get_db), user=Depends(_platform)):
    slug = (data.get("slug") or "").strip()
    if not slug:
        raise HTTPException(400, "slug 必填")
    if db.query(models.Tool).filter(models.Tool.slug == slug).first():
        raise HTTPException(400, "slug 已存在")
    allowed = {"slug", "name", "category", "summary", "owner_dept", "icon", "color",
               "bar", "visibility", "status", "entry_kind", "entry_path", "sort_order"}
    t = models.Tool(**{k: v for k, v in data.items() if k in allowed},
                    created_at=now(), updated_at=now())
    db.add(t)
    db.commit()
    db.refresh(t)
    write_log(db, user, "新增工具", "tools", t.slug)
    return {"ok": True, "id": t.id}


@app.put("/api/admin/tools/{tid}")
def admin_update_tool(tid: int, data: dict = Body(...), db: Session = Depends(database.get_db), user=Depends(_platform)):
    t = db.get(models.Tool, tid)
    if not t:
        raise HTTPException(404, "工具不存在")
    for k in ("name", "category", "summary", "owner_dept", "icon", "color", "bar",
              "visibility", "status", "entry_kind", "entry_path", "sort_order"):
        if k in data:
            setattr(t, k, data[k])
    t.updated_at = now()
    db.commit()
    write_log(db, user, "修改工具", "tools", t.slug)
    return {"ok": True}


@app.delete("/api/admin/tools/{tid}")
def admin_delete_tool(tid: int, db: Session = Depends(database.get_db), user=Depends(_platform)):
    t = db.get(models.Tool, tid)
    if not t:
        raise HTTPException(404, "工具不存在")
    db.delete(t)
    db.commit()
    write_log(db, user, "删除工具", "tools", t.slug)
    return {"ok": True}


# ============ 工具提交（公开上传到待审核暂存区；审核/下载仅管理员） ============
MAX_UPLOAD = 20 * 1024 * 1024   # 20MB 上限

def _sub_dir(token):
    return os.path.join(database.DATA_DIR, "submissions", token)


@app.post("/api/tools/submit")
async def submit_tool(request: Request,
                      name: str = Form(...), version: str = Form(""),
                      developer: str = Form(""), desc: str = Form(""),
                      selfcheck: str = Form(""), file: UploadFile = File(...),
                      kind: str = Form("new"), target: str = Form(""),
                      db: Session = Depends(database.get_db)):
    """公开接口：同事上传工具 zip（新工具或现有工具的更新版本）。仅写入暂存区，
    不解压、不发布、不对外暴露。安全：限大小 20MB、仅 zip、校验文件头、随机目录名、字段截断。"""
    name = (name or "").strip()
    kind = "update" if str(kind).strip().lower() == "update" else "new"
    target = (target or "").strip()
    if kind == "update" and not target:
        raise HTTPException(400, "更新现有工具时请选择目标工具")
    if not name:
        raise HTTPException(400, "请填写工具名称")
    fn = os.path.basename((file.filename or "").strip())
    if not fn.lower().endswith(".zip"):
        raise HTTPException(400, "仅支持 .zip 压缩包")
    # 分块读取并限制大小
    data = b""
    while True:
        chunk = await file.read(262144)
        if not chunk:
            break
        data += chunk
        if len(data) > MAX_UPLOAD:
            raise HTTPException(413, "文件过大（上限 20MB）")
    if len(data) < 4 or data[:2] != b"PK":
        raise HTTPException(400, "文件不是有效的 zip 压缩包")
    token = uuid.uuid4().hex
    d = _sub_dir(token)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, "package.zip"), "wb") as f:
        f.write(data)
    sub = models.Submission(
        token=token, kind=kind, target=target[:120],
        name=name[:120], version=(version or "").strip()[:40],
        developer=(developer or "").strip()[:80], desc=(desc or "").strip()[:300],
        selfcheck=1 if str(selfcheck).lower() in ("1", "true", "yes", "on") else 0,
        filename=fn[:120], size=len(data),
        ip=(request.client.host if request.client else ""),
        status="待审核", created_at=now())
    try:
        with open(os.path.join(d, "meta.json"), "w", encoding="utf-8") as f:
            json.dump({k: getattr(sub, k) for k in
                       ("kind", "target", "name", "version", "developer", "desc",
                        "selfcheck", "filename", "size", "created_at")}, f, ensure_ascii=False, indent=2)
    except Exception:
        pass
    db.add(sub)
    db.commit()
    db.refresh(sub)
    # 新提交即时邮件通知维护者（配置 AEO_NOTIFY_EMAIL 后生效）
    try:
        notify = os.environ.get("AEO_NOTIFY_EMAIL", "").strip()
        if notify and email_enabled():
            kind_txt = ("更新现有工具 → " + (sub.target or "")) if sub.kind == "update" else "新工具"
            html = ("<p>工具平台收到一条<b>待审核</b>提交：</p><ul>"
                    f"<li>名称：{sub.name}</li><li>类型：{kind_txt}</li>"
                    f"<li>版本：{sub.version or '-'}</li><li>开发者/部门：{sub.developer or '-'}</li>"
                    f"<li>自检：{'已确认' if sub.selfcheck else '未确认'}　大小：{round(sub.size/1024)}KB</li>"
                    f"<li>时间：{sub.created_at}</li></ul>"
                    f"<p>请到管理后台审核发布：<a href='{public_base()}/admin.html'>{public_base()}/admin.html</a></p>")
            send_email(notify, f"【工具平台】新提交待审核：{sub.name}", html)
            print(f"[NOTIFY] submission alert -> {notify}", flush=True)
    except Exception as e:
        print(f"[NOTIFY][ERROR] {type(e).__name__}: {e}", flush=True)
    return {"ok": True, "id": sub.id, "message": "提交成功，已进入待审核区，平台维护者审核后部署上线。"}


@app.get("/api/tools/submissions")
def list_submissions(db: Session = Depends(database.get_db), user=Depends(_platform)):
    rows = db.query(models.Submission).order_by(models.Submission.id.desc()).all()
    return [to_dict(r) for r in rows]


@app.get("/api/tools/submissions/{sid}/download")
def download_submission(sid: int, db: Session = Depends(database.get_db), user=Depends(_platform)):
    s = db.get(models.Submission, sid)
    if not s:
        raise HTTPException(404, "提交不存在")
    path = os.path.join(_sub_dir(s.token), "package.zip")
    if not os.path.exists(path):
        raise HTTPException(404, "文件缺失")
    return FileResponse(path, filename=s.filename or "package.zip", media_type="application/zip")


@app.put("/api/tools/submissions/{sid}")
def update_submission(sid: int, data: dict = Body(...),
                      db: Session = Depends(database.get_db), user=Depends(_platform)):
    s = db.get(models.Submission, sid)
    if not s:
        raise HTTPException(404, "提交不存在")
    if data.get("status"):
        s.status = data["status"]
    db.commit()
    write_log(db, user, "更新提交状态", "submissions", f"{s.name}->{s.status}")
    return {"ok": True}


@app.delete("/api/tools/submissions/{sid}")
def delete_submission(sid: int, db: Session = Depends(database.get_db), user=Depends(_platform)):
    s = db.get(models.Submission, sid)
    if not s:
        raise HTTPException(404, "提交不存在")
    shutil.rmtree(_sub_dir(s.token), ignore_errors=True)
    db.delete(s)
    db.commit()
    write_log(db, user, "删除提交", "submissions", s.name)
    return {"ok": True}


# ============ 工具发布流水线（批准→安全解压→版本化；仅管理员/维护者） ============
def _safe_extract(zip_path, dest):
    """安全解压：防 zip slip；自动上提单层包裹目录；要求含 index.html。"""
    os.makedirs(dest, exist_ok=True)
    dest_real = os.path.realpath(dest)
    with zipfile.ZipFile(zip_path) as z:
        for m in z.namelist():
            target = os.path.realpath(os.path.join(dest, m))
            if target != dest_real and not target.startswith(dest_real + os.sep):
                raise HTTPException(400, f"压缩包包含非法路径：{m}")
        z.extractall(dest)
    entries = [e for e in os.listdir(dest) if not e.startswith("__MACOSX")]
    if len(entries) == 1 and os.path.isdir(os.path.join(dest, entries[0])) \
            and not os.path.exists(os.path.join(dest, "index.html")):
        inner = os.path.join(dest, entries[0])
        if os.path.exists(os.path.join(inner, "index.html")):
            for e in os.listdir(inner):
                shutil.move(os.path.join(inner, e), os.path.join(dest, e))
            shutil.rmtree(inner, ignore_errors=True)
    if not os.path.exists(os.path.join(dest, "index.html")):
        raise HTTPException(400, "压缩包内未找到 index.html（工具入口）")


def _slugify(s):
    s = re.sub(r"[^a-z0-9\-]+", "-", (s or "").strip().lower()).strip("-")
    return s or ("tool-" + uuid.uuid4().hex[:6])


@app.get("/api/admin/submissions")
def admin_list_submissions(db: Session = Depends(database.get_db), user=Depends(_platform)):
    rows = db.query(models.Submission).order_by(models.Submission.id.desc()).all()
    return [to_dict(r) for r in rows]


@app.get("/api/admin/pending-count")
def pending_count(db: Session = Depends(database.get_db), user=Depends(_platform)):
    n = db.query(models.Submission).filter(models.Submission.status == "待审核").count()
    return {"pending": n}


@app.get("/api/admin/submissions/{sid}/download")
def admin_download_submission(sid: int, db: Session = Depends(database.get_db), user=Depends(_platform)):
    s = db.get(models.Submission, sid)
    if not s:
        raise HTTPException(404, "提交不存在")
    path = os.path.join(_sub_dir(s.token), "package.zip")
    if not os.path.exists(path):
        raise HTTPException(404, "文件缺失")
    return FileResponse(path, filename=s.filename or "package.zip", media_type="application/zip")


@app.post("/api/admin/submissions/{sid}/approve")
def approve_submission(sid: int, data: dict = Body(default={}),
                       db: Session = Depends(database.get_db), user=Depends(_platform)):
    """批准提交：解压发布到 /data/tools/<slug>/<version>/，建/更新 Tool 与 ToolVersion，切 current。"""
    s = db.get(models.Submission, sid)
    if not s:
        raise HTTPException(404, "提交不存在")
    zip_path = os.path.join(_sub_dir(s.token), "package.zip")
    if not os.path.exists(zip_path):
        raise HTTPException(404, "暂存文件缺失")

    # 先确定目标工具/slug（不写库），再解压——解压失败则不留任何半成品记录
    if s.kind == "update" and s.target:
        tool = db.query(models.Tool).filter(
            (models.Tool.name == s.target) | (models.Tool.slug == s.target)).first()
        if not tool:
            raise HTTPException(400, f"未找到要更新的工具：{s.target}")
        slug = tool.slug
    else:
        tool = None
        slug = _slugify(data.get("slug") or s.name)
        if db.query(models.Tool).filter(models.Tool.slug == slug).first():
            slug = slug + "-" + uuid.uuid4().hex[:4]

    version = (s.version or "").strip() or datetime.datetime.now(TZ_CN).strftime("v%Y%m%d-%H%M%S")
    rel = f"tools/{slug}/{version}"
    if os.path.exists(os.path.join(database.DATA_DIR, rel)):
        rel = f"tools/{slug}/{version}-{uuid.uuid4().hex[:4]}"
    # 解压（含 index.html 校验）；若失败直接抛错，不创建任何 Tool/Version
    _safe_extract(zip_path, os.path.join(database.DATA_DIR, rel))

    # 解压成功后才落库
    if tool is None:
        tool = models.Tool(
            slug=slug, name=s.name, summary=s.desc, owner_dept=s.developer,
            category=data.get("category", "通用"),
            visibility=data.get("visibility", "both"),
            icon=(data.get("icon") or (s.name[:2] if s.name else "工具")),
            color=data.get("color", "linear-gradient(135deg,#007892,#0a9bbd)"),
            bar=data.get("bar", "linear-gradient(90deg,#007892,#0a9bbd)"),
            entry_kind="hosted", entry_path="", status="online",
            sort_order=int(data.get("sort_order", 100)), created_at=now(), updated_at=now())
        db.add(tool)
        db.commit()
        db.refresh(tool)

    for v in db.query(models.ToolVersion).filter(models.ToolVersion.tool_id == tool.id).all():
        v.state = "archived"
    ver = models.ToolVersion(tool_id=tool.id, slug=tool.slug, version=version, rel_path=rel,
                             changelog=s.desc, submitted_by=s.developer,
                             approved_by=user.username, state="live", created_at=now())
    db.add(ver)
    db.commit()
    db.refresh(ver)
    tool.current_version_id = ver.id
    tool.entry_kind = "hosted"
    tool.entry_path = f"/tools/{tool.slug}/?embed=1"
    tool.updated_at = now()
    s.status = "已部署"
    db.commit()
    write_log(db, user, "批准并发布", "tools", f"{tool.slug}@{version}")
    try:
        scoring.rescore_tool(tool, db)      # 自动合规分
        scoring.rescore_value(tool, db)     # AI 价值分（已配大模型时）
    except Exception:
        pass
    return {"ok": True, "slug": tool.slug, "version": version, "url": f"/tools/{tool.slug}/",
            "score": tool.score if (tool.score or -1) >= 0 else None}


@app.post("/api/admin/submissions/{sid}/reject")
def reject_submission(sid: int, data: dict = Body(default={}),
                      db: Session = Depends(database.get_db), user=Depends(_platform)):
    s = db.get(models.Submission, sid)
    if not s:
        raise HTTPException(404, "提交不存在")
    s.status = "已驳回：" + ((data.get("reason") or "未注明原因")[:200])
    db.commit()
    write_log(db, user, "驳回提交", "submissions", s.name)
    return {"ok": True}


@app.post("/api/admin/submissions/{sid}/prescore")
def prescore_submission(sid: int, db: Session = Depends(database.get_db), user=Depends(_platform)):
    """发布前先评分：解析提交压缩包里的入口 HTML，按《前端统一标准》打分，供审核决策。"""
    import posixpath
    s = db.get(models.Submission, sid)
    if not s:
        raise HTTPException(404, "提交不存在")
    zip_path = os.path.join(_sub_dir(s.token), "package.zip")
    if not os.path.exists(zip_path):
        raise HTTPException(404, "暂存文件缺失")
    try:
        with zipfile.ZipFile(zip_path) as z:
            names = z.namelist()
            htmls = [n for n in names if n.lower().endswith(".html") and not n.endswith("/")]
            htmls.sort(key=lambda x: (x.count("/"), len(x)))
            entry = next((n for n in htmls if posixpath.basename(n).lower() == "index.html"), None) \
                or (htmls[0] if htmls else None)
            if not entry:
                raise HTTPException(400, "压缩包内未找到 HTML 页面")
            html = z.read(entry).decode("utf-8", "ignore")
            base = posixpath.dirname(entry)
            bundle = html
            for src in re.findall(r"<script[^>]+src\s*=\s*[\"']([^\"']+)[\"']", html, re.I):
                if src.startswith(("http", "//", "/")):
                    continue
                cand = posixpath.normpath(posixpath.join(base, src)) if base else src
                if cand in names:
                    try:
                        bundle += "\n" + z.read(cand).decode("utf-8", "ignore")
                    except Exception:
                        pass
            score, items = scoring._audit(html, bundle)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"解析压缩包失败：{e}")
    return {"ok": True, "score": score, "items": items, "name": s.name, "version": s.version}


@app.get("/api/admin/tools/{tid}/versions")
def tool_versions(tid: int, db: Session = Depends(database.get_db), user=Depends(_platform)):
    t = db.get(models.Tool, tid)
    cur = t.current_version_id if t else 0
    rows = db.query(models.ToolVersion).filter(models.ToolVersion.tool_id == tid)\
        .order_by(models.ToolVersion.id.desc()).all()
    return [{**to_dict(v), "isCurrent": v.id == cur} for v in rows]


@app.post("/api/admin/tools/{tid}/rollback")
def rollback_tool(tid: int, data: dict = Body(...), db: Session = Depends(database.get_db), user=Depends(_platform)):
    t = db.get(models.Tool, tid)
    if not t:
        raise HTTPException(404, "工具不存在")
    v = db.get(models.ToolVersion, data.get("version_id") or 0)
    if not v or v.tool_id != tid:
        raise HTTPException(400, "版本无效")
    for x in db.query(models.ToolVersion).filter(models.ToolVersion.tool_id == tid).all():
        x.state = "archived"
    v.state = "live"
    t.current_version_id = v.id
    t.updated_at = now()
    db.commit()
    write_log(db, user, "回滚工具版本", "tools", f"{t.slug}@{v.version}")
    return {"ok": True, "version": v.version}


# ---- 托管工具文件服务（/tools/<slug>/...；内部工具需员工登录） ----
@app.get("/tools/{slug}/{path:path}")
def serve_tool(slug: str, path: str = "", db: Session = Depends(database.get_db),
               user=Depends(auth.optional_user)):
    tool = db.query(models.Tool).filter(models.Tool.slug == slug).first()
    if not tool or tool.status != "online":
        raise HTTPException(404, "工具不存在")
    if tool.visibility == "internal" and not (user and auth.is_staff(user.role)):
        raise HTTPException(403, "该工具仅限内部员工访问")
    ver = db.get(models.ToolVersion, tool.current_version_id or 0)
    if not ver:
        raise HTTPException(404, "暂无已发布版本")
    base = os.path.realpath(os.path.join(database.DATA_DIR, ver.rel_path))
    target = os.path.realpath(os.path.join(base, path or "index.html"))
    if target != base and not target.startswith(base + os.sep):
        raise HTTPException(400, "非法路径")
    if os.path.isdir(target):
        target = os.path.join(target, "index.html")
    if not os.path.exists(target):
        raise HTTPException(404, "文件不存在")
    return FileResponse(target)


# ============ 需求直通车（提交公开、公示墙公开；管理仅管理员） ============
NEED_KINDS = ("新系统", "新功能", "体验改进", "问题反馈")
NEED_STATUSES = ("待评估", "规划中", "开发中", "已上线", "已关闭")


NEED_FILE_MAX = 3                       # 每条需求最多 3 个附件
NEED_FILE_SIZE = 5 * 1024 * 1024        # 单个 5MB
NEED_FILE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp",
                 ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".zip", ".txt", ".csv"}
NEED_IMG_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp"}


def _need_files(db, nid):
    rows = db.query(models.NeedFile).filter(models.NeedFile.need_id == nid).all()
    return [{"id": f.id, "name": f.name, "size": f.size,
             "isImage": os.path.splitext(f.name)[1].lower() in NEED_IMG_EXT,
             "url": f"/api/needs/files/{f.id}"} for f in rows]


def _need_votes(db, nid):
    return db.query(models.NeedVote).filter(models.NeedVote.need_id == nid).count()


def _need_public(n, db):
    """公示墙视图：不暴露联系方式与 IP。"""
    return {"id": n.id, "kind": n.kind, "title": n.title, "detail": n.detail,
            "tool": n.tool, "submitter": n.submitter or "匿名", "identity": n.identity,
            "status": n.status, "reply": n.reply, "created_at": n.created_at,
            "updated_at": n.updated_at,
            "votes": _need_votes(db, n.id), "files": _need_files(db, n.id)}


def _voter_key(request, user):
    if user:
        return f"user:{user.id}"
    return request.client.host if request.client else "anon"


@app.post("/api/needs")
async def create_need(request: Request,
                      kind: str = Form("新功能"), title: str = Form(""),
                      detail: str = Form(""), tool: str = Form(""),
                      submitter: str = Form(""), contact: str = Form(""),
                      files: list[UploadFile] = File(None),
                      db: Session = Depends(database.get_db), user=Depends(auth.optional_user)):
    """公开接口：客户/员工提交系统或软件需求（multipart，支持最多 3 个附件）。
    免登录可提；已登录自动带身份。"""
    title = (title or "").strip()
    detail = (detail or "").strip()
    if len(title) < 4:
        raise HTTPException(400, "请用一句话写清需求标题（至少4个字）")
    if len(detail) < 10:
        raise HTTPException(400, "请补充业务场景与期望效果（至少10个字），便于评估")
    ip = request.client.host if request.client else ""
    # 简单防滥提：同一 IP 10 分钟内最多 5 条
    cutoff = (datetime.datetime.now(TZ_CN) - datetime.timedelta(minutes=10)).strftime("%Y-%m-%d %H:%M:%S")
    recent = db.query(models.Need).filter(models.Need.ip == ip,
                                          models.Need.created_at >= cutoff).count()
    if ip and recent >= 5:
        raise HTTPException(429, "提交太频繁，请稍后再试")
    # —— 附件预校验（先读后存，任何一个不合法整单拒绝）——
    saved = []          # (clean_name, data, mime)
    for f in (files or [])[:NEED_FILE_MAX + 1]:
        if not f or not (f.filename or "").strip():
            continue
        if len(saved) >= NEED_FILE_MAX:
            raise HTTPException(400, f"附件最多 {NEED_FILE_MAX} 个")
        fn = os.path.basename(f.filename.strip())
        ext = os.path.splitext(fn)[1].lower()
        if ext not in NEED_FILE_EXT:
            raise HTTPException(400, f"不支持的附件类型：{ext or fn}（支持图片/PDF/Office/zip/txt/csv）")
        data = b""
        while True:
            chunk = await f.read(262144)
            if not chunk:
                break
            data += chunk
            if len(data) > NEED_FILE_SIZE:
                raise HTTPException(413, "单个附件不能超过 5MB")
        if not data:
            continue
        # 文件名清洗：去路径、去危险字符、防重名
        safe = re.sub(r"[^\w.\-一-鿿]", "_", fn)[:80] or ("file" + ext)
        if any(s[0] == safe for s in saved):
            safe = f"{len(saved)+1}_{safe}"
        saved.append((safe, data, f.content_type or ""))
    kind = kind if kind in NEED_KINDS else "新功能"
    submitter = (submitter or "").strip()[:40]
    identity = "外部客户"
    uid = 0
    if user:
        uid = user.id
        identity = "内部员工" if auth.is_staff(user.role) else "外部客户"
        if not submitter:
            submitter = (user.name or user.username)[:40]
    n = models.Need(kind=kind, title=title[:120], detail=detail[:2000],
                    tool=(tool or "").strip()[:80], submitter=submitter,
                    contact=(contact or "").strip()[:120],
                    user_id=uid, identity=identity, ip=ip,
                    status="待评估", created_at=now(), updated_at=now())
    db.add(n)
    db.commit()
    db.refresh(n)
    # —— 落盘附件并登记 ——
    if saved:
        d = os.path.join(database.DATA_DIR, "needs", str(n.id))
        os.makedirs(d, exist_ok=True)
        for safe, data, mime in saved:
            with open(os.path.join(d, safe), "wb") as fh:
                fh.write(data)
            db.add(models.NeedFile(need_id=n.id, name=safe,
                                   rel_path=f"needs/{n.id}/{safe}",
                                   size=len(data), mime=mime[:80], created_at=now()))
        db.commit()
    # 提交人默认自动「同求」一票 + 生成编辑密钥（匿名提交人凭它补充说明）
    edit_key = uuid.uuid4().hex
    db.add(models.NeedVote(need_id=n.id, voter=_voter_key(request, user), created_at=now()))
    db.add(models.NeedKey(need_id=n.id, key=edit_key))
    db.commit()
    # 邮件通知维护者（沿用工具提交的通知配置）
    try:
        notify = os.environ.get("AEO_NOTIFY_EMAIL", "").strip()
        if notify and email_enabled():
            html = ("<p>需求直通车收到一条新需求：</p><ul>"
                    f"<li>类型：{n.kind}</li><li>标题：{n.title}</li>"
                    f"<li>相关工具：{n.tool or '-'}</li>"
                    f"<li>提交人：{n.submitter or '匿名'}（{n.identity}）</li>"
                    f"<li>联系方式：{n.contact or '-'}</li>"
                    f"<li>附件：{len(saved)} 个</li><li>时间：{n.created_at}</li></ul>"
                    f"<p>{n.detail}</p>"
                    f"<p>管理后台：<a href='{public_base()}/admin.html'>{public_base()}/admin.html</a></p>")
            send_email(notify, f"【需求直通车】{n.kind}：{n.title}", html)
    except Exception as e:
        print(f"[NOTIFY][ERROR] need: {type(e).__name__}: {e}", flush=True)
    return {"ok": True, "id": n.id, "editKey": edit_key,
            "message": "需求已提交，进入公示墙，由平台信息部评估。"}


@app.get("/api/needs")
def list_needs(request: Request, db: Session = Depends(database.get_db),
               user=Depends(auth.optional_user)):
    """公开公示墙：最新 200 条（隐藏项除外），不含联系方式。
    voted=当前访问者已同求的需求 id；mine=登录用户自己提交的需求 id。"""
    rows = (db.query(models.Need).filter(models.Need.hidden == 0)
            .order_by(models.Need.id.desc()).limit(200).all())
    stat = {}
    for s in NEED_STATUSES:
        stat[s] = db.query(models.Need).filter(models.Need.hidden == 0,
                                               models.Need.status == s).count()
    voter = _voter_key(request, user)
    voted = [v.need_id for v in
             db.query(models.NeedVote).filter(models.NeedVote.voter == voter).all()]
    mine = []
    if user:
        mine = [x.id for x in db.query(models.Need)
                .filter(models.Need.user_id == user.id, models.Need.hidden == 0).all()]
    return {"needs": [_need_public(n, db) for n in rows], "stats": stat,
            "kinds": list(NEED_KINDS), "statuses": list(NEED_STATUSES),
            "voted": voted, "mine": mine}


@app.post("/api/needs/{nid}/append")
def append_need(nid: int, request: Request, text: str = Form(""), key: str = Form(""),
                db: Session = Depends(database.get_db), user=Depends(auth.optional_user)):
    """提交人给自己的需求追加补充说明（不改原文，保持公示透明）。
    身份验证：登录用户匹配 user_id，或匿名提交人持有提交时返回的编辑密钥。"""
    n = db.get(models.Need, nid)
    if not n or n.hidden:
        raise HTTPException(404, "需求不存在")
    ok = bool(user and n.user_id and user.id == n.user_id)
    if not ok and (key or "").strip():
        k = db.query(models.NeedKey).filter(models.NeedKey.need_id == nid).first()
        ok = bool(k and hmac.compare_digest(k.key, key.strip()))
    if not ok:
        raise HTTPException(403, "只有需求提交人可以补充（请在提交时的浏览器/账号操作）")
    text = (text or "").strip()
    if len(text) < 2:
        raise HTTPException(400, "请输入补充内容")
    if len(n.detail) + len(text) > 4000:
        raise HTTPException(400, "补充内容过长")
    n.detail = n.detail + f"\n\n【提交人补充 · {now()}】{text[:1000]}"
    n.updated_at = now()
    db.commit()
    return {"ok": True}


@app.post("/api/needs/{nid}/vote")
def vote_need(nid: int, request: Request,
              db: Session = Depends(database.get_db), user=Depends(auth.optional_user)):
    """公开接口：「同求 +1」。同一访问者（IP 或登录账号）每条限一票，再点取消。"""
    n = db.get(models.Need, nid)
    if not n or n.hidden:
        raise HTTPException(404, "需求不存在")
    voter = _voter_key(request, user)
    ex = (db.query(models.NeedVote)
          .filter(models.NeedVote.need_id == nid, models.NeedVote.voter == voter).first())
    if ex:
        db.delete(ex)
        db.commit()
        return {"ok": True, "voted": False, "votes": _need_votes(db, nid)}
    db.add(models.NeedVote(need_id=nid, voter=voter, created_at=now()))
    db.commit()
    return {"ok": True, "voted": True, "votes": _need_votes(db, nid)}


@app.get("/api/needs/files/{fid}")
def need_file(fid: int, db: Session = Depends(database.get_db)):
    """公开附件下载/预览（公示墙附件本就公开）。"""
    f = db.get(models.NeedFile, fid)
    if not f:
        raise HTTPException(404, "附件不存在")
    n = db.get(models.Need, f.need_id)
    if not n or n.hidden:
        raise HTTPException(404, "附件不存在")
    base = os.path.realpath(os.path.join(database.DATA_DIR, "needs"))
    path = os.path.realpath(os.path.join(database.DATA_DIR, f.rel_path))
    if not path.startswith(base + os.sep) or not os.path.exists(path):
        raise HTTPException(404, "文件缺失")
    ext = os.path.splitext(f.name)[1].lower()
    if ext in NEED_IMG_EXT:   # 图片内联预览，其余下载
        return FileResponse(path, media_type=f.mime or "image/png")
    return FileResponse(path, filename=f.name)


@app.get("/api/admin/needs")
def admin_list_needs(db: Session = Depends(database.get_db), user=Depends(_platform)):
    rows = db.query(models.Need).order_by(models.Need.id.desc()).all()
    return [{**to_dict(r), "votes": _need_votes(db, r.id),
             "files": _need_files(db, r.id)} for r in rows]


@app.put("/api/admin/needs/{nid}")
def admin_update_need(nid: int, data: dict = Body(...),
                      db: Session = Depends(database.get_db), user=Depends(_platform)):
    n = db.get(models.Need, nid)
    if not n:
        raise HTTPException(404, "需求不存在")
    if "status" in data:
        if data["status"] not in NEED_STATUSES:
            raise HTTPException(400, "状态无效")
        n.status = data["status"]
    if "reply" in data:
        n.reply = str(data["reply"] or "")[:1000]
    if "hidden" in data:
        n.hidden = 1 if data["hidden"] else 0
    n.updated_at = now()
    db.commit()
    write_log(db, user, "更新需求", "needs", f"#{n.id} {n.title[:30]}->{n.status}")
    return {"ok": True}


@app.delete("/api/admin/needs/{nid}")
def admin_delete_need(nid: int, db: Session = Depends(database.get_db), user=Depends(_platform)):
    n = db.get(models.Need, nid)
    if not n:
        raise HTTPException(404, "需求不存在")
    db.query(models.NeedFile).filter(models.NeedFile.need_id == nid).delete()
    db.query(models.NeedVote).filter(models.NeedVote.need_id == nid).delete()
    db.query(models.NeedKey).filter(models.NeedKey.need_id == nid).delete()
    db.delete(n)
    db.commit()
    shutil.rmtree(os.path.join(database.DATA_DIR, "needs", str(nid)), ignore_errors=True)
    write_log(db, user, "删除需求", "needs", f"#{nid}")
    return {"ok": True}


# ============ 操作日志（仅管理员） ============
@app.get("/api/logs")
def logs(db: Session = Depends(database.get_db), user=Depends(_admin)):
    rows = db.query(models.AuditLog).order_by(models.AuditLog.id.desc()).limit(300).all()
    return [to_dict(r) for r in rows]


# ============ 示例数据装载 / 清空（仅管理员） ============
@app.post("/api/admin/load-sample")
def load_sample(db: Session = Depends(database.get_db), user=Depends(_admin)):
    if db.query(models.Decl).count() > 0:
        raise HTTPException(400, "已有业务数据，请先清空再装载示例")
    seed.load_sample(db)
    write_log(db, user, "装载示例数据", "admin")
    return {"ok": True}


@app.post("/api/admin/clear")
def clear(db: Session = Depends(database.get_db), user=Depends(_admin)):
    seed.clear_business(db)
    write_log(db, user, "清空业务数据", "admin")
    return {"ok": True}


# ============ 前端静态托管 ============
@app.get("/")
def index():
    # index.html 不缓存：保证每次更新后浏览器立即取到最新版本（再按 ?v= 拉取最新 JS/CSS）
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"),
                        headers={"Cache-Control": "no-cache, no-store, must-revalidate"})


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")
