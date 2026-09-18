from pathlib import Path

path = Path("code.js")
text = path.read_text(encoding="utf-8")

def replace_once(old, new, marker):
    global text
    if marker in text:
        return
    if old not in text:
        raise SystemExit("Missing expected block: " + marker)
    text = text.replace(old, new, 1)

# 1) Preview date must follow the user-selected quote date.
replace_once(
"""      NgayBaoGia: new Date(),
""",
"""      NgayBaoGia: request.date
        ? new Date(request.date + 'T00:00:00')
        : new Date(),
""",
"request.date + 'T00:00:00'"
)

# 2) Build a compact customer information block and hide empty email.
anchor = """  const toolbar = previewMode
    ? [
"""
insert = """  const customerEmail = clean_(customer.Email);

  const customerInfoRows = [
    [
      '<div class="info-row">',
      '<div class="info-label">Khách hàng</div>',
      '<div class="info-value info-strong">',
      escapeHtmlServer_(quote.TenKhachHang),
      '</div>',
      '</div>'
    ].join(''),
    [
      '<div class="info-row">',
      '<div class="info-label">Mã số thuế</div>',
      '<div class="info-value">',
      escapeHtmlServer_(customer.MaSoThue),
      '</div>',
      '</div>'
    ].join(''),
    [
      '<div class="info-row info-wide">',
      '<div class="info-label">Địa chỉ</div>',
      '<div class="info-value">',
      escapeHtmlServer_(customer.DiaChi),
      '</div>',
      '</div>'
    ].join(''),
    [
      '<div class="info-row">',
      '<div class="info-label">Người liên hệ</div>',
      '<div class="info-value">',
      escapeHtmlServer_(
        quote.NguoiLienHe ||
        customer.NguoiNhan
      ),
      '</div>',
      '</div>'
    ].join(''),
    [
      '<div class="info-row">',
      '<div class="info-label">Điện thoại</div>',
      '<div class="info-value">',
      escapeHtmlServer_(
        quote.DienThoai ||
        customer.DienThoai
      ),
      '</div>',
      '</div>'
    ].join(''),
    [
      '<div class="info-row">',
      '<div class="info-label">Hiệu lực đến</div>',
      '<div class="info-value">',
      escapeHtmlServer_(
        formatDateOnly_(quote.HieuLucDen)
      ),
      '</div>',
      '</div>'
    ].join(''),
    customerEmail
      ? [
          '<div class="info-row">',
          '<div class="info-label">Email</div>',
          '<div class="info-value">',
          escapeHtmlServer_(customerEmail),
          '</div>',
          '</div>'
        ].join('')
      : '',
    [
      '<div class="info-row">',
      '<div class="info-label">Đơn vị tiền</div>',
      '<div class="info-value">Việt Nam đồng (VNĐ)</div>',
      '</div>'
    ].join('')
  ].filter(Boolean).join('');

"""
if "const customerInfoRows = [" not in text:
    if anchor not in text:
        raise SystemExit("Missing toolbar anchor")
    text = text.replace(anchor, insert + anchor, 1)

# 3) Replace the old customer table CSS with a cleaner information card.
old_css = """    '.meta{',
    'width:100%;',
    'border-collapse:collapse;',
    'margin-bottom:3mm;',
    '}',
    '.meta td{',
    'width:33.333%;',
    'padding:1.2mm 1mm;',
    'text-align:center;',
    'font-size:8.6pt;',
    'font-weight:400;',
    'color:#47596a;',
    '}',
    '.meta strong{',
    'font-weight:700;',
    'color:#263746;',
    '}',
    '.customer-table{',
    'width:100%;',
    'border-collapse:collapse;',
    'table-layout:fixed;',
    'margin-bottom:4mm;',
    '}',
    '.customer-table th,',
    '.customer-table td{',
    'border:.35mm solid #c4cdd5;',
    'padding:2mm 2.2mm;',
    'vertical-align:middle;',
    'font-size:8.8pt;',
    '}',
    '.customer-table th{',
    'width:22mm;',
    'text-align:left;',
    'font-weight:700;',
    'color:#17324d;',
    'background:#eef2f5;',
    '}',
    '.customer-table td{',
    'font-weight:400;',
    'color:#263746;',
    '}',
    '.customer-table .customer-name{',
    'font-weight:700;',
    '}',
"""

new_css = """    '.meta-strip{',
    'display:grid;',
    'grid-template-columns:1fr 1fr 1fr;',
    'gap:2.2mm;',
    'margin:0 0 3.2mm;',
    'padding:2.3mm 3mm;',
    'border:.3mm solid #d6e0e7;',
    'border-radius:2mm;',
    'background:#f8fafc;',
    '}',
    '.meta-item{',
    'text-align:center;',
    'font-size:8.7pt;',
    'color:#475569;',
    '}',
    '.meta-item strong{',
    'font-weight:700;',
    'color:#1f3347;',
    '}',
    '.customer-card{',
    'margin-bottom:4mm;',
    'border:.3mm solid #d6e0e7;',
    'border-radius:2mm;',
    'overflow:hidden;',
    '}',
    '.info-grid{',
    'display:grid;',
    'grid-template-columns:1fr 1fr;',
    '}',
    '.info-row{',
    'display:grid;',
    'grid-template-columns:28mm minmax(0,1fr);',
    'min-height:10.8mm;',
    'border-bottom:.25mm solid #e1e7ec;',
    '}',
    '.info-row:nth-child(odd){',
    'border-right:.25mm solid #e1e7ec;',
    '}',
    '.info-wide{',
    'grid-column:1/-1;',
    'border-right:0!important;',
    '}',
    '.info-label{',
    'display:flex;',
    'align-items:center;',
    'padding:1.7mm 2.2mm;',
    'font-size:8.5pt;',
    'font-weight:700;',
    'color:#334155;',
    'background:#f4f7f9;',
    'border-right:.25mm solid #e1e7ec;',
    '}',
    '.info-value{',
    'display:flex;',
    'align-items:center;',
    'padding:1.7mm 2.3mm;',
    'font-size:8.8pt;',
    'color:#263746;',
    'line-height:1.3;',
    'word-break:break-word;',
    '}',
    '.info-strong{font-weight:700;color:#17324d;}',
"""

replace_once(old_css, new_css, "'.meta-strip{'")

# 4) Upgrade product table + totals + notes spacing.
replacements = [
("""    '.items{',
    'width:100%;',
    'border-collapse:collapse;',
    'table-layout:fixed;',
    'margin-bottom:3mm;',
    '}',
""",
"""    '.items{',
    'width:100%;',
    'border-collapse:separate;',
    'border-spacing:0;',
    'table-layout:fixed;',
    'margin-bottom:3.2mm;',
    'border:.3mm solid #c8d3dc;',
    'border-radius:2mm;',
    'overflow:hidden;',
    '}',
""", "border-collapse:separate"),
("""    '.items th,',
    '.items td{',
    'border:.35mm solid #aeb9c3;',
    'padding:2mm 1.4mm;',
    'vertical-align:middle;',
    '}',
""",
"""    '.items th,',
    '.items td{',
    'border-right:.25mm solid #d8e0e6;',
    'border-bottom:.25mm solid #d8e0e6;',
    'padding:2.15mm 1.6mm;',
    'vertical-align:middle;',
    '}',
    '.items th:last-child,.items td:last-child{border-right:0;}',
    '.items tbody tr:last-child td{border-bottom:0;}',
""", "'.items th:last-child"),
("""    '.items th{',
    'font-size:8.1pt;',
    'font-weight:700;',
    'text-align:center;',
    'color:#fff;',
    'background:#17324d;',
    '}',
""",
"""    '.items th{',
    'font-size:8.15pt;',
    'font-weight:700;',
    'text-align:center;',
    'color:#fff;',
    'background:#17324d;',
    'letter-spacing:.05px;',
    '}',
""", "letter-spacing:.05px"),
("""    '.items .product{',
    'font-weight:400;',
    'line-height:1.3;',
    '}',
""",
"""    '.items .product{',
    'font-weight:600;',
    'line-height:1.32;',
    'color:#1f3347;',
    '}',
""", "font-weight:600"),
("""    '.totals{',
    'width:78mm;',
    'border-collapse:collapse;',
    '}',
""",
"""    '.totals{',
    'width:82mm;',
    'border-collapse:separate;',
    'border-spacing:0;',
    'border:.3mm solid #cbd6df;',
    'border-radius:2mm;',
    'overflow:hidden;',
    '}',
""", "width:82mm"),
("""    '.totals td{',
    'border:.35mm solid #c4cdd5;',
    'padding:2mm 2.3mm;',
    'font-size:8.8pt;',
    '}',
""",
"""    '.totals td{',
    'border:0;',
    'border-bottom:.25mm solid #e0e6eb;',
    'padding:2.1mm 2.5mm;',
    'font-size:8.8pt;',
    '}',
    '.totals tr:last-child td{border-bottom:0;}',
""", "'.totals tr:last-child"),
("""    '.totals .grand td{',
    'font-size:10pt;',
    'font-weight:700;',
    'color:#fff;',
    'background:#17324d;',
    '}',
""",
"""    '.totals .grand td{',
    'font-size:10.4pt;',
    'font-weight:800;',
    'color:#fff;',
    'background:#0f766e;',
    '}',
""", "background:#0f766e"),
("""    '.amount-words{',
    'margin:3mm 0 3.5mm;',
    'font-size:8.8pt;',
    'font-weight:400;',
    'color:#354858;',
    '}',
""",
"""    '.amount-words{',
    'margin:2.8mm 0 3.5mm;',
    'padding:2mm 2.6mm;',
    'font-size:8.8pt;',
    'font-weight:400;',
    'color:#354858;',
    'background:#f8fafc;',
    'border-left:1mm solid #0f766e;',
    '}',
""", "border-left:1mm solid #0f766e"),
("""    '.notes{',
    'page-break-inside:avoid;',
    'border:.35mm solid #cbd3da;',
    'background:#f7f9fb;',
    'padding:2.5mm 3mm;',
    'margin-top:2mm;',
    '}',
""",
"""    '.notes{',
    'page-break-inside:avoid;',
    'border:.3mm solid #d6e0e7;',
    'border-radius:2mm;',
    'background:#fbfcfd;',
    'padding:2.7mm 3.2mm;',
    'margin-top:2mm;',
    '}',
""", "border-radius:2mm")
]
for old,new,marker in replacements:
    if marker not in text:
        if old not in text:
            raise SystemExit("Missing CSS block for " + marker)
        text = text.replace(old,new,1)

# 5) Replace the old meta/customer markup.
old_markup = """    '<table class="meta"><tr>',
    '<td><strong>Ngày báo giá:</strong> ',
    escapeHtmlServer_(
      formatDateOnly_(quote.NgayBaoGia)
    ),
    '</td>',
    '<td><strong>Số báo giá:</strong> ',
    escapeHtmlServer_(quote.SoBaoGia),
    '</td>',
    '<td><strong>',
    escapeHtmlServer_(taxModeLabel),
    '</strong></td>',
    '</tr></table>',
    '<table class="customer-table">',
    '<colgroup>',
    '<col style="width:22mm">',
    '<col style="width:73mm">',
    '<col style="width:22mm">',
    '<col style="width:73mm">',
    '</colgroup>',
    '<tr>',
    '<th>Khách hàng</th>',
    '<td class="customer-name">',
    escapeHtmlServer_(quote.TenKhachHang),
    '</td>',
    '<th>Mã số thuế</th>',
    '<td>',
    escapeHtmlServer_(customer.MaSoThue),
    '</td>',
    '</tr>',
    '<tr>',
    '<th>Địa chỉ</th>',
    '<td>',
    escapeHtmlServer_(customer.DiaChi),
    '</td>',
    '<th>Điện thoại</th>',
    '<td>',
    escapeHtmlServer_(
      quote.DienThoai ||
      customer.DienThoai
    ),
    '</td>',
    '</tr>',
    '<tr>',
    '<th>Người liên hệ</th>',
    '<td>',
    escapeHtmlServer_(
      quote.NguoiLienHe ||
      customer.NguoiNhan
    ),
    '</td>',
    '<th>Hiệu lực đến</th>',
    '<td>',
    escapeHtmlServer_(
      formatDateOnly_(
        quote.HieuLucDen
      )
    ),
    '</td>',
    '</tr>',
    '<tr>',
    '<th>Email</th>',
    '<td>',
    escapeHtmlServer_(customer.Email),
    '</td>',
    '<th>Đơn vị tiền</th>',
    '<td>Việt Nam đồng (VNĐ)</td>',
    '</tr>',
    '</table>',
"""

new_markup = """    '<section class="meta-strip">',
    '<div class="meta-item"><strong>Ngày báo giá:</strong> ',
    escapeHtmlServer_(
      formatDateOnly_(quote.NgayBaoGia)
    ),
    '</div>',
    '<div class="meta-item"><strong>Số báo giá:</strong> ',
    escapeHtmlServer_(quote.SoBaoGia),
    '</div>',
    '<div class="meta-item"><strong>Chính sách giá:</strong> ',
    escapeHtmlServer_(taxModeLabel),
    '</div>',
    '</section>',
    '<section class="customer-card">',
    '<div class="info-grid">',
    customerInfoRows,
    '</div>',
    '</section>',
"""

replace_once(old_markup, new_markup, "'<section class=\"meta-strip\">'")

path.write_text(text, encoding="utf-8")
print("Upgraded quote print layout and bound preview date to quote date")
