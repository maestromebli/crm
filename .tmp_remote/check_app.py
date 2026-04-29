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
        print(out[:15000])
    if err.strip():
        print("ERR:\n" + err[:6000])


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
        run(c, "curl -I -sS http://127.0.0.1:3000/login")
        run(c, "curl -sS http://127.0.0.1:3000/login | head -n 20")
        run(c, "ss -tulpen | head -n 60")
        run(c, "su - envercom -s /bin/bash -lc \"pm2 status\"")
        run(c, "su - envercom -s /bin/bash -lc \"pm2 logs enver-crm --lines 120 --nostream\"")
    finally:
        c.close()


if __name__ == "__main__":
    main()
