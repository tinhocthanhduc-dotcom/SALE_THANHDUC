from pathlib import Path

INDEX = Path("Index.html")
CODE = Path("code.js")

def replace_once(text, old, new, marker):
    if marker in text:
        return text
    if old not in text:
        raise SystemExit(f"Missing expected block for {marker}")
    return text.replace(old, new, 1)

idx = INDEX.read_text(encoding="utf-8")
code = CODE.read_text(encoding="utf-8")

idx = replace_once(
    idx,
    '''  <div class="field"><label>Hiệu lực báo giá <span class="required">*</span></label><input id="quoteValid" type="date"></div>
  <div class="field">
  <label>Thuế VAT</label>''',
    '''  <div class="field"><label>Ngày báo giá <span class="required">*</span></label><input id="quoteDate" type="date"></div>
  <div class="field"><label>Hiệu lực báo giá <span class="required">*</span></label><input id="quoteValid" type="date"></div>
  <div class="field">
  <label>Thuế VAT</label>''',
    'id="quoteDate"'
)

idx = replace_once(
    idx,
    '''    no:editingQuoteNo,
    customer:selectedCustomer(),''',
    '''    no:editingQuoteNo,
    date:
      document.getElementById('quoteDate').value,
    customer:selectedCustomer(),''',
    "document.getElementById('quoteDate').value"
)

idx = replace_once(
    idx,
    '''  if(!quoteItems.length){toast('Báo giá chưa có sản phẩm.');return false;}
  const customer=selectedCustomer();''',
    '''  if(!quoteItems.length){toast('Báo giá chưa có sản phẩm.');return false;}
  if(!document.getElementById('quoteDate').value){toast('Chưa chọn ngày báo giá.');return false;}
  const customer=selectedCustomer();''',
    "toast('Chưa chọn ngày báo giá.')"
)

idx = replace_once(
    idx,
    '''  document.getElementById('quoteDiscount').value=0;
  document.getElementById('quoteTaxMode').value='INCLUDED_8';''',
    '''  document.getElementById('quoteDiscount').value=0;
  setDefaultQuoteDate(true);
  document.getElementById('quoteTaxMode').value='INCLUDED_8';''',
    'setDefaultQuoteDate(true);'
)

idx = replace_once(
    idx,
    '''function setDefaultValidDate(force=false){
  const input=document.getElementById('quoteValid');''',
    '''function setDefaultQuoteDate(force=false){
  const input=document.getElementById('quoteDate');

  if(input.value && !force) return;

  input.value=new Date().toISOString().slice(0,10);
}

function setDefaultValidDate(force=false){
  const input=document.getElementById('quoteValid');''',
    'function setDefaultQuoteDate(force=false)'
)

idx = replace_once(
    idx,
    '''    document.getElementById('quotePhone').value=quote.phone||'';
    document.getElementById('quoteValid').value=quote.validUntil||'';''',
    '''    document.getElementById('quotePhone').value=quote.phone||'';
    document.getElementById('quoteDate').value=duplicate
      ?new Date().toISOString().slice(0,10)
      :(quote.dateIso||'');
    document.getElementById('quoteValid').value=quote.validUntil||'';''',
    "document.getElementById('quoteDate').value=duplicate"
)

code = replace_once(
    code,
    '''  const no = q.no || nextNo_('BG');
  const now = new Date();
  const taxMode = pricingEngine_().normalizeMode(q.taxMode);''',
    '''  const no = q.no || nextNo_('BG');
  const now = new Date();
  const quoteDate = q.date
    ? new Date(q.date + 'T00:00:00')
    : now;
  const taxMode = pricingEngine_().normalizeMode(q.taxMode);''',
    "const quoteDate = q.date"
)

code = replace_once(
    code,
    '''      no,
      now,
      clean_(customer.id),''',
    '''      no,
      quoteDate,
      clean_(customer.id),''',
    "      quoteDate,\n      clean_(customer.id)"
)

code = replace_once(
    code,
    '''      date: formatDate_(now),
      dateIso: formatDateInput_(now),''',
    '''      date: formatDate_(quoteDate),
      dateIso: formatDateInput_(quoteDate),''',
    "date: formatDate_(quoteDate)"
)

code = replace_once(
    code,
    '''    const valuesByHeader = {
      MaKhachHang: clean_(customer.id),''',
    '''    const newQuoteDate = q.date
      ? new Date(q.date + 'T00:00:00')
      : quoteDate;

    const valuesByHeader = {
      NgayBaoGia: newQuoteDate,
      MaKhachHang: clean_(customer.id),''',
    "NgayBaoGia: newQuoteDate"
)

code = replace_once(
    code,
    '''        date: formatDate_(quoteDate),
        dateIso: formatDateInput_(quoteDate),''',
    '''        date: formatDate_(newQuoteDate),
        dateIso: formatDateInput_(newQuoteDate),''',
    "date: formatDate_(newQuoteDate)"
)

INDEX.write_text(idx, encoding="utf-8")
CODE.write_text(code, encoding="utf-8")
print("Applied quote date field patch")
