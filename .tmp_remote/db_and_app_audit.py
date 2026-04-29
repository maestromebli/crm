import sys
import shlex
import paramiko

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


def psql_cmd(database_url, sql):
    db = shlex.quote(database_url)
    q = sql.replace('"', '\\"')
    return f'su - envercom -s /bin/bash -lc "psql {db} -tAc \\"{q}\\""'


def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=20, look_for_keys=False, allow_agent=False)
    try:
        sftp = ssh.open_sftp()
        with sftp.open(ENV_PATH, "r") as f:
            env_text = f.read().decode("utf-8", "ignore")
        sftp.close()
        env = parse_env(env_text)
        database_url = env.get("DATABASE_URL")
        if not database_url:
            print("DATABASE_URL not found in .env.production")
            return

        sql_checks = [
            "select current_database(), current_user",
            "select count(*) from information_schema.tables where table_schema='public'",
            'select count(*) from "User"',
            'select count(*) from "User" where role=\'ADMIN\'',
            "select count(*) from pg_constraint where contype='f' and not convalidated",
            "select count(*) from pg_constraint where contype='f'",
            "select count(*) from pg_stat_activity where datname=current_database()",
        ]

        for sql in sql_checks:
            run(ssh, psql_cmd(database_url, sql))

        run(ssh, "su - envercom -s /bin/bash -lc \"pm2 logs enver-crm --lines 60 --nostream\"")
        run(ssh, "cat /etc/resolv.conf")
        run(ssh, "getent hosts enver.com.ua")
    finally:
        ssh.close()


if __name__ == "__main__":
    main()
