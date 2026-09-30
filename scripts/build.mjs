import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url)),destination=resolve(root,'dist');
const entries=['index.html','editor.html','game.css','styles.css','fonts.css','src','assets','examples'];
await rm(destination,{recursive:true,force:true});
await mkdir(destination,{recursive:true});
for(const name of entries)await cp(resolve(root,name),resolve(destination,name),{recursive:true,filter:path=>!path.endsWith('.DS_Store')});
await writeFile(resolve(destination,'.nojekyll'),'');
console.log('Static site built → dist/');
