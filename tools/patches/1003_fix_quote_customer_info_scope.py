from pathlib import Path

path = Path("code.js")
text = path.read_text(encoding="utf-8")

quote_start = text.find("function buildQuoteA4Html_(")
if quote_start < 0:
    raise SystemExit("buildQuoteA4Html_ not found")

quote_end = text.find("function generateQuotePdf_", quote_start)
if quote_end < 0:
    raise SystemExit("generateQuotePdf_ anchor not found")

quote_block = text[quote_start:quote_end]

if "const customerInfoRows = [" not in quote_block:
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
      escapeHtmlServer_(quote.NguoiLienHe || customer.NguoiNhan),
      '</div>',
      '</div>'
    ].join(''),
    [
      '<div class="info-row">',
      '<div class="info-label">Điện thoại</div>',
      '<div class="info-value">',
      escapeHtmlServer_(quote.DienThoai || customer.DienThoai),
      '</div>',
      '</div>'
    ].join(''),
    [
      '<div class="info-row">',
      '<div class="info-label">Hiệu lực đến</div>',
      '<div class="info-value">',
      escapeHtmlServer_(formatDateOnly_(quote.HieuLucDen)),
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
    if anchor not in quote_block:
        raise SystemExit("Quote toolbar anchor not found")
    quote_block = quote_block.replace(anchor, insert + anchor, 1)
    text = text[:quote_start] + quote_block + text[quote_end:]

# Remove the accidental duplicate block from warehouse issue function.
warehouse_start = text.find("function buildWarehouseIssueHtml_(")
if warehouse_start >= 0:
    warehouse_tail = text[warehouse_start:]
    start = warehouse_tail.find("  const customerEmail = clean_(customer.Email);")
    toolbar = warehouse_tail.find("  const toolbar = previewMode", start if start >= 0 else 0)
    if start >= 0 and toolbar > start:
        warehouse_tail = warehouse_tail[:start] + warehouse_tail[toolbar:]
        text = text[:warehouse_start] + warehouse_tail

path.write_text(text, encoding="utf-8")
print("Moved customerInfoRows into quote print renderer and removed accidental warehouse insertion")
