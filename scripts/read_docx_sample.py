# -*- coding: utf-8 -*-
import os
import re
import zipfile
import sys

base = r"C:\Users\user\Downloads\Telegram Desktop"


def extract_plain(xml: str) -> str:
    text = re.sub(r"<[^>]+>", " ", xml)
    return re.sub(r"\s+", " ", text).strip()


path = os.path.join(base, "Договір зразок.docx")
if not os.path.isfile(path):
    path = ""
    for f in os.listdir(base):
        if not f.endswith(".docx"):
            continue
        fp = os.path.join(base, f)
        try:
            with zipfile.ZipFile(fp) as z:
                xml = z.read("word/document.xml").decode("utf-8")
            t = extract_plain(xml)
            if "ДОГОВІР" in t or "Договір" in t:
                if "зразок" in f.lower() or "зразок" in t.lower() or len(t) > 400:
                    path = fp
                    print("picked:", fp, file=sys.stderr)
                    break
        except OSError:
            continue

if not path or not os.path.isfile(path):
    print("NOT_FOUND", file=sys.stderr)
    sys.exit(1)

with zipfile.ZipFile(path) as z:
    xml = z.read("word/document.xml").decode("utf-8")

out = os.path.join(os.path.dirname(__file__), "..", "tmp_contract_sample_utf8.txt")
out = os.path.abspath(out)
with open(out, "w", encoding="utf-8") as f:
    f.write(extract_plain(xml))
print("WROTE", out)
