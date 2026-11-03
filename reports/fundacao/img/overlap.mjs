import { chromium } from 'file:///C:/Users/WenschZada/source/repos/nft-marketplace-challenge/node_modules/playwright/index.mjs'
const b=await chromium.launch()
for(const w of [768,820,900,1024,1100,1199,1200,1440]){const p=await b.newPage({viewport:{width:w,height:800}});await p.goto('http://localhost:4173/');await p.waitForTimeout(1200)
const r=await p.evaluate(()=>{const n=[...document.querySelectorAll('header nav a')].pop().getBoundingClientRect();const s=document.querySelector('header a[aria-label="Buscar NFTs"]').getBoundingClientRect();const t=document.querySelector('header nav a').getBoundingClientRect();const l=document.querySelector('header a').getBoundingClientRect();return {aprendaRight:Math.round(n.right),searchLeft:Math.round(s.left),inicioLeft:Math.round(t.left),logoRight:Math.round(l.right)}})
console.log(w,JSON.stringify(r),'overlap',r.aprendaRight>r.searchLeft); await p.close()}
const p=await b.newPage({viewport:{width:390,height:844}});await p.goto('http://localhost:4173/');await p.waitForTimeout(1200)
console.log(JSON.stringify(await p.evaluate(()=>{const n=[...document.querySelectorAll('nav')].map(e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);return [e.getAttribute('aria-label'),r.x,r.y,r.width,r.height,c.backgroundColor,c.position,c.borderRadius]});const a=document.activeElement.tagName;return {n,a,mainPad:getComputedStyle(document.querySelector('main')).paddingBottom,bodyPadB:getComputedStyle(document.body).paddingBottom}})))
await p.screenshot({path:'C:/Users/WenschZada/source/repos/nft-marketplace-challenge/reports/fundacao/img/mobile-viewport-390.png'})
await p.keyboard.press('Tab');console.log('first tab',await p.evaluate(()=>document.activeElement.textContent.slice(0,30)))
console.log('before tab focus', await (async()=>{const q=await b.newPage();await q.goto('http://localhost:4173/');await q.waitForTimeout(1500);return q.evaluate(()=>document.activeElement.tagName+'#'+document.activeElement.id)})())
await b.close()
