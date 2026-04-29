import secrets
import sys
from datetime import datetime

import paramiko

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(errors="ignore")


HOST = "45.94.158.200"
USER = "root"
PASSWORD = "HYb76zUtR9P4iHv29h"

APP_ROOT = "/home/envercom/public_html"
DB_NAME = "envercrm"
DB_USER = "envercrm"
DB_PASSWORD = secrets.token_urlsafe(20)
NEXTAUTH_SECRET = secrets.token_urlsafe(48)


def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        HOST,
        username=USER,
        password=PASSWORD,
        timeout=20,
        look_for_keys=False,
        allow_agent=False,
    )
    return c


def run(client, cmd, check=True):
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode("utf-8", "ignore")
    err = stderr.read().decode("utf-8", "ignore")
    code = stdout.channel.recv_exit_status()
    print(f"\n$ {cmd}\n(exit={code})")
    if out.strip():
        print(out[:12000])
    if err.strip():
        print("ERR:\n" + err[:4000])
    if check and code != 0:
        raise RuntimeError(f"Command failed with exit {code}: {cmd}")
    return code, out, err


def main():
    client = connect()
    try:
        run(client, "whoami && hostname && cat /etc/os-release | head -n 6")

        # 1) Install Node.js 20 + PM2
        run(client, "dnf install -y curl unzip")
        run(client, "curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -")
        run(client, "dnf install -y nodejs")
        run(client, "npm install -g pm2")
        run(client, "node -v && npm -v && pm2 -v")

        # 2) Install and initialize PostgreSQL
        run(client, "dnf install -y postgresql-server postgresql")
        run(
            client,
            "test -f /var/lib/pgsql/data/PG_VERSION || postgresql-setup --initdb",
            check=False,
        )
        run(client, "systemctl enable --now postgresql")
        run(client, "systemctl is-active postgresql")

        # 3) Create DB user/database idempotently
        run(
            client,
            f"su - postgres -c \"psql -tAc \\\"SELECT 1 FROM pg_roles WHERE rolname='{DB_USER}'\\\"\" | grep -q 1 || "
            f"su - postgres -c \"psql -c \\\"CREATE ROLE {DB_USER} LOGIN;\\\"\"",
        )
        run(
            client,
            f"su - postgres -c \"psql -c \\\"ALTER ROLE {DB_USER} WITH PASSWORD '{DB_PASSWORD}';\\\"\"",
        )
        run(
            client,
            f"su - postgres -c \"psql -tAc \\\"SELECT 1 FROM pg_database WHERE datname='{DB_NAME}'\\\"\" | grep -q 1 || "
            f"su - postgres -c \"createdb -O {DB_USER} {DB_NAME}\"",
        )

        # 4) Write production env
        env_content = f"""NODE_ENV=production
PORT=3000
HOSTNAME=127.0.0.1
DATABASE_URL=postgresql://{DB_USER}:{DB_PASSWORD}@127.0.0.1:5432/{DB_NAME}?schema=public
NEXTAUTH_URL=https://enver.com.ua
NEXTAUTH_SECRET={NEXTAUTH_SECRET}
SIGNATURE_PROVIDER=mock
DIIA_WEBHOOK_SECRET={secrets.token_urlsafe(24)}
CLIENT_PORTAL_TOKEN_SECRET={secrets.token_urlsafe(24)}
AUTH_INACTIVITY_TIMEOUT_SECONDS=3600
AUTH_DAILY_REAUTH_SECONDS=86400
NEXT_PUBLIC_AUTH_INACTIVITY_TIMEOUT_SECONDS=3600
NEXT_PUBLIC_AUTH_DAILY_REAUTH_SECONDS=86400
"""
        run(client, "mkdir -p /var/webuzo-data/apache2/custom/domains")
        sftp = client.open_sftp()
        with sftp.file(f"{APP_ROOT}/.env.production", "w") as f:
            f.write(env_content)
        sftp.close()
        run(client, f"chown envercom:envercom {APP_ROOT}/.env.production")
        run(client, f"chmod 640 {APP_ROOT}/.env.production")

        # 5) Remove Passenger directives (unsupported in current Apache build)
        run(
            client,
            f"cp -a {APP_ROOT}/.htaccess {APP_ROOT}/.htaccess.bak.$(date +%s) || true",
            check=False,
        )
        run(client, f"printf '# managed by deployment\\n' > {APP_ROOT}/.htaccess")
        run(client, f"chown envercom:envercom {APP_ROOT}/.htaccess")

        # 6) Configure Apache custom include to proxy domain traffic to Node app
        proxy_conf = """# managed by deployment
ProxyRequests Off
ProxyPreserveHost On
RequestHeader set X-Forwarded-Proto "https" env=HTTPS
RequestHeader set X-Forwarded-For %{REMOTE_ADDR}s
ProxyPass /.well-known !
ProxyPass / http://127.0.0.1:3000/
ProxyPassReverse / http://127.0.0.1:3000/
"""
        sftp = client.open_sftp()
        with sftp.file("/var/webuzo-data/apache2/custom/domains/enver.com.ua.conf", "w") as f:
            f.write(proxy_conf)
        sftp.close()

        # 7) Start app with PM2 under envercom user
        run(
            client,
            "su - envercom -s /bin/bash -lc "
            "\"cd /home/envercom/public_html && "
            "set -a && source .env.production && set +a && "
            "pm2 delete enver-crm >/dev/null 2>&1 || true && "
            "pm2 start server.js --name enver-crm --update-env && pm2 save\"",
        )
        run(client, "su - envercom -s /bin/bash -lc \"pm2 status\"")

        # 8) Apply schema (standalone package usually has no migrations folder)
        run(
            client,
            "su - envercom -s /bin/bash -lc "
            "\"cd /home/envercom/public_html && set -a && source .env.production && set +a && "
            "npx prisma db push --accept-data-loss\"",
        )

        # 9) Reload web stack
        run(client, "systemctl restart httpd", check=False)
        run(client, "/usr/local/apps/apache2/bin/apachectl -k graceful", check=False)
        run(client, "systemctl restart nginx")

        # 10) Smoke checks
        run(client, "curl -I -sS http://127.0.0.1:3000/login", check=False)
        run(client, "curl -I -sS -H 'Host: enver.com.ua' http://45.94.158.200/login", check=False)
        run(client, "curl -k -I -sS -H 'Host: enver.com.ua' https://45.94.158.200/login", check=False)
        run(client, "getent hosts enver.com.ua", check=False)

        # 11) Persist deployment summary on server
        summary = f"""ENVER CRM deployment summary
Timestamp: {datetime.utcnow().isoformat()}Z
App root: {APP_ROOT}
Database: {DB_NAME}
DB user: {DB_USER}
DB password: {DB_PASSWORD}
NEXTAUTH_SECRET: {NEXTAUTH_SECRET}
NOTE: DNS A record for enver.com.ua must point to 45.94.158.200
"""
        sftp = client.open_sftp()
        with sftp.file("/root/enver_crm_deploy_info.txt", "w") as f:
            f.write(summary)
        sftp.close()

        print("\nDEPLOYMENT_COMPLETED")
        print(summary)
    finally:
        client.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"\nDEPLOYMENT_FAILED: {exc}")
        sys.exit(1)
