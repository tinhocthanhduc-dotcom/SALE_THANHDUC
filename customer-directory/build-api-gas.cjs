'use strict';
// PREVIEW ONLY. No deployment. Publish only as a separate, explicitly approved API deployment.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const destination=path.resolve(process.argv[2]||'/tmp/customer-directory-api-preview'),root=path.resolve(__dirname,'..');
if(destination===root||destination.startsWith(root+path.sep))throw Error('OUTPUT_OUTSIDE_CHECKOUT_REQUIRED');
execFileSync(process.execPath,[path.join(__dirname,'build-gas.cjs'),destination],{stdio:'pipe'});
const file=path.join(destination,'Code.gs');fs.writeFileSync(file,'var CD_API_ONLY_ = true;\n'+fs.readFileSync(file,'utf8'));
fs.unlinkSync(path.join(destination,'Index.html'));
const manifest=JSON.parse(fs.readFileSync(path.join(destination,'appsscript.json')));manifest.webapp.access='ANYONE_ANONYMOUS';fs.writeFileSync(path.join(destination,'appsscript.json'),JSON.stringify(manifest,null,2));
console.log('Prepared API-only COPY preview. NOT deployed; requires separate endpoint approval.');
