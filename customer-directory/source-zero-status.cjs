"use strict";
const fs=require("node:fs");let raw;
try{raw=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));}catch(_){}
const fields=["source_rows","leading_zero_rows","repaired_customers","revision","ktd_allocated"];
function find(value,depth=0){
 if(!value||typeof value!=="object"||depth>6)return null;
 if(fields.every(k=>Number.isSafeInteger(value[k])&&value[k]>=0)&&value.ktd_allocated===0)return Object.fromEntries(fields.map(k=>[k,value[k]]));
 for(const k of ["result","response","data"]){const found=find(value[k],depth+1);if(found)return found;}
 return null;
}
const counts=find(raw),report={confirmed:!!counts,...counts?{counts}:{reason:"Google rescan result unconfirmed. Owner can click Quét bốn bản sao or run normalizeCustomerDirectorySourceNumbers; rerun preserves allocated KTD."}};
fs.writeFileSync(process.argv[3],JSON.stringify(report,null,2));
console.log(JSON.stringify({source_zero_rescan_confirmed:!!counts}));
