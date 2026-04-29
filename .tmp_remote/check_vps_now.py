import sys
import paramiko

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(errors="ignore")

HOST = "45.94.158.200"
USER = "root"
PASSWORD = "HYb76zUtR9P4iHv29h"

checks = [
    "hostname",
    "systemctl is-active nginx",
    "systemctl is-active httpd || systemctl is-active apache2 || true",
    "systemctl is-active postgresql",
    "su - envercom -s /bin/bash -lc \"pm2 status\"",
    "ss -lntp | egrep ':80 |:443 |:3000 ' || true",
    "curl -sS -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:3000/login || true",
    "curl -k -sS -o /dev/null -w '%{http_code}\\n' https://127.0.0.1/login || true",
    "su - envercom -s /bin/bash -lc \"pm2 logs enver-crm --lines 60 --nostream\"",
]

s = paramiko.SSHClient()
s.set_missing_host_key_policy(paramiko.AutoAddPolicy())
s.connect(HOST, username=USER, password=PASSWORD, timeout=20, look_for_keys=False, allow_agent=False)
try:
    for cmd in checks:
        i, o, e = s.exec_command(cmd, timeout=60)
        out = o.read().decode("utf-8", "ignore")
        err = e.read().decode("utf-8", "ignore")
        code = o.channel.recv_exit_status()
        print(f"\n$ {cmd}\n(exit={code})")
        if out.strip():
            print(out[:12000])
        if err.strip():
            print("ERR:\n" + err[:6000])
finally:
    s.close()
