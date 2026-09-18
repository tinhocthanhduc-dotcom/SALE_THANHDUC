from pathlib import Path
import re

path = Path("Index.html")
text = path.read_text(encoding="utf-8")

# Repair accidental repeated facade prefixes introduced by an older non-idempotent patch.
text = re.sub(
    r'(?:PRICING_ENGINE\.)+resolveItemTax\(',
    'PRICING_ENGINE.resolveItemTax(',
    text
)
text = re.sub(
    r'(?:PRICING_ENGINE\.)+calculateItem\(',
    'PRICING_ENGINE.calculateItem(',
    text
)
text = re.sub(
    r'(?:PRICING_ENGINE\.)+normalizeMode\(',
    'PRICING_ENGINE.normalizeMode(',
    text
)
text = re.sub(
    r'(?:PRICING_ENGINE\.)+modeLabel\(',
    'PRICING_ENGINE.modeLabel(',
    text
)

path.write_text(text, encoding="utf-8")
print("Repaired repeated frontend pricing-engine facade prefixes")
