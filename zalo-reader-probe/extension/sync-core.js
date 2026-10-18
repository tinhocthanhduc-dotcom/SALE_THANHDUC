(() => {
 'use strict';
 const origins=['https://script.google.com/*','https://script.googleusercontent.com/*'];
 function endpoint(s){if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(String(s||'')))throw Error('Dán URL web app /exec của Apps Script, không dùng link Google Sheet.');return s;}
 async function envelope(config,payload){const request={version:1,client_id:'ZALO_DESKTOP',timestamp:Date.now(),nonce:crypto.randomUUID(),payload};const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(config.secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(JSON.stringify(request)));return {...request,signature:[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('')};}
 function pending(snapshots,receipts){return snapshots.filter(x=>!receipts?.[x.digest]).slice(0,3);}
 globalThis.ZaloSyncCore={origins,endpoint,envelope,pending};
})();
