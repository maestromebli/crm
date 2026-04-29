import sys
import paramiko

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(errors="ignore")

HOST = "45.94.158.200"
USER = "root"
PASSWORD = "HYb76zUtR9P4iHv29h"


def run(client, cmd, check=True):
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode("utf-8", "ignore")
    err = stderr.read().decode("utf-8", "ignore")
    code = stdout.channel.recv_exit_status()
    print(f"\n$ {cmd}\n(exit={code})")
    if out.strip():
        print(out[:12000])
    if err.strip():
        print("ERR:\n" + err[:6000])
    if check and code != 0:
        raise RuntimeError(f"Command failed with exit {code}: {cmd}")


def main():
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
    try:
        run(
            c,
            "su - envercom -s /bin/bash -lc "
            "\"cd /home/envercom/public_html && npm install styled-jsx @prisma/client prisma@7.5.0 --no-save\"",
        )
        run(
            c,
            "su - envercom -s /bin/bash -lc "
            "\"cd /home/envercom/public_html && set -a && source .env.production && set +a && npx prisma generate\"",
        )
        run(
            c,
            "su - envercom -s /bin/bash -lc \"pm2 restart enver-crm --update-env && pm2 status\"",
        )
        run(c, "curl -I -sS http://127.0.0.1:3000/login", check=False)
        run(c, "curl -I -sS -H 'Host: enver.com.ua' http://45.94.158.200/login", check=False)
        run(c, "curl -k -I -sS -H 'Host: enver.com.ua' https://45.94.158.200/login", check=False)
    finally:
        c.close()


if __name__ == "__main__":
    main()
