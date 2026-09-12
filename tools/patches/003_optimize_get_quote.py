from pathlib import Path
import sys

FILE = Path('code.js')

if not FILE.exists():
    print('ERROR: code.js not found')
    sys.exit(1)

text = FILE.read_text(encoding='utf-8')

if "function readRowsByValue_(" in text and "const quoteNo = clean_(no);" in text:
    print('SKIP: getQuote optimization already applied')
    sys.exit(0)

old = r'''function getQuote(no) {
  ensureAppReady_();

  const quote = rows_(APP.SHEETS.QUOTES)
    .find(item =>
      clean_(item.SoBaoGia) === clean_(no)
    );

  if (!quote) {
    throw new Error('Không tìm thấy báo giá.');
  }

  const products = {};

  rows_(APP.SHEETS.PRODUCTS).forEach(product => {
    products[clean_(product.MaSanPham)] = product;
  });

  const items = rows_(APP.SHEETS.QUOTE_LINES)
    .filter(item =>
      clean_(item.SoBaoGia) === clean_(no)
    )
    .map(item => {
      const product =
        products[clean_(item.MaSanPham)] || {};

      const tax = normalizeProductTax_({
        name: item.TenSanPham,
        vat:
          item.VAT !== '' && item.VAT != null
            ? item.VAT
            : product.VAT,
        priceIncludesVat:
          item.GiaDaGomVAT !== '' &&
          item.GiaDaGomVAT != null
            ? item.GiaDaGomVAT
            : product.GiaDaGomVAT,
        used:
          item.DaQuaSuDung !== '' &&
          item.DaQuaSuDung != null
            ? item.DaQuaSuDung
            : product.DaQuaSuDung
      });

      return {
        code: clean_(item.MaSanPham),
        name: clean_(item.TenSanPham),
        unit: clean_(item.DonViTinh) || 'Cái',
        qty: Number(item.SoLuong || 0),
        price: Number(item.DonGia || 0),
        lineDiscount: Number(item.ChietKhauDong || 0),
        vat: tax.vat,
        priceIncludesVat: tax.priceIncludesVat,
        used: tax.used
      };
    });

  return {
    quote: quote,
    items: items
  };
}'''

new = r'''/**
 * Đọc các dòng có cùng giá trị khóa mà không quét toàn bộ sheet.
 * Tối ưu cho các nhóm dữ liệu liên tiếp như CHI_TIET_BAO_GIA.
 */
function readRowsByValue_(sh, columnName, value) {
  const target = clean_(value);

  if (!target) return [];

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();

  if (lastRow < 2 || lastCol < 1) return [];

  const headers = sh
    .getRange(1, 1, 1, lastCol)
    .getValues()[0]
    .map(clean_);

  const keyCol = headers.indexOf(columnName);

  if (keyCol < 0) {
    throw new Error(
      'Sheet ' + sh.getName() + ' thiếu cột ' + columnName + '.'
    );
  }

  const matches = sh
    .getRange(2, keyCol + 1, lastRow - 1, 1)
    .createTextFinder(target)
    .matchEntireCell(true)
    .findAll();

  if (!matches.length) return [];

  const rowNumbers = matches
    .map(cell => cell.getRow())
    .sort((a, b) => a - b);

  const blocks = [];
  let start = rowNumbers[0];
  let previous = rowNumbers[0];

  for (let i = 1; i < rowNumbers.length; i++) {
    const current = rowNumbers[i];

    if (current === previous + 1) {
      previous = current;
      continue;
    }

    blocks.push([start, previous - start + 1]);
    start = current;
    previous = current;
  }

  blocks.push([start, previous - start + 1]);

  const result = [];

  blocks.forEach(block => {
    const values = sh
      .getRange(block[0], 1, block[1], lastCol)
      .getValues();

    values.forEach(row => {
      const item = {};
      headers.forEach((header, index) => {
        item[header] = row[index];
      });
      result.push(item);
    });
  });

  return result;
}

function getQuote(no) {
  ensureAppReady_();

  const quoteNo = clean_(no);

  if (!quoteNo) {
    throw new Error('Thiếu số báo giá.');
  }

  const quoteSheet = sheet_(APP.SHEETS.QUOTES);
  const quoteLastCol = quoteSheet.getLastColumn();

  if (quoteLastCol < 1) {
    throw new Error('Sheet BAO_GIA chưa có dữ liệu.');
  }

  const quoteHeaders = quoteSheet
    .getRange(1, 1, 1, quoteLastCol)
    .getValues()[0]
    .map(clean_);

  const quoteNoCol = quoteHeaders.indexOf('SoBaoGia');

  if (quoteNoCol < 0) {
    throw new Error('Sheet BAO_GIA thiếu cột SoBaoGia.');
  }

  const quoteRow = findDataRowByValue_(
    quoteSheet,
    quoteNoCol + 1,
    quoteNo
  );

  if (!quoteRow) {
    throw new Error('Không tìm thấy báo giá ' + quoteNo + '.');
  }

  const quoteValues = quoteSheet
    .getRange(quoteRow, 1, 1, quoteLastCol)
    .getValues()[0];

  const quote = {};
  quoteHeaders.forEach((header, index) => {
    quote[header] = quoteValues[index];
  });

  const products = {};

  rows_(APP.SHEETS.PRODUCTS).forEach(product => {
    products[clean_(product.MaSanPham)] = product;
  });

  const lineSheet = sheet_(APP.SHEETS.QUOTE_LINES);
  const items = readRowsByValue_(
    lineSheet,
    'SoBaoGia',
    quoteNo
  ).map(item => {
    const product =
      products[clean_(item.MaSanPham)] || {};

    const tax = normalizeProductTax_({
      name: item.TenSanPham,
      vat:
        item.VAT !== '' && item.VAT != null
          ? item.VAT
          : product.VAT,
      priceIncludesVat:
        item.GiaDaGomVAT !== '' &&
        item.GiaDaGomVAT != null
          ? item.GiaDaGomVAT
          : product.GiaDaGomVAT,
      used:
        item.DaQuaSuDung !== '' &&
        item.DaQuaSuDung != null
          ? item.DaQuaSuDung
          : product.DaQuaSuDung
    });

    return {
      code: clean_(item.MaSanPham),
      name: clean_(item.TenSanPham),
      unit: clean_(item.DonViTinh) || 'Cái',
      qty: Number(item.SoLuong || 0),
      price: Number(item.DonGia || 0),
      lineDiscount: Number(item.ChietKhauDong || 0),
      vat: tax.vat,
      priceIncludesVat: tax.priceIncludesVat,
      used: tax.used
    };
  });

  return {
    quote: quote,
    items: items
  };
}'''

if old not in text:
    print('ERROR: expected getQuote block not found; source may have changed')
    sys.exit(1)

text = text.replace(old, new, 1)
FILE.write_text(text, encoding='utf-8')

print('OK: optimized getQuote and quote-line lookup')
