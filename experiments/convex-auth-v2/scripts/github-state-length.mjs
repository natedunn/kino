import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(`${process.env.PROOF_PLAYWRIGHT}/index.mjs`).href);
const resume=process.env.PROOF_LENGTH_RESUME==='1';
const steps=resume?4:5;
const file=new URL(resume?'../performance/github-state-length-resume.json':'../performance/github-state-length.json',import.meta.url);
const output={startedAt:new Date().toISOString(),method:'Adaptive intermediate-length tests, then repeat both bracket endpoints with new random states. Same client, redirect URI, scopes and PKCE. Fresh signed-out contexts. No app callback executed.',priorPassingState:resume?1024:48,priorFailingState:1906,cases:[],complete:false};
const save=()=>writeFileSync(file,JSON.stringify(output,null,2)+'\n');
const browser=await chromium.launch({headless:false});
try{
 const origin='https://usekino.com';
 const response=await fetch(origin+'/api/auth/sign-in/social',{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({provider:'github',callbackURL:origin+'/auth?redirect=%2Fdashboard'}),signal:AbortSignal.timeout(30000)});
 assert.equal(response.status,200);const data=await response.json();const original=new URL(data.url);assert.equal(original.hostname,'github.com');
 const callback=new URL(original.searchParams.get('redirect_uri'));assert.equal(callback.origin,'https://gateway.usekino.com');
 async function test(length,phase){
  const c=await browser.newContext({locale:'en-US'});const page=await c.newPage();
  const state=randomBytes(length).toString('hex').slice(0,length);const u=new URL(original);u.searchParams.set('state',state);
  const record={phase,stateLength:length,stateBytes:Buffer.byteLength(state),authorizationUrlLength:u.href.length,authorizationUrlBytes:Buffer.byteLength(u.href),responses:[],outcome:'pending'};
  output.cases.push(record);save();let finish;
  const done=new Promise(r=>finish=r);
  await c.route('https://gateway.usekino.com/**',async route=>{
   const returned=new URL(route.request().url());
   const valid=returned.pathname===callback.pathname&&returned.searchParams.get('state')===state&&!!returned.searchParams.get('code')&&!returned.searchParams.has('error');
   record.outcome=valid?'oauth-return-success':'unexpected-callback';save();
   await route.fulfill({status:200,contentType:'text/html',body:'<h1>Length test recorded</h1><p>The next test opens automatically. No request reached Kino.</p>'});finish();
  });
  page.on('response',r=>{
   const url=new URL(r.url());if(url.hostname!=='github.com'||!r.request().isNavigationRequest())return;
   const location=r.headers().location;
   record.responses.push({method:r.request().method(),path:url.pathname,status:r.status(),requestId:r.headers()['x-github-request-id']??null,...(location?{redirectLength:location.length}:{} )});
   if(url.pathname==='/login')record.githubLoginUrlLength=url.href.length;
   if(url.pathname==='/session'&&r.request().method()==='POST'&&r.status()===500){record.outcome='session-500';finish();}
   else if(r.status()>=400){record.outcome='unexpected-http-error';finish();}
   save();
  });
  try{
   await page.goto(u.href);await page.bringToFront();console.log(`READY ${output.cases.length}/${steps+2}: ${length} state characters (${phase}). Complete GitHub sign-in.`);
   let timer;await Promise.race([done,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Sign-in timeout')),15*60*1000);})]).finally(()=>clearTimeout(timer));
   console.log(`RESULT: ${length} characters: ${record.outcome}`);await page.waitForTimeout(1000);
   assert.ok(['oauth-return-success','session-500'].includes(record.outcome),'Unexpected result; do not treat as length failure');
   return record.outcome==='oauth-return-success';
  }finally{await c.close();}
 }
 let low=resume?1024:48,high=1906;
 for(let i=0;i<steps;i++){
  const length=i===0&&!resume?1024:Math.floor((low+high)/2);
  if(await test(length,'intermediate'))low=length;else high=length;
  output.bracket={largestPassingState:low,smallestFailingState:high};save();
 }
 const lowAgain=await test(low,'repeat-passing-boundary');
 const highAgain=await test(high,'repeat-failing-boundary');
 output.repeatableBracket=lowAgain&&!highAgain;output.complete=true;
 console.log('DONE:',JSON.stringify({bracket:output.bracket,repeatableBracket:output.repeatableBracket}));
}catch(e){output.error=e.name;console.error('Stopped:',e.name);process.exitCode=1;}
finally{save();await browser.close();}
