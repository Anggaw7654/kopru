/**
 * Interface language.
 *
 * The dictionary is keyed by the **Turkish source string**, not by an invented
 * identifier. Two reasons:
 *
 *  1. Call sites stay readable — `t('Bağlantı kesildi')` says what it renders,
 *     while `t('conn.lost')` sends you to a table to find out.
 *  2. A missing entry degrades to the Turkish original instead of printing a
 *     raw key at the user. A half-translated build is ugly; a build showing
 *     `conn.lost` is broken.
 *
 * Placeholders are `{name}` and are substituted after lookup, so a translation
 * may reorder them — English and Turkish do not agree on word order.
 */

export type Dil = 'tr' | 'en'

export const DILLER: readonly Dil[] = ['tr', 'en']

/** Turkish source → English. Anything absent falls through untranslated. */
const EN: Record<string, string> = {}

/** Registers translations. Split across files so no single map gets unwieldy. */
export function ekle(girdiler: Record<string, string>): void {
  Object.assign(EN, girdiler)
}

export function cevir(
  dil: Dil,
  kaynak: string,
  degerler?: Record<string, string | number>,
): string {
  let metin = dil === 'en' ? (EN[kaynak] ?? kaynak) : kaynak
  if (degerler) {
    for (const [ad, deger] of Object.entries(degerler)) {
      metin = metin.split(`{${ad}}`).join(String(deger))
    }
  }
  return metin
}

/** True when the string has an English entry — used by the coverage test. */
export function ceviriVar(kaynak: string): boolean {
  return kaynak in EN
}

export function ceviriSayisi(): number {
  return Object.keys(EN).length
}
