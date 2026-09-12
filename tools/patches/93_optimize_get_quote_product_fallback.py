from pathlib import Path

path = Path('code.js')
text = path.read_text(encoding='utf-8')

old = """  const products = {};

  rows_(APP.SHEETS.PRODUCTS).forEach(product => {
    products[clean_(product.MaSanPham)] = product;
  });

  const lineSheet = sheet_(APP.SHEETS.QUOTE_LINES);
  const items = readRowsByValue_(
    lineSheet,
    'SoBaoGia',
    quoteNo
  ).map(item => {
"""

new = """  const lineSheet = sheet_(APP.SHEETS.QUOTE_LINES);
  const rawItems = readRowsByValue_(
    lineSheet,
    'SoBaoGia',
    quoteNo
  );

  /*
   * Chỉ đọc SAN_PHAM khi dữ liệu chi tiết cũ thiếu metadata thuế.
   * Báo giá mới đã lưu VAT/GiaDaGomVAT/DaQuaSuDung ngay trên dòng chi tiết,
   * nên không cần quét toàn bộ danh mục sản phẩm mỗi lần mở báo giá.
   */
  const productCodesNeedingFallback = {};

  rawItems.forEach(item => {
    const needsFallback =
      item.VAT === '' || item.VAT == null ||
      item.GiaDaGomVAT === '' || item.GiaDaGomVAT == null ||
      item.DaQuaSuDung === '' || item.DaQuaSuDung == null;

    const code = clean_(item.MaSanPham);
    if (needsFallback && code) {
      productCodesNeedingFallback[code] = true;
    }
  });

  const products = {};
  Object.keys(productCodesNeedingFallback).forEach(code => {
    const product = findObjectByValue_(
      APP.SHEETS.PRODUCTS,
      'MaSanPham',
      code
    );

    if (product) products[code] = product;
  });

  const items = rawItems.map(item => {
"""

if old in text:
    text = text.replace(old, new, 1)
    path.write_text(text, encoding='utf-8')
    print('Optimized getQuote product tax fallback lookup.')
elif 'productCodesNeedingFallback' in text:
    print('getQuote product fallback already optimized')
else:
    raise SystemExit('getQuote product map anchor not found')
