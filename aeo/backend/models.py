"""ORM 数据模型 —— 喜事达AEO认证管理平台。

字段命名避开 SQL/Python 关键字：
  集装箱检查情况 -> chk
  培训通过率     -> passrate
"""
from sqlalchemy import Column, Integer, String, Float, Text, JSON
from database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)          # 格式: salt$hash
    name = Column(String, default="")
    role = Column(String, default="customs")           # admin/customs/audit/finance/logistics/security
    dept = Column(String, default="")
    email = Column(String, default="", index=True)     # 用于找回密码


class Standard(Base):
    """海关高级认证企业标准 —— 2026版 45 项自评条款（42核心+3附加）。"""
    __tablename__ = "standards"
    id = Column(Integer, primary_key=True)
    code = Column(String, default="")                  # 条款号，如 1.1
    cat = Column(String, default="")                   # 内部控制/财务状况/守法规范/贸易安全/附加标准
    name = Column(String, default="")
    req = Column(Text, default="")
    dept = Column(String, default="")
    status = Column(String, default="待评估")          # 待评估/达标/基本达标/不达标
    note = Column(Text, default="")
    evidence = Column(JSON, default=list)              # 证明材料清单
    origin = Column(Text, default="")                  # 官方逐字原文（公告2026年第34号附件，逐条录入）


class Decl(Base):
    """进出口报关单证。"""
    __tablename__ = "decls"
    id = Column(Integer, primary_key=True)
    no = Column(String, default="")
    type = Column(String, default="出口")
    date = Column(String, default="")
    hs = Column(String, default="")
    goods = Column(String, default="")
    value = Column(String, default="")
    cur = Column(String, default="USD")
    status = Column(String, default="已放行")
    err = Column(String, default="正常")               # 正常/差错-已整改/差错-待整改


class Container(Base):
    """集装箱与箱体安全。"""
    __tablename__ = "containers"
    id = Column(Integer, primary_key=True)
    no = Column(String, default="")
    type = Column(String, default="40HQ")
    seal = Column(String, default="")
    goods = Column(String, default="")
    chk = Column(String, default="")                   # 检查情况
    photo = Column(String, default="是")               # 照片留存 是/否
    status = Column(String, default="装箱中")


class Finance(Base):
    """年度财务状况（2026版 9 项指标测算：偿债4 + 盈利5）。

    金额字段统一以「万元」录入。rate/rev/profit 为旧版兼容字段，
    通过财务测算保存时自动回填（rate=资产负债率）。"""
    __tablename__ = "finance"
    id = Column(Integer, primary_key=True)
    y = Column(String, default="")
    rate = Column(Float, default=0.0)                  # 资产负债率 %（兼容旧版/趋势图）
    rev = Column(String, default="")
    profit = Column(String, default="")
    tax = Column(String, default="A级")
    # —— 2026版测算输入（万元）——
    ftype = Column(String, default="")                 # 生产型 / 非生产型
    assets = Column(Float, default=0.0)                # 资产总额
    liab = Column(Float, default=0.0)                  # 负债总额
    cash = Column(Float, default=0.0)                  # 货币资金
    cura = Column(Float, default=0.0)                  # 流动资产
    curl = Column(Float, default=0.0)                  # 流动负债
    ocf = Column(Float, default=0.0)                   # 经营活动现金流量净额
    revenue = Column(Float, default=0.0)               # 营业收入
    cost = Column(Float, default=0.0)                  # 营业成本
    opprofit = Column(Float, default=0.0)              # 营业利润
    netprofit = Column(Float, default=0.0)             # 净利润
    totalprofit = Column(Float, default=0.0)           # 利润总额
    interest = Column(Float, default=0.0)              # 利息支出（总资产报酬率用，可0）
    metrics = Column(JSON, default=dict)               # 9项指标测算结果快照
    verdict = Column(String, default="")               # 达标/基本达标/不达标


class Partner(Base):
    """商业伙伴安全评估。"""
    __tablename__ = "partners"
    id = Column(Integer, primary_key=True)
    name = Column(String, default="")
    type = Column(String, default="供应商")
    role = Column(String, default="")
    risk = Column(String, default="待定")
    aeo = Column(String, default="未认证")
    sec = Column(String, default="待评估")
    expire = Column(String, default="-")


class DocFile(Base):
    """制度与档案。"""
    __tablename__ = "docfiles"
    id = Column(Integer, primary_key=True)
    name = Column(String, default="")
    cat = Column(String, default="关务制度")
    ver = Column(String, default="V1.0")
    date = Column(String, default="")
    owner = Column(String, default="")
    keep = Column(String, default="长期")


class Training(Base):
    """培训管理。"""
    __tablename__ = "trainings"
    id = Column(Integer, primary_key=True)
    topic = Column(String, default="")
    date = Column(String, default="")
    aud = Column(String, default="")
    people = Column(Integer, default=0)
    passrate = Column(String, default="-")
    status = Column(String, default="计划中")


class Audit(Base):
    """内部审计。"""
    __tablename__ = "audits"
    id = Column(Integer, primary_key=True)
    no = Column(String, default="")
    scope = Column(String, default="")
    date = Column(String, default="")
    lead = Column(String, default="")
    find = Column(Integer, default=0)
    closed = Column(Integer, default=0)
    status = Column(String, default="计划中")


class Rectify(Base):
    """整改跟踪（闭环）。"""
    __tablename__ = "rectify"
    id = Column(Integer, primary_key=True)
    code = Column(String, default="")
    src = Column(String, default="")
    std = Column(String, default="")
    issue = Column(Text, default="")
    dept = Column(String, default="")
    owner = Column(String, default="")
    due = Column(String, default="")
    step = Column(Integer, default=1)                  # 1登记 2整改 3关闭
    risk = Column(String, default="中")


class AuditLog(Base):
    """操作日志（合规留痕）。"""
    __tablename__ = "logs"
    id = Column(Integer, primary_key=True)
    ts = Column(String, default="")
    user = Column(String, default="")
    role = Column(String, default="")
    action = Column(String, default="")                # 新增/修改/删除/登录等
    entity = Column(String, default="")
    ref = Column(String, default="")


class PackerProject(Base):
    """装箱软件——用户云端保存的装箱方案（按账号隔离）。"""
    __tablename__ = "packer_projects"
    id = Column(Integer, primary_key=True)
    owner = Column(Integer, index=True)                # 所属用户 id
    name = Column(String, default="装箱方案")
    data = Column(JSON, default=dict)                  # serializeProject() 的内容
    updated_at = Column(String, default="")


class Tool(Base):
    """工具注册表 —— 平台唯一事实来源。首页与各视图从此渲染。"""
    __tablename__ = "tools"
    id = Column(Integer, primary_key=True)
    slug = Column(String, unique=True, index=True)      # 英文标识，决定 /tools/<slug>/
    name = Column(String, default="")
    category = Column(String, default="通用")
    summary = Column(Text, default="")                  # 一句话说明
    owner_dept = Column(String, default="")
    icon = Column(String, default="工具")               # 卡片图标字
    color = Column(String, default="linear-gradient(135deg,#007892,#0a9bbd)")  # 卡片主题色
    bar = Column(String, default="linear-gradient(90deg,#007892,#0a9bbd)")     # 顶部条
    visibility = Column(String, default="both")         # external/internal/both
    status = Column(String, default="online")           # online/hidden/deprecated
    entry_kind = Column(String, default="embed")        # embed=弹窗内嵌 / link=跳转 / hosted=平台托管(/tools/<slug>/)
    entry_path = Column(String, default="")             # /xxx.html?embed=1 或 /aeo/ 或 /tools/<slug>/?embed=1
    current_version_id = Column(Integer, default=0)     # hosted 工具当前生效版本
    sort_order = Column(Integer, default=100)
    created_at = Column(String, default="")
    updated_at = Column(String, default="")


class ToolVersion(Base):
    """hosted 工具的版本记录。文件在 AEO_DATA_DIR/tools/<slug>/<version>/。"""
    __tablename__ = "tool_versions"
    id = Column(Integer, primary_key=True)
    tool_id = Column(Integer, index=True)
    slug = Column(String, index=True, default="")
    version = Column(String, default="")
    rel_path = Column(String, default="")               # tools/<slug>/<version>
    changelog = Column(Text, default="")
    submitted_by = Column(String, default="")
    approved_by = Column(String, default="")
    state = Column(String, default="live")              # live/archived
    created_at = Column(String, default="")


class Submission(Base):
    """同事提交的工具压缩包（仅进待审核暂存区，不自动上线）。
    zip 文件存于 AEO_DATA_DIR/submissions/<token>/package.zip（不对外暴露）。"""
    __tablename__ = "submissions"
    id = Column(Integer, primary_key=True)
    token = Column(String, index=True, default="")     # 随机目录名
    kind = Column(String, default="new")               # new=新工具 / update=更新现有工具
    target = Column(String, default="")                # 更新时指向的现有工具名
    name = Column(String, default="")                  # 工具名称
    version = Column(String, default="")
    developer = Column(String, default="")             # 开发者/部门
    desc = Column(Text, default="")                    # 一句话说明
    selfcheck = Column(Integer, default=0)             # 是否已自检 1/0
    filename = Column(String, default="")              # 原始文件名
    size = Column(Integer, default=0)                  # 字节
    ip = Column(String, default="")
    status = Column(String, default="待审核")          # 待审核/已部署/已驳回
    created_at = Column(String, default="")


class Need(Base):
    """需求直通车 —— 客户/员工提出的系统或软件需求（公示墙）。
    contact/ip 不对外公开，仅管理员可见。"""
    __tablename__ = "needs"
    id = Column(Integer, primary_key=True)
    kind = Column(String, default="新功能")        # 新系统/新功能/体验改进/问题反馈
    title = Column(String, default="")
    detail = Column(Text, default="")              # 业务场景与期望效果
    tool = Column(String, default="")              # 相关工具（空=新系统/其他）
    submitter = Column(String, default="")         # 姓名/称呼（公开）
    contact = Column(String, default="")           # 联系方式（仅管理员可见）
    user_id = Column(Integer, default=0)           # 登录用户 id（0=匿名）
    identity = Column(String, default="外部客户")   # 外部客户/内部员工
    status = Column(String, default="待评估")       # 待评估/规划中/开发中/已上线/已关闭
    reply = Column(Text, default="")               # 平台回复（公开）
    hidden = Column(Integer, default=0)            # 1=不在公示墙显示
    ip = Column(String, default="")
    created_at = Column(String, default="")
    updated_at = Column(String, default="")


class NeedFile(Base):
    """需求附件（截图/文档）。文件存 AEO_DATA_DIR/needs/<need_id>/。"""
    __tablename__ = "need_files"
    id = Column(Integer, primary_key=True)
    need_id = Column(Integer, index=True)
    name = Column(String, default="")                  # 原始文件名（已清洗）
    rel_path = Column(String, default="")              # needs/<need_id>/<name>
    size = Column(Integer, default=0)
    mime = Column(String, default="")
    created_at = Column(String, default="")


class NeedVote(Base):
    """需求「同求」记录（按 IP+用户去重）。"""
    __tablename__ = "need_votes"
    id = Column(Integer, primary_key=True)
    need_id = Column(Integer, index=True)
    voter = Column(String, index=True, default="")     # ip 或 user:<id>
    created_at = Column(String, default="")


# 实体名 -> (模型类, 归属权限模块, 可写字段)
ENTITY_FIELDS = {
    "standards":  ["code", "cat", "name", "req", "dept", "status", "note", "evidence", "origin"],
    "decls":      ["no", "type", "date", "hs", "goods", "value", "cur", "status", "err"],
    "containers": ["no", "type", "seal", "goods", "chk", "photo", "status"],
    "finance":    ["y", "rate", "rev", "profit", "tax",
                   "ftype", "assets", "liab", "cash", "cura", "curl", "ocf",
                   "revenue", "cost", "opprofit", "netprofit", "totalprofit",
                   "interest", "metrics", "verdict"],
    "partners":   ["name", "type", "role", "risk", "aeo", "sec", "expire"],
    "docfiles":   ["name", "cat", "ver", "date", "owner", "keep"],
    "trainings":  ["topic", "date", "aud", "people", "passrate", "status"],
    "audits":     ["no", "scope", "date", "lead", "find", "closed", "status"],
    "rectify":    ["code", "src", "std", "issue", "dept", "owner", "due", "step", "risk"],
}
ENTITY_MODEL = {
    "standards": Standard, "decls": Decl, "containers": Container, "finance": Finance,
    "partners": Partner, "docfiles": DocFile, "trainings": Training, "audits": Audit,
    "rectify": Rectify,
}
# 实体 -> 权限模块
ENTITY_MODULE = {
    "standards": "standards", "decls": "customs", "containers": "logistics",
    "finance": "finance", "partners": "partner", "docfiles": "docs",
    "trainings": "training", "audits": "audit", "rectify": "rectify",
}
