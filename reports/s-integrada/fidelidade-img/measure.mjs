import { chromium } from '@playwright/test'
import fs from 'fs'
const B='http://localhost:4173'
const out='reports/s-integrada/fidelidade-img/'
const browser=await chromium.launch()
const res={}
const measure=()=>{
  const cs=(e)=>getComputedStyle(e)
  const r=(e)=>{const b=e.getBoundingClientRect();return [Math.round(b.x),Math.round(b.y+scrollY),Math.round(b.width),Math.round(b.height)]}
  const pick=(sel,n=6)=>[...document.querySelectorAll(sel)].slice(0,n).map(e=>{const c=cs(e);return {t:(e.textContent||'').trim().slice(0,28),ff:c.fontFamily.split(',')[0],fs:c.fontSize,lh:c.lineHeight,fw:c.fontWeight,ls:c.letterSpacing,col:c.color,bg:c.backgroundColor,box:r(e)}})
  const imgs=[...document.querySelectorAll('main img')].slice(0,6).map(i=>({nat:[i.naturalWidth,i.naturalHeight],box:r(i),of:cs(i).objectFit}))
  return {sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,h:document.documentElement.scrollHeight,bodyBg:cs(document.body).backgroundColor,bodyFf:cs(document.body).fontFamily.split(',')[0],h1:pick('h1,h2',8),btn:pick('main button,main a[class*=bg-]',6),imgs,hdr:pick('header',1)}
}
async function login(ctx){const p=await ctx.newPage();await p.goto(B+'/');await p.waitForFunction(()=>!!window.__mock);
  await p.evaluate(async()=>{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'alice@example.test',password:'Senha@123'})});const s=await r.json();localStorage.setItem('kurio.session',JSON.stringify({token:s.token,expiresAt:s.expiresAt}));
   for(const id of ['nft_001','nft_002']){const d=await (await fetch('/api/nfts/'+id)).json();const e=d.editions.find(x=>x.available>=3&&x.maxPerOrder>=2);if(e)await fetch('/api/cart/items',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:JSON.stringify({nftId:id,editionId:e.id,quantity:2})})}})
  await p.reload();await p.waitForFunction(()=>!!window.__mock);return p}
for(const w of [390,768,1440]){
  const ctx=await browser.newContext({viewport:{width:w,height:900}})
  const p=await login(ctx)
  const pages={inicio:'/',detalhe:'/nft/nft_001',carrinho:'/cart',pagamento:'/checkout',perfil:'/profile',carteiras:'/wallets'}
  for(const [k,u] of Object.entries(pages)){
    await p.goto(B+u);await p.waitForLoadState('networkidle');await p.waitForTimeout(800)
    res[`${k}@${w}`]=await p.evaluate(measure)
    await p.screenshot({path:`${out}${k}-${w}.png`,fullPage:true})
  }
  await ctx.close()
  const c2=await browser.newContext({viewport:{width:w,height:900}});const q=await c2.newPage()
  for(const k of ['login','register']){await q.goto(B+'/'+k);await q.waitForLoadState('networkidle');await q.waitForTimeout(600);res[`${k}@${w}`]=await q.evaluate(measure);await q.screenshot({path:`${out}${k}-${w}.png`,fullPage:true})}
  await c2.close()
}
fs.writeFileSync('reports/s-integrada/fidelidade-img/measure.json',JSON.stringify(res,null,1))
await browser.close()
