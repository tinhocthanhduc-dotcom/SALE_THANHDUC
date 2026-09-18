from pathlib import Path

path = Path("code.js")
text = path.read_text(encoding="utf-8")

old = """  if (!blob) {
    return (
      'data:image/svg+xml;charset=UTF-8,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>'
      )
    );
  }
"""

new = """  if (!blob) {
    return 'https://thanhduc.vn/wp-content/uploads/2018/11/1111-300x114.png';
  }
"""

if "1111-300x114.png" not in text:
    if old not in text:
        raise SystemExit("Expected empty-logo fallback not found")
    text = text.replace(old, new, 1)

text = text.replace(
    "'height:27mm;',\n    'object-fit:contain;',",
    "'height:auto;',\n    'max-height:27mm;',\n    'object-fit:contain;',",
    1
)

text = text.replace(
    "'.logo{display:block;width:25mm;max-height:25mm;margin:0 auto;object-fit:contain;}',",
    "'.logo{display:block;width:25mm;height:auto;max-height:25mm;margin:0 auto;object-fit:contain;}',",
    1
)

path.write_text(text, encoding="utf-8")
print("Added public website logo fallback for print/PDF output")
