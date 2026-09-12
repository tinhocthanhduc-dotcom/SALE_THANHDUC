from pathlib import Path

path = Path('code.js')
text = path.read_text(encoding='utf-8')

old_rows = """function rows_(name) {
  const values = sheet_(name).getDataRange().getValues();
  if (!values.length) return [];
  const headers = values[0].map(clean_);
  return values.slice(1)
    .filter(r => r.some(v => v !== '' && v != null))
    .map(r => {
      const o = {};
      headers.forEach((h, i) => o[h] = r[i]);
      return o;
    });
}
"""
new_rows = """function rows_(name) {
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
"""
if old_rows in text:
    text = text.replace(old_rows, new_rows, 1)

old_group_reads = """  const currentNames = rows_(
    APP.SHEETS.GROUPS
  )
    .map(x =>
      clean_(x.TenNhom)
        .toLowerCase()
    )
    .filter(Boolean);

  const productGroups = rows_(
    APP.SHEETS.PRODUCTS
  )
    .map(x => clean_(x.NhomHang))
    .filter(Boolean);
"""
new_group_reads = """  const groupMeta = sheetHeaderMap_(sh);
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
"""
if old_group_reads in text:
    text = text.replace(old_group_reads, new_group_reads, 1)

old_update_group = """  sh.getRange(row, nameCol).setValue(newName);

  if (orderCol) {
    sh.getRange(row, orderCol)
      .setValue(Number(group.order || 0));
  }
"""
new_update_group = """  const groupRow = sh
    .getRange(row, 1, 1, meta.headers.length)
    .getValues()[0];

  groupRow[nameCol - 1] = newName;

  if (orderCol) {
    groupRow[orderCol - 1] = Number(group.order || 0);
  }

  sh.getRange(row, 1, 1, meta.headers.length)
    .setValues([groupRow]);
"""
if old_update_group in text:
    text = text.replace(old_update_group, new_update_group, 1)

path.write_text(text, encoding='utf-8')
print('Cleaned remaining broad sheet reads in common helpers and group bootstrap path.')
