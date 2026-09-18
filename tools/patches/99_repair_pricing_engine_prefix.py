from pathlib import Path
import re

path = Path("Index.html")
text = path.read_text(encoding="utf-8")

patterns = [
    "resolveItemTax",
    "calculateItem",
    "normalizeMode",
    "modeLabel",
    "modeInfo",
]

for name in patterns:
    text = re.sub(
        rf'(?:PRICING_ENGINE\.)+{name}\(',
        f'PRICING_ENGINE.{name}(',
        text
    )

path.write_text(text, encoding="utf-8")
print("Final pricing facade repair applied after all earlier patches")
