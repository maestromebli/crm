import sys
import paramiko

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(errors="ignore")

HOST = "45.94.158.200"
USER = "root"
PASSWORD = "HYb76zUtR9P4iHv29h"

CMDS = [
    "curl -I -sS -H 'Host: enver.com.ua' http://127.0.0.1:8081/login",
    "curl -k -I -sS -H 'Host: enver.com.ua' https://127.0.0.1:8082/login",
    "curl -I -sS -H 'Host: enver.com.ua' http://45.94.158.200/login",
    "curl -k -I -sS -H 'Host: enver.com.ua' https://45.94.158.200/login",
]


def main():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASSWORD, timeout=20, look_for_keys=False, allow_agent=False)
    for cmd in CMDS:
        stdin, stdout, stderr = c.exec_command(cmd)
        out = stdout.read().decode("utf-8", "ignore")
        err = stderr.read().decode("utf-8", "ignore")
        code = stdout.channel.recv_exit_status()
        print(f"\n$ {cmd}\n(exit={code})\n{out}")
        if err.strip():
            print("ERR:\n" + err)
    c.close()


if __name__ == "__main__":
    main()
