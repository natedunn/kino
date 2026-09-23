import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(`${process.env.PROOF_PLAYWRIGHT}/index.mjs`).href);
const output={startedAt:new Date().toISOString(),method:'Same production OAuth client, callback, scope and PKCE; isolated fresh browser context for each state variant. Callback intercepted before gateway; diagnostic variants cannot create app sessions.',cases:[]};
const browser=await chromium.launch({headless:false});
try{
 const origin='https://usekino.com';
 const response=await fetch(origin+'/api/auth/sign-in/social',{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({provider:'github',callbackURL:origin+'/auth?redirect=%2Fdashboard'})});
 assert.equal(response.status,200);const data=await response.json();const original=new URL(data.url);assert.equal(original.hostname,'github.com');const originalState=original.searchParams.get('state');assert.ok(originalState);
 for(const variant of ['original','short-random','same-length-random']){
  const c=await browser.newContext({locale:'en-US'});const page=await c.newPage();
  const u=new URL(original);if(variant==='short-random')u.searchParams.set('state',randomBytes(24).toString('hex'));if(variant==='same-length-random')u.searchParams.set('state',randomBytes(originalState.length).toString('hex').slice(0,originalState.length));
  const record={variant,stateLength:u.searchParams.get('state').length,authorizationUrlLength:u.href.length,responses:[],outcome:'pending'};output.cases.push(record);
  const save=()=>writeFileSync(new URL('../performance/github-session-diagnostic.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
  let resolve;const finished=new Promise(r=>resolve=r);
  await c.route('https://gateway.usekino.com/**',async route=>{record.outcome='github-returned-to-callback';save();await route.fulfill({status:200,contentType:'text/html',body:'<h1>GitHub login succeeded</h1><p>Diagnostic stopped before Kino callback. The next test opens automatically.</p>'});resolve();});
  page.on('response',async r=>{const url=new URL(r.url());if(url.hostname!=='github.com'||!r.request().isNavigationRequest())return;record.responses.push({method:r.request().method(),path:url.pathname,status:r.status(),requestId:r.headers()['x-github-request-id']??null});save();if(r.status()>=500){record.outcome='github-server-error';save();resolve();}});
  await page.goto(u.href);await page.bringToFront();save();console.log('READY:',variant,'— sign into GitHub in this fresh window.');
  let timeout;await Promise.race([finished,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('User sign-in timed out')),15*60*1000);})]).finally(()=>clearTimeout(timeout));
  console.log('RESULT:',variant,record.outcome);await page.waitForTimeout(1200);await c.close();
 }
}finally{writeFileSync(new URL('../performance/github-session-diagnostic.json',import.meta.url),JSON.stringify(output,null,2)+'\n');await browser.close();}
