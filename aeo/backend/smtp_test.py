"""SMTP 连通性诊断：用容器内现有 AEO_SMTP_* 环境变量，逐个端口测试连接+登录。"""
import os, smtplib, ssl, traceback

host = os.environ.get("AEO_SMTP_HOST", "")
user = os.environ.get("AEO_SMTP_USER", "")
pwd  = os.environ.get("AEO_SMTP_PASS", "")
frm  = os.environ.get("AEO_SMTP_FROM", "") or user
print(f"HOST={host!r}  USER={user!r}  FROM={frm!r}  PASS_LEN={len(pwd)}")
print("=" * 60)

def try_ssl(port):
    print(f"\n--- 尝试 SMTP_SSL :{port} ---")
    try:
        s = smtplib.SMTP_SSL(host, port, timeout=20)
        s.set_debuglevel(1)
        s.ehlo()
        s.login(user, pwd)
        print(f"==> 端口 {port} SSL: 登录成功")
        s.quit()
        return True
    except Exception as e:
        print(f"==> 端口 {port} SSL 失败: {type(e).__name__}: {e}")
        return False

def try_starttls(port):
    print(f"\n--- 尝试 STARTTLS :{port} ---")
    try:
        s = smtplib.SMTP(host, port, timeout=20)
        s.set_debuglevel(1)
        s.ehlo()
        s.starttls(context=ssl.create_default_context())
        s.ehlo()
        s.login(user, pwd)
        print(f"==> 端口 {port} STARTTLS: 登录成功")
        s.quit()
        return True
    except Exception as e:
        print(f"==> 端口 {port} STARTTLS 失败: {type(e).__name__}: {e}")
        return False

ok = try_ssl(465) or try_ssl(994) or try_starttls(25) or try_starttls(587)
print("\n" + "=" * 60)
print("结论：", "至少一种方式可登录" if ok else "全部失败 —— 见上面各自报错")
