'use strict';
const {fail}=require('./core.cjs');
const GRACE_MS=30*60*1000;
function rotate(clients,{random,now=()=>Date.now()}){
 const at=now(),client=clients.DIEUPHOI;
 if(!client?.secret||client.active===false)fail('CLIENT_CONFIG_REQUIRED');
 if(client.previous_secret&&client.previous_expires_at>at)fail('ROTATION_IN_PROGRESS');
 const secret=random();
 if(!/^[a-f0-9]{64,128}$/.test(secret)||secret===client.secret)fail('INVALID_SECRET');
 return {clients:{...clients,DIEUPHOI:{...client,secret,previous_secret:client.secret,previous_expires_at:at+GRACE_MS,rotated_at:at}},secret,previous_expires_at:at+GRACE_MS};
}
function revoke(clients){const client=clients.DIEUPHOI;if(!client)fail('CLIENT_CONFIG_REQUIRED');const next={...client};delete next.previous_secret;delete next.previous_expires_at;return {...clients,DIEUPHOI:next};}
module.exports={rotate,revoke,GRACE_MS};
