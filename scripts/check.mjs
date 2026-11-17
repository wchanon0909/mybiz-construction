import {existsSync, readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const files=['public/index.html','public/js/app.js','public/app.css','public/js/xlsx.js','public/js/pdf.js','functions/api/[[path]].js','functions/_lib/core.js','migrations/0001_init.sql'];
for(const path of files){if(!existsSync(path))throw new Error(`Missing ${path}`)}
for(const path of files.filter(x=>x.endsWith('.js'))){execFileSync(process.execPath,['--check',path],{stdio:'inherit'});}
const html=readFileSync('public/index.html','utf8');
if(html.includes('data.js'))throw new Error('Demo seed script must be removed');
console.log('MyBiz checks OK (no demo seed, required application files present)');
