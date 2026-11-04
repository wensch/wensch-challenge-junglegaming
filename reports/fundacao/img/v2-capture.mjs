import { chromium } from 'file:///C:/Users/WenschZada/source/repos/nft-marketplace-challenge/node_modules/playwright/index.mjs'
const out='C:/Users/WenschZada/source/repos/nft-marketplace-challenge/reports/fundacao/img/'
const b=await chromium.launch()
for (const [w,h] of [[390,844],[768,1024],[1440,900]]){
  const p=await b.newPage({viewport:{width:w,height:h}})
  for (const [name,url] of [['inicio','/'],['404','/rota-inexistente'],['embreve','/em-breve?secao=criadores']]){
    await p.goto('http://localhost:4173'+url); await p.waitForTimeout(1200)
    await p.screenshot({path:`${out}v2-${name}-${w}.png`,fullPage:true})
    const m=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}))
    console.log(w,name,'overflow',m.sw>m.cw,JSON.stringify(m))
  }
  await p.goto('http://localhost:4173/'); await p.waitForTimeout(800)
  console.log(w,'focus before tab',await p.evaluate(()=>document.activeElement.tagName))
  await p.keyboard.press('Tab')
  console.log(w,'first tab',await p.evaluate(()=>{const e=document.activeElement,r=e.getBoundingClientRect();return [e.textContent.slice(0,30),Math.round(r.x),Math.round(r.y),getComputedStyle(e).outlineStyle]}))
  await p.screenshot({path:`${out}v2-skip-${w}.png`,clip:{x:0,y:0,width:w,height:160}})
  if(w>=768){
    await p.locator('header').screenshot({path:`${out}v2-header-${w}.png`})
    const m=await p.evaluate(()=>{const f=document.querySelector('footer');const c=getComputedStyle(f);return {h:Math.round(f.getBoundingClientRect().height)}})
    console.log(w,'footer',JSON.stringify(m))
    await p.locator('footer').screenshot({path:`${out}v2-footer-${w}.png`})
    console.log(w,'header', JSON.stringify(await p.evaluate(()=>{const g=s=>{const e=document.querySelector(s);const c=getComputedStyle(e),r=e.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),fs:c.fontSize,lh:c.lineHeight,color:c.color,bg:c.backgroundColor,rad:c.borderRadius}};return {logo:g('header a'),nav:g('header nav a'),entrar:g('header button, header a[href*="login"], header a:last-child')}})))
  } else {
    await p.screenshot({path:`${out}v2-mobile-viewport-390.png`})
    await p.click('[aria-label="Abrir menu"]'); await p.waitForTimeout(500); await p.screenshot({path:`${out}v2-menu-390.png`})
    await p.keyboard.press('Escape')
    console.log(w,'tabbar',JSON.stringify(await p.evaluate(()=>{const e=document.querySelector('nav[aria-label="Navegação inferior"]'),c=getComputedStyle(e),r=e.getBoundingClientRect();return {h:r.height,w:r.width,rad:c.borderTopLeftRadius}})))
  }
  await p.close()
}
// sweep header
for (const w of [768,800,850,1000,1199,1300]){const p=await b.newPage({viewport:{width:w,height:800}});await p.goto('http://localhost:4173/');await p.waitForTimeout(800);await p.locator('header').screenshot({path:`${out}v2-header-sweep-${w}.png`});await p.close()}
await b.close()
