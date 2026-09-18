from pathlib import Path

path = Path("Index.html")
text = path.read_text(encoding="utf-8")

old_button = """          <button class="light mini icon-button"
            title="${quote.pdf?'Mở PDF hiện hành':'Chưa có PDF hiện hành'}"
            aria-label="Mở PDF hiện hành"
            onclick="reprintQuote('${esc(quote.no)}')"
            ${quote.pdf?'':'disabled'}>
            🖨️
          </button>
"""

new_button = """          <button class="light mini icon-button"
            title="${quote.pdf?'Mở PDF / In':'Tạo PDF / In'}"
            aria-label="${quote.pdf?'Mở PDF / In':'Tạo PDF / In'}"
            onclick="printQuoteFromHistory('${esc(quote.no)}',${quote.pdf?'true':'false'})">
            🖨️
          </button>
"""

if "printQuoteFromHistory(" not in text:
    if old_button not in text:
        raise SystemExit("Expected history print button not found")
    text = text.replace(old_button, new_button, 1)

anchor = """function openSavedQuotePdf(no){
  const popup=window.open('','_blank');
"""

helper = """function printQuoteFromHistory(no,hasPdf){
  if(hasPdf){
    reprintQuote(no);
    return;
  }

  regenerateQuoteFile(no);
}

"""

if "function printQuoteFromHistory(no,hasPdf)" not in text:
    if anchor not in text:
        raise SystemExit("openSavedQuotePdf anchor not found")
    text = text.replace(anchor, helper + anchor, 1)

# Prevent the action column from becoming unusably narrow.
css_anchor = """.row-actions{display:flex;gap:5px;flex-wrap:wrap;white-space:nowrap}
"""
css_new = """.row-actions{display:flex;gap:5px;flex-wrap:wrap;white-space:nowrap;min-width:360px}
#history th:last-child,#history td:last-child{min-width:360px}
"""
if "#history th:last-child" not in text:
    if css_anchor not in text:
        raise SystemExit("row-actions CSS anchor not found")
    text = text.replace(css_anchor, css_new, 1)

path.write_text(text, encoding="utf-8")
print("Enabled smart print action in quote history and widened action column")
