// Gera as imagens otimizadas de public/nft a partir de assets-src/nft (PNG originais + hero 1350px).
// Uso: node scripts/optimize-images.mjs   (requer `sharp`, devDependency)
import { readdirSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const src = 'assets-src/nft'
const out = 'public/nft'

// Artes dos cards: PNG -> WebP nas mesmas dimensoes.
for (const f of readdirSync(src).filter((n) => n.endsWith('.png'))) {
  await sharp(path.join(src, f)).webp({ quality: 90, effort: 6 }).toFile(path.join(out, f.replace(/\.png$/, '.webp')))
}

// Hero: variantes 240/480/900 (o arquivo de 1350 px permanece como fallback de `src`).
const heroSrc = path.join(src, 'hero-emerald-ape.src.webp')
for (const w of [240, 480, 900]) {
  await sharp(heroSrc).resize(w, w).webp({ quality: 82, effort: 6 }).toFile(path.join(out, `hero-emerald-ape-${w}.webp`))
}
console.log('ok')
