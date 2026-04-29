import sys
import paramiko

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(errors="ignore")

HOST = "45.94.158.200"
USER = "root"
PASSWORD = "HYb76zUtR9P4iHv29h"


def run(client, cmd):
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode("utf-8", "ignore")
    err = stderr.read().decode("utf-8", "ignore")
    code = stdout.channel.recv_exit_status()
    print(f"\n$ {cmd}\n(exit={code})")
    if out.strip():
        print(out[:12000])
    if err.strip():
        print("ERR:\n" + err[:4000])


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
        run(c, "cat /home/envercom/public_html/.env.production")
        run(c, "cat /var/webuzo-data/apache2/custom/domains/enver.com.ua.conf")
        run(c, "su - envercom -s /bin/bash -lc \"pm2 status\"")
        run(c, "curl -I -sS -H 'Host: enver.com.ua' http://45.94.158.200/login")
        run(c, "getent hosts enver.com.ua")
    finally:
        c.close()


if __name__ == "__main__":
    main()
