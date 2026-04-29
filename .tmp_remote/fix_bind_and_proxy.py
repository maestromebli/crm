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
            "sed -i 's/^HOSTNAME=.*/HOSTNAME=0.0.0.0/' /home/envercom/public_html/.env.production",
        )
        run(
            c,
            "sed -i 's#ProxyPass / http://127.0.0.1:3000/#ProxyPass / http://45.94.158.200:3000/#; "
            "s#ProxyPassReverse / http://127.0.0.1:3000/#ProxyPassReverse / http://45.94.158.200:3000/#' "
            "/var/webuzo-data/apache2/custom/domains/enver.com.ua.conf",
        )
        run(
            c,
            "su - envercom -s /bin/bash -lc \"pm2 restart enver-crm --update-env && pm2 status\"",
        )
        run(c, "systemctl restart httpd", check=False)
        run(c, "/usr/local/apps/apache2/bin/apachectl -k graceful", check=False)
        run(c, "systemctl restart nginx", check=False)
        run(c, "curl -I -sS http://45.94.158.200:3000/login", check=False)
        run(c, "curl -I -sS -H 'Host: enver.com.ua' http://45.94.158.200/login", check=False)
        run(c, "curl -k -I -sS -H 'Host: enver.com.ua' https://45.94.158.200/login", check=False)
    finally:
        c.close()


if __name__ == "__main__":
    main()
