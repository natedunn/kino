import { readFileSync, writeFileSync } from 'node:fs';
const result=JSON.parse(readFileSync(new URL('../performance/results.json',import.meta.url)));
const stats=values=>{const s=values.filter(Number.isFinite).sort((a,b)=>a-b);return {n:s.length,p50Ms:Math.round((s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2)*10)/10,p95Ms:Math.round(s[Math.ceil(s.length*.95)-1]*10)/10};};
const summary={recordedAt:result.recordedAt,initiation:{},public:{},protected:{}};
for(const t of result.targets){summary.initiation[t.name]=stats(result.initiation.filter(r=>r.target===t.name&&r.phase==='measured').map(r=>r.totalMs));summary.public[t.name]={ttfb:stats(result.public.filter(r=>r.target===t.name).map(r=>r.ttfbMs)),fcp:stats(result.public.filter(r=>r.target===t.name).map(r=>r.fcpMs))};}
for(const field of ['ttfbMs','usefulMs','hoverClickMs'])summary.protected[field]=stats(result.protected.map(r=>r[field]));
writeFileSync(new URL('../performance/summary.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
