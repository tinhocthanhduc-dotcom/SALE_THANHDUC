from pathlib import Path
import base64, zlib

INDEX = Path("Index.html")
CODE = Path("code.js")
MARKER = "TD_UX_UI_V2"

PREFIX_B64 = """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"""

html = INDEX.read_text(encoding="utf-8")

if MARKER not in html:
    prefix = zlib.decompress(
        base64.b64decode(PREFIX_B64)
    ).decode("utf-8")

    script_pos = html.find("<script>")
    if script_pos < 0:
        raise SystemExit("Index.html missing <script>")

    script_and_tail = html[script_pos:]

    # Cosmetic-only JS labels requested by the design package.
    script_and_tail = script_and_tail.replace(
        ">\n            🖨️\n          </button>",
        ">\n            In\n          </button>"
    ).replace(
        ">\n            🗑️\n          </button>",
        ">\n            Xóa\n          </button>"
    )

    html = prefix + script_and_tail
    INDEX.write_text(html, encoding="utf-8")
    print("Applied TD_UX_UI_V2 to Index.html")
else:
    print("TD_UX_UI_V2 already applied")

# Optional print skin from the supplied UI package. It only changes CSS.
text = CODE.read_text(encoding="utf-8")
PRINT_MARKER = "/* TD_PRINT_V2 */"

if text.count(PRINT_MARKER) < 2:
    quote_anchor = "    '@media print{',\n    '.preview-toolbar{display:none;}',"
    slip_anchor = "    '@media print{html,body{background:#fff;}.preview-toolbar{display:none!important;}"

    quote_css = """    '/* TD_PRINT_V2 */',
    'html,body{color:#161a22;}',
    '.preview-toolbar button{background:#2263a8;}',
    '.preview-toolbar .secondary{background:#f0f1f3;color:#161a22;}',
    '.sheet::before{content:\\'\\';display:block;height:1.4mm;margin-bottom:5mm;background:linear-gradient(90deg,#bb2a2c 50%,#2263a8 50%);}',
    '.company-header{border-bottom:.3mm solid #d3d8df;}',
    '.company-name{color:#bb2a2c;letter-spacing:.2px;}',
    '.company-line{color:#343b47;}.company-line strong{color:#161a22;}',
    '.quote-title h1{color:#161a22;letter-spacing:1px;font-weight:800;}',
    '.quote-title p{color:#5d6675;}',
    '.meta-strip{background:#f6f7f9;border-color:#e3e6eb;}',
    '.meta-item{color:#5d6675;}.meta-item strong{color:#161a22;}',
    '.customer-card{border-color:#d3d8df;}',
    '.info-row,.info-row:nth-child(odd){border-color:#e3e6eb;}',
    '.info-label{background:#fff;color:#5d6675;font-weight:400;border-right-color:#e3e6eb;}',
    '.info-value{color:#161a22;}.info-strong{color:#161a22;}',
    '.items{border:0;border-radius:0;}',
    '.items th,.items td{border-right:0;border-bottom:.25mm solid #e3e6eb;}',
    '.items th{background:#eef3f9;color:#161a22;border-top:.5mm solid #161a22;border-bottom:.3mm solid #c9d6e6;font-size:7.9pt;letter-spacing:.3px;text-transform:uppercase;}',
    '.th-note{color:#5d6675;text-transform:none;letter-spacing:0;}',
    '.items tbody tr:nth-child(even){background:transparent;}',
    '.items td{color:#161a22;}.items .product{color:#161a22;}',
    '.totals{border:0;border-radius:0;}',
    '.totals td{border-bottom:.25mm solid #e3e6eb;}',
    '.totals .label{background:transparent;color:#5d6675;}',
    '.totals .grand td{background:transparent;color:#1a4f87;border-top:.5mm solid #161a22;border-bottom:0;font-size:11pt;font-weight:800;}',
    '.totals .grand .label{color:#161a22;font-size:8.6pt;letter-spacing:.4px;text-transform:uppercase;}',
    '.discount-value{color:#bb2a2c;}',
    '.amount-words{background:#f6f7f9;border-left:1mm solid #2263a8;color:#161a22;}',
    '.notes{background:#fff;border:.3mm solid #e3e6eb;border-radius:2mm;}',
    '.notes h3{color:#161a22;}',
    '.notes .quote-custom-note,.notes .quote-custom-note strong{color:#bb2a2c;}',
    '.notes .quote-custom-note{border-top-color:#f0caca;}',
    '.signatures td{color:#5d6675;}.signatures strong{color:#161a22;}',
    '.footer{color:#8a93a1;border-top-color:#e3e6eb;}',
"""

    slip_css = """    '/* TD_PRINT_V2 */',
    'html,body{font-family:Arial,Helvetica,sans-serif;color:#161a22;}',
    '.preview-toolbar{background:#161a22;}',
    '.preview-toolbar button{background:#2263a8;}',
    '.preview-toolbar .secondary{background:#fff;color:#161a22;}',
    '.sheet::before{content:\\'\\';display:block;height:1.4mm;margin:0 -6mm 4mm;background:linear-gradient(90deg,#bb2a2c 50%,#2263a8 50%);}',
    '.company-name{color:#bb2a2c;}',
    '.company-line{color:#343b47;}',
    '.title{border-top:.3mm solid #d3d8df;}',
    '.title h1{letter-spacing:.6px;font-size:17pt;}',
    '.title p{font-weight:400;color:#5d6675;}',
    '.document-meta{color:#343b47;}',
    '.customer td{border-bottom-color:#e3e6eb;}',
    '.customer .label{font-weight:400;color:#5d6675;}',
    '.items th,.items td{border:.25mm solid #d3d8df;}',
    '.items th{background:#eef3f9;border-top:.5mm solid #161a22;font-size:8.6pt;}',
    '.items th .subhead{color:#5d6675;}',
    '.item-code{color:#8a93a1;}',
    '.totals td{border:.25mm solid #d3d8df;}',
    '.totals .blank{border-right:0;}.totals .label{border-left:0;color:#343b47;}',
    '.totals .grand td{background:#f4f8fc;color:#1a4f87;}',
    '.words,.warehouse-note{border-color:#d3d8df;}',
    '.sign-date{color:#5d6675;}',
    '.signatures em{color:#8a93a1;}',
"""

    changed = False
    if quote_anchor in text:
        text = text.replace(
            quote_anchor,
            quote_css + quote_anchor,
            1
        )
        changed = True
    else:
        print("Quote print anchor not found; skipped quote print skin")

    if slip_anchor in text:
        text = text.replace(
            slip_anchor,
            slip_css + slip_anchor,
            1
        )
        changed = True
    else:
        print("Warehouse print anchor not found; skipped warehouse print skin")

    if changed:
        CODE.write_text(text, encoding="utf-8")
        print("Applied TD_PRINT_V2")
else:
    print("TD_PRINT_V2 already applied")
