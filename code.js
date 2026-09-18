
const APP = {
  SHEETS: {
    CUSTOMERS: 'KHACH_HANG',
    PRODUCTS: 'SAN_PHAM',
    QUOTES: 'BAO_GIA',
    QUOTE_LINES: 'CHI_TIET_BAO_GIA',
    CONTRACTS: 'HOP_DONG',
    CONFIG: 'CAU_HINH',
    GROUPS: 'NHOM_HANG'
  },
  TZ: 'Asia/Ho_Chi_Minh'
};


const APP_RUNTIME = {
  READY_KEY: 'TD_SALES_READY_V1923',
  PHONE_MIGRATION_KEY: 'TD_SALES_PHONE_TEXT_V1923'
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Thành Đức Sales')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Không tìm thấy sheet: ' + name);
  return sh;
}

function clean_(v) {
  return String(v == null ? '' : v).replace(/^\uFEFF/, '').trim();
}

function rows_(name) {
  const sh = sheet_(name);
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();

  if (lastRow < 1 || lastCol < 1) return [];

  const values = sh
    .getRange(1, 1, lastRow, lastCol)
    .getValues();

  const headers = values[0].map(clean_);

  return values.slice(1)
    .filter(r => r.some(v => v !== '' && v != null))
    .map(r => {
      const o = {};
      headers.forEach((h, i) => o[h] = r[i]);
      return o;
    });
}

function sheetHeaderMap_(sh) {
  const lastCol = sh.getLastColumn();

  if (lastCol < 1) {
    return {
      headers: [],
      byName: {}
    };
  }

  const headers = sh
    .getRange(1, 1, 1, lastCol)
    .getValues()[0]
    .map(clean_);

  const byName = {};
  headers.forEach((header, index) => {
    if (header) byName[header] = index + 1;
  });

  return {
    headers: headers,
    byName: byName
  };
}

function columnValues_(sh, columnIndex) {
  const lastRow = sh.getLastRow();

  if (lastRow < 2 || columnIndex < 1) {
    return [];
  }

  return sh
    .getRange(2, columnIndex, lastRow - 1, 1)
    .getValues()
    .map(row => row[0]);
}


function findDataRowsByValue_(sh, columnIndex, value) {
  const target = clean_(value);
  const lastRow = sh.getLastRow();

  if (!target || lastRow < 2 || columnIndex < 1) {
    return [];
  }

  return sh
    .getRange(2, columnIndex, lastRow - 1, 1)
    .createTextFinder(target)
    .matchEntireCell(true)
    .findAll()
    .map(range => range.getRow())
    .sort((a, b) => a - b);
}


function findObjectByValue_(sheetName, columnName, value) {
  const sh = sheet_(sheetName);
  const meta = sheetHeaderMap_(sh);
  const column = meta.byName[columnName] || 0;

  if (!column) return null;

  const row = findDataRowByValue_(sh, column, value);
  if (!row) return null;

  const values = sh
    .getRange(row, 1, 1, meta.headers.length)
    .getValues()[0];

  const result = {};
  meta.headers.forEach((header, index) => {
    result[header] = values[index];
  });

  return result;
}

function recentRows_(sheetName, limit) {
  const sh = sheet_(sheetName);
  const meta = sheetHeaderMap_(sh);
  const lastRow = sh.getLastRow();
  const lastCol = meta.headers.length;
  const safeLimit = Math.max(1, Number(limit || 20));

  if (lastRow < 2 || lastCol < 1) return [];

  const startRow = Math.max(2, lastRow - safeLimit + 1);
  const values = sh
    .getRange(startRow, 1, lastRow - startRow + 1, lastCol)
    .getValues();

  return values
    .filter(row => row.some(value => value !== '' && value != null))
    .map(row => {
      const item = {};
      meta.headers.forEach((header, index) => {
        item[header] = row[index];
      });
      return item;
    });
}

function deleteRowBlocks_(sh, rows) {
  if (!Array.isArray(rows) || !rows.length) return 0;

  const sorted = rows
    .slice()
    .sort((a, b) => a - b);

  const blocks = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];

    if (current === prev + 1) {
      prev = current;
      continue;
    }

    blocks.push([start, prev - start + 1]);
    start = current;
    prev = current;
  }

  blocks.push([start, prev - start + 1]);

  blocks
    .sort((a, b) => b[0] - a[0])
    .forEach(block => sh.deleteRows(block[0], block[1]));

  return sorted.length;
}

function cfg_() {
  const out = {};
  rows_(APP.SHEETS.CONFIG).forEach(x => out[clean_(x.Khoa)] = x.GiaTri);
  return out;
}

function nextNo_(prefix) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ym = Utilities.formatDate(new Date(), APP.TZ, 'yyyyMM');
    const key = prefix + '_' + ym;
    const p = PropertiesService.getScriptProperties();
    const n = Number(p.getProperty(key) || 0) + 1;
    p.setProperty(key, String(n));
    return prefix + '-' + ym + '-' + String(n).padStart(4, '0');
  } finally {
    lock.releaseLock();
  }
}



function refreshProductValidationRules_(
  groupSheet
) {
  const productSheet = ss_().getSheetByName(
    APP.SHEETS.PRODUCTS
  );

  const groups = groupSheet ||
    ss_().getSheetByName(
      APP.SHEETS.GROUPS
    );

  if (
    !productSheet ||
    !groups ||
    groups.getLastRow() < 2
  ) {
    return;
  }

  const rowCount = Math.max(
    productSheet.getMaxRows() - 1,
    1
  );

  const groupCount = Math.max(
    groups.getLastRow() - 1,
    1
  );

  const groupRange = groups.getRange(
    2,
    2,
    groupCount,
    1
  );

  const unitRule = SpreadsheetApp
    .newDataValidation()
    .requireValueInList(
      allowedProductUnits_(),
      true
    )
    .setAllowInvalid(false)
    .build();

  const groupRule = SpreadsheetApp
    .newDataValidation()
    .requireValueInRange(
      groupRange,
      true
    )
    .setAllowInvalid(false)
    .build();

  /*
   * Cột C: Đơn vị tính
   * Cột G: Nhóm hàng
   *
   * Quy tắc được làm mới theo số nhóm hiện tại,
   * không còn cố định B2:B7.
   */
  productSheet
    .getRange(
      2,
      3,
      rowCount,
      1
    )
    .setDataValidation(unitRule);

  productSheet
    .getRange(
      2,
      7,
      rowCount,
      1
    )
    .setDataValidation(groupRule);
}


function applyProductValidationToRow_(row, groupSheet) {
  const productSheet = ss_().getSheetByName(
    APP.SHEETS.PRODUCTS
  );

  const groups = groupSheet || ss_().getSheetByName(
    APP.SHEETS.GROUPS
  );

  if (!productSheet || !groups || row < 2) return;

  const unitRule = SpreadsheetApp
    .newDataValidation()
    .requireValueInList(
      allowedProductUnits_(),
      true
    )
    .setAllowInvalid(false)
    .build();

  productSheet
    .getRange(row, 3)
    .setDataValidation(unitRule);

  if (groups.getLastRow() >= 2) {
    const groupRule = SpreadsheetApp
      .newDataValidation()
      .requireValueInRange(
        groups.getRange(
          2,
          2,
          groups.getLastRow() - 1,
          1
        ),
        true
      )
      .setAllowInvalid(false)
      .build();

    productSheet
      .getRange(row, 7)
      .setDataValidation(groupRule);
  }
}

function ensureProductGroupSheet_() {
  let sh = ss_().getSheetByName(
    APP.SHEETS.GROUPS
  );

  if (!sh) {
    sh = ss_().insertSheet(
      APP.SHEETS.GROUPS
    );
  }

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, 4)
      .setValues([[
        'MaNhom',
        'TenNhom',
        'ThuTu',
        'DangDung'
      ]]);
  }

  const header = sh.getRange(
    1,
    1,
    1,
    4
  );

  header
    .setFontWeight('bold')
    .setFontColor('#ffffff')
    .setBackground('#0f766e');

  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 90);
  sh.setColumnWidth(2, 220);
  sh.setColumnWidth(3, 70);
  sh.setColumnWidth(4, 90);

  const groupMeta = sheetHeaderMap_(sh);
  const groupNameCol = groupMeta.byName.TenNhom || 0;

  const currentNames = groupNameCol
    ? columnValues_(sh, groupNameCol)
        .map(value => clean_(value).toLowerCase())
        .filter(Boolean)
    : [];

  const productSheet = sheet_(APP.SHEETS.PRODUCTS);
  const productMeta = sheetHeaderMap_(productSheet);
  const productGroupCol = productMeta.byName.NhomHang || 0;

  const productGroups = productGroupCol
    ? columnValues_(productSheet, productGroupCol)
        .map(value => clean_(value))
        .filter(Boolean)
    : [];

  const defaults = [
    'Máy in',
    'Hộp mực',
    'Mực nạp',
    'Linh kiện máy in',
    'Thiết bị văn phòng',
    'Dịch vụ'
  ];

  const requiredGroups = [
    'Dịch vụ sửa chữa'
  ];

  const candidates =
    productGroups.length
      ? productGroups.concat(
          requiredGroups
        )
      : defaults.concat(
          requiredGroups
        );

  const unique = [];
  const seen = {};

  candidates.forEach(name => {
    const normalized = clean_(name)
      .toLowerCase();

    if (
      normalized &&
      !seen[normalized] &&
      currentNames.indexOf(
        normalized
      ) < 0
    ) {
      seen[normalized] = true;
      unique.push(clean_(name));
    }
  });

  if (unique.length) {
    const start =
      sh.getLastRow() + 1;

    const newRows = unique.map(
      (name, index) => [
        nextGroupCode_(),
        name,
        start + index - 1,
        true
      ]
    );

    sh.getRange(
      start,
      1,
      newRows.length,
      4
    ).setValues(newRows);
  }

  /*
   * Sau khi thêm nhóm, cập nhật lại xác thực
   * cho toàn bộ danh mục sản phẩm.
   */
  refreshProductValidationRules_(sh);

  return sh;
}

function nextGroupCode_() {
  const sh = ss_().getSheetByName(APP.SHEETS.GROUPS);

  if (!sh || sh.getLastRow() < 2) {
    return 'NH001';
  }

  const values = sh
    .getRange(2, 1, sh.getLastRow() - 1, 1)
    .getValues()
    .flat();

  let max = 0;

  values.forEach(value => {
    const match = clean_(value).match(/(\d+)$/);

    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  });

  return 'NH' + String(max + 1).padStart(3, '0');
}

function getProductGroups_() {
  const groupSheet = ss_().getSheetByName(
    APP.SHEETS.GROUPS
  );

  if (!groupSheet || groupSheet.getLastRow() === 0) {
    ensureProductGroupSheet_();
  }

  return rows_(APP.SHEETS.GROUPS)
    .filter(x => x.DangDung !== false)
    .map(x => ({
      id: clean_(x.MaNhom),
      name: clean_(x.TenNhom),
      order: Number(x.ThuTu || 0),
      active: x.DangDung !== false
    }))
    .filter(x => x.id && x.name)
    .sort((a, b) =>
      a.order - b.order ||
      a.name.localeCompare(b.name, 'vi')
    );
}

function validateProductGroupName_(name, ignoreId) {
  const normalized = clean_(name).toLowerCase();

  if (!normalized) {
    throw new Error('Tên nhóm hàng không được để trống.');
  }

  const duplicate = getProductGroups_().find(group =>
    group.id !== clean_(ignoreId) &&
    group.name.toLowerCase() === normalized
  );

  if (duplicate) {
    throw new Error(
      'Nhóm hàng "' + clean_(name) + '" đã tồn tại.'
    );
  }
}

function saveProductGroup(group) {
  group = group || {};
  validateProductGroupName_(group.name, '');

  const sh = ensureProductGroupSheet_();
  const id = nextGroupCode_();
  const order = Number.isFinite(Number(group.order))
    ? Number(group.order)
    : sh.getLastRow();

  sh.appendRow([
    id,
    clean_(group.name),
    order,
    true
  ]);

  return {
    success: true,
    id: id,
    message: 'Đã thêm nhóm hàng ' + clean_(group.name)
  };
}

function updateProductGroup(group) {
  group = group || {};

  if (!clean_(group.id)) {
    throw new Error('Thiếu mã nhóm hàng.');
  }

  validateProductGroupName_(
    group.name,
    group.id
  );

  const sh = ensureProductGroupSheet_();
  const meta = sheetHeaderMap_(sh);
  const idCol = meta.byName.MaNhom || 0;
  const nameCol = meta.byName.TenNhom || 0;
  const orderCol = meta.byName.ThuTu || 0;

  if (!idCol || !nameCol) {
    throw new Error(
      'Sheet NHOM_HANG thiếu cột MaNhom hoặc TenNhom.'
    );
  }

  const row = findDataRowByValue_(
    sh,
    idCol,
    group.id
  );

  if (!row) {
    throw new Error('Không tìm thấy nhóm hàng.');
  }

  const oldName = clean_(
    sh.getRange(row, nameCol).getValue()
  );
  const newName = clean_(group.name);

  const groupRow = sh
    .getRange(row, 1, 1, meta.headers.length)
    .getValues()[0];

  groupRow[nameCol - 1] = newName;

  if (orderCol) {
    groupRow[orderCol - 1] = Number(group.order || 0);
  }

  sh.getRange(row, 1, 1, meta.headers.length)
    .setValues([groupRow]);

  if (
    oldName &&
    oldName.toLowerCase() !== newName.toLowerCase()
  ) {
    const productSheet = sheet_(APP.SHEETS.PRODUCTS);
    const productMeta = sheetHeaderMap_(productSheet);
    const groupCol = productMeta.byName.NhomHang || 0;

    if (groupCol && productSheet.getLastRow() >= 2) {
      const range = productSheet.getRange(
        2,
        groupCol,
        productSheet.getLastRow() - 1,
        1
      );
      const values = range.getValues();
      let changed = false;

      values.forEach(rowValues => {
        if (
          clean_(rowValues[0]).toLowerCase() ===
          oldName.toLowerCase()
        ) {
          rowValues[0] = newName;
          changed = true;
        }
      });

      if (changed) {
        range.setValues(values);
      }
    }
  }

  return {
    success: true,
    id: clean_(group.id),
    message: 'Đã cập nhật nhóm hàng ' + newName
  };
}

function deleteProductGroup(groupId) {
  const id = clean_(groupId);

  if (!id) {
    throw new Error('Thiếu mã nhóm hàng.');
  }

  const sh = ensureProductGroupSheet_();
  const meta = sheetHeaderMap_(sh);
  const idCol = meta.byName.MaNhom || 0;
  const nameCol = meta.byName.TenNhom || 0;

  if (!idCol || !nameCol) {
    throw new Error(
      'Sheet NHOM_HANG thiếu cột MaNhom hoặc TenNhom.'
    );
  }

  const row = findDataRowByValue_(sh, idCol, id);

  if (!row) {
    throw new Error('Không tìm thấy nhóm hàng.');
  }

  const name = clean_(
    sh.getRange(row, nameCol).getValue()
  );

  const productSheet = sheet_(APP.SHEETS.PRODUCTS);
  const productMeta = sheetHeaderMap_(productSheet);
  const groupCol = productMeta.byName.NhomHang || 0;

  let inUse = false;

  if (groupCol) {
    inUse = columnValues_(productSheet, groupCol)
      .some(value =>
        clean_(value).toLowerCase() ===
        name.toLowerCase()
      );
  }

  if (inUse) {
    throw new Error(
      'Không thể xóa nhóm "' + name +
      '" vì đang có sản phẩm sử dụng.'
    );
  }

  sh.deleteRow(row);

  return {
    success: true,
    id: id,
    message: 'Đã xóa nhóm hàng ' + name
  };
}




function booleanValue_(value, fallback) {
  if (value === true || value === false) {
    return value;
  }

  const text = clean_(value).toLowerCase();

  if (['true', '1', 'yes', 'có', 'co'].indexOf(text) >= 0) {
    return true;
  }

  if (['false', '0', 'no', 'không', 'khong'].indexOf(text) >= 0) {
    return false;
  }

  return Boolean(fallback);
}

function isUsedProductName_(name) {
  const text = clean_(name).toLowerCase();

  return [
    'đã qua sử dụng',
    'da qua su dung',
    'máy cũ',
    'may cu',
    ' hàng cũ',
    ' hang cu',
    'dùng lướt',
    'dung luot',
    'thanh lý',
    'thanh ly',
    'second hand',
    'used'
  ].some(keyword => text.indexOf(keyword) >= 0);
}

function ensurePricingColumns_() {
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

function normalizeProductTax_(product) {
  product = product || {};

  const used = booleanValue_(
    product.used,
    isUsedProductName_(product.name)
  );

  const vat = used
    ? 0
    : (
        Number.isFinite(Number(product.vat))
          ? Number(product.vat)
          : 0.08
      );

  const priceIncludesVat = used
    ? false
    : booleanValue_(product.priceIncludesVat, true);

  return {
    used: used,
    vat: vat,
    priceIncludesVat: priceIncludesVat
  };
}


function normalizeQuoteTaxMode_(mode) {
  const value = clean_(mode).toUpperCase();

  if (value === 'AUTO') {
    return 'INCLUDED_8';
  }

  const allowed = [
    'NO_VAT',
    'INCLUDED_8',
    'EXCLUDED_8',
    'INCLUDED_10',
    'EXCLUDED_10'
  ];

  return allowed.indexOf(value) >= 0
    ? value
    : 'INCLUDED_8';
}

function quoteTaxModeLabel_(mode) {
  const normalized =
    pricingEngine_().normalizeMode(mode);

  const labels = {
    NO_VAT: 'Không tính VAT',
    INCLUDED_8:
      'Giá đã gồm VAT 8%',
    EXCLUDED_8:
      'Giá chưa gồm VAT 8%',
    INCLUDED_10:
      'Giá đã gồm VAT 10%',
    EXCLUDED_10:
      'Giá chưa gồm VAT 10%'
  };

  return labels[normalized];
}

function resolveItemTax_(item, quoteTaxMode) {
  const mode = pricingEngine_().normalizeMode(quoteTaxMode);

  if (mode === 'NO_VAT') {
    return {
      used: Boolean(item && item.used),
      vat: 0,
      priceIncludesVat: true
    };
  }

  if (mode === 'INCLUDED_8') {
    return {
      used: false,
      vat: 0.08,
      priceIncludesVat: true
    };
  }

  if (mode === 'EXCLUDED_8') {
    return {
      used: false,
      vat: 0.08,
      priceIncludesVat: false
    };
  }

  if (mode === 'INCLUDED_10') {
    return {
      used: false,
      vat: 0.10,
      priceIncludesVat: true
    };
  }

  if (mode === 'EXCLUDED_10') {
    return {
      used: false,
      vat: 0.10,
      priceIncludesVat: false
    };
  }

  return normalizeProductTax_(item);
}

function inferSavedQuoteTaxMode_(quote) {
  const stored = pricingEngine_().normalizeMode(
    quote && quote.CheDoVAT
  );

  if (
    quote &&
    clean_(quote.CheDoVAT)
  ) {
    return stored;
  }

  const goods = Number(
    quote && quote.TienHang || 0
  );

  const discount = Number(
    quote && quote.ChietKhau || 0
  );

  const vatAmount = Number(
    quote && quote.VAT || 0
  );

  const taxable = Math.max(
    0,
    goods - discount
  );

  if (taxable > 0 && vatAmount > 0) {
    const rate = vatAmount / taxable;

    if (Math.abs(rate - 0.10) < 0.002) {
      return 'EXCLUDED_10';
    }

    if (Math.abs(rate - 0.08) < 0.002) {
      return 'EXCLUDED_8';
    }
  }

  return 'INCLUDED_8';
}

function calculateItemPricing_(item, quoteTaxMode) {
  item = item || {};

  const tax = pricingEngine_().resolveItemTax(
    item,
    quoteTaxMode
  );

  /*
   * Tiền Việt Nam được làm tròn đến đơn vị đồng.
   * Không giữ phần thập phân như 11.111,111 đồng.
   */
  const amount = Math.round(
    Math.max(
      0,
      Number(item.qty || 0) *
      Number(item.price || 0) -
      Number(item.lineDiscount || 0)
    )
  );

  let net = amount;
  let vatAmount = 0;
  let payable = amount;

  if (
    tax.vat > 0 &&
    tax.priceIncludesVat
  ) {
    vatAmount = Math.round(
      amount * tax.vat /
      (1 + tax.vat)
    );

    net = amount - vatAmount;
    payable = amount;
  } else if (tax.vat > 0) {
    vatAmount = Math.round(
      amount * tax.vat
    );

    net = amount;
    payable = amount + vatAmount;
  }

  return {
    net: net,
    vatAmount: vatAmount,
    payable: payable,
    vat: tax.vat,
    priceIncludesVat:
      tax.priceIncludesVat,
    used: tax.used
  };
}

function calculateQuotePricing_(
  items,
  discount,
  quoteTaxMode
) {
  items = Array.isArray(items)
    ? items
    : [];

  let netBeforeDiscount = 0;
  let vatBeforeDiscount = 0;
  let grossBeforeDiscount = 0;

  items.forEach(item => {
    const line = pricingEngine_().calculateItem(
      item,
      quoteTaxMode
    );

    netBeforeDiscount += line.net;
    vatBeforeDiscount += line.vatAmount;
    grossBeforeDiscount += line.payable;
  });

  grossBeforeDiscount = Math.round(
    grossBeforeDiscount
  );

  const normalizedDiscount = Math.round(
    Math.min(
      Math.max(
        0,
        Number(discount || 0)
      ),
      grossBeforeDiscount
    )
  );

  const total = Math.round(
    grossBeforeDiscount -
    normalizedDiscount
  );

  /*
   * Giảm giá toàn đơn được phân bổ theo tỷ lệ vào:
   * - tiền hàng chưa VAT;
   * - tiền thuế VAT.
   */
  const remainingRatio =
    grossBeforeDiscount > 0
      ? total / grossBeforeDiscount
      : 0;

  const netAmount = Math.round(
    netBeforeDiscount *
    remainingRatio
  );

  /*
   * Lấy VAT bằng phần còn lại để bảo đảm:
   * Tiền hàng chưa VAT + VAT = Thanh toán.
   */
  const vatAmount = Math.round(
    total - netAmount
  );

  return {
    grossAmount: grossBeforeDiscount,
    discount: normalizedDiscount,
    subtotal: netAmount,
    netAmount: netAmount,
    vatAmount: vatAmount,
    total: total
  };
}

function itemVatLabel_(
  item,
  quoteTaxMode
) {
  const mode = pricingEngine_().normalizeMode(
    quoteTaxMode
  );

  if (mode === 'NO_VAT') {
    return 'VAT 0% — giá đã gồm VAT';
  }

  return pricingEngine_().modeLabel(mode);
}


function quoteTaxModeInfo_(mode) {
  const normalized = pricingEngine_().normalizeMode(mode);
  const noVat = normalized === 'NO_VAT';
  const included =
    normalized === 'INCLUDED_8' ||
    normalized === 'INCLUDED_10';
  const rate = noVat
    ? 0
    : (normalized.indexOf('10') >= 0 ? 0.1 : 0.08);

  return {
    mode: normalized,
    noVat: noVat,
    included: included,
    rate: rate,
    ratePercent: Math.round(rate * 100)
  };
}

function pricingEngine_() {
  return {
    normalizeMode: normalizeQuoteTaxMode_,
    modeInfo: quoteTaxModeInfo_,
    modeLabel: quoteTaxModeLabel_,
    resolveItemTax: resolveItemTax_,
    inferSavedMode: inferSavedQuoteTaxMode_,
    calculateItem: calculateItemPricing_,
    calculateQuote: calculateQuotePricing_
  };
}

function migrateQuoteTotalsToNet_() {
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

      const taxMode = pricingEngine_().inferSavedMode(quoteObject);
      const totals = pricingEngine_().calculateQuote(
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


function normalizePhone_(value) {
  let phone = clean_(value).replace(/\D/g, '');

  if (!phone) return '';

  /*
   * Dữ liệu cũ từng bị Google Sheets coi là số,
   * làm mất số 0 đầu. Khôi phục theo quy ước số VN:
   * - di động: 9 số sau khi mất số 0;
   * - bàn: thường còn 10 số và bắt đầu bằng 2.
   * Với dữ liệu nội bộ chỉ lưu chữ số, nếu chưa có 0
   * và dài từ 8 đến 11 số thì thêm lại 0 ở đầu.
   */
  if (
    phone.startsWith('84') &&
    phone.length >= 10 &&
    phone.length <= 12
  ) {
    phone = '0' + phone.slice(2);
  } else if (
    phone.charAt(0) !== '0' &&
    phone.length >= 8 &&
    phone.length <= 11
  ) {
    phone = '0' + phone;
  }

  return phone;
}

function ensureQuotePhoneText_() {
  const properties = PropertiesService.getScriptProperties();

  if (
    properties.getProperty(
      APP_RUNTIME.PHONE_MIGRATION_KEY
    ) === 'DONE'
  ) {
    return;
  }

  const quoteSheet = sheet_(APP.SHEETS.QUOTES);
  const lastRow = quoteSheet.getLastRow();
  const lastCol = quoteSheet.getLastColumn();

  if (lastRow < 1 || lastCol < 1) {
    properties.setProperty(
      APP_RUNTIME.PHONE_MIGRATION_KEY,
      'DONE'
    );
    return;
  }

  const headers = quoteSheet
    .getRange(1, 1, 1, lastCol)
    .getValues()[0]
    .map(clean_);

  const phoneCol = headers.indexOf('DienThoai');

  if (phoneCol < 0) {
    properties.setProperty(
      APP_RUNTIME.PHONE_MIGRATION_KEY,
      'DONE'
    );
    return;
  }

  if (lastRow >= 2) {
    const range = quoteSheet.getRange(
      2,
      phoneCol + 1,
      lastRow - 1,
      1
    );

    const phones = range.getValues().map(row => [
      normalizePhone_(row[0])
    ]);

    range
      .setNumberFormat('@')
      .setValues(phones);
  }

  properties.setProperty(
    APP_RUNTIME.PHONE_MIGRATION_KEY,
    'DONE'
  );
}

function ensureAppReady_() {
  const properties = PropertiesService.getScriptProperties();

  if (
    properties.getProperty(APP_RUNTIME.READY_KEY) ===
    'DONE'
  ) {
    return;
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    if (
      properties.getProperty(APP_RUNTIME.READY_KEY) ===
      'DONE'
    ) {
      return;
    }

    /*
     * Các tác vụ dưới đây có ghi/định dạng cả cột nên
     * chỉ chạy một lần sau khi nâng phiên bản, thay vì
     * chạy ở mỗi lần mở ứng dụng.
     */
    ensureProductGroupSheet_();
    ensurePricingColumns_();
    ensureCustomerTextColumns_();
    ensureQuotePhoneText_();
    migrateQuoteTotalsToNet_();

    properties.setProperty(
      APP_RUNTIME.READY_KEY,
      'DONE'
    );
  } finally {
    lock.releaseLock();
  }
}

function bootstrap() {
  ensureAppReady_();

  const customers = rows_(APP.SHEETS.CUSTOMERS)
    .filter(x => x.DangHoatDong !== false)
    .map(x => ({
      id: clean_(x.MaKhachHang),
      name: clean_(x.TenKhachHang),
      address: clean_(x.DiaChi),
      tax: clean_(x.MaSoThue),
      phone: normalizePhone_(x.DienThoai),
      email: clean_(x.Email),
      representative: clean_(x.NguoiDaiDien),
      position: clean_(x.ChucVu),
      recipient: clean_(x.NguoiNhan),
      type: clean_(x.LoaiKhach),
      note: clean_(x.GhiChu)
    }));

  const products = rows_(APP.SHEETS.PRODUCTS)
    .filter(x => x.DangKinhDoanh !== false)
    .map(x => {
      const tax = normalizeProductTax_({
        name: x.TenSanPham,
        vat: x.VAT,
        priceIncludesVat: x.GiaDaGomVAT,
        used: x.DaQuaSuDung
      });

      return {
        code: clean_(x.MaSanPham),
        name: clean_(x.TenSanPham),
        unit: clean_(x.DonViTinh) || 'Cái',
        price: Number(x.GiaBan || 0),
        cost: Number(x.GiaVon || 0),
        vat: tax.vat,
        priceIncludesVat: tax.priceIncludesVat,
        used: tax.used,
        group: clean_(x.NhomHang),
        warranty: clean_(x.BaoHanh),
        description: clean_(x.MoTa)
      };
    });

  return {
    customers: customers,
    products: products,
    groups: getProductGroups_(),
    /* Báo giá/hợp đồng chỉ tải khi mở trang lịch sử. */
    quotes: [],
    contracts: [],
    config: cfg_()
  };
}


function normalizeTaxCode_(value) {
  return clean_(value)
    .replace(/\s+/g, '');
}

function ensureCustomerTextColumns_() {
  const sh = sheet_(APP.SHEETS.CUSTOMERS);
  const headers = sh
    .getRange(1, 1, 1, sh.getLastColumn())
    .getValues()[0]
    .map(clean_);

  const taxCol = headers.indexOf('MaSoThue');
  const phoneCol = headers.indexOf('DienThoai');
  const rowCount = Math.max(
    sh.getMaxRows() - 1,
    1
  );

  /*
   * Định dạng văn bản để:
   * - không mất số 0 ở đầu;
   * - không chuyển thành số khoa học;
   * - giữ dấu gạch ngang trong mã số thuế.
   */
  if (taxCol >= 0) {
    sh.getRange(
      2,
      taxCol + 1,
      rowCount,
      1
    ).setNumberFormat('@');
  }

  if (phoneCol >= 0) {
    sh.getRange(
      2,
      phoneCol + 1,
      rowCount,
      1
    ).setNumberFormat('@');
  }
}

function validateCustomer_(c, requireId) {
  if (!c) {
    throw new Error(
      'Dữ liệu khách hàng không hợp lệ.'
    );
  }

  if (
    requireId &&
    !clean_(c.id)
  ) {
    throw new Error(
      'Thiếu mã khách hàng.'
    );
  }

  if (!clean_(c.name)) {
    throw new Error(
      'Tên khách hàng/công ty không được để trống.'
    );
  }

  const phone = clean_(c.phone);

  if (
    phone &&
    !/^[0-9]{8,12}$/.test(phone)
  ) {
    throw new Error(
      'Số điện thoại phải gồm 8–12 chữ số, ' +
      'không có chữ hoặc ký tự đặc biệt.'
    );
  }

  const tax = normalizeTaxCode_(c.tax);

  if (
    tax &&
    !/^[0-9]+(?:-[0-9]+)*$/.test(tax)
  ) {
    throw new Error(
      'Mã số thuế chỉ được gồm chữ số và dấu gạch ngang. ' +
      'Ví dụ: 0313015734-001.'
    );
  }

  if (tax.length > 30) {
    throw new Error(
      'Mã số thuế không được dài quá 30 ký tự.'
    );
  }

  const email = clean_(c.email);

  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error(
      'Địa chỉ email không đúng định dạng.'
    );
  }
}

function contractMissingFields_(customer) {
  const missing = [];
  if (!clean_(customer.TenKhachHang)) missing.push('Tên khách hàng/công ty');
  if (!clean_(customer.DiaChi)) missing.push('Địa chỉ');
  if (!clean_(customer.MaSoThue)) missing.push('Mã số thuế');
  if (!clean_(customer.NguoiDaiDien)) missing.push('Người đại diện');
  if (!clean_(customer.ChucVu)) missing.push('Chức vụ');
  return missing;
}

function validateContractCustomer_(customer) {
  const missing = contractMissingFields_(customer);
  if (missing.length) {
    throw new Error(
      'Chưa đủ thông tin tạo hợp đồng: ' + missing.join(', ') +
      '. Hãy bổ sung thông tin khách hàng trước.'
    );
  }
}

function saveContractInfoAndCreate(request) {
  request = request || {};
  const customer = request.customer || {};
  const customerId = clean_(customer.id);
  const quoteNo = clean_(request.quoteNo);
  const type = clean_(request.type).toUpperCase();

  if (!customerId) throw new Error('Thiếu mã khách hàng để cập nhật hồ sơ hợp đồng.');
  if (type !== 'HĐMB' && type !== 'HĐNT') throw new Error('Loại hợp đồng không hợp lệ.');

  updateCustomer(customer);

  if (quoteNo) return createContract(quoteNo, type);
  if (type !== 'HĐNT') throw new Error('Hợp đồng mua bán phải được tạo từ một báo giá đã lưu.');
  return createPrincipleContractForCustomer(customerId);
}


function allowedProductUnits_() {
  return [
    'Cái',
    'Chiếc',
    'Bộ',
    'Hộp',
    'Thùng',
    'Túi',
    'Chai',
    'Cụm',
    'Ống',
    'KG',
    'Ram',
    'Lần'
  ];
}

function nextProductCode_() {
  const sh = sheet_(APP.SHEETS.PRODUCTS);
  const meta = sheetHeaderMap_(sh);
  const codeCol = meta.byName.MaSanPham;

  if (!codeCol) {
    throw new Error('Sheet SAN_PHAM thiếu cột MaSanPham.');
  }

  let maxNumber = 0;

  columnValues_(sh, codeCol).forEach(value => {
    const code = clean_(value);
    const match = code.match(/^TD-(\d{4,})$/i);

    if (match) {
      maxNumber = Math.max(
        maxNumber,
        Number(match[1])
      );
    }
  });

  return 'TD-' +
    String(maxNumber + 1).padStart(4, '0');
}

function validateProduct_(p) {
  if (!p) {
    throw new Error('Dữ liệu sản phẩm không hợp lệ.');
  }

  if (!clean_(p.code) || !/^TD-\d{4,}$/i.test(clean_(p.code))) {
    throw new Error('Mã sản phẩm phải có dạng TD-0001.');
  }

  if (!clean_(p.name)) {
    throw new Error('Tên sản phẩm không được để trống.');
  }

  const unit = clean_(p.unit);
  const allowedUnits = allowedProductUnits_();

  if (!unit || !allowedUnits.includes(unit)) {
    throw new Error(
      'Đơn vị tính phải là: ' +
      allowedUnits.join(', ') + '.'
    );
  }

  const price = Number(p.price);
  const cost = Number(p.cost);

  if (!Number.isFinite(price) || price < 0) {
    throw new Error('Giá bán phải là số từ 0 trở lên.');
  }

  if (!Number.isFinite(cost) || cost < 0) {
    throw new Error('Giá vốn phải là số từ 0 trở lên.');
  }

  const tax = normalizeProductTax_(p);

  if (![0, 0.08, 0.1].includes(tax.vat)) {
    throw new Error('VAT chỉ được chọn 0%, 8% hoặc 10%.');
  }

  if (tax.used && tax.vat !== 0) {
    throw new Error('Sản phẩm đã qua sử dụng phải để VAT 0% — giá đã gồm VAT.');
  }

  if (tax.used && tax.priceIncludesVat) {
    throw new Error(
      'Sản phẩm đã qua sử dụng không chọn Giá đã gồm VAT.'
    );
  }

  const groupName = clean_(p.group);

  if (groupName) {
    const exists = getProductGroups_()
      .some(group =>
        group.name.toLowerCase() === groupName.toLowerCase()
      );

    if (!exists) {
      throw new Error(
        'Nhóm hàng "' + groupName +
        '" chưa có trong danh sách nhóm.'
      );
    }
  }
}

function saveCustomer(c) {
  validateCustomer_(c, false);
  ensureAppReady_();

  const sh = sheet_(APP.SHEETS.CUSTOMERS);
  const id =
    'KH' +
    String(sh.getLastRow()).padStart(
      4,
      '0'
    );

  const tax = normalizeTaxCode_(c.tax);
  const phone = normalizePhone_(c.phone);
  const row = sh.getLastRow() + 1;

  const customer = {
    id: id,
    name: clean_(c.name),
    address: clean_(c.address),
    tax: tax,
    phone: phone,
    email: clean_(c.email),
    representative: clean_(c.representative),
    position: clean_(c.position),
    recipient: clean_(c.recipient),
    type: clean_(c.type) || 'Khách hàng',
    note: clean_(c.note)
  };

  sh.getRange(row, 1, 1, 12).setValues([[
    customer.id,
    customer.name,
    customer.address,
    customer.tax,
    customer.phone,
    customer.email,
    customer.representative,
    customer.position,
    customer.recipient,
    customer.type,
    customer.note,
    true
  ]]);

  sh.getRangeList([
    'D' + row,
    'E' + row
  ]).setNumberFormat('@');

  return {
    success: true,
    id: id,
    customer: customer,
    message:
      'Đã thêm khách hàng ' + id
  };
}

function updateCustomer(c) {
  validateCustomer_(c, true);
  ensureAppReady_();

  const sh = sheet_(APP.SHEETS.CUSTOMERS);
  const meta = sheetHeaderMap_(sh);
  const idCol = meta.byName.MaKhachHang;

  if (!idCol) {
    throw new Error('Sheet KHACH_HANG thiếu cột MaKhachHang.');
  }

  const row = findDataRowByValue_(
    sh,
    idCol,
    clean_(c.id)
  );

  if (!row) {
    throw new Error(
      'Không tìm thấy khách hàng ' +
      clean_(c.id)
    );
  }

  const customer = {
    id: clean_(c.id),
    name: clean_(c.name),
    address: clean_(c.address),
    tax: normalizeTaxCode_(c.tax),
    phone: normalizePhone_(c.phone),
    email: clean_(c.email),
    representative: clean_(c.representative),
    position: clean_(c.position),
    recipient: clean_(c.recipient),
    type: clean_(c.type),
    note: clean_(c.note)
  };

  const map = {
    TenKhachHang: customer.name,
    DiaChi: customer.address,
    MaSoThue: customer.tax,
    DienThoai: customer.phone,
    Email: customer.email,
    NguoiDaiDien: customer.representative,
    ChucVu: customer.position,
    NguoiNhan: customer.recipient,
    LoaiKhach: customer.type,
    GhiChu: customer.note
  };

  const updatedRow = sh
    .getRange(row, 1, 1, meta.headers.length)
    .getValues()[0];

  Object.keys(map).forEach(key => {
    const col = meta.byName[key];
    if (col) updatedRow[col - 1] = map[key];
  });

  sh.getRange(
    row,
    1,
    1,
    meta.headers.length
  ).setValues([updatedRow]);

  const textRanges = [];
  const taxCol = meta.byName.MaSoThue;
  const phoneCol = meta.byName.DienThoai;

  if (taxCol) {
    textRanges.push(
      sh.getRange(row, taxCol).getA1Notation()
    );
  }

  if (phoneCol) {
    textRanges.push(
      sh.getRange(row, phoneCol).getA1Notation()
    );
  }

  if (textRanges.length) {
    sh.getRangeList(textRanges).setNumberFormat('@');
  }

  return {
    success: true,
    id: customer.id,
    customer: customer,
    message:
      'Đã cập nhật khách hàng ' +
      customer.id
  };
}

function saveProduct(p) {
  p = p || {};

  /*
   * Khởi tạo/migrate trước khi giữ lock tạo mã.
   * ScriptLock không re-entrant, nên gọi ensureAppReady_()
   * bên trong lock có thể tự chờ chính nó ở lần chạy đầu.
   */
  ensureAppReady_();

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const productCode = nextProductCode_();
    const tax = normalizeProductTax_(p);

    const product = {
      code: productCode,
      name: p.name,
      unit: p.unit,
      price: p.price,
      cost: p.cost,
      vat: tax.vat,
      priceIncludesVat: tax.priceIncludesVat,
      used: tax.used,
      group: p.group,
      warranty: p.warranty,
      description: p.description
    };

    validateProduct_(product);

    const productSheet = sheet_(
      APP.SHEETS.PRODUCTS
    );

    const row = productSheet.getLastRow() + 1;

    productSheet
      .getRange(row, 1, 1, 12)
      .setValues([[
        productCode,
        clean_(product.name),
        clean_(product.unit),
        Number(product.price || 0),
        Number(product.cost || 0),
        Number(product.vat || 0),
        clean_(product.group),
        clean_(product.warranty),
        clean_(product.description),
        true,
        product.priceIncludesVat,
        product.used
      ]]);

    /*
     * Chỉ áp dụng validation cho dòng vừa thêm,
     * không quét lại toàn bộ cột sản phẩm.
     */
    applyProductValidationToRow_(row);

    return {
      success: true,
      code: productCode,
      product: {
        code: productCode,
        name: clean_(product.name),
        unit: clean_(product.unit),
        price: Number(product.price || 0),
        cost: Number(product.cost || 0),
        vat: Number(product.vat || 0),
        priceIncludesVat: product.priceIncludesVat,
        used: product.used,
        group: clean_(product.group),
        warranty: clean_(product.warranty),
        description: clean_(product.description)
      },
      message:
        'Đã thêm sản phẩm ' +
        productCode
    };
  } finally {
    lock.releaseLock();
  }
}

function updateProduct(p) {
  ensureAppReady_();

  const tax = normalizeProductTax_(p);
  const product = Object.assign({}, p, tax);

  validateProduct_(product);

  const sh = sheet_(APP.SHEETS.PRODUCTS);
  const meta = sheetHeaderMap_(sh);
  const codeCol = meta.byName.MaSanPham;

  if (!codeCol) {
    throw new Error('Sheet SAN_PHAM thiếu cột MaSanPham.');
  }

  const row = findDataRowByValue_(
    sh,
    codeCol,
    clean_(product.code)
  );

  if (!row) {
    throw new Error(
      'Không tìm thấy sản phẩm ' +
      clean_(product.code)
    );
  }

  const savedProduct = {
    code: clean_(product.code),
    name: clean_(product.name),
    unit: clean_(product.unit),
    price: Number(product.price || 0),
    cost: Number(product.cost || 0),
    vat: Number(product.vat || 0),
    group: clean_(product.group),
    warranty: clean_(product.warranty),
    description: clean_(product.description),
    priceIncludesVat: product.priceIncludesVat,
    used: product.used
  };

  const map = {
    TenSanPham: savedProduct.name,
    DonViTinh: savedProduct.unit,
    GiaBan: savedProduct.price,
    GiaVon: savedProduct.cost,
    VAT: savedProduct.vat,
    NhomHang: savedProduct.group,
    BaoHanh: savedProduct.warranty,
    MoTa: savedProduct.description,
    GiaDaGomVAT: savedProduct.priceIncludesVat,
    DaQuaSuDung: savedProduct.used
  };

  const updatedRow = sh
    .getRange(row, 1, 1, meta.headers.length)
    .getValues()[0];

  Object.keys(map).forEach(key => {
    const col = meta.byName[key];
    if (col) updatedRow[col - 1] = map[key];
  });

  sh.getRange(
    row,
    1,
    1,
    meta.headers.length
  ).setValues([updatedRow]);

  return {
    success: true,
    code: savedProduct.code,
    product: savedProduct,
    message:
      'Đã cập nhật sản phẩm ' +
      savedProduct.code
  };
}

function saveQuote(q) {
  if (
    !q ||
    !Array.isArray(q.items) ||
    !q.items.length
  ) {
    throw new Error('Báo giá chưa có sản phẩm.');
  }

  ensureAppReady_();

  const no = q.no || nextNo_('BG');
  const now = new Date();
  const quoteDate = q.date
    ? new Date(q.date + 'T00:00:00')
    : now;
  const taxMode = pricingEngine_().normalizeMode(q.taxMode);

  const totals = pricingEngine_().calculateQuote(
    q.items,
    q.discount,
    taxMode
  );

  const customer = q.customer || {};
  const phone = normalizePhone_(
    q.phone || customer.phone
  );
  const quoteSheet = sheet_(APP.SHEETS.QUOTES);
  const quoteRow = quoteSheet.getLastRow() + 1;

  quoteSheet
    .getRange(quoteRow, 1, 1, 16)
    .setValues([[
      no,
      quoteDate,
      clean_(customer.id),
      clean_(customer.name),
      clean_(q.contact || customer.recipient),
      phone,
      q.validUntil
        ? new Date(q.validUntil + 'T00:00:00')
        : '',
      totals.netAmount,
      totals.discount,
      totals.vatAmount,
      totals.total,
      'NHÁP',
      Session.getActiveUser().getEmail() || 'Người dùng',
      clean_(q.note),
      '',
      taxMode
    ]]);

  /* Giữ số điện thoại dưới dạng text để không mất số 0 đầu. */
  quoteSheet
    .getRange(quoteRow, 6)
    .setNumberFormat('@');

  const lines = q.items.map((item, index) => {
    const line = pricingEngine_().calculateItem(item, taxMode);

    return [
      no,
      index + 1,
      clean_(item.code),
      clean_(item.name),
      clean_(item.unit) || 'Cái',
      Number(item.qty || 0),
      Number(item.price || 0),
      Number(item.lineDiscount || 0),
      Number(line.vat || 0),
      line.payable,
      line.priceIncludesVat,
      line.used
    ];
  });

  const lineSheet = sheet_(APP.SHEETS.QUOTE_LINES);

  lineSheet
    .getRange(
      lineSheet.getLastRow() + 1,
      1,
      lines.length,
      12
    )
    .setValues(lines);

  return {
    success: true,
    no: no,
    total: totals.total,
    quote: {
      no: no,
      date: formatDate_(quoteDate),
      dateIso: formatDateInput_(quoteDate),
      customerId: clean_(customer.id),
      customer: clean_(customer.name),
      contact: clean_(q.contact || customer.recipient),
      phone: phone,
      validUntil: q.validUntil || '',
      subtotal: totals.netAmount,
      discount: totals.discount,
      vatAmount: totals.vatAmount,
      total: totals.total,
      status: 'NHÁP',
      note: clean_(q.note),
      pdf: ''
    }
  };
}

function listQuotes(filters) {
  filters = filters || {};

  const keyword = clean_(filters.keyword).toLowerCase();
  const status = clean_(filters.status).toUpperCase();
  const from = clean_(filters.from);
  const to = clean_(filters.to);
  const limit = Math.max(
    1,
    Math.min(Number(filters.limit || 1000), 3000)
  );

  const fromDate = from
    ? new Date(from + 'T00:00:00')
    : null;
  const toDate = to
    ? new Date(to + 'T23:59:59')
    : null;

  const sh = sheet_(APP.SHEETS.QUOTES);
  const meta = sheetHeaderMap_(sh);
  const lastRow = sh.getLastRow();
  const lastCol = meta.headers.length;

  if (lastRow < 2 || lastCol < 1) {
    return [];
  }

  const col = name => {
    const index = meta.byName[name];
    return index ? index - 1 : -1;
  };

  const noCol = col('SoBaoGia');
  const dateCol = col('NgayBaoGia');
  const customerIdCol = col('MaKhachHang');
  const customerCol = col('TenKhachHang');
  const contactCol = col('NguoiLienHe');
  const phoneCol = col('DienThoai');
  const validCol = col('HieuLucDen');
  const subtotalCol = col('TienHang');
  const discountCol = col('ChietKhau');
  const vatCol = col('VAT');
  const totalCol = col('TongThanhToan');
  const statusCol = col('TrangThai');
  const noteCol = col('GhiChu');
  const pdfCol = col('LinkPDF');

  if (noCol < 0) {
    throw new Error('Sheet BAO_GIA thiếu cột SoBaoGia.');
  }

  const valueAt = (row, index) =>
    index >= 0 ? row[index] : '';

  const results = [];

  /*
   * Đọc từ cuối sheet theo từng khối. Danh sách lịch sử cần
   * các báo giá mới nhất trước, vì vậy có thể dừng ngay khi
   * đã thu đủ số lượng yêu cầu thay vì getDataRange() toàn bộ.
   */
  const chunkSize = 250;
  let endRow = lastRow;

  while (endRow >= 2 && results.length < limit) {
    const startRow = Math.max(
      2,
      endRow - chunkSize + 1
    );
    const rowCount = endRow - startRow + 1;

    const values = sh
      .getRange(startRow, 1, rowCount, lastCol)
      .getValues();

    for (
      let index = values.length - 1;
      index >= 0 && results.length < limit;
      index--
    ) {
      const row = values[index];
      const quoteNo = clean_(valueAt(row, noCol));

      if (!quoteNo) continue;

      const rawDate = valueAt(row, dateCol);
      const date = rawDate instanceof Date
        ? rawDate
        : new Date(rawDate);
      const rowStatus = clean_(
        valueAt(row, statusCol)
      ).toUpperCase();
      const haystack = [
        quoteNo,
        valueAt(row, customerCol),
        valueAt(row, customerIdCol),
        valueAt(row, contactCol),
        valueAt(row, phoneCol)
      ]
        .map(clean_)
        .join(' ')
        .toLowerCase();

      if (
        keyword &&
        haystack.indexOf(keyword) < 0
      ) {
        continue;
      }

      if (status && rowStatus !== status) {
        continue;
      }

      if (
        fromDate &&
        date instanceof Date &&
        !isNaN(date) &&
        date < fromDate
      ) {
        continue;
      }

      if (
        toDate &&
        date instanceof Date &&
        !isNaN(date) &&
        date > toDate
      ) {
        continue;
      }

      results.push({
        no: quoteNo,
        date: formatDate_(rawDate),
        dateIso: formatDateInput_(rawDate),
        customerId: clean_(
          valueAt(row, customerIdCol)
        ),
        customer: clean_(
          valueAt(row, customerCol)
        ),
        contact: clean_(
          valueAt(row, contactCol)
        ),
        phone: normalizePhone_(
          valueAt(row, phoneCol)
        ),
        validUntil: formatDateInput_(
          valueAt(row, validCol)
        ),
        subtotal: Number(
          valueAt(row, subtotalCol) || 0
        ),
        discount: Number(
          valueAt(row, discountCol) || 0
        ),
        vatAmount: Number(
          valueAt(row, vatCol) || 0
        ),
        total: Number(
          valueAt(row, totalCol) || 0
        ),
        status: clean_(
          valueAt(row, statusCol)
        ) || 'NHÁP',
        note: clean_(
          valueAt(row, noteCol)
        ),
        pdf: clean_(
          valueAt(row, pdfCol)
        )
      });
    }

    endRow = startRow - 1;
  }

  return results;
}

function getQuoteForEdit(no) {
  const data = getQuote(no);
  const quote = data.quote;

  return {
    no: clean_(quote.SoBaoGia),
    date: formatDate_(quote.NgayBaoGia),
    customer: {
      id: clean_(quote.MaKhachHang),
      name: clean_(quote.TenKhachHang)
    },
    contact: clean_(quote.NguoiLienHe),
    phone: normalizePhone_(quote.DienThoai),
    validUntil: formatDateInput_(quote.HieuLucDen),
    discount: Number(quote.ChietKhau || 0),
    note: clean_(quote.GhiChu),
    status: clean_(quote.TrangThai) || 'NHÁP',
    pdf: clean_(quote.LinkPDF),
    taxMode: pricingEngine_().inferSavedMode(quote),
    items: data.items
  };
}

function updateQuote(q) {
  if (!q || !clean_(q.no)) {
    throw new Error('Thiếu số báo giá cần cập nhật.');
  }

  if (!Array.isArray(q.items) || !q.items.length) {
    throw new Error('Báo giá chưa có sản phẩm.');
  }

  ensureAppReady_();

  const no = clean_(q.no);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const quoteSheet = sheet_(APP.SHEETS.QUOTES);
    const quoteMeta = sheetHeaderMap_(quoteSheet);
    const quoteNoColumn = quoteMeta.byName.SoBaoGia;

    if (!quoteNoColumn) {
      throw new Error('Sheet BAO_GIA thiếu cột SoBaoGia.');
    }

    const quoteRow = findDataRowByValue_(
      quoteSheet,
      quoteNoColumn,
      no
    );

    if (!quoteRow) {
      throw new Error('Không tìm thấy báo giá ' + no);
    }

    const quoteHeaders = quoteMeta.headers;
    const quoteValues = quoteSheet
      .getRange(quoteRow, 1, 1, quoteHeaders.length)
      .getValues()[0];

    const quoteStatusCol = quoteHeaders.indexOf('TrangThai');
    const quotePdfCol = quoteHeaders.indexOf('LinkPDF');
    const quoteDateCol = quoteHeaders.indexOf('NgayBaoGia');

    const oldStatus = quoteStatusCol >= 0
      ? clean_(quoteValues[quoteStatusCol]).toUpperCase()
      : '';

    const oldPdfUrl = quotePdfCol >= 0
      ? clean_(quoteValues[quotePdfCol])
      : '';

    const quoteDate = (
      quoteDateCol >= 0 &&
      quoteValues[quoteDateCol] instanceof Date
    )
      ? quoteValues[quoteDateCol]
      : new Date();

    if (oldStatus === 'HỦY') {
      throw new Error('Không thể cập nhật báo giá đã hủy.');
    }

    archiveQuoteFiles_(no, oldPdfUrl, quoteDate);

    const taxMode = pricingEngine_().normalizeMode(q.taxMode);
    const totals = pricingEngine_().calculateQuote(
      q.items,
      q.discount,
      taxMode
    );

    const customer = q.customer || {};
    const phone = normalizePhone_(
      q.phone || customer.phone
    );

    const newQuoteDate = q.date
      ? new Date(q.date + 'T00:00:00')
      : quoteDate;

    const valuesByHeader = {
      NgayBaoGia: newQuoteDate,
      MaKhachHang: clean_(customer.id),
      TenKhachHang: clean_(customer.name),
      NguoiLienHe: clean_(q.contact || customer.recipient),
      DienThoai: phone,
      HieuLucDen: q.validUntil
        ? new Date(q.validUntil + 'T00:00:00')
        : '',
      TienHang: totals.netAmount,
      ChietKhau: totals.discount,
      VAT: totals.vatAmount,
      TongThanhToan: totals.total,
      TrangThai: 'ĐÃ CẬP NHẬT',
      NguoiLap:
        Session.getActiveUser().getEmail() ||
        'Người dùng',
      GhiChu: clean_(q.note),
      LinkPDF: '',
      CheDoVAT: taxMode
    };

    const updatedQuoteRow = quoteValues.slice();

    Object.keys(valuesByHeader).forEach(header => {
      const col = quoteHeaders.indexOf(header);
      if (col >= 0) {
        updatedQuoteRow[col] = valuesByHeader[header];
      }
    });

    quoteSheet
      .getRange(
        quoteRow,
        1,
        1,
        quoteHeaders.length
      )
      .setValues([updatedQuoteRow]);

    const phoneCol = quoteHeaders.indexOf('DienThoai');
    if (phoneCol >= 0) {
      quoteSheet
        .getRange(quoteRow, phoneCol + 1)
        .setNumberFormat('@');
    }

    const lineSheet = sheet_(APP.SHEETS.QUOTE_LINES);
    const lineMeta = sheetHeaderMap_(lineSheet);
    const lineNoColumn = lineMeta.byName.SoBaoGia;

    if (!lineNoColumn) {
      throw new Error(
        'Sheet CHI_TIET_BAO_GIA thiếu cột SoBaoGia.'
      );
    }

    const rowsToDelete = findDataRowsByValue_(
      lineSheet,
      lineNoColumn,
      no
    );

    deleteRowBlocks_(lineSheet, rowsToDelete);

    const lines = q.items.map((item, index) => {
      const line = pricingEngine_().calculateItem(item, taxMode);

      return [
        no,
        index + 1,
        clean_(item.code),
        clean_(item.name),
        clean_(item.unit) || 'Cái',
        Number(item.qty || 0),
        Number(item.price || 0),
        Number(item.lineDiscount || 0),
        Number(line.vat || 0),
        line.payable,
        line.priceIncludesVat,
        line.used
      ];
    });

    lineSheet
      .getRange(
        lineSheet.getLastRow() + 1,
        1,
        lines.length,
        12
      )
      .setValues(lines);

    return {
      success: true,
      no: no,
      total: totals.total,
      pdfInvalidated: true,
      quote: {
        no: no,
        date: formatDate_(newQuoteDate),
        dateIso: formatDateInput_(newQuoteDate),
        customerId: clean_(customer.id),
        customer: clean_(customer.name),
        contact: clean_(q.contact || customer.recipient),
        phone: phone,
        validUntil: q.validUntil || '',
        subtotal: totals.netAmount,
        discount: totals.discount,
        vatAmount: totals.vatAmount,
        total: totals.total,
        status: 'ĐÃ CẬP NHẬT',
        note: clean_(q.note),
        pdf: ''
      },
      message:
        'Đã cập nhật ' + no +
        '. PDF cũ đã chuyển vào PHIEN_BAN_CU.'
    };
  } finally {
    lock.releaseLock();
  }
}

function cancelQuote(no, reason) {
  no = clean_(no);
  if (!no) throw new Error('Thiếu số báo giá.');

  const sh = sheet_(APP.SHEETS.QUOTES);
  const meta = sheetHeaderMap_(sh);
  const noCol = meta.byName.SoBaoGia;
  const statusCol = meta.byName.TrangThai;
  const noteCol = meta.byName.GhiChu;

  if (!noCol || !statusCol) {
    throw new Error(
      'Sheet BAO_GIA thiếu cột SoBaoGia hoặc TrangThai.'
    );
  }

  const row = findDataRowByValue_(sh, noCol, no);

  if (!row) {
    throw new Error('Không tìm thấy báo giá ' + no);
  }

  const rowValues = sh
    .getRange(row, 1, 1, meta.headers.length)
    .getValues()[0];

  const currentStatus = clean_(
    rowValues[statusCol - 1]
  ).toUpperCase();

  if (currentStatus === 'HỦY') {
    throw new Error('Báo giá này đã hủy.');
  }

  rowValues[statusCol - 1] = 'HỦY';

  if (noteCol) {
    const oldNote = clean_(rowValues[noteCol - 1]);
    const cancelText =
      '[Hủy ' +
      Utilities.formatDate(
        new Date(),
        APP.TZ,
        'dd/MM/yyyy HH:mm'
      ) +
      '] ' +
      (clean_(reason) || 'Không ghi lý do');

    rowValues[noteCol - 1] =
      (oldNote ? oldNote + ' | ' : '') +
      cancelText;
  }

  sh.getRange(row, 1, 1, meta.headers.length)
    .setValues([rowValues]);

  return {
    success: true,
    no: no,
    message: 'Đã hủy báo giá ' + no
  };
}


function deleteQuotePermanently(no) {
  no = clean_(no);

  if (!no) {
    throw new Error('Thiếu số báo giá.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const contractSheet = sheet_(APP.SHEETS.CONTRACTS);
    const contractMeta = sheetHeaderMap_(contractSheet);
    const contractQuoteCol = contractMeta.byName.MaBaoGia;
    const linkedContract = contractQuoteCol
      ? Boolean(findDataRowByValue_(
          contractSheet,
          contractQuoteCol,
          no
        ))
      : false;

    if (linkedContract) {
      throw new Error(
        'Báo giá ' + no +
        ' đã được dùng để tạo hợp đồng nên không thể xóa hoàn toàn.'
      );
    }

    const quoteSheet = sheet_(APP.SHEETS.QUOTES);
    const quoteMeta = sheetHeaderMap_(quoteSheet);
    const quoteNoCol = quoteMeta.byName.SoBaoGia;
    const quotePdfCol = quoteMeta.byName.LinkPDF;

    if (!quoteNoCol) {
      throw new Error('Sheet BAO_GIA thiếu cột SoBaoGia.');
    }

    const quoteRow = findDataRowByValue_(
      quoteSheet,
      quoteNoCol,
      no
    );

    if (!quoteRow) {
      throw new Error('Không tìm thấy báo giá ' + no);
    }

    let pdfUrl = '';

    if (quotePdfCol) {
      pdfUrl = clean_(
        quoteSheet.getRange(quoteRow, quotePdfCol).getValue()
      );
    }

    const lineSheet = sheet_(APP.SHEETS.QUOTE_LINES);
    const lineMeta = sheetHeaderMap_(lineSheet);
    const lineNoCol = lineMeta.byName.SoBaoGia;

    if (!lineNoCol) {
      throw new Error(
        'Sheet CHI_TIET_BAO_GIA thiếu cột SoBaoGia.'
      );
    }

    const rowsToDelete = findDataRowsByValue_(
      lineSheet,
      lineNoCol,
      no
    );

    deleteRowBlocks_(lineSheet, rowsToDelete);

    quoteSheet.deleteRow(quoteRow);

    const trashedFiles = trashQuoteFiles_(no, pdfUrl);

    SpreadsheetApp.flush();

    return {
      success: true,
      no: no,
      deletedLines: rowsToDelete.length,
      trashedFiles: trashedFiles,
      message:
        'Đã xóa hoàn toàn báo giá ' + no +
        ', ' + rowsToDelete.length + ' dòng chi tiết và ' +
        trashedFiles + ' tệp liên quan.'
    };
  } finally {
    lock.releaseLock();
  }
}

function trashQuoteFiles_(no, storedUrl) {
  let count = 0;
  const handled = {};

  function trashFile_(file) {
    if (!file || file.isTrashed()) return;

    const id = file.getId();

    if (handled[id]) return;
    handled[id] = true;

    if (
      file.getName().indexOf(clean_(no)) < 0
    ) {
      return;
    }

    file.setTrashed(true);
    count++;
  }

  function scanFolder_(folder) {
    const files = folder.getFiles();

    while (files.hasNext()) {
      try {
        trashFile_(files.next());
      } catch (error) {
        // Bỏ qua tệp không thể xóa.
      }
    }

    const children = folder.getFolders();

    while (children.hasNext()) {
      scanFolder_(children.next());
    }
  }

  try {
    scanFolder_(getStorageRootFolder_());
  } catch (error) {
    // Nếu chưa có thư mục gốc vẫn tiếp tục xử lý URL đã lưu.
  }

  const fileId = extractDriveFileId_(
    storedUrl
  );

  if (fileId && !handled[fileId]) {
    try {
      trashFile_(
        DriveApp.getFileById(fileId)
      );
    } catch (error) {
      // Tệp có thể đã bị xóa hoặc không đủ quyền.
    }
  }

  [
    'BÁO GIÁ ' + clean_(no),
    'BAO_GIA_' + clean_(no) + '.pdf'
  ].forEach(name => {
    const files = DriveApp.getFilesByName(name);

    while (files.hasNext()) {
      try {
        trashFile_(files.next());
      } catch (error) {
        // Bỏ qua tệp không thể xóa.
      }
    }
  });

  return count;
}

function extractDriveFileId_(url) {
  url = clean_(url);

  if (!url) return '';

  const byPath = url.match(/\/d\/([a-zA-Z0-9_-]+)/);

  if (byPath && byPath[1]) {
    return byPath[1];
  }

  const byQuery = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);

  return byQuery && byQuery[1] ? byQuery[1] : '';
}

function formatDateInput_(value) {
  if (!value) return '';

  if (value instanceof Date && !isNaN(value)) {
    return Utilities.formatDate(value, APP.TZ, 'yyyy-MM-dd');
  }

  const date = new Date(value);

  if (!isNaN(date)) {
    return Utilities.formatDate(date, APP.TZ, 'yyyy-MM-dd');
  }

  return '';
}

function normalizeVatRate_(rate) {
  rate = Number(rate || 0);

  const supported = [0, 0.08, 0.1];
  let nearest = supported[0];
  let distance = Math.abs(rate - nearest);

  supported.forEach(value => {
    const nextDistance = Math.abs(rate - value);

    if (nextDistance < distance) {
      nearest = value;
      distance = nextDistance;
    }
  });

  return nearest;
}


function getStorageRootFolder_() {
  const config = cfg_();
  const configuredId = clean_(
    config.THUMUC_GOC_ID ||
    config.ROOT_FOLDER_ID
  );

  if (configuredId) {
    try {
      return DriveApp.getFolderById(configuredId);
    } catch (error) {
      throw new Error(
        'THUMUC_GOC_ID trong CAU_HINH không hợp lệ hoặc tài khoản không có quyền truy cập.'
      );
    }
  }

  const properties = PropertiesService.getScriptProperties();
  const storedId = clean_(properties.getProperty('THANH_DUC_SALES_ROOT_FOLDER_ID'));

  if (storedId) {
    try {
      return DriveApp.getFolderById(storedId);
    } catch (error) {
      properties.deleteProperty('THANH_DUC_SALES_ROOT_FOLDER_ID');
    }
  }

  const folder = DriveApp.createFolder('THANH_DUC_SALES');
  properties.setProperty(
    'THANH_DUC_SALES_ROOT_FOLDER_ID',
    folder.getId()
  );

  return folder;
}

function getOrCreateChildFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);

  if (folders.hasNext()) {
    return folders.next();
  }

  return parent.createFolder(name);
}

function getDatedStorageFolder_(category, date, subtype) {
  const value = date instanceof Date && !isNaN(date)
    ? date
    : new Date();

  let folder = getOrCreateChildFolder_(
    getStorageRootFolder_(),
    category
  );

  if (clean_(subtype)) {
    folder = getOrCreateChildFolder_(
      folder,
      clean_(subtype)
    );
  }

  folder = getOrCreateChildFolder_(
    folder,
    Utilities.formatDate(value, APP.TZ, 'yyyy')
  );

  folder = getOrCreateChildFolder_(
    folder,
    Utilities.formatDate(value, APP.TZ, 'MM')
  );

  return folder;
}

function safeFileName_(value) {
  return clean_(value)
    .replace(/[\\/:*?"<>|#%{}[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 120);
}

function quoteFileBaseName_(quote) {
  const no = clean_(quote.SoBaoGia);
  const customer = safeFileName_(quote.TenKhachHang);

  return customer
    ? no + ' - ' + customer
    : no;
}

function contractSubtypeFolder_(type) {
  return clean_(type).toUpperCase() === 'HĐNT'
    ? 'HDNT'
    : 'HDMB';
}

function getStoredQuotePdf(no) {
  const data = getQuote(no);
  const url = clean_(data.quote.LinkPDF);

  if (!url) {
    throw new Error(
      'Báo giá ' + clean_(no) +
      ' chưa có PDF hiện hành. Hãy bấm nút Tạo PDF.'
    );
  }

  const fileId = extractDriveFileId_(url);

  if (!fileId) {
    throw new Error('Liên kết PDF của báo giá không hợp lệ.');
  }

  try {
    const file = DriveApp.getFileById(fileId);

    if (file.isTrashed()) {
      throw new Error('Tệp PDF đã nằm trong thùng rác.');
    }

    return {
      success: true,
      no: clean_(no),
      pdf: file.getUrl(),
      name: file.getName(),
      created: false
    };
  } catch (error) {
    throw new Error(
      'Không mở được PDF hiện hành của ' + clean_(no) +
      '. Hãy bấm Tạo PDF để tạo lại.'
    );
  }
}

function regenerateQuotePdf(no) {
  const data = getQuote(no);
  const q = data.quote;

  archiveQuoteFiles_(
    clean_(no),
    clean_(q.LinkPDF),
    q.NgayBaoGia
  );

  setQuotePdf_(no, '');

  return generateQuotePdf_(data);
}

function createQuotePdf(no) {
  return regenerateQuotePdf(no);
}

function ensureExternalLogo_() {
  const properties = PropertiesService.getScriptProperties();
  const configuredId = clean_(cfg_().LOGO_FILE_ID);
  const storedId = clean_(
    properties.getProperty('THANH_DUC_LOGO_FILE_ID')
  );

  const candidates = [configuredId, storedId].filter(Boolean);

  for (let index = 0; index < candidates.length; index++) {
    try {
      const file = DriveApp.getFileById(candidates[index]);
      if (!file.isTrashed()) {
        properties.setProperty(
          'THANH_DUC_LOGO_FILE_ID',
          file.getId()
        );
        return file.getId();
      }
    } catch (error) {
      // Thử nguồn tiếp theo.
    }
  }

  /*
   * Fallback an toàn: tìm logo đã được migrate trong ASSETS.
   * Nhờ vậy Script Property bị mất vẫn có thể tự phục hồi.
   */
  const root = getStorageRootFolder_();
  const assets = getOrCreateChildFolder_(root, 'ASSETS');
  const files = assets.getFilesByName('logo-thanh-duc.jpg');

  if (files.hasNext()) {
    const file = files.next();
    properties.setProperty(
      'THANH_DUC_LOGO_FILE_ID',
      file.getId()
    );
    return file.getId();
  }

  throw new Error(
    'Không tìm thấy logo Thành Đức trên Drive. ' +
    'Hãy cấu hình LOGO_FILE_ID trong CAU_HINH.'
  );
}

function getLogoBlob_() {
  try {
    const fileId = ensureExternalLogo_();

    if (!fileId) {
      return null;
    }

    return DriveApp
      .getFileById(fileId)
      .getBlob()
      .setName('logo-thanh-duc.jpg');
  } catch (error) {
    console.warn(
      'Logo Thành Đức chưa được cấu hình: ' +
      (error && error.message ? error.message : error)
    );

    return null;
  }
}

function getLogoDataUrl_() {
  const blob = getLogoBlob_();

  if (!blob) {
    return (
      'data:image/svg+xml;charset=UTF-8,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>'
      )
    );
  }

  const mimeType = clean_(blob.getContentType()) || 'image/jpeg';

  return (
    'data:' +
    mimeType +
    ';base64,' +
    Utilities.base64Encode(blob.getBytes())
  );
}

function companyInfo_(config) {
  config = config || {};

  return {
    name: clean_(
      config.TEN_CONG_TY ||
      'CÔNG TY TNHH TM DV TIN HỌC THÀNH ĐỨC'
    ),
    address: clean_(
      config.DIA_CHI ||
      'Số 58 Mã Lò, Phường Bình Trị Đông, TP.HCM'
    ),
    phone: clean_(
      config.DIEN_THOAI ||
      '028 6266 1869'
    ),
    hotline: clean_(
      config.HOTLINE ||
      '0888 304 668'
    ),
    tax: clean_(
      config.MA_SO_THUE ||
      '0313015734'
    ),
    website: clean_(
      config.WEBSITE ||
      'www.thanhduc.vn'
    ),
    email: clean_(
      config.EMAIL ||
      'info@thanhduc.vn'
    )
  };
}

function setCellTextStyle_(
  cell,
  options
) {
  options = options || {};

  const text = cell.editAsText();

  text.setFontFamily(
    options.font || 'Arial'
  );

  if (options.bold != null) {
    text.setBold(Boolean(options.bold));
  }

  if (options.italic != null) {
    text.setItalic(Boolean(options.italic));
  }

  if (options.color) {
    text.setForegroundColor(options.color);
  }

  if (options.size) {
    text.setFontSize(Number(options.size));
  }

  const paragraph = cell
    .getChild(0)
    .asParagraph();

  if (options.align) {
    paragraph.setAlignment(options.align);
  }

  paragraph
    .setLineSpacing(1)
    .setSpacingBefore(0)
    .setSpacingAfter(0);

  if (options.vertical) {
    cell.setVerticalAlignment(
      options.vertical
    );
  }
}

function appendCompanyHeader_(
  body,
  company
) {
  const NAVY = '#18324A';
  const TEXT = '#334155';
  const MUTED = '#64748B';

  const table = body.appendTable([[
    '',
    ''
  ]]);

  table.setBorderWidth(0);
  table.setColumnWidth(0, 100);
  table.setColumnWidth(1, 395);

  const logoCell = table.getCell(0, 0);
  const infoCell = table.getCell(0, 1);

  logoCell.setPaddingTop(0);
  logoCell.setPaddingBottom(0);
  logoCell.setPaddingLeft(0);
  logoCell.setPaddingRight(8);

  infoCell.setPaddingTop(0);
  infoCell.setPaddingBottom(0);
  infoCell.setPaddingLeft(3);
  infoCell.setPaddingRight(0);

  const logoBlob = getLogoBlob_();

  if (logoBlob) {
    const image = logoCell.appendImage(
      logoBlob
    );

    image.setWidth(88);
    image.setHeight(96);
  }

  logoCell.setVerticalAlignment(
    DocumentApp.VerticalAlignment.CENTER
  );

  const companyName = infoCell
    .appendParagraph(company.name);

  companyName
    .setSpacingBefore(0)
    .setSpacingAfter(5)
    .setLineSpacing(1)
    .setAlignment(
      DocumentApp.HorizontalAlignment.LEFT
    );

  companyName.editAsText()
    .setFontFamily('Arial')
    .setBold(true)
    .setFontSize(14)
    .setForegroundColor(NAVY);

  const lines = [
    ['Địa chỉ: ', company.address],
    [
      'Điện thoại: ',
      company.phone +
      '    |    Hotline: ' +
      company.hotline
    ],
    ['Mã số thuế: ', company.tax],
    [
      'Website: ',
      company.website +
      '    |    Email: ' +
      company.email
    ]
  ];

  lines.forEach(parts => {
    const paragraph = infoCell
      .appendParagraph(
        parts[0] + parts[1]
      );

    paragraph
      .setSpacingBefore(0)
      .setSpacingAfter(2)
      .setLineSpacing(1.05);

    const text = paragraph.editAsText();

    text
      .setFontFamily('Arial')
      .setFontSize(9.5)
      .setForegroundColor(TEXT);

    text.setBold(
      0,
      Math.max(0, parts[0].length - 1),
      true
    );
  });

  const line = body.appendParagraph(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  );

  line
    .setSpacingBefore(4)
    .setSpacingAfter(5)
    .setAlignment(
      DocumentApp.HorizontalAlignment.CENTER
    );

  line.editAsText()
    .setFontFamily('Arial')
    .setFontSize(6)
    .setForegroundColor(MUTED);
}

function appendQuoteTitle_(
  body,
  quote,
  vatRate
) {
  const NAVY = '#18324A';
  const TEXT = '#334155';
  const MUTED = '#64748B';

  const title = body.appendParagraph(
    'BÁO GIÁ SẢN PHẨM'
  );

  title
    .setAlignment(
      DocumentApp.HorizontalAlignment.CENTER
    )
    .setSpacingBefore(2)
    .setSpacingAfter(3)
    .setLineSpacing(1);

  title.editAsText()
    .setFontFamily('Arial')
    .setBold(true)
    .setFontSize(18)
    .setForegroundColor(NAVY);

  const subtitle = body.appendParagraph(
    'Kính gửi Quý khách hàng'
  );

  subtitle
    .setAlignment(
      DocumentApp.HorizontalAlignment.CENTER
    )
    .setSpacingBefore(0)
    .setSpacingAfter(8)
    .setLineSpacing(1);

  subtitle.editAsText()
    .setFontFamily('Arial')
    .setFontSize(9.5)
    .setForegroundColor(MUTED);

  const date = quote.NgayBaoGia instanceof Date
    ? quote.NgayBaoGia
    : new Date(quote.NgayBaoGia);

  const vatText = vatRate > 0
    ? 'Đã bao gồm VAT ' +
      Math.round(vatRate * 100) + '%'
    : 'Chưa bao gồm VAT';

  const meta = body.appendTable([[
    'Ngày báo giá: ' +
      Utilities.formatDate(
        date,
        APP.TZ,
        'dd/MM/yyyy'
      ),
    'Số báo giá: ' +
      clean_(quote.SoBaoGia),
    vatText
  ]]);

  meta.setBorderWidth(0);
  meta.setColumnWidth(0, 165);
  meta.setColumnWidth(1, 165);
  meta.setColumnWidth(2, 165);

  for (let column = 0; column < 3; column++) {
    const cell = meta.getCell(0, column);

    cell.setPaddingTop(2);
    cell.setPaddingBottom(5);
    cell.setPaddingLeft(2);
    cell.setPaddingRight(2);

    setCellTextStyle_(
      cell,
      {
        bold: true,
        size: 9.5,
        color:
          column === 2
            ? NAVY
            : TEXT,
        align:
          DocumentApp
            .HorizontalAlignment
            .CENTER,
        vertical:
          DocumentApp
            .VerticalAlignment
            .CENTER
      }
    );
  }
}

function appendCustomerInfo_(
  body,
  quote,
  customer
) {
  const NAVY = '#18324A';
  const TEXT = '#1F2937';
  const BORDER = '#CBD5E1';
  const LABEL_FILL = '#F1F5F9';

  const rows = [
    [
      'Khách hàng',
      clean_(quote.TenKhachHang),
      'Mã số thuế',
      clean_(customer.MaSoThue)
    ],
    [
      'Địa chỉ',
      clean_(customer.DiaChi),
      'Điện thoại',
      clean_(
        quote.DienThoai ||
        customer.DienThoai
      )
    ],
    [
      'Người liên hệ',
      clean_(
        quote.NguoiLienHe ||
        customer.NguoiNhan
      ),
      'Hiệu lực đến',
      formatDateOnly_(
        quote.HieuLucDen
      )
    ],
    [
      'Email',
      clean_(customer.Email),
      'Hình thức',
      'Báo giá hàng hóa/dịch vụ'
    ]
  ];

  const table = body.appendTable(rows);

  table
    .setBorderColor(BORDER)
    .setBorderWidth(0.6);

  const widths = [82, 205, 75, 133];

  for (
    let row = 0;
    row < table.getNumRows();
    row++
  ) {
    for (let column = 0; column < 4; column++) {
      const cell = table.getCell(
        row,
        column
      );

      cell.setWidth(widths[column]);
      cell.setPaddingTop(5);
      cell.setPaddingBottom(5);
      cell.setPaddingLeft(6);
      cell.setPaddingRight(6);

      if (
        column === 0 ||
        column === 2
      ) {
        cell.setBackgroundColor(
          LABEL_FILL
        );

        setCellTextStyle_(
          cell,
          {
            bold: true,
            size: 9.5,
            color: NAVY,
            vertical:
              DocumentApp
                .VerticalAlignment
                .CENTER
          }
        );
      } else {
        setCellTextStyle_(
          cell,
          {
            bold:
              row === 0 &&
              column === 1,
            size: 9.5,
            color: TEXT,
            vertical:
              DocumentApp
                .VerticalAlignment
                .CENTER
          }
        );
      }
    }
  }

  body.appendParagraph('')
    .setSpacingAfter(2);
}

function appendProductTable_(
  body,
  items
) {
  const NAVY = '#18324A';
  const TEXT = '#1F2937';
  const BORDER = '#94A3B8';
  const ALT_FILL = '#F8FAFC';

  const rows = [[
    'STT',
    'Mã hàng',
    'Tên sản phẩm / dịch vụ',
    'ĐVT',
    'SL',
    'Đơn giá (VNĐ)',
    'Thành tiền (VNĐ)'
  ]];

  items.forEach((item, index) => {
    rows.push([
      String(index + 1),
      clean_(item.code),
      clean_(item.name),
      clean_(item.unit),
      String(Number(item.qty || 0)),
      formatMoney_(item.price),
      formatMoney_(
        Number(item.qty || 0) *
        Number(item.price || 0) -
        Number(item.lineDiscount || 0)
      )
    ]);
  });

  const table = body.appendTable(rows);

  table
    .setBorderColor(BORDER)
    .setBorderWidth(0.6);

  const widths = [
    28,
    61,
    196,
    40,
    34,
    83,
    92
  ];

  for (
    let row = 0;
    row < table.getNumRows();
    row++
  ) {
    for (let column = 0; column < 7; column++) {
      const cell = table.getCell(
        row,
        column
      );

      cell.setWidth(widths[column]);
      cell.setPaddingTop(
        row === 0 ? 5 : 6
      );
      cell.setPaddingBottom(
        row === 0 ? 5 : 6
      );
      cell.setPaddingLeft(4);
      cell.setPaddingRight(4);

      const isHeader = row === 0;

      const align =
        column === 0 ||
        column === 3 ||
        column === 4
          ? DocumentApp
              .HorizontalAlignment
              .CENTER
          : column === 5 ||
            column === 6
            ? DocumentApp
                .HorizontalAlignment
                .RIGHT
            : DocumentApp
                .HorizontalAlignment
                .LEFT;

      if (isHeader) {
        cell.setBackgroundColor(NAVY);

        setCellTextStyle_(
          cell,
          {
            bold: true,
            size: 8.8,
            color: '#FFFFFF',
            align:
              DocumentApp
                .HorizontalAlignment
                .CENTER,
            vertical:
              DocumentApp
                .VerticalAlignment
                .CENTER
          }
        );
      } else {
        if (row % 2 === 0) {
          cell.setBackgroundColor(
            ALT_FILL
          );
        }

        setCellTextStyle_(
          cell,
          {
            bold: column === 2,
            size: 9.2,
            color: TEXT,
            align: align,
            vertical:
              DocumentApp
                .VerticalAlignment
                .CENTER
          }
        );
      }
    }
  }

  return table;
}

function appendQuoteTotals_(
  body,
  quote,
  vatRate
) {
  const NAVY = '#18324A';
  const TEXT = '#334155';
  const BORDER = '#CBD5E1';
  const LIGHT_FILL = '#F8FAFC';

  const subtotal = Number(
    quote.TienHang || 0
  );

  const discount = Number(
    quote.ChietKhau || 0
  );

  const vatAmount = Number(
    quote.VAT || 0
  );

  const total = Number(
    quote.TongThanhToan || 0
  );

  const taxMode =
    pricingEngine_().inferSavedMode(quote);

  const taxModeLabel =
    pricingEngine_().modeLabel(taxMode);

  const layoutTable = body.appendTable([[
    '',
    ''
  ]]);

  layoutTable.setBorderWidth(0);
  layoutTable.setColumnWidth(0, 218);
  layoutTable.setColumnWidth(1, 277);

  const spacerCell = layoutTable.getCell(0, 0);
  const totalCell = layoutTable.getCell(0, 1);

  [
    spacerCell,
    totalCell
  ].forEach(cell => {
    cell.setPaddingTop(0);
    cell.setPaddingBottom(0);
    cell.setPaddingLeft(0);
    cell.setPaddingRight(0);
  });

  totalCell.clear();

  const totalTable = totalCell.appendTable([
    [
      'Tiền hàng',
      formatMoney_(subtotal) + ' đ'
    ],
    [
      'Giảm giá',
      formatMoney_(discount) + ' đ'
    ],
    [
      vatRate > 0
        ? 'Thuế VAT ' +
          Math.round(vatRate * 100) + '%'
        : 'Thuế VAT',
      formatMoney_(vatAmount) + ' đ'
    ],
    [
      'TỔNG THANH TOÁN',
      formatMoney_(total) + ' đ'
    ]
  ]);

  totalTable
    .setBorderColor(BORDER)
    .setBorderWidth(0.6);

  totalTable.setColumnWidth(0, 155);
  totalTable.setColumnWidth(1, 122);

  for (
    let row = 0;
    row < totalTable.getNumRows();
    row++
  ) {
    for (
      let column = 0;
      column < 2;
      column++
    ) {
      const cell = totalTable.getCell(
        row,
        column
      );

      cell.setPaddingTop(5);
      cell.setPaddingBottom(5);
      cell.setPaddingLeft(7);
      cell.setPaddingRight(7);

      if (row < 3) {
        cell.setBackgroundColor(
          LIGHT_FILL
        );
      }

      setCellTextStyle_(
        cell,
        {
          bold:
            column === 1 ||
            row === 3,
          size:
            row === 3
              ? 10.5
              : 9.5,
          color:
            row === 3
              ? '#FFFFFF'
              : TEXT,
          align:
            column === 0
              ? DocumentApp
                  .HorizontalAlignment
                  .LEFT
              : DocumentApp
                  .HorizontalAlignment
                  .RIGHT,
          vertical:
            DocumentApp
              .VerticalAlignment
              .CENTER
        }
      );

      if (row === 3) {
        cell.setBackgroundColor(NAVY);
      }
    }
  }

  const words = body.appendParagraph(
    'Bằng chữ: ' +
    numberToVietnamese_(total)
  );

  words
    .setSpacingBefore(6)
    .setSpacingAfter(8)
    .setLineSpacing(1.05);

  words.editAsText()
    .setFontFamily('Arial')
    .setFontSize(9.5)
    .setForegroundColor(TEXT);
}

function appendQuoteNotes_(
  body,
  quote,
  vatRate,
  config
) {
  const NAVY = '#18324A';
  const TEXT = '#334155';
  const BORDER = '#CBD5E1';
  const FILL = '#F8FAFC';
  const ACCENT = '#A12622';

  const taxMode =
    pricingEngine_().inferSavedMode(quote);

  const notes = [
    quoteVatNote_(taxMode),
    'Giá có thể thay đổi theo thời điểm và số lượng đặt hàng.',
    'Thời gian giao hàng và điều kiện thanh toán được xác nhận khi đặt hàng.',
    'Quý khách vui lòng liên hệ Thành Đức để được hỗ trợ mức giá tốt nhất.'
  ];

  const table = body.appendTable([['']]);

  table
    .setBorderColor(BORDER)
    .setBorderWidth(0.6);

  const cell = table.getCell(0, 0);

  cell.setBackgroundColor(FILL);
  cell.setPaddingTop(7);
  cell.setPaddingBottom(7);
  cell.setPaddingLeft(9);
  cell.setPaddingRight(9);
  cell.clear();

  const title = cell.appendParagraph(
    'GHI CHÚ'
  );

  title
    .setSpacingBefore(0)
    .setSpacingAfter(4)
    .setLineSpacing(1);

  title.editAsText()
    .setFontFamily('Arial')
    .setBold(true)
    .setFontSize(10)
    .setForegroundColor(NAVY);

  notes.forEach(note => {
    const item = cell.appendListItem(
      note
    );

    item
      .setGlyphType(
        DocumentApp.GlyphType.BULLET
      )
      .setNestingLevel(0)
      .setSpacingBefore(0)
      .setSpacingAfter(2)
      .setLineSpacing(1.05);

    item.editAsText()
      .setFontFamily('Arial')
      .setFontSize(9)
      .setForegroundColor(TEXT);
  });

  const customNote = clean_(
    quote.GhiChu
  );

  if (customNote) {
    const item = cell.appendListItem(
      'Ghi chú báo giá: ' +
      customNote
    );

    item
      .setGlyphType(
        DocumentApp.GlyphType.BULLET
      )
      .setNestingLevel(0)
      .setSpacingBefore(4)
      .setSpacingAfter(2)
      .setLineSpacing(1.05);

    item.editAsText()
      .setFontFamily('Arial')
      .setFontSize(9)
      .setBold(true)
      .setForegroundColor(ACCENT);
  }
}

function appendSignature_(
  body,
  companyName
) {
  const NAVY = '#18324A';
  const TEXT = '#475569';

  body.appendParagraph('')
    .setSpacingAfter(3);

  const table = body.appendTable([[
    '',
    ''
  ]]);

  table.setBorderWidth(0);
  table.setColumnWidth(0, 247);
  table.setColumnWidth(1, 248);

  const left = table.getCell(0, 0);
  const right = table.getCell(0, 1);

  [left, right].forEach(cell => {
    cell.setPaddingTop(4);
    cell.setPaddingBottom(58);
    cell.setPaddingLeft(4);
    cell.setPaddingRight(4);
  });

  left.setText(
    'ĐẠI DIỆN KHÁCH HÀNG\n' +
    '(Ký và ghi rõ họ tên)'
  );

  right.setText(
    'ĐẠI DIỆN CÔNG TY THÀNH ĐỨC\n' +
    '(Ký tên và đóng dấu)'
  );

  [left, right].forEach(cell => {
    const text = cell.editAsText();

    text
      .setFontFamily('Arial')
      .setFontSize(9)
      .setForegroundColor(TEXT);

    const firstLineEnd =
      cell.getText().indexOf('\n') - 1;

    if (firstLineEnd >= 0) {
      text
        .setBold(
          0,
          firstLineEnd,
          true
        )
        .setForegroundColor(
          0,
          firstLineEnd,
          NAVY
        );
    }

    cell.getChild(0)
      .asParagraph()
      .setAlignment(
        DocumentApp
          .HorizontalAlignment
          .CENTER
      )
      .setSpacingBefore(0)
      .setSpacingAfter(0)
      .setLineSpacing(1.05);
  });
}


function escapeHtmlServer_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function quotePreviewData_(request) {
  request = request || {};

  if (!Array.isArray(request.items) || !request.items.length) {
    throw new Error('Báo giá chưa có sản phẩm.');
  }

  const customerInput = request.customer || {};

  const storedCustomer = clean_(customerInput.id)
    ? findObjectByValue_(
      APP.SHEETS.CUSTOMERS,
      'MaKhachHang',
      customerInput.id
    )
    : null;

  const customer = storedCustomer || {
    MaKhachHang: clean_(customerInput.id),
    TenKhachHang: clean_(customerInput.name),
    DiaChi: clean_(customerInput.address),
    MaSoThue: clean_(customerInput.tax),
    DienThoai: clean_(customerInput.phone),
    Email: clean_(customerInput.email),
    NguoiNhan: clean_(customerInput.recipient)
  };

  const items = request.items.map(item => {
    const tax = normalizeProductTax_(item);

    return {
      code: clean_(item.code),
      name: clean_(item.name),
      unit: clean_(item.unit) || 'Cái',
      qty: Number(item.qty || 0),
      price: Number(item.price || 0),
      lineDiscount: Number(item.lineDiscount || 0),
      vat: tax.vat,
      priceIncludesVat: tax.priceIncludesVat,
      used: tax.used
    };
  });

  const taxMode =
    pricingEngine_().normalizeMode(request.taxMode);

  const totals = pricingEngine_().calculateQuote(
    items,
    request.discount,
    taxMode
  );

  return {
    quote: {
      SoBaoGia:
        clean_(request.no) ||
        'BẢN XEM TRƯỚC',
      NgayBaoGia: request.date
        ? new Date(request.date + 'T00:00:00')
        : new Date(),
      MaKhachHang: clean_(customerInput.id),
      TenKhachHang:
        clean_(customerInput.name) ||
        clean_(customer.TenKhachHang),
      NguoiLienHe:
        clean_(request.contact) ||
        clean_(customer.NguoiNhan),
      DienThoai:
        clean_(request.phone) ||
        normalizePhone_(customer.DienThoai),
      HieuLucDen:
        request.validUntil
          ? new Date(request.validUntil + 'T00:00:00')
          : '',
      TienHang: totals.netAmount,
      ChietKhau: totals.discount,
      VAT: totals.vatAmount,
      TongThanhToan: totals.total,
      GhiChu: clean_(request.note),
      CheDoVAT: taxMode
    },
    items: items,
    customer: customer
  };
}


function warehouseIssueNo_(quoteNo) {
  const no = clean_(quoteNo);

  if (!no) {
    return 'PXK-' + Utilities.formatDate(
      new Date(),
      APP.TZ,
      'yyyyMMdd-HHmmss'
    );
  }

  if (/^BG-/i.test(no)) {
    return no.replace(/^BG-/i, 'PXK-');
  }

  return 'PXK-' + no;
}

function formatVietnameseLongDate_(value) {
  const date = value instanceof Date && !isNaN(value)
    ? value
    : new Date(value || new Date());

  const safeDate = isNaN(date)
    ? new Date()
    : date;

  return 'Ngày ' +
    Utilities.formatDate(safeDate, APP.TZ, 'dd') +
    ' tháng ' +
    Utilities.formatDate(safeDate, APP.TZ, 'MM') +
    ' năm ' +
    Utilities.formatDate(safeDate, APP.TZ, 'yyyy');
}

function getWarehouseIssuePreviewHtml(no) {
  const data = getQuote(no);
  const quote = data.quote;

  const customer = findObjectByValue_(
      APP.SHEETS.CUSTOMERS,
      'MaKhachHang',
      quote.MaKhachHang
    ) || {};

  return buildWarehouseIssueHtml_(
    {
      quote: quote,
      items: data.items,
      customer: customer,
      issueDate: new Date()
    },
    true
  );
}

function buildWarehouseIssueHtml_(data, previewMode) {
  data = data || {};

  const quote = data.quote || {};
  const items = Array.isArray(data.items)
    ? data.items
    : [];

  if (!items.length) {
    throw new Error('Phiếu xuất kho chưa có sản phẩm.');
  }

  const customer = data.customer || {};
  const company = companyInfo_(cfg_());
  const taxMode = pricingEngine_().inferSavedMode(quote);
  const issueDate = data.issueDate instanceof Date && !isNaN(data.issueDate)
    ? data.issueDate
    : new Date();

  const slipNo = warehouseIssueNo_(quote.SoBaoGia);
  const total = Math.round(Number(quote.TongThanhToan || 0));
  const savedNet = Math.round(Number(quote.TienHang || 0));
  const savedVat = Math.round(Number(quote.VAT || 0));

  let netBeforeOrderDiscount = 0;

  const rowsHtml = items.map((item, index) => {
    const pricing = pricingEngine_().calculateItem(item, taxMode);
    const qty = Number(item.qty || 0);
    const netUnitPrice = qty > 0
      ? Math.round(pricing.net / qty)
      : 0;

    netBeforeOrderDiscount += pricing.net;

    const productName = [
      escapeHtmlServer_(item.name),
      clean_(item.code)
        ? '<span class="item-code">Mã: ' +
          escapeHtmlServer_(item.code) +
          '</span>'
        : '',
      Number(item.lineDiscount || 0) > 0
        ? '<span class="item-code">Đã trừ giảm giá dòng: ' +
          escapeHtmlServer_(formatMoney_(item.lineDiscount)) +
          ' đ</span>'
        : ''
    ].join('');

    return [
      '<tr>',
      '<td class="center">', index + 1, '</td>',
      '<td class="item-name">', productName, '</td>',
      '<td class="center">', escapeHtmlServer_(item.unit || 'Cái'), '</td>',
      '<td class="center">', escapeHtmlServer_(qty), '</td>',
      '<td class="money">', escapeHtmlServer_(formatMoney_(netUnitPrice)), '</td>',
      '<td class="money">', escapeHtmlServer_(formatMoney_(pricing.net)), '</td>',
      '</tr>'
    ].join('');
  }).join('');

  netBeforeOrderDiscount = Math.round(netBeforeOrderDiscount);

  const netDiscount = Math.max(
    0,
    netBeforeOrderDiscount - savedNet
  );

  const vatPercent = savedNet > 0 && savedVat > 0
    ? Math.round((savedVat / savedNet) * 10000) / 100
    : contractTaxPercent_(taxMode);

  const discountRow = netDiscount > 0
    ? [
        '<tr>',
        '<td class="blank"></td>',
        '<td class="label">Chiết khấu</td>',
        '<td class="value">-',
        escapeHtmlServer_(formatMoney_(netDiscount)),
        ' đ</td>',
        '</tr>',
        '<tr>',
        '<td class="blank"></td>',
        '<td class="label">Tiền hàng sau chiết khấu</td>',
        '<td class="value">',
        escapeHtmlServer_(formatMoney_(savedNet)),
        ' đ</td>',
        '</tr>'
      ].join('')
    : '';

  const contactName = clean_(
    quote.NguoiLienHe ||
    customer.NguoiNhan ||
    customer.NguoiDaiDien
  );

  const phone = clean_(
    quote.DienThoai ||
    customer.DienThoai
  );

  const toolbar = previewMode
    ? [
        '<div class="preview-toolbar">',
        '<button onclick="window.print()">In / Lưu PDF</button>',
        '<button class="secondary" onclick="window.close()">Đóng</button>',
        '</div>'
      ].join('')
    : '';

  const logoData = getLogoDataUrl_();

  return [
    '<!DOCTYPE html>',
    '<html lang="vi">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>', escapeHtmlServer_(slipNo), ' - Phiếu xuất kho bán hàng</title>',
    '<style>',
    '@page{size:A4 portrait;margin:8mm;}',
    '*{box-sizing:border-box;}',
    'html,body{margin:0;padding:0;background:#e8edf1;color:#111;font-family:"Times New Roman",serif;}',
    '.preview-toolbar{position:sticky;top:0;z-index:10;display:flex;gap:8px;padding:10px 14px;background:#17324d;box-shadow:0 2px 8px rgba(0,0,0,.18);}',
    '.preview-toolbar button{border:0;border-radius:6px;padding:9px 16px;background:#0f766e;color:#fff;font:700 14px Arial,sans-serif;cursor:pointer;}',
    '.preview-toolbar .secondary{background:#fff;color:#17324d;}',
    '.sheet{width:194mm;min-height:277mm;margin:8mm auto;background:#fff;padding:1.5mm 6mm 5mm;box-shadow:0 2px 16px rgba(15,23,42,.18);}',
    '.company{width:100%;border-collapse:collapse;margin:0 0 .5mm;}',
    '.company td{vertical-align:top;}',
    '.logo-cell{width:32mm;text-align:center;}',
    '.logo{display:block;width:25mm;max-height:25mm;margin:0 auto;object-fit:contain;}',
    '.company-info{text-align:center;line-height:1.2;padding-top:0;}',
    '.company-name{margin:0 0 .35mm;font-size:12.5pt;font-weight:700;line-height:1.15;text-transform:uppercase;}',
    '.company-line{margin:.25mm 0;font-size:9.5pt;line-height:1.15;}',
    '.title{text-align:center;border-top:.35mm solid #111;padding-top:2.2mm;margin-top:1mm;}',
    '.title h1{margin:0;font-size:18pt;font-weight:800;}',
    '.title p{margin:1mm 0 2.2mm;font-size:10.5pt;font-style:italic;font-weight:700;}',
    '.document-meta{display:flex;justify-content:center;gap:15mm;margin-bottom:2mm;font-size:9.5pt;}',
    '.customer{width:100%;border-collapse:collapse;margin:1mm 0 4mm;}',
    '.customer td{padding:1.3mm .8mm;font-size:10pt;vertical-align:top;border-bottom:.22mm solid #d0d0d0;}',
    '.customer .label{width:27mm;font-weight:700;white-space:nowrap;}',
    '.items{width:100%;border-collapse:collapse;table-layout:fixed;}',
    '.items thead{display:table-header-group;}',
    '.items tr{page-break-inside:avoid;}',
    '.items th,.items td{border:.35mm solid #111;padding:2mm 1.5mm;}',
    '.items th{text-align:center;font-size:9.5pt;font-weight:700;}',
    '.items th .subhead{display:block;margin-top:.4mm;font-size:7.8pt;font-weight:400;line-height:1.15;}',
    '.items td{font-size:9.5pt;vertical-align:middle;}',
    '.col-stt{width:12mm;}.col-name{width:auto;}.col-unit{width:19mm;}.col-qty{width:18mm;}.col-price{width:31mm;}.col-amount{width:34mm;}',
    '.center{text-align:center;}.money{text-align:right;white-space:nowrap;}.strong{font-weight:700;}',
    '.item-name{line-height:1.28;}.item-code{display:block;margin-top:.6mm;font-size:8.2pt;color:#444;}',
    '.totals{width:100%;border-collapse:collapse;margin-top:-.35mm;page-break-inside:avoid;}',
    '.totals td{border:.35mm solid #111;padding:2mm 2.2mm;font-size:10pt;}',
    '.totals .blank{border-right:0;}',
    '.totals .label{width:48mm;text-align:left;border-left:0;padding-left:2.2mm;}',
    '.totals .value{width:34mm;font-weight:700;text-align:right;white-space:nowrap;}',
    '.totals .grand td{font-size:11pt;font-weight:800;}',
    '.words{border:.35mm solid #111;border-top:0;padding:2.2mm;font-size:10pt;line-height:1.35;page-break-inside:avoid;}',
    '.words strong{font-weight:700;}',
    '.warehouse-note{border:.35mm solid #111;border-top:0;min-height:10mm;padding:2.2mm;font-size:10pt;line-height:1.35;page-break-inside:avoid;white-space:pre-wrap;}',
    '.warehouse-note strong{font-weight:700;}',
    '.reference{margin-top:2mm;text-align:right;font-size:8.8pt;font-style:italic;color:#444;}',
    '.sign-date{text-align:right;margin-top:7mm;font-size:10pt;font-style:italic;page-break-inside:avoid;}',
    '.signatures{width:100%;border-collapse:collapse;table-layout:fixed;page-break-inside:avoid;margin-top:2mm;}',
    '.signatures td{width:25%;height:35mm;text-align:center;vertical-align:top;padding:1.5mm;font-size:9.2pt;}',
    '.signatures strong{display:block;font-size:9.7pt;margin-bottom:1mm;}',
    '.signatures em{font-size:8.6pt;}',
    '@media print{html,body{background:#fff;}.preview-toolbar{display:none!important;}.sheet{width:auto;min-height:auto;margin:0;padding:0;box-shadow:none;}}',
    '</style>',
    '</head>',
    '<body>',
    toolbar,
    '<main class="sheet">',
    '<table class="company"><tr>',
    '<td class="logo-cell"><img class="logo" src="', logoData, '" alt="Logo Thành Đức"></td>',
    '<td class="company-info">',
    '<div class="company-name">', escapeHtmlServer_(company.name), '</div>',
    '<p class="company-line">', escapeHtmlServer_(company.address), '</p>',
    '<p class="company-line"><b>MST:</b> ', escapeHtmlServer_(company.tax),
    ' &nbsp; | &nbsp; <b>Tel:</b> ', escapeHtmlServer_(company.phone),
    ' &nbsp; | &nbsp; <b>Hotline:</b> ', escapeHtmlServer_(company.hotline), '</p>',
    '</td>',
    '</tr></table>',
    '<section class="title">',
    '<h1>PHIẾU XUẤT KHO BÁN HÀNG</h1>',
    '<p>', escapeHtmlServer_(formatVietnameseLongDate_(issueDate)), '</p>',
    '</section>',
    '<div class="document-meta">',
    '<span><b>Số phiếu:</b> ', escapeHtmlServer_(slipNo), '</span>',
    '<span><b>Theo báo giá:</b> ', escapeHtmlServer_(quote.SoBaoGia), '</span>',
    '</div>',
    '<table class="customer">',
    '<tr><td class="label">Tên khách hàng:</td><td><b>', escapeHtmlServer_(quote.TenKhachHang), '</b></td></tr>',
    '<tr><td class="label">Địa chỉ:</td><td>', escapeHtmlServer_(customer.DiaChi), '</td></tr>',
    '<tr><td class="label">Mã số thuế:</td><td>', escapeHtmlServer_(customer.MaSoThue),
    ' &nbsp;&nbsp; <b>Điện thoại:</b> ', escapeHtmlServer_(phone),
    contactName ? ' &nbsp;&nbsp; <b>Người nhận:</b> ' + escapeHtmlServer_(contactName) : '',
    '</td></tr>',
    '</table>',
    '<table class="items">',
    '<colgroup><col class="col-stt"><col class="col-name"><col class="col-unit"><col class="col-qty"><col class="col-price"><col class="col-amount"></colgroup>',
    '<thead><tr><th>STT</th><th>Tên hàng</th><th>Đơn vị</th><th>Số lượng</th><th>Đơn giá<span class="subhead">Chưa VAT</span></th><th>Thành tiền<span class="subhead">Chưa VAT</span></th></tr></thead>',
    '<tbody>', rowsHtml, '</tbody>',
    '</table>',
    '<table class="totals">',
    '<tr><td class="blank"></td><td class="label">Cộng tiền hàng</td><td class="value">', escapeHtmlServer_(formatMoney_(netBeforeOrderDiscount)), ' đ</td></tr>',
    discountRow,
    savedVat > 0
      ? '<tr><td class="blank"></td><td class="label">Thuế VAT ' + escapeHtmlServer_(vatPercent) + '%</td><td class="value">' + escapeHtmlServer_(formatMoney_(savedVat)) + ' đ</td></tr>'
      : '',
    '<tr class="grand"><td class="blank"></td><td class="label">Tổng tiền thanh toán</td><td class="value">', escapeHtmlServer_(formatMoney_(total)), ' đ</td></tr>',
    '</table>',
    '<div class="words"><strong>Số tiền bằng chữ:</strong> ', escapeHtmlServer_(numberToVietnamese_(total)), '.</div>',
    '<div class="warehouse-note"><strong>Ghi chú:</strong> ',
    clean_(quote.GhiChu)
      ? escapeHtmlServer_(quote.GhiChu)
      : '&nbsp;',
    '</div>',
    '<div class="sign-date">', escapeHtmlServer_(formatVietnameseLongDate_(issueDate)), '</div>',
    '<table class="signatures"><tr>',
    '<td><strong>Người mua hàng</strong><em>(Ký, họ tên)</em></td>',
    '<td><strong>Nhân viên giao</strong><em>(Ký, họ tên)</em></td>',
    '<td><strong>Kế toán bán hàng</strong><em>(Ký, họ tên)</em></td>',
    '<td><strong>Đại diện bên bán</strong><em>(Ký, họ tên)</em></td>',
    '</tr></table>',
    '</main>',
    '</body>',
    '</html>'
  ].join('');
}

function getQuotePreviewHtml(request) {
  return buildQuoteA4Html_(
    quotePreviewData_(request),
    true
  );
}


function quoteVatNote_(mode) {
  const normalized =
    pricingEngine_().normalizeMode(mode);

  const notes = {
    NO_VAT:
      'Đơn giá đã bao gồm VAT 0%.',
    INCLUDED_8:
      'Đơn giá đã bao gồm VAT 8%.',
    EXCLUDED_8:
      'Đơn giá chưa bao gồm VAT 8%.',
    INCLUDED_10:
      'Đơn giá đã bao gồm VAT 10%.',
    EXCLUDED_10:
      'Đơn giá chưa bao gồm VAT 10%.'
  };

  return notes[normalized];
}

function quoteVatPercent_(mode) {
  const normalized = pricingEngine_().normalizeMode(mode);

  if (
    normalized === 'INCLUDED_10' ||
    normalized === 'EXCLUDED_10'
  ) {
    return 10;
  }

  if (normalized === 'NO_VAT') {
    return 0;
  }

  return 8;
}

function quotePriceIncludesVat_(mode) {
  const normalized = pricingEngine_().normalizeMode(mode);

  return (
    normalized === 'INCLUDED_8' ||
    normalized === 'INCLUDED_10'
  );
}

function quoteColumnBasisLabel_(mode) {
  const normalized = pricingEngine_().normalizeMode(mode);
  const vatPercent = quoteVatPercent_(normalized);

  if (normalized === 'NO_VAT') {
    return 'Không tính VAT';
  }

  return quotePriceIncludesVat_(normalized)
    ? 'Đã gồm VAT ' + vatPercent + '%'
    : 'Chưa VAT ' + vatPercent + '%';
}

function buildQuoteA4Html_(
  data,
  previewMode
) {
  const quote = data.quote;
  const items = data.items || [];
  const config = cfg_();
  const company = companyInfo_(config);

  const customer = data.customer || findObjectByValue_(
      APP.SHEETS.CUSTOMERS,
      'MaKhachHang',
      quote.MaKhachHang
    ) || {};

  const total = Math.round(
    Number(
      quote.TongThanhToan || 0
    )
  );

  /*
   * Chế độ VAT phải được khai báo ngay trong hàm A4.
   * Bản V1.9.3 dùng taxMode nhưng chưa khai báo.
   */
  const taxMode =
    pricingEngine_().inferSavedMode(quote);

  const taxModeLabel =
    pricingEngine_().modeLabel(taxMode);

  const vatPercent = quoteVatPercent_(taxMode);
  const priceIncludesVat = quotePriceIncludesVat_(taxMode);
  const columnBasisLabel = quoteColumnBasisLabel_(taxMode);

  let displayedGoodsBeforeDiscount = 0;

  const logoData = getLogoDataUrl_();

  const rowsHtml = items.map(
    (item, index) => {
      const pricing =
        pricingEngine_().calculateItem(
          item,
          taxMode
        );

      const displayedLineAmount =
        pricing.priceIncludesVat
          ? pricing.payable
          : pricing.net;

      displayedGoodsBeforeDiscount +=
        displayedLineAmount;

      return [
        '<tr>',
        '<td class="center">' +
          (index + 1) +
        '</td>',
        '<td class="code">' +
          escapeHtmlServer_(item.code) +
        '</td>',
        '<td class="product">' +
          escapeHtmlServer_(item.name) +
        '</td>',
        '<td class="center">' +
          escapeHtmlServer_(item.unit) +
        '</td>',
        '<td class="center">' +
          escapeHtmlServer_(item.qty) +
        '</td>',
        '<td class="money">' +
          escapeHtmlServer_(
            formatMoney_(item.price)
          ) +
        '</td>',
        '<td class="money">' +
          escapeHtmlServer_(
            formatMoney_(displayedLineAmount)
          ) +
        '</td>',
        '</tr>'
      ].join('');
    }
  ).join('');

  displayedGoodsBeforeDiscount = Math.round(
    displayedGoodsBeforeDiscount
  );

  const displayedDiscount = priceIncludesVat
    ? Math.round(Number(quote.ChietKhau || 0))
    : Math.max(
        0,
        displayedGoodsBeforeDiscount -
        Math.round(Number(quote.TienHang || 0))
      );

  const grossLabel = priceIncludesVat
    ? 'Cộng tiền hàng (đã gồm VAT ' + vatPercent + '%)'
    : (
        vatPercent > 0
          ? 'Cộng tiền hàng (chưa VAT ' + vatPercent + '%)'
          : 'Cộng tiền hàng'
      );

  const discountRowHtml = displayedDiscount > 0
    ? [
        '<tr>',
        '<td class="label">Chiết khấu</td>',
        '<td class="value discount-value">-',
        escapeHtmlServer_(formatMoney_(displayedDiscount)),
        ' đ</td>',
        '</tr>'
      ].join('')
    : '';

  const subtotalRowHtml = priceIncludesVat
    ? [
        '<tr>',
        '<td class="label">Tiền hàng chưa VAT</td>',
        '<td class="value">',
        escapeHtmlServer_(formatMoney_(quote.TienHang)),
        ' đ</td>',
        '</tr>'
      ].join('')
    : (
        displayedDiscount > 0
          ? [
              '<tr>',
              '<td class="label">Tiền hàng sau chiết khấu</td>',
              '<td class="value">',
              escapeHtmlServer_(formatMoney_(quote.TienHang)),
              ' đ</td>',
              '</tr>'
            ].join('')
          : ''
      );

  const vatRowHtml = vatPercent > 0
    ? [
        '<tr>',
        '<td class="label">Thuế VAT ',
        escapeHtmlServer_(vatPercent),
        '%</td>',
        '<td class="value">',
        escapeHtmlServer_(formatMoney_(quote.VAT)),
        ' đ</td>',
        '</tr>'
      ].join('')
    : '';

  /*
   * Ghi chú mặc định luôn theo mẫu.
   * Chỉ dòng đầu thay đổi theo chế độ VAT.
   */
  const notes = [
    quoteVatNote_(taxMode),
    'Giá có thể thay đổi theo thời điểm và số lượng đặt hàng.',
    'Thời gian giao hàng và điều kiện thanh toán được xác nhận khi đặt hàng.',
    'Quý khách vui lòng liên hệ Thành Đức để được hỗ trợ mức giá tốt nhất.'
  ];

  const notesHtml = notes.map(
    note =>
      '<li>' +
      escapeHtmlServer_(note) +
      '</li>'
  ).join('');

  /*
   * Ghi chú riêng của báo giá luôn nằm cuối,
   * in đậm và dùng màu nhấn.
   */
  const customQuoteNote = clean_(
    quote.GhiChu
  );

  const customQuoteNoteHtml =
    customQuoteNote
      ? [
          '<li class="quote-custom-note">',
          '<strong>Ghi chú báo giá:</strong> ',
          escapeHtmlServer_(
            customQuoteNote
          ),
          '</li>'
        ].join('')
      : '';

  const customerEmail = clean_(customer.Email);

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

  const toolbar = previewMode
    ? [
        '<div class="preview-toolbar">',
        '<button onclick="window.print()">',
        'In báo giá',
        '</button>',
        '<button class="secondary" ',
        'onclick="window.close()">',
        'Đóng',
        '</button>',
        '</div>'
      ].join('')
    : '';

  const html = [
    '<!DOCTYPE html>',
    '<html lang="vi">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" ',
    'content="width=device-width,initial-scale=1">',
    '<title>',
    escapeHtmlServer_(quote.SoBaoGia),
    ' - Báo giá Thành Đức',
    '</title>',
    '<style>',
    '@page{',
    'size:A4 portrait;',
    'margin:10mm 10mm 12mm 10mm;',
    '}',
    '*{box-sizing:border-box;}',
    'html,body{',
    'margin:0;',
    'padding:0;',
    'font-family:Arial,Helvetica,sans-serif;',
    'font-size:9.4pt;',
    'line-height:1.35;',
    'color:#263746;',
    'background:#fff;',
    '-webkit-print-color-adjust:exact;',
    'print-color-adjust:exact;',
    '}',
    'body{width:190mm;margin:0 auto;}',
    '.preview-toolbar{',
    'position:sticky;',
    'top:0;',
    'z-index:10;',
    'display:flex;',
    'justify-content:flex-end;',
    'gap:8px;',
    'padding:8px 0;',
    'background:#fff;',
    '}',
    '.preview-toolbar button{',
    'border:0;',
    'border-radius:6px;',
    'padding:9px 18px;',
    'font:700 10pt Arial,sans-serif;',
    'background:#17324d;',
    'color:#fff;',
    'cursor:pointer;',
    '}',
    '.preview-toolbar .secondary{',
    'background:#e8edf2;',
    'color:#263746;',
    '}',
    '.sheet{width:100%;}',
    '.company-header{',
    'width:100%;',
    'border-collapse:collapse;',
    'border-bottom:1.2px solid #17324d;',
    'margin-bottom:5mm;',
    '}',
    '.company-header td{',
    'vertical-align:middle;',
    'padding:0 0 4mm 0;',
    '}',
    '.logo-cell{width:31mm;}',
    '.logo{',
    'display:block;',
    'width:25mm;',
    'height:27mm;',
    'object-fit:contain;',
    '}',
    '.company-name{',
    'margin:0 0 2.2mm;',
    'font-size:14.5pt;',
    'line-height:1.15;',
    'font-weight:700;',
    'color:#17324d;',
    '}',
    '.company-line{',
    'margin:0.7mm 0;',
    'font-size:8.8pt;',
    'font-weight:400;',
    'color:#3b4d5d;',
    '}',
    '.company-line strong{',
    'font-weight:700;',
    'color:#263746;',
    '}',
    '.quote-title{',
    'text-align:center;',
    'margin-bottom:4mm;',
    '}',
    '.quote-title h1{',
    'margin:0 0 1mm;',
    'font-size:20pt;',
    'line-height:1.1;',
    'font-weight:700;',
    'letter-spacing:.2px;',
    'color:#17324d;',
    '}',
    '.quote-title p{',
    'margin:0;',
    'font-size:9pt;',
    'font-weight:400;',
    'color:#647586;',
    '}',
    '.meta-strip{',
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
    '.items{',
    'width:100%;',
    'border-collapse:separate;',
    'border-spacing:0;',
    'table-layout:fixed;',
    'margin-bottom:3.2mm;',
    'border:.3mm solid #c8d3dc;',
    'border-radius:2mm;',
    'overflow:hidden;',
    '}',
    '.items thead{display:table-header-group;}',
    '.items tr{page-break-inside:avoid;}',
    '.items th,',
    '.items td{',
    'border-right:.25mm solid #d8e0e6;',
    'border-bottom:.25mm solid #d8e0e6;',
    'padding:2.15mm 1.6mm;',
    'vertical-align:middle;',
    '}',
    '.items th:last-child,.items td:last-child{border-right:0;}',
    '.items tbody tr:last-child td{border-bottom:0;}',
    '.items th{',
    'font-size:8.15pt;',
    'font-weight:700;',
    'text-align:center;',
    'color:#fff;',
    'background:#17324d;',
    'letter-spacing:.05px;',
    '}',
    '.items td{',
    'font-size:8.6pt;',
    'font-weight:400;',
    'color:#263746;',
    '}',
    '.items tbody tr:nth-child(even){',
    'background:#f7f9fb;',
    '}',
    '.items .product{',
    'font-weight:600;',
    'line-height:1.32;',
    'color:#1f3347;',
    '}',
    '.th-note{',
    'display:block;',
    'margin-top:.4mm;',
    'font-size:7pt;',
    'font-weight:400;',
    'line-height:1.15;',
    'color:#dce7ef;',
    '}',
    '.discount-value{color:#a12622;}',
    '.items .code{',
    'font-size:8.2pt;',
    '}',
    '.center{text-align:center;}',
    '.money{text-align:right;white-space:nowrap;}',
    '.col-stt{width:9mm;}',
    '.col-code{width:23mm;}',
    '.col-name{width:70mm;}',
    '.col-unit{width:14mm;}',
    '.col-qty{width:12mm;}',
    '.col-price{width:28mm;}',
    '.col-total{width:31mm;}',
    '.totals-wrap{',
    'display:flex;',
    'justify-content:flex-end;',
    'page-break-inside:avoid;',
    'margin-top:2mm;',
    '}',
    '.totals{',
    'width:82mm;',
    'border-collapse:separate;',
    'border-spacing:0;',
    'border:.3mm solid #cbd6df;',
    'border-radius:2mm;',
    'overflow:hidden;',
    '}',
    '.totals td{',
    'border:0;',
    'border-bottom:.25mm solid #e0e6eb;',
    'padding:2.1mm 2.5mm;',
    'font-size:8.8pt;',
    '}',
    '.totals tr:last-child td{border-bottom:0;}',
    '.totals .label{',
    'font-weight:400;',
    'background:#f7f9fb;',
    '}',
    '.totals .value{',
    'text-align:right;',
    'font-weight:700;',
    'white-space:nowrap;',
    '}',
    '.totals .grand td{',
    'font-size:10pt;',
    'font-weight:700;',
    'color:#fff;',
    'background:#17324d;',
    '}',
    '.amount-words{',
    'margin:2.8mm 0 3.5mm;',
    'padding:2mm 2.6mm;',
    'font-size:8.8pt;',
    'font-weight:400;',
    'color:#354858;',
    'background:#f8fafc;',
    'border-left:1mm solid #0f766e;',
    '}',
    '.amount-words strong{font-weight:700;}',
    '.notes{',
    'page-break-inside:avoid;',
    'border:.35mm solid #cbd3da;',
    'background:#f7f9fb;',
    'padding:2.5mm 3mm;',
    'margin-top:2mm;',
    '}',
    '.notes h3{',
    'margin:0 0 1.5mm;',
    'font-size:9.2pt;',
    'font-weight:700;',
    'color:#17324d;',
    '}',
    '.notes ul{',
    'margin:0;',
    'padding-left:5mm;',
    '}',
    '.notes li{',
    'margin:0.8mm 0;',
    'font-size:8.4pt;',
    'font-weight:400;',
    'line-height:1.35;',
    '}',
    '.notes .quote-custom-note{',
    'margin-top:2mm;',
    'padding-top:1.8mm;',
    'border-top:.25mm solid #d5a2a2;',
    'font-weight:700;',
    'color:#a12622;',
    '}',
    '.notes .quote-custom-note strong{',
    'font-weight:700;',
    'color:#a12622;',
    '}',
    '.signatures{',
    'width:100%;',
    'border-collapse:collapse;',
    'page-break-inside:avoid;',
    'margin-top:6mm;',
    '}',
    '.signatures td{',
    'width:50%;',
    'height:34mm;',
    'vertical-align:top;',
    'text-align:center;',
    'padding:0 4mm;',
    'font-size:8.7pt;',
    'font-weight:400;',
    'color:#47596a;',
    '}',
    '.signatures strong{',
    'display:block;',
    'margin-bottom:1mm;',
    'font-size:9pt;',
    'font-weight:700;',
    'color:#17324d;',
    '}',
    '.footer{',
    'margin-top:3mm;',
    'padding-top:2mm;',
    'border-top:.25mm solid #d6dde3;',
    'text-align:center;',
    'font-size:7.8pt;',
    'font-weight:400;',
    'color:#778795;',
    '}',
    '@media print{',
    '.preview-toolbar{display:none;}',
    'html,body{width:auto;margin:0;}',
    '}',
    '</style>',
    '</head>',
    '<body>',
    toolbar,
    '<main class="sheet">',
    '<table class="company-header">',
    '<tr>',
    '<td class="logo-cell">',
    '<img class="logo" src="',
    logoData,
    '" alt="Logo Thành Đức">',
    '</td>',
    '<td>',
    '<div class="company-name">',
    escapeHtmlServer_(company.name),
    '</div>',
    '<p class="company-line"><strong>Địa chỉ:</strong> ',
    escapeHtmlServer_(company.address),
    '</p>',
    '<p class="company-line"><strong>Điện thoại:</strong> ',
    escapeHtmlServer_(company.phone),
    ' &nbsp; | &nbsp; <strong>Hotline:</strong> ',
    escapeHtmlServer_(company.hotline),
    '</p>',
    '<p class="company-line"><strong>Mã số thuế:</strong> ',
    escapeHtmlServer_(company.tax),
    '</p>',
    '<p class="company-line"><strong>Website:</strong> ',
    escapeHtmlServer_(company.website),
    ' &nbsp; | &nbsp; <strong>Email:</strong> ',
    escapeHtmlServer_(company.email),
    '</p>',
    '</td>',
    '</tr>',
    '</table>',
    '<section class="quote-title">',
    '<h1>BÁO GIÁ SẢN PHẨM</h1>',
    '<p>Trân trọng gửi đến Quý khách hàng</p>',
    '</section>',
    '<section class="meta-strip">',
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
    '<table class="items">',
    '<colgroup>',
    '<col class="col-stt">',
    '<col class="col-code">',
    '<col class="col-name">',
    '<col class="col-unit">',
    '<col class="col-qty">',
    '<col class="col-price">',
    '<col class="col-total">',
    '</colgroup>',
    '<thead><tr>',
    '<th>STT</th>',
    '<th>Mã hàng</th>',
    '<th>Tên sản phẩm / dịch vụ</th>',
    '<th>ĐVT</th>',
    '<th>SL</th>',
    '<th>Đơn giá<span class="th-note">',
    escapeHtmlServer_(columnBasisLabel),
    '</span></th>',
    '<th>Thành tiền<span class="th-note">',
    escapeHtmlServer_(columnBasisLabel),
    '</span></th>',
    '</tr></thead>',
    '<tbody>',
    rowsHtml,
    '</tbody>',
    '</table>',
    '<div class="totals-wrap">',
    '<table class="totals">',
    '<tr>',
    '<td class="label">',
    escapeHtmlServer_(grossLabel),
    '</td>',
    '<td class="value">',
    escapeHtmlServer_(
      formatMoney_(displayedGoodsBeforeDiscount)
    ),
    ' đ</td>',
    '</tr>',
    discountRowHtml,
    subtotalRowHtml,
    vatRowHtml,
    '<tr class="grand">',
    '<td>TỔNG THANH TOÁN</td>',
    '<td class="value">',
    escapeHtmlServer_(
      formatMoney_(total)
    ),
    ' đ</td>',
    '</tr>',
    '</table>',
    '</div>',
    '<p class="amount-words">',
    '<strong>Bằng chữ:</strong> ',
    escapeHtmlServer_(
      numberToVietnamese_(total)
    ),
    '</p>',
    '<section class="notes">',
    '<h3>GHI CHÚ</h3>',
    '<ul>',
    notesHtml,
    customQuoteNoteHtml,
    '</ul>',
    '</section>',
    '<table class="signatures">',
    '<tr>',
    '<td>',
    '<strong>ĐẠI DIỆN KHÁCH HÀNG</strong>',
    '(Ký và ghi rõ họ tên)',
    '</td>',
    '<td>',
    '<strong>ĐẠI DIỆN CÔNG TY THÀNH ĐỨC</strong>',
    '(Ký tên và đóng dấu)',
    '</td>',
    '</tr>',
    '</table>',
    '<div class="footer">',
    escapeHtmlServer_(company.name),
    ' · ',
    escapeHtmlServer_(company.hotline),
    ' · ',
    escapeHtmlServer_(company.website),
    '</div>',
    '</main>',
    '</body>',
    '</html>'
  ].join('');

  return html;
}


function generateQuotePdf_(data) {
  const quote = data.quote;
  const no = clean_(quote.SoBaoGia);

  const date = quote.NgayBaoGia instanceof Date
    ? quote.NgayBaoGia
    : new Date(quote.NgayBaoGia);

  const folder = getDatedStorageFolder_(
    'BAO_GIA',
    date
  );

  const customer = findObjectByValue_(
      APP.SHEETS.CUSTOMERS,
      'MaKhachHang',
      quote.MaKhachHang
    ) || {};

  const html = buildQuoteA4Html_(
    {
      quote: quote,
      items: data.items,
      customer: customer
    },
    false
  );

  const baseName = quoteFileBaseName_(quote);

  const pdfBlob = HtmlService
    .createHtmlOutput(html)
    .getAs(MimeType.PDF)
    .setName(baseName + '.pdf');

  const pdf = folder.createFile(pdfBlob);

  setQuotePdf_(no, pdf.getUrl());

  return {
    success: true,
    no: no,
    doc: '',
    pdf: pdf.getUrl(),
    folder: folder.getUrl(),
    created: true,
    format: 'A4'
  };
}

function archiveQuoteFiles_(no, storedUrl, quoteDate) {
  const date = quoteDate instanceof Date && !isNaN(quoteDate)
    ? quoteDate
    : new Date();

  const quoteFolder = getDatedStorageFolder_(
    'BAO_GIA',
    date
  );

  const archiveFolder = getOrCreateChildFolder_(
    quoteFolder,
    'PHIEN_BAN_CU'
  );

  const timestamp = Utilities.formatDate(
    new Date(),
    APP.TZ,
    'yyyyMMdd_HHmmss'
  );

  const handled = {};
  let moved = 0;

  function archiveFile_(file) {
    if (!file || file.isTrashed()) return;

    const id = file.getId();

    if (handled[id]) return;
    handled[id] = true;

    const currentName = file.getName();

    if (currentName.indexOf(clean_(no)) < 0) return;

    if (currentName.indexOf('[CU_') !== 0) {
      file.setName(
        '[CU_' + timestamp + '] ' + currentName
      );
    }

    file.moveTo(archiveFolder);
    moved++;
  }

  const currentFiles = quoteFolder.getFiles();

  while (currentFiles.hasNext()) {
    try {
      archiveFile_(currentFiles.next());
    } catch (error) {
      // Không dừng cập nhật chỉ vì một tệp không đủ quyền di chuyển.
    }
  }

  const storedId = extractDriveFileId_(storedUrl);

  if (storedId && !handled[storedId]) {
    try {
      archiveFile_(DriveApp.getFileById(storedId));
    } catch (error) {
      // Tệp cũ có thể đã bị xóa hoặc không thuộc quyền sở hữu.
    }
  }

  [
    'BÁO GIÁ ' + clean_(no),
    'BAO_GIA_' + clean_(no) + '.pdf'
  ].forEach(name => {
    const files = DriveApp.getFilesByName(name);

    while (files.hasNext()) {
      try {
        archiveFile_(files.next());
      } catch (error) {
        // Bỏ qua tệp không thể xử lý.
      }
    }
  });

  return moved;
}


function getHistoryData(limit) {
  const quoteLimit = Math.max(
    20,
    Math.min(Number(limit || 200), 1000)
  );

  return {
    quotes: listQuotes({limit: quoteLimit}),
    contracts: getRecentContracts(20)
  };
}

function getRecentQuotes(limit) {
  return listQuotes({limit: Number(limit || 20)});
}

function getRecentContracts(limit) {
  return recentRows_(
    APP.SHEETS.CONTRACTS,
    Number(limit || 20)
  )
    .reverse()
    .map(x => ({
      no: clean_(x.SoHopDong),
      date: formatDate_(x.NgayHopDong),
      type: clean_(x.LoaiHopDong),
      customer: clean_(x.TenKhachHang),
      total: Number(x.GiaTriHopDong || 0),
      status: clean_(x.TrangThai),
      doc: clean_(x.LinkGoogleDoc),
      pdf: clean_(x.LinkPDF)
    }));
}

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

  const lineSheet = sheet_(APP.SHEETS.QUOTE_LINES);
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
}

function createPrincipleContractForCustomer(customerId) {
  const id = clean_(customerId);

  if (!id) {
    throw new Error('Thiếu mã khách hàng.');
  }

  const customer = findObjectByValue_(
    APP.SHEETS.CUSTOMERS,
    'MaKhachHang',
    id
  );

  if (!customer) {
    throw new Error('Không tìm thấy khách hàng ' + id);
  }

  const config = cfg_();
  const templateId = clean_(
    config.TEMPLATE_HDNT_ID
  );

  if (!templateId) {
    throw new Error(
      'Chưa cấu hình TEMPLATE_HDNT_ID trong sheet CAU_HINH.'
    );
  }

  validateContractCustomer_(customer);

  const customerName = clean_(
    customer.TenKhachHang
  );

  const contractNo = nextNo_('HDNT');
  const now = new Date();

  const folder = getDatedStorageFolder_(
    'HOP_DONG',
    now,
    'HDNT'
  );

  const baseName = safeFileName_(
    contractNo + ' - ' + customerName
  );

  const copy = DriveApp
    .getFileById(templateId)
    .makeCopy(baseName, folder);

  const doc = DocumentApp.openById(
    copy.getId()
  );

  const body = doc.getBody();

  const replacements = {
    '{{SO_HOP_DONG}}': contractNo,
    '{{NGAY}}': Utilities.formatDate(
      now,
      APP.TZ,
      'dd'
    ),
    '{{THANG}}': Utilities.formatDate(
      now,
      APP.TZ,
      'MM'
    ),
    '{{NAM}}': Utilities.formatDate(
      now,
      APP.TZ,
      'yyyy'
    ),
    '{{TEN_KHACH_HANG}}': customerName,
    '{{DIA_CHI_KHACH_HANG}}':
      clean_(customer.DiaChi),
    '{{MA_SO_THUE_KHACH_HANG}}':
      clean_(customer.MaSoThue),
    '{{DIEN_THOAI_KHACH_HANG}}':
      normalizePhone_(customer.DienThoai),
    '{{EMAIL_KHACH_HANG}}':
      clean_(customer.Email),
    '{{NGUOI_DAI_DIEN}}':
      clean_(customer.NguoiDaiDien),
    '{{CHUC_VU}}':
      clean_(customer.ChucVu),
    '{{NGUOI_NHAN}}':
      clean_(customer.NguoiNhan),
    '{{DIA_CHI_GIAO_HANG}}':
      clean_(customer.DiaChi),
    '{{TONG_TIEN}}': '0',
    '{{TONG_TIEN_BANG_CHU}}':
      'Không đồng'
  };

  Object.keys(replacements).forEach(key => {
    body.replaceText(
      escapeRegex_(key),
      replacements[key] || ''
    );
  });

  doc.saveAndClose();

  /*
   * DocumentApp không bảo đảm đường kẻ bên trong
   * của các dòng được append động khi xuất PDF.
   * Dùng Docs API để áp full grid sau khi lưu tài liệu.
   */
  if (type === 'HĐMB') {
    applyContractTableBorders_(
      copy.getId()
    );
  }

  const pdf = folder
    .createFile(
      DriveApp
        .getFileById(copy.getId())
        .getAs(MimeType.PDF)
    )
    .setName(baseName + '.pdf');

  sheet_(APP.SHEETS.CONTRACTS).appendRow([
    contractNo,
    now,
    'HĐNT',
    '',
    id,
    customerName,
    clean_(customer.NguoiDaiDien),
    clean_(customer.ChucVu),
    0,
    'ĐÃ TẠO',
    Session.getActiveUser().getEmail() ||
      'Người dùng',
    copy.getUrl(),
    pdf.getUrl(),
    'Tạo trực tiếp từ danh sách khách hàng'
  ]);

  return {
    success: true,
    no: contractNo,
    customerId: id,
    customer: customerName,
    doc: copy.getUrl(),
    pdf: pdf.getUrl(),
    folder: folder.getUrl()
  };
}


function contractTaxPercent_(mode) {
  const normalized =
    pricingEngine_().normalizeMode(mode);

  if (
    normalized === 'INCLUDED_10' ||
    normalized === 'EXCLUDED_10'
  ) {
    return 10;
  }

  if (normalized === 'NO_VAT') {
    return 0;
  }

  return 8;
}

function contractPriceHeader_(mode) {
  const normalized =
    pricingEngine_().normalizeMode(mode);

  if (normalized === 'NO_VAT') {
    return 'ĐƠN GIÁ\n(VAT 0%)';
  }

  if (
    normalized === 'INCLUDED_8' ||
    normalized === 'INCLUDED_10'
  ) {
    return (
      'ĐƠN GIÁ\n(ĐÃ GỒM VAT ' +
      contractTaxPercent_(normalized) +
      '%)'
    );
  }

  return (
    'ĐƠN GIÁ\n(CHƯA VAT ' +
    contractTaxPercent_(normalized) +
    '%)'
  );
}

function contractAmountHeader_(mode) {
  const normalized =
    pricingEngine_().normalizeMode(mode);

  if (
    normalized === 'EXCLUDED_8' ||
    normalized === 'EXCLUDED_10'
  ) {
    return 'THÀNH TIỀN\n(CHƯA VAT)';
  }

  return 'THÀNH TIỀN\n(ĐÃ VAT)';
}

function contractItemText_(
  item,
  product
) {
  const lines = [];

  const code = clean_(item.code);
  const name = clean_(item.name);

  lines.push(
    (code ? code + ' - ' : '') +
    name
  );

  const warranty = clean_(
    product && product.BaoHanh
  );

  const description = clean_(
    product && product.MoTa
  );

  if (warranty) {
    lines.push(
      'Bảo hành: ' +
      warranty
    );
  }

  if (description) {
    const limited =
      description.length > 180
        ? description.slice(0, 177) +
          '...'
        : description;

    lines.push(
      'Mô tả: ' +
      limited
    );
  }

  return lines.join('\n');
}

function setContractParagraph_(
  paragraph,
  text,
  boldParts
) {
  paragraph.setText(text);

  paragraph
    .setIndentStart(0)
    .setIndentEnd(0)
    .setIndentFirstLine(0)
    .setSpacingBefore(3)
    .setSpacingAfter(3)
    .setLineSpacing(1.08)
    .setAlignment(
      DocumentApp
        .HorizontalAlignment
        .JUSTIFY
    );

  const editor =
    paragraph.editAsText();

  editor
    .setFontFamily('Times New Roman')
    .setFontSize(11)
    .setBold(false);

  (boldParts || []).forEach(part => {
    const start = text.indexOf(part);

    if (
      start >= 0 &&
      part.length > 0
    ) {
      editor.setBold(
        start,
        start + part.length - 1,
        true
      );
    }
  });
}

function updateContractPricingSection_(
  body,
  quote,
  quoteTaxMode
) {
  const paragraphs =
    body.getParagraphs();

  const quoteNo = clean_(
    quote.SoBaoGia
  );

  const quoteDate =
    formatDateOnly_(
      quote.NgayBaoGia
    );

  const validUntil =
    formatDateOnly_(
      quote.HieuLucDen
    );

  const taxPercent =
    contractTaxPercent_(
      quoteTaxMode
    );

  const total = Math.round(
    Number(
      quote.TongThanhToan || 0
    )
  );

  const net = Math.round(
    Number(
      quote.TienHang || 0
    )
  );

  const vat = Math.round(
    Number(
      quote.VAT || 0
    )
  );

  paragraphs.forEach(paragraph => {
    const current = clean_(
      paragraph.getText()
    );

    if (current.indexOf('1.1.') === 0) {
      const text =
        '1.1. Căn cứ Báo giá số ' +
        quoteNo +
        (
          quoteDate
            ? ' ngày ' + quoteDate
            : ''
        ) +
        (
          validUntil
            ? ', có hiệu lực đến ' +
              validUntil
            : ''
        ) +
        ', Bên B đồng ý bán và Bên A đồng ý mua các hàng hóa/dịch vụ theo bảng dưới đây:';

      setContractParagraph_(
        paragraph,
        text,
        [
          '1.1.',
          'Báo giá số ' + quoteNo
        ]
      );
    }

    if (current.indexOf('1.2.') === 0) {
      /*
       * Chỉ giữ các số liệu cần thiết:
       * tiền hàng chưa VAT, VAT, tổng thanh toán
       * và số tiền bằng chữ.
       */
      const lines = [
        '1.2. Chi tiết giá trị hợp đồng:',
        'Tiền hàng chưa VAT: ' +
          formatMoney_(net) +
          ' đồng',
        'Thuế VAT ' +
          taxPercent +
          '%: ' +
          formatMoney_(vat) +
          ' đồng',
        'Tổng giá trị thanh toán: ' +
          formatMoney_(total) +
          ' đồng',
        'Bằng chữ: ' +
          numberToVietnamese_(total)
      ];

      const note = clean_(
        quote.GhiChu
      );

      if (note) {
        lines.push(
          'Ghi chú báo giá: ' +
          note
        );
      }

      const text = lines.join('\n');

      setContractParagraph_(
        paragraph,
        text,
        [
          '1.2. Chi tiết giá trị hợp đồng:',
          'Tổng giá trị thanh toán: ' +
            formatMoney_(total) +
            ' đồng',
          note
            ? 'Ghi chú báo giá:'
            : ''
        ].filter(Boolean)
      );

      /*
       * Dòng “Bằng chữ” không bôi đậm.
       */
    }

    if (current.indexOf('1.3.') === 0) {
      const normalized =
        pricingEngine_().normalizeMode(
          quoteTaxMode
        );

      let taxText = '';

      if (normalized === 'NO_VAT') {
        taxText =
          'Đơn giá áp dụng VAT 0%; tổng giá trị thanh toán không phát sinh tiền thuế VAT.';
      } else if (
        normalized === 'INCLUDED_8' ||
        normalized === 'INCLUDED_10'
      ) {
        taxText =
          'Đơn giá và tổng giá trị hợp đồng đã bao gồm thuế VAT ' +
          taxPercent +
          '%.';
      } else {
        taxText =
          'Đơn giá chưa bao gồm thuế VAT ' +
          taxPercent +
          '%; tiền thuế được cộng riêng tại khoản 1.2.';
      }

      const text =
        '1.3. ' +
        taxText +
        ' Trường hợp chính sách thuế thay đổi tại thời điểm lập hóa đơn, các bên thực hiện theo quy định pháp luật và chứng từ thực tế.';

      setContractParagraph_(
        paragraph,
        text,
        ['1.3.']
      );
    }

    if (current.indexOf('1.4.') === 0) {
      const text =
        '1.4. Tên hàng, mã hàng, quy cách, tình trạng, xuất xứ và bảo hành được xác định theo bảng trên, báo giá, tài liệu sản phẩm hoặc xác nhận của hai bên. Hàng mới phải nguyên vẹn và chưa qua sử dụng; hàng đã qua sử dụng hoặc dịch vụ phải được ghi rõ trong tên hàng, mô tả hoặc ghi chú báo giá.';

      setContractParagraph_(
        paragraph,
        text,
        ['1.4.']
      );
    }
  });
}


function docsApiContentText_(content) {
  let text = '';

  (content || []).forEach(element => {
    if (
      element.paragraph &&
      element.paragraph.elements
    ) {
      element.paragraph.elements.forEach(
        paragraphElement => {
          if (
            paragraphElement.textRun &&
            paragraphElement.textRun.content
          ) {
            text +=
              paragraphElement.textRun.content;
          }
        }
      );
    }

    if (element.table) {
      element.table.tableRows
        .forEach(row => {
          row.tableCells.forEach(cell => {
            text += docsApiContentText_(
              cell.content
            );
          });
        });
    }

    if (
      element.tableOfContents &&
      element.tableOfContents.content
    ) {
      text += docsApiContentText_(
        element.tableOfContents.content
      );
    }
  });

  return text;
}

function findContractGoodsTableApi_(
  documentData
) {
  const content =
    documentData &&
    documentData.body &&
    documentData.body.content
      ? documentData.body.content
      : [];

  for (
    let index = 0;
    index < content.length;
    index++
  ) {
    const element = content[index];

    if (!element.table) {
      continue;
    }

    const text =
      docsApiContentText_([element])
        .replace(/\s+/g, ' ')
        .trim();

    if (
      text.indexOf(
        'MÃ / TÊN HÀNG HÓA, DỊCH VỤ'
      ) >= 0 &&
      text.indexOf(
        'TỔNG TIỀN'
      ) >= 0
    ) {
      const rows =
        element.table.tableRows || [];

      const columnCount = rows.reduce(
        (max, row) => Math.max(
          max,
          (row.tableCells || []).length
        ),
        0
      );

      return {
        startIndex:
          Number(element.startIndex),
        rowCount: rows.length,
        columnCount: columnCount
      };
    }
  }

  throw new Error(
    'Không tìm thấy bảng hàng hóa để đóng khung.'
  );
}

function docsApiBorder_(
  width,
  red,
  green,
  blue
) {
  return {
    color: {
      color: {
        rgbColor: {
          red: red,
          green: green,
          blue: blue
        }
      }
    },
    width: {
      magnitude: width,
      unit: 'PT'
    },
    dashStyle: 'SOLID'
  };
}

function contractTableRange_(
  tableInfo,
  rowIndex,
  columnIndex,
  rowSpan,
  columnSpan
) {
  return {
    tableCellLocation: {
      tableStartLocation: {
        index: tableInfo.startIndex
      },
      rowIndex: rowIndex,
      columnIndex: columnIndex
    },
    rowSpan: rowSpan,
    columnSpan: columnSpan
  };
}

function applyContractTableBorders_(
  documentId
) {
  const token =
    ScriptApp.getOAuthToken();

  const documentUrl =
    'https://docs.googleapis.com/v1/documents/' +
    encodeURIComponent(documentId);

  const getResponse =
    UrlFetchApp.fetch(
      documentUrl,
      {
        method: 'get',
        headers: {
          Authorization:
            'Bearer ' + token
        },
        muteHttpExceptions: true
      }
    );

  const getCode =
    getResponse.getResponseCode();

  if (
    getCode < 200 ||
    getCode >= 300
  ) {
    throw new Error(
      'Không đọc được tài liệu để kẻ khung. HTTP ' +
      getCode +
      ': ' +
      getResponse.getContentText()
    );
  }

  const documentData =
    JSON.parse(
      getResponse.getContentText()
    );

  const tableInfo =
    findContractGoodsTableApi_(
      documentData
    );

  if (
    tableInfo.rowCount < 2 ||
    tableInfo.columnCount < 2
  ) {
    throw new Error(
      'Bảng hàng hóa không đủ dòng hoặc cột.'
    );
  }

  /*
   * Viền trong: xám đậm 0,6 pt.
   * Gán cả 4 cạnh cho từng ô để tạo full grid.
   */
  const innerBorder =
    docsApiBorder_(
      0.6,
      0.40,
      0.45,
      0.50
    );

  /*
   * Viền ngoài: navy 1,1 pt.
   */
  const outerBorder =
    docsApiBorder_(
      1.1,
      0.09,
      0.20,
      0.30
    );

  /*
   * Đường dưới hàng tiêu đề: 0,9 pt.
   */
  const headerBorder =
    docsApiBorder_(
      0.9,
      0.09,
      0.20,
      0.30
    );

  const allCellsRange =
    contractTableRange_(
      tableInfo,
      0,
      0,
      tableInfo.rowCount,
      tableInfo.columnCount
    );

  const requests = [
    {
      updateTableCellStyle: {
        tableRange: allCellsRange,
        tableCellStyle: {
          borderTop: innerBorder,
          borderBottom: innerBorder,
          borderLeft: innerBorder,
          borderRight: innerBorder
        },
        fields:
          'borderTop,borderBottom,' +
          'borderLeft,borderRight'
      }
    },

    /*
     * Viền trên toàn bảng.
     */
    {
      updateTableCellStyle: {
        tableRange:
          contractTableRange_(
            tableInfo,
            0,
            0,
            1,
            tableInfo.columnCount
          ),
        tableCellStyle: {
          borderTop: outerBorder,
          borderBottom: headerBorder
        },
        fields:
          'borderTop,borderBottom'
      }
    },

    /*
     * Viền dưới toàn bảng.
     */
    {
      updateTableCellStyle: {
        tableRange:
          contractTableRange_(
            tableInfo,
            tableInfo.rowCount - 1,
            0,
            1,
            tableInfo.columnCount
          ),
        tableCellStyle: {
          borderBottom: outerBorder
        },
        fields: 'borderBottom'
      }
    },

    /*
     * Viền trái toàn bảng.
     */
    {
      updateTableCellStyle: {
        tableRange:
          contractTableRange_(
            tableInfo,
            0,
            0,
            tableInfo.rowCount,
            1
          ),
        tableCellStyle: {
          borderLeft: outerBorder
        },
        fields: 'borderLeft'
      }
    },

    /*
     * Viền phải toàn bảng.
     */
    {
      updateTableCellStyle: {
        tableRange:
          contractTableRange_(
            tableInfo,
            0,
            tableInfo.columnCount - 1,
            tableInfo.rowCount,
            1
          ),
        tableCellStyle: {
          borderRight: outerBorder
        },
        fields: 'borderRight'
      }
    }
  ];

  const updateResponse =
    UrlFetchApp.fetch(
      documentUrl + ':batchUpdate',
      {
        method: 'post',
        contentType: 'application/json',
        headers: {
          Authorization:
            'Bearer ' + token
        },
        payload: JSON.stringify({
          requests: requests
        }),
        muteHttpExceptions: true
      }
    );

  const updateCode =
    updateResponse.getResponseCode();

  if (
    updateCode < 200 ||
    updateCode >= 300
  ) {
    throw new Error(
      'Không thể kẻ khung bảng hợp đồng. HTTP ' +
      updateCode +
      ': ' +
      updateResponse.getContentText()
    );
  }

  /*
   * Chờ Google Docs hoàn tất style trước khi xuất PDF.
   */
  Utilities.sleep(700);

  return true;
}

function createContract(no, type) {
  const data = getQuote(no);
  const q = data.quote;

  const customer = findObjectByValue_(
      APP.SHEETS.CUSTOMERS,
      'MaKhachHang',
      q.MaKhachHang
    );

  if (!customer) {
    throw new Error(
      'Báo giá chưa liên kết với khách hàng trong danh sách. ' +
      'Hãy mở báo giá và chọn lại khách hàng.'
    );
  }

  validateContractCustomer_(customer);

  const config = cfg_();

  const templateId =
    type === 'HĐNT'
      ? clean_(config.TEMPLATE_HDNT_ID)
      : clean_(config.TEMPLATE_HDMB_ID);

  if (!templateId) {
    throw new Error(
      'Chưa cấu hình ID mẫu ' +
      type +
      ' trong sheet CAU_HINH.'
    );
  }

  const contractNo =
    type === 'HĐNT'
      ? nextNo_('HDNT')
      : nextNo_('HDMB');

  const date = new Date();

  const folder = getDatedStorageFolder_(
    'HOP_DONG',
    date,
    contractSubtypeFolder_(type)
  );

  const baseName = safeFileName_(
    contractNo +
    ' - ' +
    clean_(q.TenKhachHang)
  );

  const copy = DriveApp
    .getFileById(templateId)
    .makeCopy(baseName, folder);

  const doc = DocumentApp.openById(
    copy.getId()
  );

  const body = doc.getBody();
  const total = Number(
    q.TongThanhToan || 0
  );

  const replacements = {
    '{{SO_HOP_DONG}}': contractNo,
    '{{NGAY}}': Utilities.formatDate(
      date,
      APP.TZ,
      'dd'
    ),
    '{{THANG}}': Utilities.formatDate(
      date,
      APP.TZ,
      'MM'
    ),
    '{{NAM}}': Utilities.formatDate(
      date,
      APP.TZ,
      'yyyy'
    ),
    '{{TEN_KHACH_HANG}}':
      clean_(q.TenKhachHang),
    '{{DIA_CHI_KHACH_HANG}}':
      clean_(customer.DiaChi),
    '{{MA_SO_THUE_KHACH_HANG}}':
      clean_(customer.MaSoThue),
    '{{DIEN_THOAI_KHACH_HANG}}':
      normalizePhone_(customer.DienThoai),
    '{{EMAIL_KHACH_HANG}}':
      clean_(customer.Email),
    '{{NGUOI_NHAN}}':
      clean_(customer.NguoiNhan),
    '{{NGUOI_DAI_DIEN}}':
      clean_(customer.NguoiDaiDien),
    '{{CHUC_VU}}':
      clean_(customer.ChucVu),
    '{{DIA_CHI_GIAO_HANG}}':
      clean_(customer.DiaChi),
    '{{TONG_TIEN}}':
      formatMoney_(total),
    '{{TONG_TIEN_BANG_CHU}}':
      numberToVietnamese_(total)
        .replace(/\s+đồng$/i, '')
  };

  Object.keys(replacements).forEach(key => {
    body.replaceText(
      escapeRegex_(key),
      replacements[key] || ''
    );
  });

  if (type === 'HĐMB') {
    const quoteTaxMode =
      pricingEngine_().inferSavedMode(q);

    fillGoodsTable_(
      body,
      data.items,
      q,
      quoteTaxMode
    );

    updateContractPricingSection_(
      body,
      q,
      quoteTaxMode
    );
  }

  doc.saveAndClose();

  const pdf = folder
    .createFile(copy.getAs(MimeType.PDF))
    .setName(baseName + '.pdf');

  sheet_(APP.SHEETS.CONTRACTS).appendRow([
    contractNo,
    date,
    type,
    no,
    clean_(q.MaKhachHang),
    clean_(q.TenKhachHang),
    clean_(customer.NguoiDaiDien),
    clean_(customer.ChucVu),
    total,
    'ĐÃ TẠO',
    Session.getActiveUser().getEmail() ||
      'Người dùng',
    copy.getUrl(),
    pdf.getUrl(),
    ''
  ]);

  return {
    success: true,
    no: contractNo,
    doc: copy.getUrl(),
    pdf: pdf.getUrl(),
    folder: folder.getUrl()
  };
}


function formatContractTableCell_(
  cell,
  options
) {
  options = options || {};

  const alignment =
    options.alignment ||
    DocumentApp.HorizontalAlignment.LEFT;

  const fontSize =
    Number(options.fontSize || 9);

  const bold =
    Boolean(options.bold);

  const background =
    clean_(options.background);

  cell
    .setPaddingTop(
      Number(options.paddingTop || 3)
    )
    .setPaddingBottom(
      Number(options.paddingBottom || 3)
    )
    .setPaddingLeft(
      Number(options.paddingLeft || 3)
    )
    .setPaddingRight(
      Number(options.paddingRight || 3)
    )
    .setVerticalAlignment(
      DocumentApp.VerticalAlignment.CENTER
    );

  if (background) {
    cell.setBackgroundColor(background);
  }

  /*
   * Mỗi ô chỉ giữ một đoạn văn sạch.
   * Xóa thụt lề kế thừa từ mẫu để không bị
   * mất chữ đầu như “STT”, “TÊN”, “ĐƠN GIÁ”.
   */
  while (cell.getNumChildren() > 1) {
    cell.removeChild(
      cell.getChild(
        cell.getNumChildren() - 1
      )
    );
  }

  let paragraph;

  if (cell.getNumChildren() === 0) {
    paragraph = cell.appendParagraph('');
  } else {
    paragraph = cell
      .getChild(0)
      .asParagraph();
  }

  paragraph
    .setIndentStart(0)
    .setIndentEnd(0)
    .setIndentFirstLine(0)
    .setSpacingBefore(0)
    .setSpacingAfter(0)
    .setLineSpacing(1)
    .setAlignment(alignment);

  paragraph.editAsText()
    .setFontFamily('Arial')
    .setFontSize(fontSize)
    .setBold(bold);

  return cell;
}

function setContractTableCellText_(
  cell,
  text,
  options
) {
  cell.setText(
    String(
      text == null
        ? ''
        : text
    )
  );

  return formatContractTableCell_(
    cell,
    options
  );
}

function formatContractQuantity_(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return '0';
  }

  if (Math.round(number) === number) {
    return String(number);
  }

  return String(number)
    .replace('.', ',');
}

function fillGoodsTable_(
  body,
  items,
  quote,
  quoteTaxMode
) {
  const tables = body.getTables();

  const productMap = {};
  const productCodes = {};

  (items || []).forEach(item => {
    const code = clean_(item.code);
    if (code) productCodes[code] = true;
  });

  Object.keys(productCodes).forEach(code => {
    const product = findObjectByValue_(
      APP.SHEETS.PRODUCTS,
      'MaSanPham',
      code
    );

    if (product) productMap[code] = product;
  });

  const normalizedMode =
    pricingEngine_().normalizeMode(
      quoteTaxMode
    );

  for (
    let tableIndex = 0;
    tableIndex < tables.length;
    tableIndex++
  ) {
    const table =
      tables[tableIndex];

    let markerRow = -1;

    for (
      let rowIndex = 0;
      rowIndex < table.getNumRows();
      rowIndex++
    ) {
      if (
        table.getRow(rowIndex)
          .getText()
          .indexOf('{{STT}}') >= 0
      ) {
        markerRow = rowIndex;
        break;
      }
    }

    if (markerRow < 0) {
      continue;
    }

    /*
     * Xóa toàn bộ hàng dữ liệu và hàng tổng cũ.
     * Chỉ giữ hàng tiêu đề để tránh kế thừa:
     * - ô gộp cũ;
     * - độ rộng sai;
     * - thụt lề âm;
     * - hàng TẠM TÍNH bị vỡ.
     */
    while (table.getNumRows() > 1) {
      table.removeRow(1);
    }

    table
      .setBorderColor('#667085')
      .setBorderWidth(0.6);

    /*
     * Tổng độ rộng 475 pt, vừa vùng nội dung A4.
     */
    const widths = [
      30,   // STT
      195,  // Mã + tên + bảo hành/mô tả
      42,   // ĐVT
      34,   // SL
      84,   // Đơn giá
      90    // Thành tiền
    ];

    widths.forEach(
      (width, columnIndex) => {
        table.setColumnWidth(
          columnIndex,
          width
        );
      }
    );

    const header =
      table.getRow(0);

    const headerValues = [
      'STT',
      'MÃ / TÊN HÀNG HÓA, DỊCH VỤ',
      'ĐVT',
      'SL',
      contractPriceHeader_(
        normalizedMode
      ),
      contractAmountHeader_(
        normalizedMode
      )
    ];

    headerValues.forEach(
      (value, cellIndex) => {
        const cell =
          header.getCell(cellIndex);

        setContractTableCellText_(
          cell,
          value,
          {
            alignment:
              DocumentApp
                .HorizontalAlignment
                .CENTER,
            fontSize: 8.5,
            bold: true,
            background: '#D9E2F3',
            paddingTop: 5,
            paddingBottom: 5,
            paddingLeft: 2,
            paddingRight: 2
          }
        );
      }
    );

    let displayedSubtotal = 0;

    items.forEach(
      (item, index) => {
        const pricing =
          pricingEngine_().calculateItem(
            item,
            normalizedMode
          );

        const product =
          productMap[
            clean_(item.code)
          ] || {};

        const lineAmount =
          pricing.priceIncludesVat
            ? pricing.payable
            : pricing.net;

        displayedSubtotal +=
          lineAmount;

        const row =
          table.appendTableRow();

        const values = [
          String(index + 1),
          contractItemText_(
            item,
            product
          ),
          clean_(item.unit),
          formatContractQuantity_(
            item.qty
          ),
          formatMoney_(item.price),
          formatMoney_(lineAmount)
        ];

        values.forEach(
          (value, cellIndex) => {
            const cell =
              row.appendTableCell(
                value
              );

            let alignment =
              DocumentApp
                .HorizontalAlignment
                .CENTER;

            if (cellIndex === 1) {
              alignment =
                DocumentApp
                  .HorizontalAlignment
                  .LEFT;
            }

            if (
              cellIndex === 4 ||
              cellIndex === 5
            ) {
              alignment =
                DocumentApp
                  .HorizontalAlignment
                  .RIGHT;
            }

            setContractTableCellText_(
              cell,
              value,
              {
                alignment: alignment,
                fontSize:
                  cellIndex === 1
                    ? 8.7
                    : 9,
                bold: false,
                paddingTop: 4,
                paddingBottom: 4,
                paddingLeft: 3,
                paddingRight: 3
              }
            );
          }
        );
      }
    );

    /*
     * Dựng hàng tạm tính mới hoàn toàn.
     * Không dùng hàng tổng cũ của mẫu vì hàng đó
     * có cấu trúc ô gộp gây mất chữ và vỡ khung.
     */
    const subtotalRow =
      table.appendTableRow();

    const subtotalValues = [
      '',
      '',
      '',
      '',
      'TỔNG TIỀN',
      formatMoney_(
        displayedSubtotal
      )
    ];

    subtotalValues.forEach(
      (value, cellIndex) => {
        const cell =
          subtotalRow.appendTableCell(
            value
          );

        const isSummary =
          cellIndex === 4 ||
          cellIndex === 5;

        setContractTableCellText_(
          cell,
          value,
          {
            alignment:
              cellIndex === 5
                ? DocumentApp
                    .HorizontalAlignment
                    .RIGHT
                : DocumentApp
                    .HorizontalAlignment
                    .CENTER,
            fontSize: 9,
            bold: isSummary,
            background:
              isSummary
                ? '#EEF3F8'
                : '',
            paddingTop: 4,
            paddingBottom: 4,
            paddingLeft: 3,
            paddingRight: 3
          }
        );
      }
    );

    /*
     * Quan trọng: áp đường viền sau khi đã tạo đủ
     * hàng tiêu đề, hàng sản phẩm và hàng tạm tính.
     * Nếu đặt trước khi appendRow(), các ô mới có thể
     * không nhận đường viền trong Google Docs.
     */
    table
      .setBorderColor('#667085')
      .setBorderWidth(0.75);

    /*
     * Chuẩn hóa toàn bộ ô một lần cuối để bảng có
     * khung liên tục, padding đồng đều và không có
     * đoạn văn thụt lề kế thừa từ mẫu.
     */
    for (
      let rowIndex = 0;
      rowIndex < table.getNumRows();
      rowIndex++
    ) {
      const row = table.getRow(rowIndex);

      for (
        let cellIndex = 0;
        cellIndex < row.getNumCells();
        cellIndex++
      ) {
        const cell = row.getCell(cellIndex);

        cell
          .setPaddingTop(
            rowIndex === 0 ? 5 : 4
          )
          .setPaddingBottom(
            rowIndex === 0 ? 5 : 4
          )
          .setPaddingLeft(3)
          .setPaddingRight(3)
          .setVerticalAlignment(
            DocumentApp
              .VerticalAlignment
              .CENTER
          );

        if (cell.getNumChildren() > 0) {
          const paragraph = cell
            .getChild(0)
            .asParagraph();

          paragraph
            .setIndentStart(0)
            .setIndentEnd(0)
            .setIndentFirstLine(0)
            .setSpacingBefore(0)
            .setSpacingAfter(0);
        }
      }
    }

    return;
  }

  throw new Error(
    'Mẫu hợp đồng thiếu dòng {{STT}} trong bảng hàng hóa.'
  );
}


/**
 * Tìm số dòng theo giá trị khóa mà không cần đọc toàn bộ sheet.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sh
 * @param {number} columnIndex - cột 1-based
 * @param {*} value
 * @return {number} số dòng 1-based, hoặc 0 nếu không tìm thấy
 */
function findDataRowByValue_(sh, columnIndex, value) {
  const target = clean_(value);

  if (!target) return 0;

  const lastRow = sh.getLastRow();

  if (lastRow < 2) return 0;

  const range = sh.getRange(
    2,
    columnIndex,
    lastRow - 1,
    1
  );

  const match = range
    .createTextFinder(target)
    .matchEntireCell(true)
    .findNext();

  return match ? match.getRow() : 0;
}


function setQuotePdf_(no, url) {
  const sh = sheet_(APP.SHEETS.QUOTES);

  const lastCol = sh.getLastColumn();

  if (lastCol < 1) {
    throw new Error(
      'Sheet BAO_GIA chưa có cấu trúc dữ liệu.'
    );
  }

  const headers = sh
    .getRange(1, 1, 1, lastCol)
    .getValues()[0]
    .map(clean_);

  const noCol = headers.indexOf('SoBaoGia');
  const pdfCol = headers.indexOf('LinkPDF');

  if (noCol < 0) {
    throw new Error(
      'Sheet BAO_GIA thiếu cột SoBaoGia.'
    );
  }

  if (pdfCol < 0) {
    throw new Error(
      'Sheet BAO_GIA thiếu cột LinkPDF.'
    );
  }

  const row = findDataRowByValue_(
    sh,
    noCol + 1,
    no
  );

  if (!row) {
    throw new Error(
      'Không tìm thấy báo giá ' + clean_(no)
    );
  }

  sh
    .getRange(row, pdfCol + 1)
    .setValue(clean_(url));
}

function formatDateOnly_(value) {
  if (!value) return '';

  if (
    value instanceof Date &&
    !isNaN(value)
  ) {
    return Utilities.formatDate(
      value,
      APP.TZ,
      'dd/MM/yyyy'
    );
  }

  const parsed = new Date(value);

  if (!isNaN(parsed)) {
    return Utilities.formatDate(
      parsed,
      APP.TZ,
      'dd/MM/yyyy'
    );
  }

  return clean_(value);
}

function formatDate_(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v,APP.TZ,'dd/MM/yyyy HH:mm');
  return clean_(v);
}
function formatMoney_(value) {
  const number = Math.round(Number(value || 0));

  if (!Number.isFinite(number)) {
    return '0';
  }

  return String(number).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    '.'
  );
}

function escapeRegex_(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}

function numberToVietnamese_(value) {
  let number = Math.round(
    Number(value || 0)
  );

  if (!Number.isFinite(number)) {
    return 'Không đồng';
  }

  if (number === 0) {
    return 'Không đồng';
  }

  const negative = number < 0;
  number = Math.abs(number);

  const digits = [
    'không',
    'một',
    'hai',
    'ba',
    'bốn',
    'năm',
    'sáu',
    'bảy',
    'tám',
    'chín'
  ];

  const scales = [
    '',
    'nghìn',
    'triệu',
    'tỷ',
    'nghìn tỷ',
    'triệu tỷ',
    'tỷ tỷ'
  ];

  function readThreeDigits_(
    group,
    readFullHundreds
  ) {
    const hundred = Math.floor(
      group / 100
    );

    const ten = Math.floor(
      (group % 100) / 10
    );

    const unit = group % 10;
    const words = [];

    if (
      hundred > 0 ||
      readFullHundreds
    ) {
      words.push(
        digits[hundred] +
        ' trăm'
      );
    }

    if (ten > 1) {
      words.push(
        digits[ten] +
        ' mươi'
      );

      if (unit === 1) {
        words.push('mốt');
      } else if (unit === 4) {
        words.push('tư');
      } else if (unit === 5) {
        words.push('lăm');
      } else if (unit > 0) {
        words.push(digits[unit]);
      }
    } else if (ten === 1) {
      words.push('mười');

      if (unit === 5) {
        words.push('lăm');
      } else if (unit > 0) {
        words.push(digits[unit]);
      }
    } else if (unit > 0) {
      if (
        hundred > 0 ||
        readFullHundreds
      ) {
        words.push('lẻ');
      }

      words.push(digits[unit]);
    }

    return words.join(' ');
  }

  const groups = [];

  while (number > 0) {
    groups.push(number % 1000);
    number = Math.floor(
      number / 1000
    );
  }

  let highestGroup =
    groups.length - 1;

  while (
    highestGroup > 0 &&
    groups[highestGroup] === 0
  ) {
    highestGroup--;
  }

  const words = [];

  for (
    let index = highestGroup;
    index >= 0;
    index--
  ) {
    const group = groups[index];

    if (group === 0) {
      continue;
    }

    /*
     * Chỉ đọc “không trăm” ở nhóm thấp hơn
     * khi phía trước đã có hàng lớn hơn.
     * Nhóm cao nhất 006 phải đọc “sáu”,
     * không đọc “không trăm sáu”.
     */
    const readFullHundreds =
      index < highestGroup &&
      group < 100;

    const groupWords =
      readThreeDigits_(
        group,
        readFullHundreds
      );

    words.push(groupWords);

    if (scales[index]) {
      words.push(scales[index]);
    }
  }

  let result = words
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (negative) {
    result = 'âm ' + result;
  }

  return (
    result.charAt(0).toUpperCase() +
    result.slice(1) +
    ' đồng'
  );
}

