from pathlib import Path

path = Path('code.js')
text = path.read_text(encoding='utf-8')

start = text.find('function ensurePricingColumns_() {')
end = text.find('\nfunction normalizeProductTax_(product) {', start)

if start < 0 or end < 0:
    raise SystemExit('ensurePricingColumns_ block not found')

current = text[start:end]
if '/* TD_BATCH_PRICING_COLUMNS_V2 */' in current:
    print('ensurePricingColumns_ already optimized')
else:
    replacement = r'''function ensurePricingColumns_() {
  /* TD_BATCH_PRICING_COLUMNS_V2 */
  const productSheet = sheet_(APP.SHEETS.PRODUCTS);
  let productMeta = sheetHeaderMap_(productSheet);

  if (!productMeta.byName.GiaDaGomVAT) {
    productSheet
      .getRange(1, productMeta.headers.length + 1)
      .setValue('GiaDaGomVAT');
    productMeta = sheetHeaderMap_(productSheet);
  }

  if (!productMeta.byName.DaQuaSuDung) {
    productSheet
      .getRange(1, productMeta.headers.length + 1)
      .setValue('DaQuaSuDung');
    productMeta = sheetHeaderMap_(productSheet);
  }

  const productLastRow = productSheet.getLastRow();
  const nameCol = productMeta.byName.TenSanPham || 0;
  const vatCol = productMeta.byName.VAT || 0;
  const includedCol = productMeta.byName.GiaDaGomVAT || 0;
  const usedCol = productMeta.byName.DaQuaSuDung || 0;

  if (
    productLastRow >= 2 &&
    nameCol &&
    vatCol &&
    includedCol &&
    usedCol
  ) {
    const rowCount = productLastRow - 1;
    const names = productSheet
      .getRange(2, nameCol, rowCount, 1)
      .getValues();
    const vats = productSheet
      .getRange(2, vatCol, rowCount, 1)
      .getValues();
    const includedValues = productSheet
      .getRange(2, includedCol, rowCount, 1)
      .getValues();
    const usedValues = productSheet
      .getRange(2, usedCol, rowCount, 1)
      .getValues();

    let vatChanged = false;
    let includedChanged = false;
    let usedChanged = false;

    for (let index = 0; index < rowCount; index++) {
      const name = clean_(names[index][0]);
      const rawUsed = usedValues[index][0];
      const used = (
        rawUsed === true ||
        rawUsed === false
      )
        ? rawUsed
        : isUsedProductName_(name);

      const rawIncluded = includedValues[index][0];
      const included = used
        ? false
        : (
            rawIncluded === true ||
            rawIncluded === false
          )
          ? rawIncluded
          : true;

      if (rawUsed !== used) {
        usedValues[index][0] = used;
        usedChanged = true;
      }

      if (rawIncluded !== included) {
        includedValues[index][0] = included;
        includedChanged = true;
      }

      const rawVat = vats[index][0];

      if (used && Number(rawVat || 0) !== 0) {
        vats[index][0] = 0;
        vatChanged = true;
      } else if (
        !used &&
        (rawVat === '' || rawVat == null)
      ) {
        vats[index][0] = 0.08;
        vatChanged = true;
      }
    }

    if (usedChanged) {
      productSheet
        .getRange(2, usedCol, rowCount, 1)
        .setValues(usedValues);
    }

    if (includedChanged) {
      productSheet
        .getRange(2, includedCol, rowCount, 1)
        .setValues(includedValues);
    }

    if (vatChanged) {
      productSheet
        .getRange(2, vatCol, rowCount, 1)
        .setValues(vats);
    }
  }

  const lineSheet = sheet_(APP.SHEETS.QUOTE_LINES);
  let lineMeta = sheetHeaderMap_(lineSheet);

  if (!lineMeta.byName.GiaDaGomVAT) {
    lineSheet
      .getRange(1, lineMeta.headers.length + 1)
      .setValue('GiaDaGomVAT');
    lineMeta = sheetHeaderMap_(lineSheet);
  }

  if (!lineMeta.byName.DaQuaSuDung) {
    lineSheet
      .getRange(1, lineMeta.headers.length + 1)
      .setValue('DaQuaSuDung');
  }

  const quoteSheet = sheet_(APP.SHEETS.QUOTES);
  let quoteMeta = sheetHeaderMap_(quoteSheet);

  if (!quoteMeta.byName.CheDoVAT) {
    quoteSheet
      .getRange(1, quoteMeta.headers.length + 1)
      .setValue('CheDoVAT');
    quoteMeta = sheetHeaderMap_(quoteSheet);
  }

  const quoteLastRow = quoteSheet.getLastRow();
  const modeCol = quoteMeta.byName.CheDoVAT || 0;
  const goodsCol = quoteMeta.byName.TienHang || 0;
  const discountCol = quoteMeta.byName.ChietKhau || 0;
  const vatAmountCol = quoteMeta.byName.VAT || 0;

  if (
    quoteLastRow >= 2 &&
    modeCol &&
    goodsCol &&
    discountCol &&
    vatAmountCol
  ) {
    const rowCount = quoteLastRow - 1;
    const modes = quoteSheet
      .getRange(2, modeCol, rowCount, 1)
      .getValues();
    const goodsValues = quoteSheet
      .getRange(2, goodsCol, rowCount, 1)
      .getValues();
    const discounts = quoteSheet
      .getRange(2, discountCol, rowCount, 1)
      .getValues();
    const vatAmounts = quoteSheet
      .getRange(2, vatAmountCol, rowCount, 1)
      .getValues();

    let modeChanged = false;

    for (let index = 0; index < rowCount; index++) {
      if (clean_(modes[index][0])) continue;

      const goods = Number(goodsValues[index][0] || 0);
      const discount = Number(discounts[index][0] || 0);
      const vatAmount = Number(vatAmounts[index][0] || 0);
      const taxable = Math.max(0, goods - discount);

      let mode = 'INCLUDED_8';

      if (taxable > 0 && vatAmount > 0) {
        const rate = vatAmount / taxable;

        if (Math.abs(rate - 0.10) < 0.002) {
          mode = 'EXCLUDED_10';
        } else if (Math.abs(rate - 0.08) < 0.002) {
          mode = 'EXCLUDED_8';
        }
      }

      modes[index][0] = mode;
      modeChanged = true;
    }

    if (modeChanged) {
      quoteSheet
        .getRange(2, modeCol, rowCount, 1)
        .setValues(modes);
    }
  }
}
'''
    text = text[:start] + replacement + text[end:]
    path.write_text(text, encoding='utf-8')
    print('Optimized ensurePricingColumns_ with narrow reads and batch writes.')
