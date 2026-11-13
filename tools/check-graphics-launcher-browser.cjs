// Exercise the real local launcher and its opt-in report, using production p5.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.GRAPHICS_OUT||'/tmp/graphics-launcher-qa';
const p5=fs.readFileSync(process.env.GRAPHICS_P5||'/workspace/.environment/newone/node_modules/p5/lib/p5.min.js');
const blank=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR3kAAAAASUVORK5CYII=','base64');
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const name=pathname==='/'?'index.html':pathname.slice(1);
  if(!['index.html','game.js','graphics-report.js'].includes(name)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':'text/html');res.end(fs.readFileSync(path.join(root,name)));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}/index.html`;
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader']});
 const context=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,
  userAgent:'Mozilla/5.0 (Linux; Android 14; Test wv) AppleWebKit/537.36 Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36'});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 await page.route('**/*',route=>{
  const u=route.request().url();
  if(u.includes('cdn.jsdelivr.net/npm/p5@'))return route.fulfill({contentType:'application/javascript',body:p5});
  if(/\.png(?:\?|$)/.test(u))return route.fulfill({contentType:'image/png',body:blank});
  if(/\.(?:mp3|wav)(?:\?|$)/.test(u))return route.fulfill({status:204,body:''});
  return route.continue();
 });
 await page.addInitScript(()=>{
  window.__graphicsContexts=[];window.__graphicsParameters=0;
  const get=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,attributes){
   const gl=get.call(this,type,attributes);
   if(type==='webgl2'&&gl)window.__graphicsContexts.push({attributes:{...attributes}});
   return gl;
  };
  const parameter=WebGL2RenderingContext.prototype.getParameter;
  WebGL2RenderingContext.prototype.getParameter=function(...args){window.__graphicsParameters++;return parameter.apply(this,args);};
 });
 try{
  await page.goto(url,{waitUntil:'load'});
  await page.waitForFunction(()=>typeof leftStick!=='undefined'&&leftStick&&typeof getGameGraphicsDiagnostics==='function');
  await page.evaluate(()=>noLoop());
  assert.equal(await page.locator('#graphics-report').count(),0,'normal play has no diagnostic overlay');
  await page.goto(url+'?graphics=1',{waitUntil:'load'});
  await page.waitForFunction(()=>typeof leftStick!=='undefined'&&leftStick&&typeof getGameGraphicsDiagnostics==='function');
  const result=await page.evaluate(()=>{
   noLoop();Player3D.ensure(PLAYER3D_ASSET);
   const before={contexts:__graphicsContexts.length,parameters:__graphicsParameters};
   let report;for(let i=0;i<100;i++)report=getGameGraphicsDiagnostics();
   return {before,after:{contexts:__graphicsContexts.length,parameters:__graphicsParameters},report,requests:__graphicsContexts};
  });
  assert.equal(result.requests.length,2,'report uses only the lighting and character contexts');
  assert.deepEqual(result.after,result.before,'repeated reports create no probe contexts or GPU queries');
  assert.ok(result.requests.every(r=>r.attributes.powerPreference==='high-performance'),'both real contexts request high performance');
  assert.ok(result.requests.every(r=>r.attributes.preserveDrawingBuffer===true),'Canvas compositing retains its required buffers');
  assert.equal(result.report.environment.androidWebViewHint,true,'Android WebView UA is only a host hint');
  for(const owner of ['lighting','characters']){
   assert.equal(result.report[owner].context.state,'ready',owner+' actual context is ready');
   assert.equal(result.report[owner].context.acceleration,'software','SwiftShader is not advertised as hardware Vulkan');
  }
  await page.locator('[data-action="refresh"]').click();
  await page.waitForFunction(()=>document.querySelector('#graphics-report pre').textContent.includes('unmaskedRenderer'));
  assert.match(await page.locator('[data-context="characters"] p').textContent(),/Software renderer/);
  const intent=await page.locator('[data-action="chrome"]').getAttribute('href');
  assert.ok(intent.startsWith('intent://127.0.0.1:')&&intent.includes('package=com.android.chrome;'),'external launch explicitly targets Chrome');
  assert.ok(!intent.includes('graphics=1'),'external game address leaves the diagnostic query behind');
  await page.evaluate(()=>{window.__reportPointerEvents=0;window.addEventListener('pointerdown',()=>__reportPointerEvents++);});
  await page.locator('[data-action="refresh"]').click();
  assert.equal(await page.evaluate(()=>__reportPointerEvents),0,'report controls do not trigger game pointer input');
  await page.locator('[data-action="copy"]').click();
  await page.waitForFunction(()=>/copied|Select and copy/.test(document.querySelector('[data-status]').textContent));
  const copied=JSON.parse(await page.locator('#graphics-report pre').textContent());
  assert.equal(copied.characters.context.acceleration,'software','copied report keeps truthful backend evidence');
  await page.screenshot({path:path.join(out,'graphics-report.png')});
  await page.locator('[data-action="close"]').click();
  assert.equal(await page.locator('#graphics-report').isVisible(),false,'report can be closed to start playing');
  await page.locator('#graphics-open').click();
  assert.equal(await page.locator('#graphics-report').isVisible(),true,'report reopens after gameplay without reloading its contexts');
  assert.equal(await page.evaluate(()=>__graphicsContexts.length),2,'reopening the report creates no probe context');
  assert.deepEqual(errors,[],'local launcher has no uncaught JavaScript errors');
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({runtime:'Chromium SwiftShader; Android WebView user-agent emulation, not a phone test',result,errors},null,2));
  console.log('Local launcher, opt-in graphics report, real context attributes, cached queries, copy and Chrome action checks passed; '+out);
 }finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
