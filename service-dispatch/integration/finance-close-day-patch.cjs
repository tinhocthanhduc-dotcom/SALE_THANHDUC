'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function patchCode(source){if(source.includes('function financeClosingDayKey_'))return source;const box={};vm.createContext(box);vm.runInContext(source,box);source=source.replace(box.isDateClosed_.toString(),fs.readFileSync(path.join(__dirname,'finance-close-day.gs.txt'),'utf8'));
 source=source.replace("'CHOT_LUC', 'MO_KHOA_BOI', 'MO_KHOA_LUC'","'CHOT_LUC', 'MO_KHOA_BOI', 'MO_KHOA_LUC', 'AP_DUNG_KHOA'");
 source=source.replace("    const debtType = getDebtTypeFromCategory_(data.danhMuc);","    if(isDateClosed_(data.ngayGiaoDich))throw new Error('FINANCE_DATE_CLOSED');\n    validateTransactionMasterData_(data);\n    const debtType = getDebtTypeFromCategory_(data.danhMuc);");
 source=source.replace("    recalculateAccounts_();\n    const dashboard = buildDashboard_(date);", "    if(!PropertiesService.getScriptProperties().getProperty(financeClosingActivationKey_()))throw new Error('FINANCE_CLOSING_ACTIVATION_REQUIRED');\n    recalculateAccounts_();\n    const dashboard = buildDashboard_(date);");
 source=source.replace("      MO_KHOA_LUC: ''\n    });","      MO_KHOA_LUC: '',\n      AP_DUNG_KHOA: true\n    });");
 for(const name of ['updateAccountOpeningBalance','resetOperationalData']){const ctx={};vm.createContext(ctx);vm.runInContext(source,ctx);const original=ctx[name].toString();const changed=original.replace('    const user = getCurrentUser_();','    const user = getCurrentUser_();\n    assertNoLockedFinanceDays_();');if(changed===original)throw Error('GUARD_PATCH_MISSING:'+name);source=source.replace(original,changed);}
 source=source.replace("    closeDay: closeDay,","    closeDay: closeDay,\n    listFinanceClosings: listFinanceClosings,\n    enableFinanceClosingGuard: enableFinanceClosingGuard,\n    unlockFinanceDay: unlockFinanceDay,");
 return source;}
function patchHtml(source){if(source.includes('id="view-closings"'))return source;
 source=source.replace('<button class="nav-button finance-report-only" data-view="operatingExpenses">','<button class="nav-button finance-report-only" data-view="closings"><span class="nav-label">Chốt sổ / mở khóa</span></button>\n<button class="nav-button finance-report-only" data-view="operatingExpenses">');
 source=source.replace('<section class="view" id="view-operatingExpenses">',fs.readFileSync(path.join(__dirname,'finance-close-day-ui.html.txt'),'utf8')+'\n<section class="view" id="view-operatingExpenses">');
 source=source.replace("        case 'operatingExpenses':\n          renderOperatingExpenseReport(false);","        case 'closings':\n          renderFinanceClosings();\n          break;\n        case 'operatingExpenses':\n          renderOperatingExpenseReport(false);");
 source=source.replace("if (viewName === 'operatingExpenses' && (","if (['closings','operatingExpenses'].includes(viewName) && (");
 source=source.replace("accounts: 'Quỹ & Ngân hàng',","accounts: 'Quỹ & Ngân hàng',closings:'Chốt sổ / mở khóa',");
 source=source.replace('    function submitClosing(event) {',fs.readFileSync(path.join(__dirname,'finance-close-day-ui.js.txt'),'utf8')+'\n    function submitClosing(event) {');
 source=source.replace('Sau khi chốt sẽ không thể thêm giao dịch vào ngày này.','Ngày này sẽ bị khóa khi LOCK_AFTER_CLOSE bật; Admin có thể mở khóa với lý do.');return source;}
module.exports={patchCode,patchHtml};
