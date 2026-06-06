"""把误做的 device-handover 从注册表移除，登记 container-eir（EIR）。容器内运行，幂等。"""
from database import SessionLocal
import models

db = SessionLocal()

# 移除误做的 IT 设备交接单
old = db.query(models.Tool).filter(models.Tool.slug == "device-handover").first()
if old:
    db.delete(old)
    print("removed device-handover")
else:
    print("device-handover not present")

# 登记集装箱 EIR
if db.query(models.Tool).filter(models.Tool.slug == "container-eir").first():
    print("container-eir exists, skip")
else:
    db.add(models.Tool(
        slug="container-eir", name="集装箱设备交接单 EIR", category="物流",
        summary="集装箱进出场/提还空重的电子设备交接单（EIR）：ISO 6346 箱号校验、箱型/铅封/船公司/自重限重、冷箱温控、运输与车队信息、分部位箱况查验、双方电子签名、可打印中英单据与历史台账。",
        owner_dept="仓储物流部", icon="EIR",
        color="linear-gradient(135deg,#0a7d8c,#0a9bbd)", bar="linear-gradient(90deg,#0a7d8c,#0a9bbd)",
        visibility="both", status="online", entry_kind="embed",
        entry_path="/container-eir-app.html?embed=1", sort_order=50))
    print("added container-eir")

db.commit()
print("done")
