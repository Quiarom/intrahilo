import {readFileSync} from 'node:fs';import {classify} from '../src/core/index.ts';
const rows=JSON.parse(readFileSync(new URL('../data/classifier-holdout.json',import.meta.url),'utf8')) as {text:string;expected:string[]}[];
const results=rows.map(r=>{const actual=classify(r.text).sort();return {...r,actual,exact:JSON.stringify(actual)===JSON.stringify([...r.expected].sort())};});
console.log(JSON.stringify({method:'alias-textual',dataset:'6 ejemplos sintéticos etiquetados manualmente; no evaluación general del lenguaje',correct:results.filter(r=>r.exact).length,total:results.length,limitations:'Muestra mínima; los alias fueron revisados durante construcción. No es un benchmark ciego independiente.',results},null,2));
