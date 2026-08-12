// Kullanılan her anahtarın İngilizce karşılığı var mı?
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function dosyalar(kok) {
  const cikti = []
  for (const ad of readdirSync(kok)) {
    const yol = join(kok, ad)
    if (statSync(yol).isDirectory()) cikti.push(...dosyalar(yol))
    else if (/\.tsx?$/.test(ad) && !ad.includes('i18n')) cikti.push(yol)
  }
  return cikti
}

const anahtarlar = new Set()
for (const yol of dosyalar('src')) {
  const s = readFileSync(yol, 'utf8')
  for (const m of s.matchAll(/\b[tm]\('((?:[^'\\]|\\.)*)'/g)) anahtarlar.add(m[1])
}

// Sözlüğü kaynaktan okuyup anahtarları çıkar (çalıştırmadan)
const sozluk = readFileSync('src/shared/i18n-en.ts', 'utf8')
const cevrili = new Set()
for (const m of sozluk.matchAll(/^\s*'((?:[^'\\]|\\.)*)':/gm)) cevrili.add(m[1])

const eksik = [...anahtarlar].filter((k) => !cevrili.has(k)).sort()
console.log(`kullanılan: ${anahtarlar.size} · çevrili: ${cevrili.size} · EKSİK: ${eksik.length}`)
for (const k of eksik.slice(0, 40)) console.log('  ✗', k.slice(0, 90))
process.exit(eksik.length > 0 ? 1 : 0)
