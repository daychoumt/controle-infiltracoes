import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
for(const folder of ['assets','worker','tests','scripts'])for(const file of readdirSync(new URL(folder+'/',root)))if(/\.(mjs|js)$/.test(file))execFileSync(process.execPath,['--check',new URL(folder+'/'+file,root).pathname]);
for(const file of ['index.html','painel.html']) {
  const html=readFileSync(new URL(file,root),'utf8');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  if(new Set(ids).size!==ids.length)throw new Error(`${file}: IDs duplicados`);
  for(const match of html.matchAll(/(?:src|href)="([^"#][^"]*)"/g))if(!/^(https?:|mailto:)/.test(match[1]) && !existsSync(new URL(match[1],root)))throw new Error(`${file}: arquivo ausente ${match[1]}`);
}
console.log('Sintaxe JavaScript, IDs e referências locais verificados.');
