"""数据库连接与会话（SQLite + SQLAlchemy）。"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# 数据目录：默认在 backend/ 下，可用环境变量 AEO_DATA_DIR 覆盖（便于部署/测试）
DATA_DIR = os.environ.get("AEO_DATA_DIR", os.path.dirname(os.path.abspath(__file__)))
os.makedirs(DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DIR, "aeo.db")
ENGINE = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
    future=True,
)
SessionLocal = sessionmaker(bind=ENGINE, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


def get_db():
    """FastAPI 依赖：每个请求一个数据库会话。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
