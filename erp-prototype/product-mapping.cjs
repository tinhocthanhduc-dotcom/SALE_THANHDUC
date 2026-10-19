'use strict';
// Explicit approved external keys only. Never resolve by name or model similarity.
function resolveProduct({source,entity,source_key},mappings,products){
  if(!source||!entity||!source_key)return {status:'UNMAPPED',product_id:null};
  const candidates=mappings.filter(m=>m.source===source&&m.entity===entity&&m.source_key===source_key);
  if(!candidates.length)return {status:'UNMAPPED',product_id:null};
  if(candidates.length!==1)return {status:'CONFLICT',product_id:null};
  const m=candidates[0],p=products[m.product_id];
  if(!m.approved||!p||!p.active||!p.approved)return {status:'UNAPPROVED',product_id:null};
  return {status:'APPROVED',product_id:m.product_id};
}
module.exports={resolveProduct};
