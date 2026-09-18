from pathlib import Path
import re

path = Path("Index.html")
text = path.read_text(encoding="utf-8")

# Final runtime hotfix: calculateItemPricing must call the local resolver directly.
# This removes any dependency on a nested PRICING_ENGINE property chain.
text = re.sub(
    r"const tax=(?:PRICING_ENGINE\.)+resolveItemTax\(\s*item,\s*taxMode\s*\);",
    "const tax=resolveItemTax(\n    item,\n    taxMode\n  );",
    text,
    count=1
)

marker = "TD_SALES_BUILD_20260918_0905"
if marker not in text:
    text = text.replace(
        "<script>",
        "<script>\nconst TD_SALES_BUILD_20260918_0905=true;",
        1
    )

path.write_text(text, encoding="utf-8")
print("Applied final runtime pricing hotfix and build marker")
