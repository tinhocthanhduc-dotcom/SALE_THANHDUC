from pathlib import Path

path = Path("code.js")
text = path.read_text(encoding="utf-8")

marker = "/* TD_PRINT_V3 */"

if marker in text:
    print("TD_PRINT_V3 already applied")
    raise SystemExit(0)

quote_start = text.find("function buildQuoteA4Html_(")
quote_end = text.find("function generateQuotePdf_", quote_start)
if quote_start < 0 or quote_end < 0:
    raise SystemExit("Quote renderer not found")

block = text[quote_start:quote_end]

anchor = """    '/* TD_PRINT_V2 */',
"""

if anchor not in block:
    raise SystemExit("TD_PRINT_V2 anchor not found in quote renderer")

v3 = """    '/* TD_PRINT_V3 */',
    'body{width:190mm;margin:0 auto;background:#fff;}',
    '.sheet{position:relative;padding-top:2mm;}',
    '.sheet::before{content:\\'\\';display:block;height:2mm;margin:0 0 5mm;background:linear-gradient(90deg,#bb2a2c 0 48%,#2263a8 48% 100%);}',
    '.company-header{border:0!important;margin-bottom:3mm!important;}',
    '.company-header td{padding-bottom:2mm!important;}',
    '.logo-cell{width:28mm!important;}',
    '.logo{width:22mm!important;max-height:22mm!important;}',
    '.company-name{font-size:12.8pt!important;color:#bb2a2c!important;margin-bottom:1.2mm!important;text-transform:uppercase;letter-spacing:.35px!important;}',
    '.company-line{font-size:8.1pt!important;line-height:1.2!important;margin:.35mm 0!important;color:#4b5563!important;}',
    '.quote-title{display:flex;align-items:flex-end;justify-content:space-between;text-align:left!important;margin:0 0 4mm!important;padding:3mm 0 2mm;border-top:.35mm solid #d7dde5;border-bottom:.7mm solid #161a22;}',
    '.quote-title h1{font-size:19pt!important;margin:0!important;color:#161a22!important;letter-spacing:.8px!important;}',
    '.quote-title p{margin:0 0 .8mm!important;font-size:8.4pt!important;color:#6b7280!important;}',
    '.meta-strip{display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:0!important;padding:0!important;margin:0 0 3mm!important;border:0!important;border-radius:0!important;background:#fff!important;border-bottom:.3mm solid #d9dee5!important;}',
    '.meta-item{text-align:left!important;padding:1.8mm 2.2mm!important;font-size:8.2pt!important;border-right:.25mm solid #e5e7eb;color:#6b7280!important;}',
    '.meta-item:last-child{border-right:0!important;}',
    '.meta-item strong{display:block;margin-bottom:.4mm;font-size:7.2pt;text-transform:uppercase;letter-spacing:.45px;color:#8a93a1!important;}',
    '.customer-card{border:0!important;border-radius:0!important;margin-bottom:4mm!important;}',
    '.info-grid{display:grid!important;grid-template-columns:1fr 1fr!important;border-top:.35mm solid #161a22;border-bottom:.25mm solid #d9dee5;}',
    '.info-row{grid-template-columns:25mm minmax(0,1fr)!important;min-height:8.6mm!important;border:0!important;border-bottom:.2mm solid #e8ebef!important;}',
    '.info-row:nth-child(odd){border-right:.25mm solid #e8ebef!important;}',
    '.info-wide{grid-column:1/-1!important;border-right:0!important;}',
    '.info-label{padding:1.4mm 1.8mm!important;background:#fff!important;border:0!important;font-size:7.6pt!important;font-weight:600!important;color:#7b8491!important;text-transform:uppercase;letter-spacing:.25px;}',
    '.info-value{padding:1.4mm 1.8mm!important;font-size:8.8pt!important;color:#161a22!important;}',
    '.info-strong{font-weight:700!important;}',
    '.items{border:0!important;border-radius:0!important;margin-bottom:3mm!important;}',
    '.items th,.items td{border-right:0!important;border-bottom:.22mm solid #e1e5ea!important;}',
    '.items th{padding:1.9mm 1.4mm!important;background:#eef3f9!important;color:#161a22!important;border-top:.65mm solid #161a22!important;border-bottom:.35mm solid #b8c9db!important;font-size:7.7pt!important;text-transform:uppercase;letter-spacing:.3px;}',
    '.items td{padding:2.2mm 1.4mm!important;font-size:8.5pt!important;color:#161a22!important;}',
    '.items tbody tr:nth-child(even){background:#fff!important;}',
    '.items .product{font-weight:600!important;}',
    '.th-note{color:#748091!important;font-size:6.8pt!important;text-transform:none!important;letter-spacing:0!important;}',
    '.totals-wrap{margin-top:1mm!important;}',
    '.totals{width:80mm!important;border:0!important;border-radius:0!important;}',
    '.totals td{padding:1.8mm 0 1.8mm 3mm!important;border:0!important;border-bottom:.2mm solid #e3e6eb!important;font-size:8.6pt!important;}',
    '.totals .label{background:#fff!important;color:#5f6875!important;}',
    '.totals .value{font-weight:700!important;color:#161a22!important;}',
    '.totals .grand td{padding-top:2.3mm!important;border-top:.65mm solid #161a22!important;border-bottom:0!important;background:#fff!important;color:#1a4f87!important;font-size:11.2pt!important;}',
    '.totals .grand .label{font-size:8pt!important;color:#161a22!important;text-transform:uppercase;letter-spacing:.5px;}',
    '.amount-words{margin:3mm 0!important;padding:2mm 2.4mm!important;border:0!important;border-left:1.2mm solid #2263a8!important;background:#f6f8fb!important;color:#161a22!important;}',
    '.notes{margin-top:2mm!important;padding:2.4mm 2.8mm!important;border:.25mm solid #e2e6eb!important;border-radius:0!important;background:#fff!important;}',
    '.notes h3{font-size:8pt!important;text-transform:uppercase;letter-spacing:.5px;color:#161a22!important;}',
    '.notes li{font-size:8pt!important;color:#4b5563!important;}',
    '.signatures{margin-top:5mm!important;border-top:.25mm solid #e0e4e9;}',
    '.signatures td{padding-top:3mm!important;color:#6b7280!important;}',
    '.signatures strong{color:#161a22!important;font-size:8.7pt!important;}',
    '.footer{margin-top:1mm!important;color:#9aa2ad!important;border-top:0!important;}',
"""

block = block.replace(anchor, v3 + anchor, 1)
text = text[:quote_start] + block + text[quote_end:]

path.write_text(text, encoding="utf-8")
print("Applied visibly redesigned quote print template TD_PRINT_V3")
