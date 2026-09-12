from pathlib import Path
import re

path = Path('code.js')
text = path.read_text(encoding='utf-8')

anchor = """function findDataRowsByValue_(sh, columnIndex, value) {
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
"""
helpers = anchor + r'''

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
'''

if 'function findObjectByValue_(' not in text:
    if anchor not in text:
        raise SystemExit('findDataRowsByValue_ anchor not found')
    text = text.replace(anchor, helpers, 1)

# Replace exact customer lookups that scanned the whole customer sheet.
pattern = re.compile(
    r"rows_\(\s*APP\.SHEETS\.CUSTOMERS\s*\)\s*\.find\(\s*(item|x)\s*=>\s*clean_\(\1\.MaKhachHang\)\s*===\s*clean_\(([^\)]+)\)\s*\)",
    re.MULTILINE,
)

def repl(match):
    expression = match.group(2).strip()
    return (
        "findObjectByValue_(\n"
        "      APP.SHEETS.CUSTOMERS,\n"
        "      'MaKhachHang',\n"
        f"      {expression}\n"
        "    )"
    )

text, replaced = pattern.subn(repl, text)
print(f'Replaced {replaced} whole-sheet customer lookups.')

# Optimize recent contracts: read only the tail needed by the history screen.
start = text.find('function getRecentContracts(limit) {')
if start >= 0:
    end = text.find('\n}', start)
    # Function is compact; find the next closing brace after return block.
    next_fn = text.find('\nfunction ', start + 1)
    if next_fn > start:
        block = text[start:next_fn]
        if 'recentRows_(APP.SHEETS.CONTRACTS' not in block:
            replacement = r'''function getRecentContracts(limit) {
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

'''
            text = text[:start] + replacement + text[next_fn+1:]

path.write_text(text, encoding='utf-8')
print('Optimized exact customer lookups and recent contracts.')
