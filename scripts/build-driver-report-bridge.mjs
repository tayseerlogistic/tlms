import { build } from 'esbuild';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
const out = 'dist-driver-report';
await mkdir(out, { recursive: true });
const result = await build({entryPoints:['scripts/google-driver-report/Code.js'],bundle:true,write:false,format:'iife',
 globalName:'TLMSBridge',target:'es2022',platform:'neutral',minify:false});
const wrappers = ['setupTLMS','syncTLMS','submitTLMS','goToToday','onOpen'].map(name =>
 'function '+name+'(e) { return TLMSBridge.'+name+'(e); }').join('\n');
await writeFile(out+'/Code.gs',result.outputFiles[0].text+'\n'+wrappers+'\n');
await copyFile('scripts/google-driver-report/appsscript.json',out+'/appsscript.json');
await copyFile('scripts/google-driver-report/SETUP.md',out+'/SETUP.md');
await mkdir('public/driver-report-setup',{recursive:true});
await copyFile('scripts/google-driver-report/SETUP.md','public/driver-report-setup/SETUP.md');
await copyFile('scripts/google-driver-report/appsscript.json','public/driver-report-setup/appsscript.json');
console.log('Generated combined driver-report setup in '+out);
