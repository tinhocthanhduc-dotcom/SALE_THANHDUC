from pathlib import Path

path = Path('code.js')
text = path.read_text(encoding='utf-8')

marker = "function cfg_() {"
helper = r'''function sheetHeaderMap_(sh) {
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

'''

if 'function sheetHeaderMap_(sh)' not in text:
    if marker not in text:
        raise SystemExit('Could not find cfg_() marker')
    text = text.replace(marker, helper + marker, 1)

start = text.find('function updateProductGroup(group) {')
end = text.find('\nfunction deleteProductGroup(groupId) {', start)
if start < 0 or end < 0:
    raise SystemExit('Could not locate updateProductGroup() block')

new_update_group = r'''function updateProductGroup(group) {
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

  sh.getRange(row, nameCol).setValue(newName);

  if (orderCol) {
    sh.getRange(row, orderCol)
      .setValue(Number(group.order || 0));
  }

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
'''

text = text[:start] + new_update_group + text[end:]

start = text.find('function deleteProductGroup(groupId) {')
next_marker = text.find('\n\n\n\nfunction booleanValue_', start)
if start < 0 or next_marker < 0:
    raise SystemExit('Could not locate deleteProductGroup() block')

new_delete_group = r'''function deleteProductGroup(groupId) {
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
'''

text = text[:start] + new_delete_group + text[next_marker:]

path.write_text(text, encoding='utf-8')
print('Optimized product-group sheet IO: targeted lookups and batch column writes.')
