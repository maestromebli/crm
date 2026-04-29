import sys
import shlex
import paramiko
from urllib.parse import urlsplit, urlunsplit

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(errors="ignore")

HOST = "45.94.158.200"
USER = "root"
PASSWORD = "HYb76zUtR9P4iHv29h"
ENV_PATH = "/home/envercom/public_html/.env.production"


def run(ssh, cmd, timeout=40):
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "ignore").strip()
    err = stderr.read().decode("utf-8", "ignore").strip()
    code = stdout.channel.recv_exit_status()
    print(f"\n$ {cmd}\n(exit={code})")
    if out:
        print(out)
    if err:
        print("ERR:\n" + err)
    return code, out, err


def parse_env(text):
    env = {}
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    return env


def sanitize_db_url(db_url):
    parsed = urlsplit(db_url)
    # psql does not understand Prisma query params like ?schema=public
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))


def psql_cmd(database_url, sql):
    db = shlex.quote(database_url)
    query = shlex.quote(sql)
    return f"psql {db} -tAc {query}"


def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=20, look_for_keys=False, allow_agent=False)
    try:
        # Fix resolver order for stable public DNS answers on the VPS.
        run(ssh, "cp -f /etc/resolv.conf /etc/resolv.conf.bak.crm || true")
        run(ssh, "printf 'nameserver 1.1.1.1\\nnameserver 8.8.8.8\\n' > /etc/resolv.conf")
        run(ssh, "getent hosts enver.com.ua")

        sftp = ssh.open_sftp()
        with sftp.open(ENV_PATH, "r") as f:
            env_text = f.read().decode("utf-8", "ignore")
        sftp.close()
        env = parse_env(env_text)
        database_url = env.get("DATABASE_URL")
        if not database_url:
            print("DATABASE_URL not found in .env.production")
            return
        database_url = sanitize_db_url(database_url)

        db_checks = [
            "select current_database(), current_user",
            "select count(*) from information_schema.tables where table_schema='public'",
            "select count(*) from pg_constraint where contype='f'",
            "select count(*) from pg_constraint where contype='f' and not convalidated",
            'select count(*) from "User"',
            'select count(*) from "User" where role=\'ADMIN\'',
            "select count(*) from pg_stat_activity where datname=current_database()",
        ]
        for sql in db_checks:
            run(ssh, psql_cmd(database_url, sql))

        run(ssh, "su - envercom -s /bin/bash -lc \"pm2 flush enver-crm\"")
        runtime_checks = [
            "curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/login",
            "curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/health",
            "curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/auth/providers",
            "curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/admin/impersonation-targets",
            "curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/settings/users",
        ]
        for cmd in runtime_checks:
            run(ssh, cmd)

        run(ssh, "su - envercom -s /bin/bash -lc \"pm2 logs enver-crm --lines 80 --nostream\"")
    finally:
        ssh.close()


if __name__ == "__main__":
    main()
