from pathlib import Path
import re

path = Path('code.js')
text = path.read_text(encoding='utf-8')

if 'BATCHED_QUOTE_TOTALS_MIGRATION_V1' in text:
    print('70_batch_quote_totals_migration: already applied')
    raise SystemExit(0)

pattern = re.compile(r"function migrateQuoteTotalsToNet_\(\) \{.*?\n\}\n\n\nfunction normalizePhone_", re.S)
match = pattern.search(text)
if not match:
    raise SystemExit('Could not find migrateQuoteTotalsToNet_() block')

replacement = r'''function migrateQuoteTotalsToNet_() {
  /* BATCHED_QUOTE_TOTALS_MIGRATION_V1 */
  const properties = PropertiesService.getScriptProperties();
  const migrationKey = 'QUOTE_TOTALS_NET_V195';

  if (properties.getProperty(migrationKey) === 'DONE') {
    return;
  }

  const quoteSheet = sheet_(APP.SHEETS.QUOTES);
  const lastRow = quoteSheet.getLastRow();
  const lastCol = quoteSheet.getLastColumn();

  if (lastRow < 2 || lastCol < 1) {
    properties.setProperty(migrationKey, 'DONE');
    return;
  }

  const values = quoteSheet
    .getRange(1, 1, lastRow, lastCol)
    .getValues();
  const headers = values[0].map(clean_);

  const noCol = headers.indexOf('SoBaoGia');
  const goodsCol = headers.indexOf('TienHang');
  const discountCol = headers.indexOf('ChietKhau');
  const vatCol = headers.indexOf('VAT');
  const totalCol = headers.indexOf('TongThanhToan');
  const modeCol = headers.indexOf('CheDoVAT');

  if (
    noCol < 0 ||
    goodsCol < 0 ||
    vatCol < 0 ||
    totalCol < 0
  ) {
    throw new Error(
      'BAO_GIA thiếu cột bắt buộc để chuẩn hóa tổng tiền.'
    );
  }

  const products = {};
  rows_(APP.SHEETS.PRODUCTS).forEach(product => {
    products[clean_(product.MaSanPham)] = product;
  });

  const itemsByQuote = {};
  rows_(APP.SHEETS.QUOTE_LINES).forEach(item => {
    const quoteNo = clean_(item.SoBaoGia);
    if (!quoteNo) return;

    const product = products[clean_(item.MaSanPham)] || {};
    const tax = normalizeProductTax_({
      name: item.TenSanPham,
      vat:
        item.VAT !== '' && item.VAT != null
          ? item.VAT
          : product.VAT,
      priceIncludesVat:
        item.GiaDaGomVAT !== '' && item.GiaDaGomVAT != null
          ? item.GiaDaGomVAT
          : product.GiaDaGomVAT,
      used:
        item.DaQuaSuDung !== '' && item.DaQuaSuDung != null
          ? item.DaQuaSuDung
          : product.DaQuaSuDung
    });

    if (!itemsByQuote[quoteNo]) {
      itemsByQuote[quoteNo] = [];
    }

    itemsByQuote[quoteNo].push({
      code: clean_(item.MaSanPham),
      name: clean_(item.TenSanPham),
      unit: clean_(item.DonViTinh) || 'Cái',
      qty: Number(item.SoLuong || 0),
      price: Number(item.DonGia || 0),
      lineDiscount: Number(item.ChietKhauDong || 0),
      vat: tax.vat,
      priceIncludesVat: tax.priceIncludesVat,
      used: tax.used
    });
  });

  const goodsValues = [];
  const vatValues = [];
  const totalValues = [];
  const modeValues = [];

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    const quoteNo = clean_(row[noCol]);

    let goods = row[goodsCol];
    let vat = row[vatCol];
    let total = row[totalCol];
    let mode = modeCol >= 0 ? row[modeCol] : '';

    const items = itemsByQuote[quoteNo] || [];

    if (quoteNo && items.length) {
      const quoteObject = {};
      headers.forEach((header, index) => {
        quoteObject[header] = row[index];
      });

      const taxMode = inferSavedQuoteTaxMode_(quoteObject);
      const totals = calculateQuotePricing_(
        items,
        discountCol >= 0 ? Number(row[discountCol] || 0) : 0,
        taxMode
      );

      goods = totals.netAmount;
      vat = totals.vatAmount;
      total = totals.total;
      mode = taxMode;
    }

    goodsValues.push([goods]);
    vatValues.push([vat]);
    totalValues.push([total]);
    if (modeCol >= 0) modeValues.push([mode]);
  }

  const rowCount = values.length - 1;

  quoteSheet
    .getRange(2, goodsCol + 1, rowCount, 1)
    .setValues(goodsValues);
  quoteSheet
    .getRange(2, vatCol + 1, rowCount, 1)
    .setValues(vatValues);
  quoteSheet
    .getRange(2, totalCol + 1, rowCount, 1)
    .setValues(totalValues);

  if (modeCol >= 0) {
    quoteSheet
      .getRange(2, modeCol + 1, rowCount, 1)
      .setValues(modeValues);
  }

  SpreadsheetApp.flush();
  properties.setProperty(migrationKey, 'DONE');
}


function normalizePhone_'''

text = text[:match.start()] + replacement + text[match.end():]
path.write_text(text, encoding='utf-8')
print('70_batch_quote_totals_migration: applied')
