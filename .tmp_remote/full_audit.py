import sys
import paramiko

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(errors="ignore")

HOST = "45.94.158.200"
USER = "root"
PASSWORD = "HYb76zUtR9P4iHv29h"


def run(client, cmd):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=40)
    out = stdout.read().decode("utf-8", "ignore")
    err = stderr.read().decode("utf-8", "ignore")
    code = stdout.channel.recv_exit_status()
    print(f"\n$ {cmd}\n(exit={code})")
    if out.strip():
        print(out[:12000], flush=True)
    if err.strip():
        print("ERR:\n" + err[:6000], flush=True)
    return code, out, err


def main():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASSWORD, timeout=20, look_for_keys=False, allow_agent=False)
    try:
        checks = [
            "hostname",
            "systemctl is-active nginx",
            "systemctl is-active postgresql",
            "su - envercom -s /bin/bash -lc \"pm2 status\"",
            "curl -k -sS -o /dev/null -w '%{http_code}\\n' https://enver.com.ua/login",
            "curl -k -sS -o /dev/null -w '%{http_code}\\n' https://enver.com.ua/terms",
            "curl -k -sS -o /dev/null -w '%{http_code}\\n' https://enver.com.ua/privacy",
            "curl -k -sS -o /dev/null -w '%{http_code}\\n' https://enver.com.ua/api/auth/providers",
            "curl -k -sS -o /dev/null -w '%{http_code}\\n' https://enver.com.ua/api/auth/session",
            "su - envercom -s /bin/bash -lc \"set -a; . /home/envercom/public_html/.env.production; set +a; psql \\\"$DATABASE_URL\\\" -tAc \\\"select current_database(), current_user\\\"\"",
            "su - envercom -s /bin/bash -lc \"set -a; . /home/envercom/public_html/.env.production; set +a; psql \\\"$DATABASE_URL\\\" -tAc \\\"select count(*) from information_schema.tables where table_schema='public'\\\"\"",
            "su - envercom -s /bin/bash -lc \"set -a; . /home/envercom/public_html/.env.production; set +a; psql \\\"$DATABASE_URL\\\" -tAc \\\"select count(*) from \\\"\\\"User\\\"\\\"\\\"\"",
            "su - envercom -s /bin/bash -lc \"set -a; . /home/envercom/public_html/.env.production; set +a; psql \\\"$DATABASE_URL\\\" -tAc \\\"select count(*) from pg_constraint where contype='f' and not convalidated\\\"\"",
            "su - envercom -s /bin/bash -lc \"set -a; . /home/envercom/public_html/.env.production; set +a; psql \\\"$DATABASE_URL\\\" -tAc \\\"select count(*) from \\\"\\\"User\\\"\\\" where role='ADMIN'\\\"\"",
            "su - envercom -s /bin/bash -lc \"pm2 describe enver-crm\"",
        ]
        for cmd in checks:
            try:
                run(c, cmd)
            except Exception as exc:
                print(f"ERROR while running command: {cmd}\n{exc}", flush=True)
    finally:
        c.close()


if __name__ == "__main__":
    main()
