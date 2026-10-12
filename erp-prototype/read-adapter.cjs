'use strict';
// Deliberately .cjs: local prototype, not part of the legacy Apps Script runtime.
function fail(code) { const e = new Error(code); e.code = code; throw e; }
function text(v) { return String(v == null ? '' : v).trim(); }
const TABLES = Object.freeze({
  kho58: {source:'KHO58', tab:'TONKHO', headerRow:4, width:11, fields:{source_key:'Mã hàng',name:'Tên hàng hóa',unit:'ĐVT',qty:'Tồn hiện tại',reference_cost:'GIÁ NHẬP THAM KHẢO'}},
  kho145: {source:'KHO145',tab:'TONKHO',headerRow:4,width:11,fields:{name:'Tên hàng hóa',unit:'ĐVT',qty:'Tồn cuối',master_code:'MÃ CHUẨN 58',reference_cost:'GIÁ NHẬP THAM KHẢO'}},
  sale_products: {source:'SALE',tab:'SAN_PHAM',headerRow:1,width:12,fields:{source_key:'MaSanPham',name:'TenSanPham',unit:'DonViTinh',price:'GiaBan',cost:'GiaVon',vat:'VAT',active:'DangKinhDoanh',price_includes_vat:'GiaDaGomVAT',used:'DaQuaSuDung'}},
  sale_customers: {source:'SALE',tab:'KHACH_HANG',headerRow:1,width:12,fields:{source_key:'MaKhachHang',name:'TenKhachHang',phone:'DienThoai',tax_code:'MaSoThue',active:'DangHoatDong'}},
  care_tickets: {source:'CARE',tab:'Sửa chữa',headerRow:1,width:34,fields:{source_key:'Mã phiếu',status:'Trạng thái',model:'Model',serial:'Serial',assignee_name:'Kỹ thuật phụ trách',due_date:'Ngày hẹn',updated_at:'Cập nhật lúc'}},
  care_customers: {source:'CARE',tab:'Khách hàng',headerRow:1,width:8,fields:{source_key:'Mã khách hàng',name:'Tên khách hàng',phone:'Số điện thoại'}},
  care_employees: {source:'CARE',tab:'Nhân viên',headerRow:1,width:12,fields:{source_key:'Mã nhân viên',name:'Họ tên',role:'Vai trò',status:'Trạng thái'}},
  finance_employees: {source:'FINANCE',tab:'NHAN_VIEN',headerRow:1,width:19,fields:{source_key:'ID_NV',name:'HO_TEN',role:'VAI_TRO',status:'TRANG_THAI'}},
  finance_customers: {source:'FINANCE',tab:'KHACH_HANG',headerRow:1,width:25,fields:{source_key:'ID_KH',code:'MA_KH',name:'TEN_KH',phone:'DIEN_THOAI',tax_code:'MA_SO_THUE',status:'TRANG_THAI'}},
  finance_transactions: {source:'FINANCE',tab:'GIAO_DICH',headerRow:1,width:20,fields:{source_key:'ID_GIAO_DICH',document_no:'MA_PHIEU',amount:'SO_TIEN',invoice_id:'HOA_DON_ID',status:'TRANG_THAI',updated_at:'CAP_NHAT_LUC'}}
});
// Caller supplies a server-only registry from Script Properties and openById capability.
// This module has no setters, cache, setup/migration hooks or legacy application calls.
function createReader({registry,openById,now=()=>new Date().toISOString()}) {
  const ids = Object.freeze({...registry});
  return function read(tableKey,{offset=0,limit=50}={}) {
    const def=TABLES[tableKey];
    if(!def) fail('UNKNOWN_TABLE');
    if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>100) fail('INVALID_PAGE');
    const base={schema_version:1,source:def.source,table:tableKey,as_of:now(),data:[],issues:[]};
    try {
      if(!ids[def.source]) fail('SOURCE_NOT_CONFIGURED');
      const sheet=openById(ids[def.source]).getSheetByName(def.tab);
      if(!sheet) fail('SCHEMA_MISMATCH');
      const headers=sheet.getRange(def.headerRow,1,1,def.width).getDisplayValues()[0].map(text);
      const required=Object.values(def.fields);
      for(const h of required) if(headers.filter(v=>v===h).length!==1) fail('SCHEMA_MISMATCH');
      // Selected individual columns: never fetch a rectangle spanning password/salt columns.
      const last=sheet.getLastRow();
      const start=def.headerRow+1+offset;
      const count=Math.max(0,Math.min(limit,last-start+1));
      if(count) {
        const columns=Object.entries(def.fields).map(([field,header])=>({field,values:sheet.getRange(start,headers.indexOf(header)+1,count,1).getValues().map(r=>r[0])}));
        for(let i=0;i<count;i++) {
          const record={}; columns.forEach(c=>record[c.field]=c.values[i]);
          if(Object.values(record).every(v=>v===''||v==null)) continue;
          for(const f of ['source_key','master_code','phone','tax_code','code']) if(f in record) record[f]=text(record[f]);
          if('qty' in record) { const raw=record.qty; if(raw===''||raw==null||typeof raw==='boolean'||!Number.isFinite(Number(raw))) fail('INVALID_QUANTITY');record.qty=Number(raw); }
          if(def.source==='KHO145'&&!record.master_code) base.issues.push({code:'UNMAPPED_PRODUCT',page_row:i});
          base.data.push(record);
        }
      }
      return {...base,source_health:'AVAILABLE',next_offset:start+count<=last?offset+count:null};
    } catch(e) {
      // Do not leak source exceptions, IDs or business values to the browser.
      return {...base,data:[],source_health:'UNAVAILABLE',next_offset:null,issues:[{code:['SCHEMA_MISMATCH','SOURCE_NOT_CONFIGURED','INVALID_QUANTITY'].includes(e.code)?e.code:'SOURCE_READ_FAILED'}]};
    }
  };
}
module.exports={TABLES,createReader};
