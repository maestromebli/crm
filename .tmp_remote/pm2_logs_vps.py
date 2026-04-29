import paramiko

HOST = "45.94.158.200"
USER = "root"
PASSWORD = "HYb76zUtR9P4iHv29h"

s = paramiko.SSHClient()
s.set_missing_host_key_policy(paramiko.AutoAddPolicy())
s.connect(HOST, username=USER, password=PASSWORD, timeout=20, look_for_keys=False, allow_agent=False)
try:
    cmd = 'su - envercom -s /bin/bash -lc "pm2 logs enver-crm --lines 60 --nostream"'
    _, stdout, stderr = s.exec_command(cmd, timeout=60)
    out = stdout.read().decode("utf-8", "ignore")
    err = stderr.read().decode("utf-8", "ignore")
    code = stdout.channel.recv_exit_status()
    print(f"exit={code}")
    print(out)
    if err.strip():
        print("ERR:")
        print(err)
finally:
    s.close()
