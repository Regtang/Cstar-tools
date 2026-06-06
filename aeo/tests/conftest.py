"""测试夹具：使用独立临时数据目录，避免污染正式数据库。"""
import os
import sys
import tempfile

# 后端模块加入路径，并指向临时数据目录（必须在 import main 之前设置）
_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, "..", "backend"))
os.environ["AEO_DATA_DIR"] = tempfile.mkdtemp(prefix="aeo_test_")
os.environ["AEO_ADMIN_PASSWORD"] = "admin123"

import pytest
from fastapi.testclient import TestClient
import main


@pytest.fixture(scope="session")
def client():
    return TestClient(main.app)


def _token(client, username, password):
    r = client.post("/api/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_h(client):
    return {"Authorization": "Bearer " + _token(client, "admin", "admin123")}


@pytest.fixture
def hdr(client):
    def make(username, password):
        return {"Authorization": "Bearer " + _token(client, username, password)}
    return make
