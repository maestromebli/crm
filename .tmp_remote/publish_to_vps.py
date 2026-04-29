import tarfile
import tempfile
import sys
from pathlib import Path

import paramiko

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(errors="ignore")

HOST = "45.94.158.200"
USER = "root"
PASSWORD = "HYb76zUtR9P4iHv29h"

LOCAL_ROOT = Path("D:/crm")
REMOTE_HOME = "/home/envercom"
REMOTE_APP = "/home/envercom/public_html"
ARCHIVE_NAME = "crm-update.tar.gz"


def build_archive(archive_path: Path) -> None:
    include_paths = [
        ".next",
        "public",
        "prisma",
        "package.json",
        "server.js",
        "prisma.config.ts",
    ]
    def _filter(ti: tarfile.TarInfo) -> tarfile.TarInfo | None:
        name = ti.name.replace("\\", "/")
        if name.startswith(".next/dev/") or name.startswith(".next/cache/"):
            return None
        return ti

    with tarfile.open(archive_path, "w:gz") as tar:
        for rel in include_paths:
            src = LOCAL_ROOT / rel
            if not src.exists():
                continue
            tar.add(src, arcname=rel, filter=_filter)


def run(ssh: paramiko.SSHClient, cmd: str) -> None:
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode("utf-8", "ignore")
    err = stderr.read().decode("utf-8", "ignore")
    code = stdout.channel.recv_exit_status()
    print(f"\n$ {cmd}\n(exit={code})")
    if out.strip():
        print(out[:8000])
    if err.strip():
        print("ERR:\n" + err[:3000])
    if code != 0:
        raise RuntimeError(f"Command failed: {cmd}")


def main() -> None:
    with tempfile.TemporaryDirectory() as td:
        archive_path = Path(td) / ARCHIVE_NAME
        build_archive(archive_path)

        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(
            HOST,
            username=USER,
            password=PASSWORD,
            timeout=20,
            look_for_keys=False,
            allow_agent=False,
        )
        try:
            sftp = ssh.open_sftp()
            remote_archive = f"{REMOTE_HOME}/{ARCHIVE_NAME}"
            sftp.put(str(archive_path), remote_archive)
            sftp.close()

            run(ssh, f"tar -xzf {remote_archive} -C {REMOTE_APP}")
            run(ssh, f"chown -R envercom:envercom {REMOTE_APP}/.next {REMOTE_APP}/public {REMOTE_APP}/prisma {REMOTE_APP}/package.json {REMOTE_APP}/server.js {REMOTE_APP}/prisma.config.ts")
            run(
                ssh,
                "su - envercom -s /bin/bash -lc "
                "\"cd /home/envercom/public_html && pm2 restart enver-crm --update-env && pm2 status\"",
            )
            run(ssh, "curl -I -sS -H 'Host: enver.com.ua' http://45.94.158.200/login")
        finally:
            ssh.close()


if __name__ == "__main__":
    main()
