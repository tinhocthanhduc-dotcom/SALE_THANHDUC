from pathlib import Path

path = Path('code.js')
src = path.read_text(encoding='utf-8')

start_marker = 'function listQuotes(filters) {'
end_marker = '\nfunction getQuoteForEdit(no) {'

start = src.find(start_marker)
if start < 0:
    raise SystemExit('listQuotes() not found')

end = src.find(end_marker, start)
if end < 0:
    raise SystemExit('getQuoteForEdit() marker not found')

replacement = r'''function listQuotes(filters) {
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
'''

current = src[start:end]
if 'const chunkSize = 250;' in current:
    print('listQuotes() already optimized; no changes')
else:
    src = src[:start] + replacement + src[end:]
    path.write_text(src, encoding='utf-8')
    print('Optimized listQuotes() with reverse chunk reads')
