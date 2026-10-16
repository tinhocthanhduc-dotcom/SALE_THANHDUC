'use strict';
const fs=require('node:fs'),path=require('node:path');
const destination=path.resolve(process.argv[2]||'/tmp/thanhduc-dispatch-gas');
const root=path.resolve(__dirname,'..');if(destination===root||destination.startsWith(root+path.sep))throw Error('OUTPUT_MUST_BE_OUTSIDE_CHECKOUT');
fs.mkdirSync(destination,{recursive:true});
const bundle=require('esbuild').buildSync({entryPoints:[path.join(__dirname,'bundle-entry.cjs')],bundle:true,platform:'neutral',format:'iife',globalName:'DispatchBundle',target:'es2020',write:false,minify:false}).outputFiles[0].text;
const directoryEndpoint=require('../customer-directory/api.copy.json');
fs.writeFileSync(path.join(destination,'Code.gs'),'var DispatchDirectoryCopyEndpoint = '+JSON.stringify(directoryEndpoint)+';\n'+bundle+'\n'+fs.readFileSync(path.join(__dirname,'gas-entry.gs.txt'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'customer-directory.gs.txt'),'utf8')+'\nvar DispatchIntegration=DispatchBundle.IntegrationCatalogue;\n'+fs.readFileSync(path.join(__dirname,'integration/transport.gs.txt'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'integration/runtime.gs.txt'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'tables.gs.txt'),'utf8'));
// Normalize frontend syntax before HtmlService serializes it into its document.write wrapper.
const client=require('esbuild').transformSync(fs.readFileSync(path.join(__dirname,'ui.js.txt'),'utf8'),{loader:'js',target:'es2017',charset:'ascii',supported:{'template-literal':false},minifySyntax:false});
const script=client.code.replace(/<\/script/gi,'<\\/script');
// Keep application source out of HtmlService's HTML/script parser. Only a small loader
// is inline; it creates the script node as text after document.write has parsed the shell.
const payload=JSON.stringify(Buffer.from(script,'utf8').toString('base64'));
const loader='<script id="dispatch-client-source" type="application/json">'+payload+'</script><script id="dispatch-client-loader">(function(){var source=document.getElementById("dispatch-client-source");var current=document.currentScript;var client=document.createElement("script");client.id="dispatch-client";if(current&&current.nonce)client.nonce=current.nonce;client.text=atob(JSON.parse(source.textContent));document.head.appendChild(client);}());</script>';
fs.writeFileSync(path.join(destination,'Index.html'),fs.readFileSync(path.join(__dirname,'ui.html.txt'),'utf8').replace('<script src="/app.js"></script>',()=>loader));
fs.writeFileSync(path.join(destination,'appsscript.json'),JSON.stringify({timeZone:'Asia/Ho_Chi_Minh',runtimeVersion:'V8',exceptionLogging:'STACKDRIVER',oauthScopes:['https://www.googleapis.com/auth/script.external_request','https://www.googleapis.com/auth/spreadsheets','https://www.googleapis.com/auth/drive','https://www.googleapis.com/auth/script.storage','https://www.googleapis.com/auth/script.scriptapp','https://www.googleapis.com/auth/userinfo.email'],webapp:{executeAs:'USER_DEPLOYING',access:'ANYONE_ANONYMOUS'}},null,2));
fs.copyFileSync(path.join(__dirname,'README.md'),path.join(destination,'README.md'));
console.log('Built isolated Apps Script package: '+destination);
