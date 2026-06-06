"""喜事达AEO认证管理平台 —— 端到端 API 测试。

运行：  cd xishida-aeo && python -m pytest -q
"""


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_login_bad_password(client):
    assert client.post("/api/login", json={"username": "admin", "password": "x"}).status_code == 401


def test_login_and_me(client, admin_h):
    me = client.get("/api/me", headers=admin_h).json()
    assert me["isAdmin"] and me["role"] == "admin"


def test_unauthenticated_blocked(client):
    assert client.get("/api/standards").status_code == 401


def test_standards_seeded(client, admin_h):
    st = client.get("/api/standards", headers=admin_h).json()
    assert len(st) == 32
    assert all(s["status"] == "待评估" for s in st)


def test_dashboard_initial(client, admin_h):
    d = client.get("/api/dashboard", headers=admin_h).json()
    assert d["total"] == 32 and d["pending"] == 32 and d["pass"] is False


def test_load_sample_and_aggregate(client, admin_h):
    assert client.post("/api/admin/load-sample", headers=admin_h).status_code == 200
    d = client.get("/api/dashboard", headers=admin_h).json()
    assert d["counts"]["decls"] == 6
    assert d["mid"] == 5 and d["bad"] == 0 and d["pending"] == 0
    assert d["pass"] is False               # 基本达标 5 > 3
    # 重复装载应被拒绝
    assert client.post("/api/admin/load-sample", headers=admin_h).status_code == 400


def test_rbac_finance(client, hdr):
    fh = hdr("caiwu", "123456")
    # 财务角色不能写关务
    assert client.post("/api/decls", headers=fh, json={"no": "X", "type": "出口"}).status_code == 403
    # 但能写财务
    r = client.post("/api/finance", headers=fh,
                    json={"y": "2099", "rate": 50.0, "rev": "1亿", "profit": "1000万", "tax": "A级"})
    assert r.status_code == 200
    # 不能访问管理员接口
    assert client.get("/api/users", headers=fh).status_code == 403
    assert client.get("/api/logs", headers=fh).status_code == 403


def test_customs_crud_cycle(client, hdr):
    ch = hdr("guanwu", "123456")
    r = client.post("/api/decls", headers=ch, json={"no": "TEST999", "type": "进口", "goods": "测试件"})
    assert r.status_code == 200
    nid = r.json()["id"]
    r = client.put(f"/api/decls/{nid}", headers=ch, json={"status": "已放行"})
    assert r.status_code == 200 and r.json()["status"] == "已放行"
    assert client.delete(f"/api/decls/{nid}", headers=ch).status_code == 200
    assert client.delete(f"/api/decls/{nid}", headers=ch).status_code == 404


def test_standard_json_evidence(client, hdr):
    ch = hdr("guanwu", "123456")
    sid = client.get("/api/standards", headers=ch).json()[0]["id"]
    r = client.put(f"/api/standards/{sid}", headers=ch,
                   json={"status": "达标", "evidence": ["材料A", "材料B"]})
    assert r.status_code == 200 and r.json()["evidence"] == ["材料A", "材料B"]


def test_rectify_advance(client, hdr):
    ch = hdr("guanwu", "123456")
    rects = client.get("/api/rectify", headers=ch).json()
    rid = next(r["id"] for r in rects if r["step"] < 3)
    before = next(r["step"] for r in rects if r["id"] == rid)
    r = client.post(f"/api/rectify/{rid}/advance", headers=ch)
    assert r.status_code == 200 and r.json()["step"] == min(3, before + 1)


def test_user_management(client, admin_h, hdr):
    r = client.post("/api/users", headers=admin_h,
                    json={"username": "tester", "password": "123456", "name": "测试员", "role": "logistics"})
    assert r.status_code == 200
    # 新用户可登录
    assert hdr("tester", "123456")
    # 重名拦截
    assert client.post("/api/users", headers=admin_h,
                       json={"username": "tester", "password": "1"}).status_code == 400
    # 默认 admin 不可删
    admin_id = next(u["id"] for u in client.get("/api/users", headers=admin_h).json() if u["username"] == "admin")
    assert client.delete(f"/api/users/{admin_id}", headers=admin_h).status_code == 400


def test_change_password(client, admin_h):
    # 改密码后旧密码失效、新密码生效；再改回，保证其它测试不受影响
    assert client.post("/api/me/password", headers=admin_h,
                       json={"old": "admin123", "new": "tmpPass1"}).status_code == 200
    assert client.post("/api/login", json={"username": "admin", "password": "admin123"}).status_code == 401
    r = client.post("/api/login", json={"username": "admin", "password": "tmpPass1"})
    assert r.status_code == 200
    h2 = {"Authorization": "Bearer " + r.json()["token"]}
    assert client.post("/api/me/password", headers=h2,
                       json={"old": "tmpPass1", "new": "admin123"}).status_code == 200


def test_logs_recorded(client, admin_h):
    logs = client.get("/api/logs", headers=admin_h).json()
    assert len(logs) > 0
    assert any(l["action"] == "登录" for l in logs)


def test_frontend_served(client):
    assert client.get("/").status_code == 200
    assert client.get("/app.js").status_code == 200
    assert client.get("/styles.css").status_code == 200


def test_clear_business(client, admin_h):
    assert client.post("/api/admin/clear", headers=admin_h).status_code == 200
    d = client.get("/api/dashboard", headers=admin_h).json()
    assert d["counts"]["decls"] == 0 and d["pending"] == 32
