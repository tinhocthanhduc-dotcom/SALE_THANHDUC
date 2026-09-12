from pathlib import Path

path = Path('code.js')
text = path.read_text(encoding='utf-8')


def replace_function(source, name, replacement):
    marker = f'function {name}('
    start = source.find(marker)
    if start < 0:
        raise SystemExit(f'Function not found: {name}')

    brace = source.find('{', start)
    if brace < 0:
        raise SystemExit(f'Opening brace not found: {name}')

    depth = 0
    quote = None
    escape = False
    line_comment = False
    block_comment = False
    i = brace

    while i < len(source):
        ch = source[i]
        nxt = source[i + 1] if i + 1 < len(source) else ''

        if line_comment:
            if ch == '\n':
                line_comment = False
            i += 1
            continue

        if block_comment:
            if ch == '*' and nxt == '/':
                block_comment = False
                i += 2
                continue
            i += 1
            continue

        if quote:
            if escape:
                escape = False
            elif ch == '\\':
                escape = True
            elif ch == quote:
                quote = None
            i += 1
            continue

        if ch == '/' and nxt == '/':
            line_comment = True
            i += 2
            continue

        if ch == '/' and nxt == '*':
            block_comment = True
            i += 2
            continue

        if ch in ("'", '"', '`'):
            quote = ch
            i += 1
            continue

        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                return source[:start] + replacement.rstrip() + source[end:]
        i += 1

    raise SystemExit(f'Closing brace not found: {name}')


next_product = r'''function nextProductCode_() {
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
}'''

update_customer = r'''function updateCustomer(c) {
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
}'''

update_product = r'''function updateProduct(p) {
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
}'''

text = replace_function(text, 'nextProductCode_', next_product)
text = replace_function(text, 'updateCustomer', update_customer)
text = replace_function(text, 'updateProduct', update_product)

path.write_text(text, encoding='utf-8')
print('Optimized customer/product lookups and product-code scan.')
