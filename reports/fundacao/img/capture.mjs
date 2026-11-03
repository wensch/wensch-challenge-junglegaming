import { chromium } from 'file:///C:/Users/WenschZada/source/repos/nft-marketplace-challenge/node_modules/playwright/index.mjs'
const out='C:/Users/WenschZada/source/repos/nft-marketplace-challenge/reports/fundacao/img/'
const b=await chromium.launch()
const res={}
for (const w of [390,768,1440]){
  const h = w===1440?900:(w===768?1024:844)
  const p=await b.newPage({viewport:{width:w,height:h}})
  for (const [name,url] of [['inicio','/'],['404','/rota-inexistente'],['embreve','/em-breve?secao=criadores']]){
    await p.goto('http://localhost:4173'+url); await p.waitForTimeout(1500)
    await p.screenshot({path:`${out}${name}-${w}.png`,fullPage:true})
    const m=await p.evaluate(()=>{
      const g=(s)=>{const e=document.querySelector(s);if(!e)return null;const c=getComputedStyle(e);const r=e.getBoundingClientRect();return {color:c.color,bg:c.backgroundColor,fs:c.fontSize,lh:c.lineHeight,ff:c.fontFamily.slice(0,30),fw:c.fontWeight,ls:c.letterSpacing,x:r.x,y:r.y,w:r.width,h:r.height,bt:c.borderTopWidth+' '+c.borderBottomColor,rad:c.borderRadius}}
      return {sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,body:g('body'),header:g('header'),headerRow:g('header > div > div'),logo:g('header a'),nav:g('header nav'),navA:g('header nav a'),footer:g('footer'),h1:g('h1'),main:g('main'),tab:g('[aria-label="Abrir menu"]'),tabnav:g('nav[aria-label]:not([aria-label="Principal"])'),fontsOK:document.fonts.check('16px "Roboto Mono"'),h1t:document.querySelector('h1')?.textContent, skip:document.querySelector('a[href="#conteudo"],a[href^="#main"],a.sr-only')?.outerHTML.slice(0,200)}
    })
    res[`${name}-${w}`]=m
  }
  await p.goto('http://localhost:4173/'); await p.waitForTimeout(800)
  await p.keyboard.press('Tab'); await p.waitForTimeout(200)
  await p.screenshot({path:`${out}skiplink-${w}.png`,clip:{x:0,y:0,width:w,height:200}})
  res['skip-'+w]=await p.evaluate(()=>{const e=document.activeElement;const r=e.getBoundingClientRect();return {t:e.textContent,x:r.x,y:r.y,w:r.width,h:r.height,outline:getComputedStyle(e).outlineStyle}})
  if(w<768){ await p.click('[aria-label="Abrir menu"]'); await p.waitForTimeout(600); await p.screenshot({path:`${out}menu-${w}.png`}) }
  await p.close()
}
console.log(JSON.stringify(res,null,1))
await b.close()
