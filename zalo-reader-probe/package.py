"""Deterministic allowlist package: never include a profile or user messages."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
from hashlib import sha256
root = Path(__file__).resolve().parent
output = root / 'ThanhDuc-Zalo-DocThu-v0.6.zip'
files = [(root/'extension'/name,name) for name in ['manifest.json','core.js','content.js','popup.html','popup.css','popup.js','viewer.html','viewer.css','viewer.js']]
files += [(root/name,name) for name in ['HUONG_DAN.html','README.md','VERIFICATION.json']]
with ZipFile(output,'w',ZIP_DEFLATED) as z:
    for source, name in files:
        info=ZipInfo(name,date_time=(2026,10,18,0,0,0))
        info.compress_type=ZIP_DEFLATED
        info.external_attr=0o100644 << 16
        z.writestr(info,source.read_bytes())
(root/'SHA256SUMS').write_text(sha256(output.read_bytes()).hexdigest()+'  '+output.name+'\n')
print(output.name)
