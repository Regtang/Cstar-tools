"""在已存在的数据库中创建/重置「工具平台独立管理员」账号（容器内运行，幂等）。
账号：pmadmin　角色：platform（仅管平台，看不到 AEO 合规数据）
默认密码：Cstar@2026 —— 登录 admin.html 后请用「改密码」立即修改。"""
from database import SessionLocal
import models
from auth import hash_pw

db = SessionLocal()
u = db.query(models.User).filter(models.User.username == "pmadmin").first()
if u:
    u.role = "platform"
    print("pmadmin 已存在：角色确认为 platform（未改密码）")
else:
    db.add(models.User(username="pmadmin", password=hash_pw("Cstar@2026"),
                       name="平台管理员", role="platform", dept="工具平台"))
    print("已创建 pmadmin（默认密码 Cstar@2026，请尽快改密码）")
db.commit()
print("done")
