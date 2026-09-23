import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const {chromium}=await import(pathToFileURL(`${process.env.PROOF_PLAYWRIGHT}/index.mjs`).href);
const browser=await chromium.launch({headless:false});
const context=await browser.newContext({locale:'en-US'});
const results={recordedAt:new Date().toISOString(),conditions:'Dedicated Chromium context; actual GitHub OAuth; human/provider time reported separately. Different page workloads. Reloads use warm browser cache, not controlled server cold starts.',targets:[]};
const targets=[
 {name:'kino-production',origin:'https://usekino.com',login:'/auth?redirect=%2Fdashboard',destination:'/dashboard',gateway:'https://gateway.usekino.com/api/auth/callback/github',start:'/api/auth/sign-in/social',ready:'main h1'},
 {name:'native-proof',origin:'https://kino-auth-v2-proof-c318c09d.hello-fc8.workers.dev',login:'/',destination:'/private/alpha',gateway:'https://kino-v2-gateway-proof-c318c09d.hello-fc8.workers.dev/oauth/github/callback',start:'/api/auth/github/start',ready:'html[data-hydrated="true"] #counter'},
];
const ms=n=>Math.round(n*10)/10;
try{
 for(const t of targets){
  const page=await context.newPage();await page.bringToFront();
  let callbackAt,startedAt,initiationMs;const legs=[];
  page.on('request',r=>{const u=new URL(r.url());if(u.origin+u.pathname===t.gateway && callbackAt===undefined)callbackAt=performance.now();if(u.origin===t.origin&&u.pathname===t.start)startedAt=performance.now();});
  page.on('requestfinished',r=>{const u=new URL(r.url());if(u.origin===t.origin&&u.pathname===t.start&&startedAt!==undefined)initiationMs=ms(performance.now()-startedAt);if(r.isNavigationRequest()&&[t.origin,new URL(t.gateway).origin].includes(u.origin)){const timing=r.timing();legs.push({origin:u.origin,path:u.pathname,status:null,durationMs:ms(timing.responseEnd),ttfbMs:ms(timing.responseStart)});}});
  await page.goto(t.origin+t.login);
  const button=page.getByRole('button',{name:/github/i});await button.waitFor();await button.click();
  console.log(`READY: Complete GitHub sign-in/consent for ${t.name}. Browser continues automatically.`);
  await page.waitForURL(u=>u.origin===t.origin&&u.pathname===t.destination,{timeout:900000});
  await page.locator(t.ready).first().waitFor({timeout:60000});
  if(t.name==='kino-production')await page.getByText('Your teams',{exact:true}).waitFor({timeout:60000});
  const readyAt=performance.now();assert.ok(callbackAt,'Expected real gateway callback');
  const result={name:t.name,origin:t.origin,initiationMs,callbackToVisibleContentMs:ms(readyAt-callbackAt),startToVisibleIncludingHumanMs:ms(readyAt-startedAt),readyCriterion:t.name==='kino-production'?'Dashboard heading and Your teams visible; does not imply all feed items loaded':'Hydrated private counter visible',navigationLegs:[...legs],reloads:[]};
  for(let i=0;i<5;i++){
   const begin=performance.now();const response=await page.reload({waitUntil:'domcontentloaded'});await page.locator(t.ready).first().waitFor();
   if(t.name==='kino-production')await page.getByText('Your teams',{exact:true}).waitFor();
   assert.equal(new URL(page.url()).pathname,t.destination);
   const visibleMs=ms(performance.now()-begin);const html=await response.text();
   result.reloads.push({iteration:i,visibleMs,ssrContainsContent:t.name==='kino-production'?html.includes('Your teams'):html.includes('id="counter"'),...await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];return{ttfbMs:n.responseStart,documentMs:n.responseEnd};})});
  }
  results.targets.push(result);writeFileSync(new URL('../performance/production-results.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
  console.log('PASS:',t.name,JSON.stringify({initiationMs,callbackToVisibleContentMs:result.callbackToVisibleContentMs,reloads:result.reloads.length}));
 }
 console.log('DONE: Both login and reload measurements saved. Browser closes automatically.');
} catch(error){console.error('Benchmark stopped:',error.name);results.error={name:error.name};process.exitCode=1;}
finally{writeFileSync(new URL('../performance/production-results.json',import.meta.url),JSON.stringify(results,null,2)+'\n');await browser.close();}
