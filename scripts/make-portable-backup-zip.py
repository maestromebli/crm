"""
Portable project backup: UTF-8 paths, excludes node_modules / build caches.
Run from repo root: python scripts/make-portable-backup-zip.py
Output: D:\\crm-backup-YYYY-MM-DD_HHMMSS-portable.zip
"""
from __future__ import annotations

import os
import sys
import zipfile
from datetime import datetime
from pathlib import Path

# Project root = parent of scripts/
ROOT = Path(__file__).resolve().parent.parent

EXCLUDE_DIR_NAMES = frozenset(
    {
        "node_modules",
        ".next",
        ".turbo",
        "dist",
        "coverage",
        ".cache",
        "test-results",
        "playwright-report",
        ".git",
    }
)


def excluded_relative(rel: Path) -> bool:
    parts = rel.parts
    if any(p in EXCLUDE_DIR_NAMES for p in parts):
        return True
    if rel.name.endswith(".tsbuildinfo"):
        return True
    return False


def main() -> int:
    stamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    out = Path(f"D:/crm-backup-{stamp}-portable.zip")
    count = 0
    with zipfile.ZipFile(
        out,
        "w",
        zipfile.ZIP_DEFLATED,
        compresslevel=6,
        strict_timestamps=False,
    ) as zf:
        for dirpath, dirnames, filenames in os.walk(ROOT, topdown=True):
            dpath = Path(dirpath)
            try:
                rel_dir = dpath.relative_to(ROOT)
            except ValueError:
                continue
            if excluded_relative(rel_dir):
                dirnames[:] = []
                continue
            dirnames[:] = [
                d for d in dirnames if not excluded_relative(rel_dir / d)
            ]
            for name in filenames:
                fp = dpath / name
                try:
                    rel = fp.relative_to(ROOT)
                except ValueError:
                    continue
                if excluded_relative(rel):
                    continue
                zf.write(fp, arcname=rel.as_posix(), compress_type=zipfile.ZIP_DEFLATED)
                count += 1
    size_mb = out.stat().st_size / (1024 * 1024)
    print(f"OK: {out}")
    print(f"Files: {count}, size: {size_mb:.2f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
