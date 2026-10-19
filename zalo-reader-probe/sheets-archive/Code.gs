/* Separate container-bound Apps Script project. Only writes its configured archive file. */
var ZR_HEADERS_=['ID_BAN_DOC','KHO','TEN_NHOM_JSON','CHUP_LUC','NHAN_LUC','NOI_DUNG_1_JSON','NOI_DUNG_2_JSON','NOI_DUNG_3_JSON','NOI_DUNG_4_JSON','SO_KY_TU'];
function setupZaloArchive(){
 var ss=SpreadsheetApp.getActiveSpreadsheet();if(!ss)throw Error('Mở Apps Script từ file Sheets riêng trước.');var p=PropertiesService.getScriptProperties(),old=p.getProperty('ZR_DB_ID');if(old&&old!==ss.getId())throw Error('Project đã gắn file khác; không đổi đích tự động.');
 var sheet=ss.getSheetByName('ZR_BAN_DOC')||ss.insertSheet('ZR_BAN_DOC');if(sheet.getLastRow()){var header=sheet.getRange(1,1,1,ZR_HEADERS_.length).getValues()[0];if(JSON.stringify(header)!==JSON.stringify(ZR_HEADERS_))throw Error('Header ZR_BAN_DOC không khớp, không ghi đè.');}else sheet.getRange(1,1,1,ZR_HEADERS_.length).setValues([ZR_HEADERS_]);sheet.getRange(1,1,sheet.getMaxRows(),ZR_HEADERS_.length).setNumberFormat('@');sheet.setFrozenRows(1);p.setProperty('ZR_DB_ID',ss.getId());SpreadsheetApp.getUi().alert('Đã cài bảng lưu bản đọc. Tiếp theo chạy createZaloArchiveConnection để lấy khóa kết nối.');
}
function createZaloArchiveConnection(){
 var p=PropertiesService.getScriptProperties();if(!p.getProperty('ZR_DB_ID'))throw Error('Chạy setupZaloArchive trước.');var secret=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');p.setProperty('ZR_CLIENT_SECRET',secret);
 var html='<p>Khóa kết nối mới (không phải khóa OpenAI). Sao chép vào tiện ích; không gửi trong chat. Chạy lại hàm này sẽ vô hiệu khóa trước.</p><textarea readonly style="width:100%;height:90px;font-size:16px">'+secret+'</textarea><p>Đóng hộp thoại sẽ không xem lại khóa này. Nếu mất, tạo khóa mới rồi cập nhật tiện ích.</p>';
 SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(520).setHeight(260),'Kết nối tiện ích Zalo');
}
function doGet(){return ContentService.createTextOutput('Thành Đức · Máy chủ lưu bản đọc Zalo. Không có dữ liệu công khai.');}
function doPost(e){var result;try{result=zrHandle_(e&&e.postData&&e.postData.contents);}catch(err){result={ok:false,service:'TD_ZALO_ARCHIVE_V1',error:err.message==='ZR_AUTH'?'Không xác thực được kết nối. Kiểm tra khóa và giờ máy.':err.message};}return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);}
function zrHex_(bytes){return bytes.map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');}
function zrHash_(text){return zrHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text,Utilities.Charset.UTF_8));}
function zrHandle_(raw){
 if(typeof raw!=='string'||raw.length>400000)throw Error('Yêu cầu không hợp lệ hoặc quá lớn.');var request;try{request=JSON.parse(raw);}catch(err){throw Error('Yêu cầu không hợp lệ.');}
 var p=PropertiesService.getScriptProperties(),secret=p.getProperty('ZR_CLIENT_SECRET');if(!secret||request.version!==1||request.client_id!=='ZALO_DESKTOP'||typeof request.timestamp!=='number'||Math.abs(Date.now()-request.timestamp)>300000||typeof request.nonce!=='string'||request.nonce.length>100||typeof request.signature!=='string')throw Error('ZR_AUTH');
 var signed={version:request.version,client_id:request.client_id,timestamp:request.timestamp,nonce:request.nonce,payload:request.payload},expected=zrHex_(Utilities.computeHmacSha256Signature(JSON.stringify(signed),secret,Utilities.Charset.UTF_8)),diff=expected.length^request.signature.length;for(var i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^(request.signature.charCodeAt(i)||0);if(diff)throw Error('ZR_AUTH');
 var db=p.getProperty('ZR_DB_ID');if(!db)throw Error('Máy chủ chưa chạy setup.');if(request.payload&&request.payload.action==='ping')return {ok:true,service:'TD_ZALO_ARCHIVE_V1',workbook_id:db};
 if(!request.payload||request.payload.action!=='ingest')throw Error('Lệnh không hợp lệ.');var s=request.payload.snapshot;
 if(!s||!['58','145'].includes(s.group)||typeof s.name!=='string'||!s.name.trim()||s.name.length>160||typeof s.text!=='string'||!s.text||s.text.length>50000||typeof s.digest!=='string'||!/^[a-f0-9]{64}$/.test(s.digest)||!Number.isFinite(Date.parse(s.captured_at)))throw Error('Bản đọc không hợp lệ.');
 if(zrHash_(s.group+'\n'+s.name+'\n'+s.text)!==s.digest)throw Error('Nội dung không khớp mã bản đọc.');
 var lock=LockService.getScriptLock();if(!lock.tryLock(5000))throw Error('Máy chủ đang bận; tiện ích sẽ gửi lại.');
 try{
  var sheet=SpreadsheetApp.openById(db).getSheetByName('ZR_BAN_DOC');if(!sheet)throw Error('Thiếu bảng lưu. Chạy setupZaloArchive.');var last=sheet.getLastRow();
  if(last>1&&sheet.getRange(2,1,last-1,1).createTextFinder(s.digest).matchEntireCell(true).findNext())return {ok:true,service:'TD_ZALO_ARCHIVE_V1',digest:s.digest,duplicate:true};
  var row=[s.digest,s.group,JSON.stringify(s.name),s.captured_at,new Date().toISOString()];for(var c=0;c<4;c++)row.push(JSON.stringify(s.text.slice(c*14000,(c+1)*14000)));row.push(String(s.text.length));
  if(last+1>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),Math.max(100,last+1-sheet.getMaxRows()));
  var range=sheet.getRange(last+1,1,1,ZR_HEADERS_.length);range.setNumberFormat('@');range.setValues([row]);SpreadsheetApp.flush();return {ok:true,service:'TD_ZALO_ARCHIVE_V1',digest:s.digest,duplicate:false};
 }finally{lock.releaseLock();}
}
function onOpen(){SpreadsheetApp.getUi().createMenu('Bản đọc Zalo').addItem('Cài bảng lưu','setupZaloArchive').addItem('Tạo/đổi khóa kết nối','createZaloArchiveConnection').addItem('Xem bản đọc dòng đang chọn','viewZaloArchiveRow').addToUi();}
function viewZaloArchiveRow(){var ss=SpreadsheetApp.getActiveSpreadsheet(),sheet=ss.getActiveSheet(),row=sheet.getActiveRange().getRow();if(sheet.getName()!=='ZR_BAN_DOC'||row<2)throw Error('Chọn một dòng dữ liệu trong ZR_BAN_DOC.');var values=sheet.getRange(row,1,1,ZR_HEADERS_.length).getValues()[0],text='';for(var i=5;i<9;i++)text+=JSON.parse(values[i]);var escaped=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput('<pre style="white-space:pre-wrap;font:16px sans-serif">'+escaped+'</pre>').setWidth(800).setHeight(600),'Bản đọc Kho '+values[1]);}
