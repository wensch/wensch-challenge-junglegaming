import { chromium } from 'file:///C:/Users/WenschZada/source/repos/nft-marketplace-challenge/node_modules/playwright/index.mjs'
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});await p.goto('http://localhost:4173/');await p.waitForTimeout(1000)
console.log(await p.evaluate(()=>[...document.querySelectorAll('header, header *')].filter(e=>getComputedStyle(e).borderBottomWidth!=='0px').map(e=>e.tagName+' '+getComputedStyle(e).borderBottomWidth+' '+getComputedStyle(e).borderBottomColor+' w'+Math.round(e.getBoundingClientRect().width))))
await b.close()
