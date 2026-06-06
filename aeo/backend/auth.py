"""认证与多角色权限（RBAC）。

- 密码：PBKDF2-HMAC-SHA256（标准库，无第三方加密依赖）
- 令牌：HMAC-SHA256 签名的无状态 token
- 权限：按「模块」控制读 / 写
"""
import os
import hmac
import time
import json
import base64
import hashlib
import secrets

from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session

from database import get_db
import models

# ---------- 密钥（首次运行自动生成并持久化） ----------
_DATA_DIR = os.environ.get("AEO_DATA_DIR", os.path.dirname(os.path.abspath(__file__)))
_SECRET_FILE = os.path.join(_DATA_DIR, ".secret_key")


def _load_secret() -> bytes:
    # 生产环境优先用环境变量 AEO_SECRET_KEY（多副本部署须保持一致）
    env = os.environ.get("AEO_SECRET_KEY")
    if env:
        return env.encode()
    if os.path.exists(_SECRET_FILE):
        with open(_SECRET_FILE, "rb") as f:
            return f.read()
    s = secrets.token_bytes(32)
    try:
        with open(_SECRET_FILE, "wb") as f:
            f.write(s)
    except OSError:
        pass
    return s


SECRET = _load_secret()


# ---------- 密码 ----------
def hash_pw(pw: str, salt: str = None) -> str:
    salt = salt or secrets.token_hex(8)
    h = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 100_000).hex()
    return f"{salt}${h}"


def verify_pw(pw: str, stored: str) -> bool:
    try:
        salt, h = stored.split("$", 1)
    except ValueError:
        return False
    calc = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 100_000).hex()
    return hmac.compare_digest(calc, h)


# ---------- 令牌 ----------
def _b64e(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def _b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def make_token(uid: int, hours: int = 12) -> str:
    payload = json.dumps({"uid": uid, "exp": int(time.time()) + hours * 3600})
    p = _b64e(payload.encode())
    sig = _b64e(hmac.new(SECRET, p.encode(), hashlib.sha256).digest())
    return f"{p}.{sig}"


def parse_token(tok: str):
    try:
        p, sig = tok.split(".", 1)
        expect = _b64e(hmac.new(SECRET, p.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(expect, sig):
            return None
        data = json.loads(_b64d(p))
        if data["exp"] < time.time():
            return None
        return data["uid"]
    except Exception:
        return None


def make_reset_token(uid: int, minutes: int = 30) -> str:
    """密码重置专用短时令牌（用 rid 区分，不能当登录令牌用）。"""
    payload = json.dumps({"rid": uid, "exp": int(time.time()) + minutes * 60})
    p = _b64e(payload.encode())
    sig = _b64e(hmac.new(SECRET, p.encode(), hashlib.sha256).digest())
    return f"{p}.{sig}"


def parse_reset_token(tok: str):
    try:
        p, sig = tok.split(".", 1)
        expect = _b64e(hmac.new(SECRET, p.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(expect, sig):
            return None
        data = json.loads(_b64d(p))
        if data["exp"] < time.time():
            return None
        return data["rid"]
    except Exception:
        return None


# ---------- 当前用户依赖 ----------
def current_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "未登录")
    uid = parse_token(authorization[7:])
    if uid is None:
        raise HTTPException(401, "登录已过期，请重新登录")
    user = db.get(models.User, uid)
    if not user:
        raise HTTPException(401, "用户不存在")
    return user


def optional_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    """可选登录：有有效 token 返回用户，否则返回 None（不抛错）。
    用于工具目录等公开接口按身份过滤内部/外部工具。"""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    uid = parse_token(authorization[7:])
    if uid is None:
        return None
    return db.get(models.User, uid)


# ---------- 权限矩阵 ----------
ROLE_NAMES = {
    "admin": "系统管理员",
    "customs": "关务部",
    "audit": "内审部",
    "finance": "财务部",
    "logistics": "物流部",
    "security": "安保/贸易安全部",
    "platform": "平台管理员",
    "customer": "外部客户",
}

# 内部员工角色（可访问 AEO 合规平台）。其余角色（如 customer 外部客户）
# 一律不能访问任何 AEO 合规数据，仅能使用公开工具（装箱软件等）。
STAFF_ROLES = {"admin", "customs", "audit", "finance", "logistics", "security"}

# 所有登录用户可读的业务模块（内部合规系统强调透明）
BASE_MODULES = {
    "dashboard", "standards", "audit", "rectify", "customs",
    "logistics", "finance", "security", "partner", "docs", "training", "settings",
}

# 各角色可写的模块
WRITE_MAP = {
    "customs":   {"standards", "customs", "logistics", "docs", "rectify"},
    "audit":     {"standards", "audit", "rectify"},
    "finance":   {"finance", "standards"},
    "logistics": {"logistics"},
    "security":  {"partner", "training", "security"},
}


def is_staff(role: str) -> bool:
    return role in STAFF_ROLES


def can(role: str, module: str, write: bool = False) -> bool:
    if role == "admin":
        return True
    if role not in STAFF_ROLES:          # 外部客户等：无任何 AEO 合规权限
        return False
    if module in ("users", "logs"):      # 管理员专属
        return False
    if not write:
        return module in BASE_MODULES
    return module in WRITE_MAP.get(role, set())


def writable_modules(role: str):
    if role == "admin":
        return sorted(BASE_MODULES | {"users", "logs"})
    return sorted(WRITE_MAP.get(role, set()))


def require(module: str, write: bool = False):
    """生成一个依赖，校验当前用户对某模块的读/写权限。"""
    def _dep(user=Depends(current_user)):
        if not can(user.role, module, write):
            raise HTTPException(403, "无权限操作该模块")
        return user
    return _dep


def staff_only(user=Depends(current_user)):
    """仅内部员工可访问（阻断外部客户访问合规数据）。"""
    if not is_staff(user.role):
        raise HTTPException(403, "外部账号无权访问合规平台")
    return user
