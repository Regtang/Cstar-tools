"""初始化数据：默认账号 + 海关高级认证企业标准框架（海关总署公告2026年第34号·2026/4/1施行）。

依据《海关高级认证企业标准》（通用标准—进出口货物收发货人，海关总署公告2026年第34号，
废止2022年第106号/第114号）与《海关注册登记和备案企业信用管理办法》（海关总署令第282号）。
保留内部控制、财务状况、守法规范、贸易安全四大核心模块，新增附加标准（加分项）。

业务数据（报关/集装箱/财务等）默认为空，由企业录入真实数据。
管理员可在「设置」中一键装载/清空示例数据用于试用与培训。
"""
import os
import datetime
from database import Base, ENGINE, SessionLocal
import models
from auth import hash_pw


def now_str():
    # 北京时间（容器为 UTC）
    return datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).strftime("%Y-%m-%d %H:%M:%S")

# 标准版本标识（用于幂等迁移：升级到新版时自动刷新标准框架）
STD_VERSION = "海关总署公告2026年第34号"

# 海关高级认证企业标准（通用标准—进出口货物收发货人）框架：(条款号, 类别, 名称, 要求, 责任部门)
# 依据海关总署公告2026年第34号（2026/4/1施行），保留四大核心模块并新增附加标准。
STANDARD_FRAME = [
    # —— 一、内部控制 ——
    ("1.1", "内部控制", "内部组织架构", "设立专门关务管理部门或岗位，明确职责权限", "关务部"),
    ("1.2", "内部控制", "高管熟悉海关规定", "负责人/关务负责人熟悉海关法律法规并自觉守法", "总经理办公室"),
    ("1.3", "内部控制", "进出口单证制作", "单证制作规范，与实际进出口货物相符", "关务部"),
    ("1.4", "内部控制", "单证保管与可追溯", "单证集中保管，自办结之日起保存3年以上", "关务部/档案室"),
    ("1.5", "内部控制", "信息系统-完整性", "信息系统真实、准确、完整记录生产经营与进出口活动", "信息部"),
    ("1.6", "内部控制", "信息系统-关务物流财务模块", "财务控制、关务、物流控制功能模块有效运行", "信息部"),
    ("1.7", "内部控制", "数据保存期限", "系统数据自办结海关手续之日起保存3年以上", "信息部"),
    ("1.8", "内部控制", "内审制度", "建立内部审计制度，定期开展进出口活动合规自查", "内审部"),
    ("1.9", "内部控制", "改进机制", "对自查发现问题主动纠错、主动改进并形成闭环", "内审部"),
    ("1.10", "内部控制", "商品归类管理", "建立商品归类内部规范，归类准确", "关务部"),
    ("1.11", "内部控制", "价格与特许权使用费", "完税价格申报规范，特许权使用费如实申报", "关务部/财务部"),
    ("1.12", "内部控制", "原产地管理", "原产地申报与享惠规范", "关务部"),
    ("1.13", "内部控制", "禁限及两用物项审查", "（2026新增·单独分项）建立进出口禁止/限制类及两用物项管制商品的合规审查机制与岗位", "关务部"),
    # —— 二、财务状况（2026改为9项指标：4项偿债能力+5项盈利能力；区分生产型/非生产型）——
    ("2.1", "财务状况", "会计信息真实", "会计资料真实、完整，反映企业财务状况", "财务部"),
    ("2.2", "财务状况", "偿债能力-资产负债率", "资产负债率达标（生产型/非生产型企业差异化要求）", "财务部"),
    ("2.3", "财务状况", "偿债能力-现金比率", "现金比率达标", "财务部"),
    ("2.4", "财务状况", "偿债能力-经营现金流负债比", "经营活动现金流量与负债比率达标", "财务部"),
    ("2.5", "财务状况", "偿债能力-流动比率", "流动比率达标", "财务部"),
    ("2.6", "财务状况", "盈利能力-净利润", "净利润达标", "财务部"),
    ("2.7", "财务状况", "盈利能力-营业利润率", "营业利润率达标", "财务部"),
    ("2.8", "财务状况", "盈利能力-毛利率", "毛利率达标", "财务部"),
    ("2.9", "财务状况", "盈利能力-经营性现金流", "经营性现金流达标", "财务部"),
    ("2.10", "财务状况", "盈利能力-总资产报酬率", "总资产报酬率达标", "财务部"),
    ("2.11", "财务状况", "财务达标判定规则", "偿债能力4项中≥2项、盈利能力5项中≥2项符合即「达标」；各仅1项符合为「基本达标」", "财务部"),
    ("2.12", "财务状况", "依法纳税", "依法纳税，无重大欠税", "财务部"),
    # —— 三、守法规范（2026覆盖面扩展至更多关联主体，量化要求增加）——
    ("3.1", "守法规范", "无走私违规记录", "企业近2年无走私犯罪、走私行为", "关务部/法务"),
    ("3.2", "守法规范", "报关差错率", "年度进出口报关差错率低于规定标准", "关务部"),
    ("3.3", "守法规范", "违规处置闭环", "对违规行为及时纠正并防止再发", "关务部"),
    ("3.4", "守法规范", "关联主体守法", "（2026扩展）法定代表人、关务/财务负责人、报关人员及分支机构、所属企业、委托代理人员、备案出资人等关联主体近1年无违法违规", "人力资源部/法务部"),
    ("3.5", "守法规范", "信用记录良好", "无失信被执行、无其他严重失信记录", "法务部"),
    ("3.6", "守法规范", "处罚与欠税量化达标", "（2026量化）行政处罚次数/金额、欠税等量化指标符合规定", "财务部/法务部"),
    # —— 四、贸易安全（核心未变，具体要求略减）——
    ("4.1", "贸易安全", "关企沟通合作", "建立与海关的沟通联系机制并指定联络人", "关务部"),
    ("4.2", "贸易安全", "场所安全", "经营场所有门禁、监控、围墙等安防措施", "安保部"),
    ("4.3", "贸易安全", "人员安全", "员工入职背景调查、离职权限回收管理", "人力资源部"),
    ("4.4", "贸易安全", "货物物品安全", "货物收发、存储、装卸全程受控可追溯", "仓储物流部"),
    ("4.5", "贸易安全", "集装箱安全", "集装箱七点检查与铅封管理", "仓储物流部"),
    ("4.6", "贸易安全", "运输工具安全", "运输工具查验与异常上报机制", "仓储物流部"),
    ("4.7", "贸易安全", "商业伙伴安全", "对商业伙伴资信与安全状况评估并留存", "采购部/关务部"),
    ("4.8", "贸易安全", "信息技术安全", "信息系统访问控制、数据备份与防护", "信息部"),
    ("4.9", "贸易安全", "安全培训", "定期开展海关业务与贸易安全培训", "人力资源部/关务部"),
    ("4.10", "贸易安全", "危机与应急管理", "建立贸易安全突发事件应急预案", "安保部"),
    ("4.11", "贸易安全", "货物异常报告", "发现可疑货物或装载异常及时向海关报告", "仓储物流部"),
    # —— 五、附加标准（2026新增·加分项，进出口货物收发货人；经海关确认每项+1分，高级认证最多累计+2分）——
    ("5.1", "附加标准", "国家级绿色工厂/绿色供应链", "获评国家级绿色工厂或绿色供应链企业（+1分）", "总经理办公室"),
    ("5.2", "附加标准", "专精特新“小巨人”", "获评国家级专精特新“小巨人”企业（+1分）", "总经理办公室"),
    ("5.3", "附加标准", "其他附加情形", "收发货人附加标准共6种情形，具体以公告2026年第34号附件为准（高级认证最多累计+2分）", "关务部"),
]

DEFAULT_USERS = [
    ("admin", "admin123", "系统管理员", "admin", "信息部"),
    ("guanwu", "123456", "关务部主管", "customs", "关务部"),
    ("neishen", "123456", "内审专员", "audit", "内审部"),
    ("caiwu", "123456", "财务主管", "finance", "财务部"),
    ("wuliu", "123456", "物流主管", "logistics", "仓储物流部"),
    ("anbao", "123456", "安保主管", "security", "安保部"),
    ("pmadmin", "Cstar@2026", "平台管理员", "platform", "工具平台"),
]


def _ensure_columns():
    """轻量迁移：为已存在的旧表补齐新增列（SQLite，幂等）。"""
    from sqlalchemy import text
    # 表名 -> [(列名, 列定义)]
    wanted = {
        "users": [("email", "VARCHAR DEFAULT ''")],
        "submissions": [("kind", "VARCHAR DEFAULT 'new'"), ("target", "VARCHAR DEFAULT ''")],
        "tools": [("current_version_id", "INTEGER DEFAULT 0")],
        # v2026.2 升级：标准逐字原文 + 财务9项指标测算
        "standards": [("origin", "TEXT DEFAULT ''")],
        "finance": [
            ("ftype", "VARCHAR DEFAULT ''"), ("assets", "FLOAT DEFAULT 0"),
            ("liab", "FLOAT DEFAULT 0"), ("cash", "FLOAT DEFAULT 0"),
            ("cura", "FLOAT DEFAULT 0"), ("curl", "FLOAT DEFAULT 0"),
            ("ocf", "FLOAT DEFAULT 0"), ("revenue", "FLOAT DEFAULT 0"),
            ("cost", "FLOAT DEFAULT 0"), ("opprofit", "FLOAT DEFAULT 0"),
            ("netprofit", "FLOAT DEFAULT 0"), ("totalprofit", "FLOAT DEFAULT 0"),
            ("interest", "FLOAT DEFAULT 0"), ("metrics", "JSON"),
            ("verdict", "VARCHAR DEFAULT ''"),
        ],
    }
    with ENGINE.begin() as conn:
        for table, cols in wanted.items():
            existing = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
            if not existing:
                continue  # 表尚未创建，create_all 会按最新模型建好
            for name, ddl in cols:
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))


# 工具注册表初始数据（迁移现有 4 个工具）
DEFAULT_TOOLS = [
    dict(slug="aeo", name="AEO 认证管理平台", category="合规",
         summary="海关高级认证企业（AEO）合规管理系统（公告2026年第34号）：45 项标准自评（含官方逐字原文逐条对照）、财务9项指标自动测算、差距分析与应备材料清单、认证驾驶舱（雷达图/倒计时/估算总分/汇报版报告）、内部审计、整改闭环、关务/物流/财务记录、贸易安全与商业伙伴评估，多角色登录。",
         owner_dept="关务部", icon="AEO",
         color="linear-gradient(135deg,#007892,#0a9bbd)", bar="linear-gradient(90deg,#007892,#0a9bbd)",
         visibility="internal", status="online", entry_kind="link", entry_path="/aeo/", sort_order=10),
    dict(slug="packer", name="Cstar 装箱软件", category="物流",
         summary="集装箱装箱计划工具：20/40GP、40/45HQ 箱型，自动装箱、重货优先、3D 可视化、多箱计划与重量分布提示，打开即用、可离线。",
         owner_dept="仓储物流部", icon="装箱",
         color="linear-gradient(135deg,#e54c5e,#f59e0b)", bar="linear-gradient(90deg,#e54c5e,#f59e0b)",
         visibility="both", status="online", entry_kind="link", entry_path="/packer/?embed=1", sort_order=20),
    dict(slug="msds-un", name="危化判定（MSDS/UN）", category="合规",
         summary="进出口危化品监管判定工具：按 SDS、UN 号、CAS、成分与监管清单，自动输出所需证件与申报路径，弹窗即开即用。",
         owner_dept="关务部", icon="危化",
         color="linear-gradient(135deg,#d9480f,#f59e0b)", bar="linear-gradient(90deg,#d9480f,#f59e0b)",
         visibility="both", status="online", entry_kind="embed", entry_path="/msds-un-app.html?embed=1", sort_order=30),
    dict(slug="export-customs", name="出口风险研判助手", category="报关",
         summary="出口报关合规研判工具：依据商品、品名要素与目的国，快速研判申报风险点、所需单证与归类提示，给出处置建议，弹窗即开即用。",
         owner_dept="关务部", icon="研判",
         color="linear-gradient(135deg,#252f45,#007892)", bar="linear-gradient(90deg,#252f45,#007892)",
         visibility="both", status="online", entry_kind="embed", entry_path="/export-customs-app.html?embed=1", sort_order=40),
    dict(slug="container-eir", name="集装箱设备交接单 EIR", category="物流",
         summary="集装箱进出场/提还空重的电子设备交接单（EIR）：ISO 6346 箱号校验、箱型/铅封/船公司/自重限重、冷箱温控、运输与车队信息、分部位箱况查验、双方电子签名、可打印中英单据与历史台账。",
         owner_dept="仓储物流部", icon="EIR",
         color="linear-gradient(135deg,#0a7d8c,#0a9bbd)", bar="linear-gradient(90deg,#0a7d8c,#0a9bbd)",
         visibility="both", status="online", entry_kind="embed", entry_path="/container-eir-app.html?embed=1", sort_order=50),
    dict(slug="duty-calc", name="进出口税费试算器", category="财务",
         summary="进口关税/增值税/消费税估算 + 出口退税估算：按货价、运费、保险、汇率与各项税率自动算出完税价、各税与含税总成本，支持历史台账与 CSV/Excel/PDF 导出。仅供估算，实际以海关审定为准。",
         owner_dept="财务部", icon="税费",
         color="linear-gradient(135deg,#b45309,#f59e0b)", bar="linear-gradient(90deg,#b45309,#f59e0b)",
         visibility="both", status="online", entry_kind="embed", entry_path="/duty-calc-app.html?embed=1", sort_order=35),
    dict(slug="hs-lookup", name="HS编码·申报要素速查", category="关务",
         summary="报关前速查（已接入喜事达全量税则库）：输入商品名/HS编码在线查询全部 HS 编码、规范申报要素与各档税率（最惠国/普通/暂定/增值税/消费税/出口退税/出口关税）、监管条件与检验检疫；输入时本地常用库即时联想，支持按 HS 章浏览、关键词高亮、搜索历史、监管证件代码对照与打印/PDF/Word 申报参考单。在线结果以海关申报系统为准。",
         owner_dept="关务部", icon="HS",
         color="linear-gradient(135deg,#0e7490,#06b6d4)", bar="linear-gradient(90deg,#0e7490,#06b6d4)",
         visibility="both", status="online", entry_kind="embed", entry_path="/hs-lookup-app.html?embed=1", sort_order=20),
    dict(slug="trade-docs", name="发票·装箱单生成器", category="单证",
         summary="外贸单证一键生成：一次录入抬头与货物明细，同时生成商业发票 Commercial Invoice、形式发票 Proforma Invoice、装箱单 Packing List（中英双语）。自动汇总数量/金额/件数/净重毛重/体积CBM、金额英文大写，支持唛头、贸易术语、付款与银行信息；历史台账、示例数据、本地暂存，打印/PDF/Word 单据与货物明细 Excel 导出。",
         owner_dept="单证部", icon="单证",
         color="linear-gradient(135deg,#5b21b6,#8b5cf6)", bar="linear-gradient(90deg,#5b21b6,#8b5cf6)",
         visibility="both", status="online", entry_kind="embed", entry_path="/trade-docs-app.html?embed=1", sort_order=30),
]


def run():
    """创建表并初始化用户与标准框架（幂等）。"""
    Base.metadata.create_all(bind=ENGINE)
    _ensure_columns()
    db = SessionLocal()
    try:
        if db.query(models.User).count() == 0:
            # 生产部署可用环境变量 AEO_ADMIN_PASSWORD 覆盖默认管理员密码
            admin_pw = os.environ.get("AEO_ADMIN_PASSWORD", "admin123")
            for username, pw, name, role, dept in DEFAULT_USERS:
                if username == "admin":
                    pw = admin_pw
                db.add(models.User(username=username, password=hash_pw(pw),
                                   name=name, role=role, dept=dept))
        # 标准框架初始化 / 版本升级（幂等）：
        # 旧版（2022年第106号）无「附加标准」类别或「1.13 禁限及两用物项审查」条款，
        # 检测到非2026版时，刷新为公告2026年第34号框架（条款变更，状态重置为待评估）。
        existing = db.query(models.Standard).all()
        is_2026 = any(s.cat == "附加标准" for s in existing) and any(s.code == "1.13" for s in existing)
        if not existing or not is_2026:
            for s in existing:
                db.delete(s)
            db.flush()
            for code, cat, name, req, dept in STANDARD_FRAME:
                db.add(models.Standard(code=code, cat=cat, name=name, req=req,
                                       dept=dept, status="待评估", note="", evidence=[]))
        # 工具注册表：按 slug 补建缺失的默认工具（新增工具部署后自动上架；不覆盖已有）
        have = {x.slug for x in db.query(models.Tool).all()}
        for t in DEFAULT_TOOLS:
            if t["slug"] not in have:
                db.add(models.Tool(**dict(t, created_at=now_str(), updated_at=now_str())))
        # 修正历史遗留（幂等）：装箱软件曾通过"上传审核"流程发布到 /tools/packer/（旧副本，
        # 登录仍指向 AEO），而平台维护的始终是 /packer/。把入口纠正到维护副本，开成弹窗。
        pk = db.query(models.Tool).filter(models.Tool.slug == "packer").first()
        if pk and (pk.entry_path or "").startswith("/tools/packer"):
            pk.entry_path = "/packer/?embed=1"
            pk.entry_kind = "link"
            pk.updated_at = now_str()
        db.commit()
    finally:
        db.close()


# ---------------- 可选示例数据（试用/培训） ----------------
def load_sample(db):
    """把空系统填充为「华兴精密制造」生产制造型示例场景。"""
    # 标准状态置为示例评估结果
    overrides = {
        "1.4": ("基本达标", "2024年部分海运提单缺失，需补全扫描件", ["单证归档清单"]),
        "1.9": ("基本达标", "2笔归类差错整改未闭环", ["整改台账"]),
        "3.2": ("基本达标", "Q1差错率0.42%偏高，已落实双复核", ["差错率统计表"]),
        "4.5": ("基本达标", "部分箱检查表未拍照留存", ["七点检查表"]),
        "4.7": ("基本达标", "3家新供应商安全评估待补", ["伙伴安全协议"]),
    }
    for s in db.query(models.Standard).all():
        if s.code in overrides:
            st, note, ev = overrides[s.code]
            s.status, s.note, s.evidence = st, note, ev
        else:
            s.status = "达标"
            s.evidence = ["相关制度与记录"]

    db.add_all([
        models.Decl(no="531020250500123", type="出口", date="2026-05-28", hs="8466.9300", goods="精密机床零部件", value="¥1,286,400", cur="USD", status="已放行", err="正常"),
        models.Decl(no="531020250500119", type="进口", date="2026-05-26", hs="7228.3000", goods="合金钢棒料", value="¥842,500", cur="USD", status="已放行", err="正常"),
        models.Decl(no="531020250500112", type="出口", date="2026-05-22", hs="8483.4090", goods="传动轴及齿轮", value="¥564,200", cur="EUR", status="已放行", err="差错-已整改"),
        models.Decl(no="531020250500108", type="进口", date="2026-05-19", hs="8537.1090", goods="数控系统控制柜", value="¥1,910,000", cur="JPY", status="查验放行", err="正常"),
        models.Decl(no="531020250500101", type="出口", date="2026-05-15", hs="8466.9300", goods="精密机床零部件", value="¥998,700", cur="USD", status="已放行", err="正常"),
        models.Decl(no="531020250500088", type="出口", date="2026-05-08", hs="8483.4090", goods="减速机总成", value="¥1,455,300", cur="USD", status="已放行", err="差错-已整改"),
    ])
    db.add_all([
        models.Container(no="TCLU7823461", type="40HQ", seal="CN0928471", goods="减速机总成 出口", chk="七点检查完成", photo="是", status="已铅封发运"),
        models.Container(no="MSKU4471902", type="20GP", seal="CN0928455", goods="机床零部件 出口", chk="七点检查完成", photo="是", status="已铅封发运"),
        models.Container(no="CSNU6612084", type="40GP", seal="-", goods="合金钢棒料 进口", chk="到货查验完成", photo="否", status="已拆箱入库"),
        models.Container(no="OOLU1290573", type="40HQ", seal="CN0928490", goods="机床零部件 出口", chk="七点检查-照片缺失", photo="否", status="待复核"),
    ])
    db.add_all([
        models.Finance(y="2021", rate=78.2, rev="4.12亿", profit="3210万", tax="A级"),
        models.Finance(y="2022", rate=74.6, rev="4.55亿", profit="3680万", tax="A级"),
        models.Finance(y="2023", rate=71.3, rev="5.08亿", profit="4120万", tax="A级"),
        models.Finance(y="2024", rate=69.8, rev="5.46亿", profit="4580万", tax="A级"),
        models.Finance(y="2025", rate=66.5, rev="6.02亿", profit="5240万", tax="A级"),
    ])
    db.add_all([
        models.Partner(name="江苏恒强特钢有限公司", type="供应商", role="原材料-合金钢", risk="低", aeo="高级认证", sec="已评估", expire="2027-03"),
        models.Partner(name="东瀛精机株式会社", type="供应商", role="数控系统进口", risk="低", aeo="AEO互认(日本)", sec="已评估", expire="2026-11"),
        models.Partner(name="远洋国际物流（上海）", type="承运/报关代理", role="海运+报关", risk="中", aeo="高级认证", sec="已评估", expire="2026-08"),
        models.Partner(name="德国 PraziTech GmbH", type="客户", role="减速机出口", risk="低", aeo="AEO互认(欧盟)", sec="已评估", expire="2027-01"),
        models.Partner(name="宁波新捷密封件厂", type="供应商", role="橡胶密封件", risk="中", aeo="未认证", sec="待评估", expire="-"),
        models.Partner(name="华南成峰贸易有限公司", type="供应商", role="辅料采购", risk="待定", aeo="未认证", sec="待评估", expire="-"),
    ])
    db.add_all([
        models.DocFile(name="海关事务管理制度", cat="关务制度", ver="V3.2", date="2025-09-01", owner="关务部", keep="长期"),
        models.DocFile(name="进出口单证管理与归档办法", cat="单证管理", ver="V2.1", date="2025-06-15", owner="关务部", keep="3年+"),
        models.DocFile(name="内部审计与合规自查制度", cat="内审制度", ver="V2.0", date="2025-03-10", owner="内审部", keep="长期"),
        models.DocFile(name="贸易安全管理手册", cat="贸易安全", ver="V2.3", date="2025-10-05", owner="安保部", keep="长期"),
        models.DocFile(name="信息系统数据留存与备份策略", cat="信息安全", ver="V1.1", date="2025-05-30", owner="信息部", keep="3年+"),
        models.DocFile(name="突发事件应急预案", cat="贸易安全", ver="V1.0", date="2025-11-18", owner="安保部", keep="长期"),
    ])
    db.add_all([
        models.Training(topic="海关高级认证标准（106号公告）解读", date="2026-03-12", aud="关务/财务/物流", people=38, passrate="100%", status="已完成"),
        models.Training(topic="商品归类与申报要素实务", date="2026-04-09", aud="关务部", people=9, passrate="100%", status="已完成"),
        models.Training(topic="贸易安全与集装箱七点检查", date="2026-04-25", aud="仓储物流/安保", people=22, passrate="95%", status="已完成"),
        models.Training(topic="反走私与合规风险防控", date="2026-06-18", aud="全体进出口相关岗位", people=45, passrate="-", status="计划中"),
    ])
    db.add_all([
        models.Audit(no="IA-2026-01", scope="进出口单证合规专项", date="2026-02", lead="内审部 王敏", find=5, closed=5, status="已结案"),
        models.Audit(no="IA-2026-02", scope="商品归类与完税价格", date="2026-04", lead="内审部 李伟", find=3, closed=1, status="整改中"),
        models.Audit(no="IA-2026-03", scope="贸易安全全链条", date="2026-05", lead="内审部 王敏", find=4, closed=2, status="整改中"),
        models.Audit(no="IA-2026-04", scope="财务状况与数据留存", date="2026-07", lead="内审部 李伟", find=0, closed=0, status="计划中"),
    ])
    db.add_all([
        models.Rectify(code="R-031", src="IA-2026-02", std="1.9 改进机制", issue="2笔出口齿轮归类差错未形成整改闭环", dept="关务部", owner="张磊", due="2026-06-10", step=2, risk="中"),
        models.Rectify(code="R-034", src="IA-2026-03", std="4.5 集装箱安全", issue="OOLU1290573 七点检查照片缺失", dept="仓储物流部", owner="陈强", due="2026-06-05", step=1, risk="中"),
        models.Rectify(code="R-035", src="IA-2026-03", std="4.7 商业伙伴安全", issue="3家新供应商安全评估资料待补齐", dept="采购部", owner="刘洋", due="2026-06-15", step=1, risk="中"),
    ])
    db.commit()


def clear_business(db):
    """清空业务数据，标准状态重置为待评估。"""
    for m in (models.Decl, models.Container, models.Finance, models.Partner,
              models.DocFile, models.Training, models.Audit, models.Rectify):
        db.query(m).delete()
    for s in db.query(models.Standard).all():
        s.status, s.note, s.evidence = "待评估", "", []
    db.commit()
