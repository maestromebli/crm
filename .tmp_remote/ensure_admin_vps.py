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

ADMIN_EMAIL = "admin@enver.com"
ADMIN_PASSWORD = "Admin123!"
ADMIN_ID = "cmadmin0000000000000000001"
ADMIN_NAME = "ENVER Admin"


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
    p = urlsplit(db_url)
    return urlunsplit((p.scheme, p.netloc, p.path, "", ""))


def sql_scalar(ssh, db_url, sql):
    cmd = f"psql {shlex.quote(db_url)} -tAc {shlex.quote(sql)}"
    code, out, _ = run(ssh, cmd)
    if code != 0:
        return None
    return out.strip()


def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=20, look_for_keys=False, allow_agent=False)
    try:
        sftp = ssh.open_sftp()
        with sftp.open(ENV_PATH, "r") as f:
            env_text = f.read().decode("utf-8", "ignore")
        sftp.close()
        db_url = sanitize_db_url(parse_env(env_text)["DATABASE_URL"])

        users_count = sql_scalar(ssh, db_url, 'select count(*) from "User"')
        print(f"Users count: {users_count}")
        if users_count is None:
            return

        if int(users_count) > 0:
            print("Users already exist. Skip admin bootstrap.")
            return

        hash_cmd = (
            "su - envercom -s /bin/bash -lc "
            + shlex.quote(
                f"cd /home/envercom/public_html && node -e \"const b=require('bcryptjs'); process.stdout.write(b.hashSync('{ADMIN_PASSWORD}', 10));\""
            )
        )
        code, password_hash, _ = run(ssh, hash_cmd)
        if code != 0 or not password_hash.strip():
            print("Failed to generate bcrypt hash")
            return

        insert_sql = (
            'insert into "User" ("id","email","name","passwordHash","role","createdAt","updatedAt") '
            f"values ('{ADMIN_ID}','{ADMIN_EMAIL}','{ADMIN_NAME}','{password_hash.strip()}','SUPER_ADMIN',now(),now())"
        )
        run(ssh, f"psql {shlex.quote(db_url)} -tAc {shlex.quote(insert_sql)}")
        sql_scalar(ssh, db_url, 'select count(*) from "User"')
        sql_scalar(ssh, db_url, 'select count(*) from "User" where role=\'SUPER_ADMIN\'')
    finally:
        ssh.close()


if __name__ == "__main__":
    main()
