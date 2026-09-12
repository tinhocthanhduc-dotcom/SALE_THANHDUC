from pathlib import Path

path = Path('code.js')
text = path.read_text(encoding='utf-8')

# 1) Add helper to find all matching data rows in a single key column.
anchor = """function columnValues_(sh, columnIndex) {
  const lastRow = sh.getLastRow();

  if (lastRow < 2 || columnIndex < 1) {
    return [];
  }

  return sh
    .getRange(2, columnIndex, lastRow - 1, 1)
    .getValues()
    .map(row => row[0]);
}
"""
helper = anchor + """

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
"""
if 'function findDataRowsByValue_(' not in text:
    if anchor not in text:
        raise SystemExit('columnValues_ anchor not found')
    text = text.replace(anchor, helper, 1)

# 2) updateQuote: locate the quote row with TextFinder and read only that row.
old = """    const quoteSheet = sheet_(APP.SHEETS.QUOTES);
    const quoteValues = quoteSheet.getDataRange().getValues();
    const quoteHeaders = quoteValues[0].map(clean_);
    const quoteNoCol = quoteHeaders.indexOf('SoBaoGia');
    const quoteStatusCol = quoteHeaders.indexOf('TrangThai');
    const quotePdfCol = quoteHeaders.indexOf('LinkPDF');
    const quoteDateCol = quoteHeaders.indexOf('NgayBaoGia');

    let quoteRowIndex = -1;
    let oldStatus = '';
    let oldPdfUrl = '';
    let quoteDate = new Date();

    for (let row = 1; row < quoteValues.length; row++) {
      if (clean_(quoteValues[row][quoteNoCol]) === no) {
        quoteRowIndex = row;
        oldStatus = clean_(
          quoteValues[row][quoteStatusCol]
        ).toUpperCase();

        if (quotePdfCol >= 0) {
          oldPdfUrl = clean_(
            quoteValues[row][quotePdfCol]
          );
        }

        if (
          quoteDateCol >= 0 &&
          quoteValues[row][quoteDateCol] instanceof Date
        ) {
          quoteDate = quoteValues[row][quoteDateCol];
        }

        break;
      }
    }

    if (quoteRowIndex < 0) {
      throw new Error('Không tìm thấy báo giá ' + no);
    }
"""
new = """    const quoteSheet = sheet_(APP.SHEETS.QUOTES);
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
"""
if old in text:
    text = text.replace(old, new, 1)

text = text.replace(
    "const updatedQuoteRow = quoteValues[quoteRowIndex].slice();",
    "const updatedQuoteRow = quoteValues.slice();",
    1
)
text = text.replace(
    "quoteRowIndex + 1,\n        1,",
    "quoteRow,\n        1,",
    1
)
text = text.replace(
    "quoteRowIndex + 1, phoneCol + 1",
    "quoteRow, phoneCol + 1",
    1
)

# 3) updateQuote: avoid reading the whole quote-line sheet just to find rows to delete.
old = """    const lineSheet = sheet_(APP.SHEETS.QUOTE_LINES);
    const lineValues = lineSheet.getDataRange().getValues();
    const lineHeaders = lineValues[0].map(clean_);
    const lineNoCol = lineHeaders.indexOf('SoBaoGia');
    const rowsToDelete = [];

    for (let row = 1; row < lineValues.length; row++) {
      if (clean_(lineValues[row][lineNoCol]) === no) {
        rowsToDelete.push(row + 1);
      }
    }

    /*
     * Chi tiết của một báo giá được ghi liền nhau.
     * Xóa theo block giúp giảm nhiều lần gọi Sheets API.
     */
    if (rowsToDelete.length) {
      const blocks = [];
      let start = rowsToDelete[0];
      let prev = rowsToDelete[0];

      for (let i = 1; i < rowsToDelete.length; i++) {
        const current = rowsToDelete[i];
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
        .forEach(block =>
          lineSheet.deleteRows(block[0], block[1])
        );
    }
"""
new = """    const lineSheet = sheet_(APP.SHEETS.QUOTE_LINES);
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
"""
if old in text:
    text = text.replace(old, new, 1)

# 4) cancelQuote: find one row and write status + note in a single row write.
start = text.find('function cancelQuote(no, reason) {')
end = text.find('\n\nfunction deleteQuotePermanently(no) {', start)
if start >= 0 and end > start and 'const meta = sheetHeaderMap_(sh);' not in text[start:end]:
    replacement = """function cancelQuote(no, reason) {
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
"""
    text = text[:start] + replacement + text[end:]

# 5) deleteQuotePermanently: narrow contract/quote/line lookups and delete line blocks.
old = """    const linkedContract = rows_(APP.SHEETS.CONTRACTS)
      .some(x => clean_(x.MaBaoGia) === no);
"""
new = """    const contractSheet = sheet_(APP.SHEETS.CONTRACTS);
    const contractMeta = sheetHeaderMap_(contractSheet);
    const contractQuoteCol = contractMeta.byName.MaBaoGia;
    const linkedContract = contractQuoteCol
      ? Boolean(findDataRowByValue_(
          contractSheet,
          contractQuoteCol,
          no
        ))
      : false;
"""
if old in text:
    text = text.replace(old, new, 1)

old = """    const quoteSheet = sheet_(APP.SHEETS.QUOTES);
    const quoteValues = quoteSheet.getDataRange().getValues();
    const quoteHeaders = quoteValues[0].map(clean_);
    const quoteNoCol = quoteHeaders.indexOf('SoBaoGia');
    const quotePdfCol = quoteHeaders.indexOf('LinkPDF');

    if (quoteNoCol < 0) {
      throw new Error('Sheet BAO_GIA thiếu cột SoBaoGia.');
    }

    let quoteRow = -1;
    let pdfUrl = '';

    for (let i = 1; i < quoteValues.length; i++) {
      if (clean_(quoteValues[i][quoteNoCol]) === no) {
        quoteRow = i + 1;

        if (quotePdfCol >= 0) {
          pdfUrl = clean_(quoteValues[i][quotePdfCol]);
        }

        break;
      }
    }

    if (quoteRow < 0) {
      throw new Error('Không tìm thấy báo giá ' + no);
    }
"""
new = """    const quoteSheet = sheet_(APP.SHEETS.QUOTES);
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
"""
if old in text:
    text = text.replace(old, new, 1)

old = """    const lineSheet = sheet_(APP.SHEETS.QUOTE_LINES);
    const lineValues = lineSheet.getDataRange().getValues();
    const lineHeaders = lineValues[0].map(clean_);
    const lineNoCol = lineHeaders.indexOf('SoBaoGia');

    if (lineNoCol < 0) {
      throw new Error(
        'Sheet CHI_TIET_BAO_GIA thiếu cột SoBaoGia.'
      );
    }

    const rowsToDelete = [];

    for (let i = 1; i < lineValues.length; i++) {
      if (clean_(lineValues[i][lineNoCol]) === no) {
        rowsToDelete.push(i + 1);
      }
    }

    rowsToDelete
      .sort((a, b) => b - a)
      .forEach(rowNumber => lineSheet.deleteRow(rowNumber));
"""
new = """    const lineSheet = sheet_(APP.SHEETS.QUOTE_LINES);
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
"""
if old in text:
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('Optimized quote update/cancel/delete sheet lookups and batch row deletion.')
