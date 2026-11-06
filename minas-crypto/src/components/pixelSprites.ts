/** Dig-style flat pixel sprites (CAVA). No gradients / CSS 3D. */

export const PX: Record<string, string> = {
  _: '00000000',
  K: '#000000',
  W: '#ffffff',
  S: '#f0b878',
  D: '#c88848',
  H: '#e8c84a',
  O: '#8b5a2b',
  o: '#c4894a',
  G: '#9aa0a6',
  g: '#6a7078',
  B: '#2a5aaa',
  b: '#1a3a6a',
  U: '#4ad2ff',
  u: '#1a6a9a',
  Y: '#ffe27a',
  y: '#d4a017',
  P: '#c44dff',
  p: '#6a1a9a',
  R: '#c62828',
  r: '#6a1010',
  N: '#6fd97a',
  n: '#3a8a44',
  T: '#5a3a1e',
  t: '#3a2a1a',
  C: '#e8e0d0',
  M: '#e8dcc8',
  m: '#cfc4b4',
  L: '#fff59a',
  X: '#ff4a3a',
  F: '#ffa0ff',
  /** skin shadow */
  A: '#a86838',
  /** cream shirt */
  E: '#f2ebe0',
  /** leather vest */
  V: '#6b4423',
  /** dark armor */
  I: '#142238',
  /** gold bright */
  J: '#fff0a8',
}

const cache = new Map<string, string>()

function rgba(hex: string): [number, number, number, number] {
  if (hex === '00000000') return [0, 0, 0, 0]
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255]
}

export function renderPixelMap(rows: string[], scale = 4, cacheKey?: string): string {
  const key = cacheKey ?? `${rows.join('\n')}@${scale}`
  const hit = cache.get(key)
  if (hit) return hit

  const h = rows.length
  const w = Math.max(...rows.map((r) => r.length))
  const canvas = document.createElement('canvas')
  canvas.width = w * scale
  canvas.height = h * scale
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  for (let y = 0; y < h; y++) {
    const row = rows[y].padEnd(w, '_')
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = rgba(PX[row[x]] ?? PX._)
      if (!a) continue
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(x * scale, y * scale, scale, scale)
    }
  }
  const url = canvas.toDataURL('image/png')
  cache.set(key, url)
  return url
}

/** Pico stamp (mano) — cabeza Dig dual corta + mango */
const PICKS: Record<number, string[]> = {
  1: [
    '___KK____KK_',
    '__KGGK__KGGK',
    '__KGgKKKGgGK',
    '__KGGggGGGK_',
    '___KKKKoKK__',
    '______KoK___',
    '______KoK___',
    '______KOK___',
  ],
  2: [
    '___KK____KK_',
    '__KGGK__KGGK',
    '__KGgKNKgGGK',
    '__KGNnNnGGK_',
    '___KKKKnKK__',
    '______KnK___',
    '______KnK___',
    '______KNK___',
  ],
  3: [
    '___KK____KK_',
    '__KUGK__KGUK',
    '__KUuKUKuUUK',
    '__KUUuUuUUK_',
    '___KKKKbKK__',
    '______KbK___',
    '______KbK___',
    '______KUK___',
  ],
  4: [
    '___KK____KK_',
    '__KYGK__KGYK',
    '__KYyKPKyYYK',
    '__KYPpPpYYK_',
    '___KKKKpKK__',
    '______KpK___',
    '______KpK___',
    '______KYK___',
  ],
  5: [
    '__KK______KK',
    '_KUYK____KYU',
    '_KUuYYYYYUuK',
    '_KUYYYYYYUK_',
    '__KKKyYKK___',
    '______KyK___',
    '______KyK___',
    '______KYK___',
  ],
  6: [
    '__K_K____K_K',
    '_KPFK____KFP',
    '_KPYYYYYYYPK',
    '_KPFYYYYFPK_',
    '__KKKyYKK___',
    '______KyK___',
    '______KyK___',
    '______KYK___',
  ],
}

/**
 * Miner bodies 32×24 — Dig ranks:
 * 1 ropa básica+casco · 2 mochila · 3 traje azul · 4 oro · 5 capa cyan · 6 corona mítica
 * Espacio derecho libre para pico overlay (omitAxe en escena).
 */
const BODIES: Record<number, string[]> = {
  // 1 Básico — camisa crema, chaleco marrón, pantalón, casco + lámpara
  1: [
    '________________________________',
    '____________KK__________________',
    '___________KLLK_________________',
    '__________KHHHHK________________',
    '_________KHHooHHK_______________',
    '________KHooooooHK______________',
    '________KSSSSSSSSK______________',
    '________KS_KK_KK_SK_____________',
    '________KSSASSSASK______________',
    '________KDSSSSSSDK______________',
    '_________KKMMMMKK_______________',
    '________KMMmmmmMMK______________',
    '_______KVMMmmmmMMVK_____________',
    '_______KVMmmMMMMmVK_____________',
    '________KVMmmmmVK_______________',
    '________KTTyyTTK________________',
    '________KTTyyTTK________________',
    '________KTTKKTTK________________',
    '________KT____TK________________',
    '________KttK_KttK_______________',
    '________KttK_KttK_______________',
    '_________KK___KK________________',
    '________________________________',
    '________________________________',
  ],
  // 2 Novato — casco + lámpara, chaleco cuero, mochila
  2: [
    '________________________________',
    '____________KK__________________',
    '___________KLLK_________________',
    '__________KOoOoK________________',
    '_________KOOOOOOK_______________',
    '________KOoooooOK_______________',
    '________KSSSSSSSSK______________',
    '________KS_KK_KK_SK_____________',
    '________KSSASSSASK______________',
    '________KDSSSSSSDK______________',
    '_______KK_KMMMMK_KK_____________',
    '______KVKKMmmmmMKKVK____________',
    '_____KVVKMMmMMMmKVVK____________',
    '____KOO_KVMmmmmVK_OOK___________',
    '___KOOK_KTTyyyyTTK_OOK__________',
    '____KK__KTTyyyyTTK_KK___________',
    '________KTTKKKKTTK______________',
    '________KT______TK______________',
    '________KttK__KttK______________',
    '________KttK__KttK______________',
    '_________KK____KK_______________',
    '________________________________',
    '________________________________',
    '________________________________',
  ],
  // 3 Avanzado — traje azul, cinturones, hombreras metal
  3: [
    '________________________________',
    '____________KK__________________',
    '___________KLLK_________________',
    '__________KGgGgK________________',
    '_________KGGGGGGK_______________',
    '________KGggggggK_______________',
    '________KSSSSSSSSK______________',
    '________KS_KK_KK_SK_____________',
    '________KSSASSSASK______________',
    '________KDSSSSSSDK______________',
    '______KKKKKBBBBKKKKK____________',
    '_____KGGGKBBbbBBKGGGK___________',
    '____KGG__KBBbbBBK__GGK__________',
    '________KBBYYYYBBK______________',
    '________KBByyyyBBK______________',
    '________KBBbbbbBBK______________',
    '________KBBKKKKBBK______________',
    '________Kbb____bbK______________',
    '________KttK__KttK______________',
    '________KttK__KttK______________',
    '_________KK____KK_______________',
    '________________________________',
    '________________________________',
    '________________________________',
  ],
  // 4 Experto — azul + placas oro, lámpara dorada, destellos
  4: [
    '________________________________',
    '____________KK__________________',
    '___________KLLK_________________',
    '__________KJjJjK________________',
    '_________KJYYYYJK_______________',
    '________KJyyyyyyJK______________',
    '________KSSSSSSSSK______________',
    '________KS_KK_KK_SK_____________',
    '________KSSASSSASK______________',
    '______KKKDSSSSSSDKKK____________',
    '_____KYYYKBBbbBBKYYYK___________',
    '____KYY__KBBbbBBK__YYK__________',
    '________KBJyyyyJBK______________',
    '________KBJyyyyJBK______________',
    '________KYYyyyyYYK______________',
    '________KYYKKKKYYK______________',
    '________Kbb____bbK______________',
    '________KYYK__KYYK______________',
    '________KttK__KttK______________',
    '________KttK__KttK______________',
    '_________KK____KK_______________',
    '_____KPK____KPK____KPK__________',
    '____KPPK___KPPK___KPPK__________',
    '________________________________',
  ],
  // 5 Élite — armadura oscura, cristales cyan, capa peluda
  5: [
    '________________________________',
    '____________KK__________________',
    '___________KLLK_________________',
    '__________KUuUuK________________',
    '_________KUUUUUUK_______________',
    '________KUuuuuuuK_______________',
    '________KSSSSSSSSK______________',
    '________KS_KK_KK_SK_____________',
    '______KKKSSASSSASKKK____________',
    '_____KCCKDSSSSSSDKCCK___________',
    '____KCCC_KIBbbBIK_CCCK__________',
    '___KCCCC_KBUUUUBK_CCCCK_________',
    '___KCCCC_KBUuuuUBKCCCCK_________',
    '____KCCC_KBUuuuUBKCCCK__________',
    '_____KCC_KBUUUUBK_CCK___________',
    '______KK_KIbbbbIK_KK____________',
    '________KBBKKKKBBK______________',
    '________Kbb____bbK______________',
    '________KttK__KttK______________',
    '________KttK__KttK______________',
    '_________KK____KK_______________',
    '____KUK______KUK______KUK_______',
    '___KUUK_____KUUK_____KUUK_______',
    '________________________________',
  ],
  // 6 Legendario — corona oro, capa blanca/roja, cristales púrpura
  6: [
    '________________________________',
    '_______K_K_K_K_K________________',
    '______KYKYKYKYKYK_______________',
    '_____KYYYYYYYYYYYK______________',
    '____KYyyyyUyyyyyYK______________',
    '___KYYYYYYYYYYYYYYK_____________',
    '___KSSSSSSSSSSSSSSK_____________',
    '___KS_KK____KK_SSK______________',
    '__KKSSASSSSSSSASKK______________',
    '_KCCKDSSSSSSSSSDKCCK____________',
    'KCCCC_KYBbbbbBYK_CCCCK__________',
    'KCCCC_KBYYYYYYB_CCCCCK__________',
    'KRCCC_KBYyyyyyYB_CCCRK__________',
    'KRRCC_KBYyyyyyYB_CCRRK__________',
    'KRRRC_KBYYYYYYYB_CRRRK__________',
    '_KRRR_KBYyyyyyYB_RRRK___________',
    '__KRR_KBYYYYYYYB_RRK____________',
    '___KK_KBbbbbbbbBK_KK____________',
    '_____KYYKKKKKKYYK_______________',
    '_____Kyy______yyK_______________',
    '_____KttK____KttK_______________',
    '_____KttK____KttK_______________',
    '______KK______KK________________',
    '__KPK____KFK____KPK_____________',
    '_KPPK___KFFK___KPPK_____________',
    '________________________________',
  ],
}

function stampPick(body: string[], axeId: number): string[] {
  const pick = PICKS[Math.min(6, Math.max(1, axeId))] ?? PICKS[1]
  const out = body.map((r) => r.split(''))
  const ox = 20
  const oy = 10
  for (let py = 0; py < pick.length; py++) {
    const prow = pick[py]
    const ty = oy + py
    if (ty < 0 || ty >= out.length) continue
    for (let px = 0; px < prow.length; px++) {
      const ch = prow[px]
      if (ch === '_') continue
      const tx = ox + px
      if (tx < 0 || tx >= out[ty].length) continue
      out[ty][tx] = ch
    }
  }
  return out.map((r) => r.join(''))
}

export function minerPixelUrl(rank: number, axeId: number, scale = 4, omitAxe = false): string {
  const r = Math.min(6, Math.max(1, Math.floor(rank)))
  const a = Math.min(6, Math.max(1, Math.floor(axeId)))
  const body = BODIES[r] ?? BODIES[1]
  const map = omitAxe ? body : stampPick(body, a)
  return renderPixelMap(map, scale, `m${r}a${omitAxe ? 0 : a}@${scale}-v6`)
}

/**
 * Dig Crypto pickaxes — dual head + gem + wrap + rock mound + aura
 * 32×36
 */
const AXE_MAPS: Record<number, string[]> = {
  // 1 Básica — hierro, mango madera, wrap cuero
  1: [
    '________________________________',
    '________________________________',
    '______KK____________KK__________',
    '_____KGGK__________KGGK_________',
    '____KGGgGK________KGgGK_________',
    '___KGGggGGK______KGGggGK________',
    '___KGggggGGKKKKKGGggggGK________',
    '____KGGggGGGGGGGGGggGGK_________',
    '_____KGGGGWWGGWWGGGGK___________',
    '______KKKKKGGGGKKKK_____________',
    '___________KGKG_________________',
    '___________KoOoK________________',
    '____________KoOK________________',
    '____________KOoK________________',
    '_____________KoK________________',
    '_____________KoK________________',
    '_____________KOK________________',
    '_____________KoK________________',
    '_____________KOK________________',
    '_____________KoK________________',
    '____________KOoOK_______________',
    '____________KooooK______________',
    '_____________KKKK_______________',
    '________________________________',
    '________KK____KK________________',
    '_______KggK__KggK_______________',
    '______KggggKKggggK______________',
    '_____KGggggggggggGK_____________',
    '_____KGGGGKKKKGGGGK_____________',
    '______KKKK____KKKK______________',
    '________________________________',
    '________________________________',
    '________________________________',
    '________________________________',
    '________________________________',
    '________________________________',
  ],
  // 2 Novata — gema verde cuadrada + wrap verde
  2: [
    '________________________________',
    '__________n__N__n_______________',
    '______KK__n_NN_n__KK____________',
    '_____KGGK__NN__KGGK_____________',
    '____KGGgGK____KGgGK_____________',
    '___KGGggGGK__KGGggGK____________',
    '___KGgggGGGKKGGGgggGK___________',
    '____KGgGGKNNNKGGgGK_____________',
    '_____KGGGGNnNGGGGK______________',
    '______KKKKKNKKKKK_______________',
    '___________KGKG_________________',
    '___________KnNnK________________',
    '____________KnNK________________',
    '____________KNnK________________',
    '_____________KnK________________',
    '_____________KnK________________',
    '_____________KNK________________',
    '_____________KnK________________',
    '_____________KNK________________',
    '_____________KnK________________',
    '____________KNnNK_______________',
    '____________KnnnnK______________',
    '_____________KKKK_______________',
    '__________n_____________________',
    '________KK_n_N_KK_______________',
    '_______KggKnNKggK_______________',
    '______KggggNNggggK______________',
    '_____KGggggNNggggGK_____________',
    '_____KGGGGKKKKGGGGK_____________',
    '______KKKK____KKKK______________',
    '________________________________',
    '________________________________',
    '________________________________',
    '________________________________',
    '________________________________',
    '________________________________',
  ],
  // 3 Avanzada — acero azul + gema cyan + aura
  3: [
    '________________________________',
    '_________u__U__u________________',
    '______KK_u_UU_u_KK______________',
    '_____KUGK__UU__KUGK_____________',
    '____KUUuUK____KUuUK_____________',
    '___KUUuuUUK__KUUuuUK____________',
    '___KUuuuUUUKKUUuuuUK____________',
    '____KUuUUKUUKUUuUK______________',
    '_____KUUUUuUuUUUUK______________',
    '______KKKKKUUKKKK_______________',
    '___________KUKU_________________',
    '___________KbUbK________________',
    '____________KbUK________________',
    '____________KUbK________________',
    '_____________KbK________________',
    '_____________KbK________________',
    '_____________KUK________________',
    '_____________KbK________________',
    '_____________KUK________________',
    '_____________KbK________________',
    '____________KUbUK_______________',
    '____________KbbbbK______________',
    '_____________KKKK_______________',
    '________u___U___u_______________',
    '_______KK_u_U_u_KK______________',
    '______KugKuUuUKugK______________',
    '_____KugguuUUuugguK_____________',
    '____KUugguuUUuugguUK____________',
    '____KUUUUUKKKKUUUUUK____________',
    '_____KKKKK____KKKKK_____________',
    '________________________________',
    '________________________________',
    '________________________________',
    '________________________________',
    '________________________________',
    '________________________________',
  ],
  // 4 Experta — oro + gema púrpura + wrap púrpura
  4: [
    '________________________________',
    '_________p__P__p________________',
    '______KK_p_PP_p_KK______________',
    '_____KYGK__PP__KYGK_____________',
    '____KYYyYK____KYyYK_____________',
    '___KYYyyYYK__KYYyyYK____________',
    '___KYyyyYYYKKYYYyyyYK___________',
    '____KYyYYKPPKYYyYK______________',
    '_____KYYYYPpPYYYYK______________',
    '______KKKKKPKKKKK_______________',
    '___________KYKY_________________',
    '___________KpYpK________________',
    '____________KpYK________________',
    '____________KYpK________________',
    '_____________KpK________________',
    '_____________KpK________________',
    '_____________KYK________________',
    '_____________KpK________________',
    '_____________KYK________________',
    '_____________KpK________________',
    '____________KYpYK_______________',
    '____________KppppK______________',
    '_____________KKKK_______________',
    '________p___P___p_______________',
    '_______KK_p_P_p_KK______________',
    '______KygKpPpPKygK______________',
    '_____KygggpPPpgggyK_____________',
    '____KYygggpPPpgggyYK____________',
    '____KYYYYYKKKKYYYYYK____________',
    '_____KKKKK____KKKKK_____________',
    '________________________________',
    '________________________________',
    '________________________________',
    '________________________________',
    '________________________________',
    '________________________________',
  ],
  // 5 Élite — cristales cyan + filigrana oro
  5: [
    '________________________________',
    '________y__Y__y_________________',
    '_____KK_y_YY_y_KK_______________',
    '____KUKK_YYYY_KKUK______________',
    '___KUUuUKYYYYKUUuUK_____________',
    '__KUUuuUUYYYYUUuuUUK____________',
    '__KUuuuUYYYYYYUuuuUK____________',
    '___KUuUYKUUKYUuUK_______________',
    '____KUYYYUuUuYYYUK______________',
    '_____KKYYYUUUYYYKK______________',
    '_______KKKYUYKKK________________',
    '__________KyUyK_________________',
    '__________KyYyK_________________',
    '___________KyYK_________________',
    '___________KyYK_________________',
    '____________KyK_________________',
    '____________KyK_________________',
    '____________KYK_________________',
    '____________KyK_________________',
    '____________KYK_________________',
    '___________KyYyK________________',
    '__________KyyyyyK_______________',
    '___________KKKKK________________',
    '_______y__YUY__y________________',
    '______KK_yUYUy_KK_______________',
    '_____KugKyUYUyKugK______________',
    '____KugguYYYYYugguK_____________',
    '___KYugguYYYYYugguYK____________',
    '___KYYYYYKKKKKYYYYYK____________',
    '____KKKKK_____KKKKK_____________',
    '________________________________',
    '________________________________',
    '________________________________',
    '________________________________',
    '________________________________',
    '________________________________',
  ],
  // 6 Legendaria — cristales magenta + oro + chispas
  6: [
    '________________________________',
    '____F___X_F_X___F_______________',
    '__KPK_p_PPPP_p_KPK______________',
    '_KPFPK_PPPPPP_KPFPK_____________',
    'KPFFPPKYYYYYYKPPFFPK____________',
    'KPFPPKYyyyyyyYKPPFPK____________',
    '_KPPKYyyFFFFFFyyKPPK____________',
    '__KPKYyKFFFFFKyYPK______________',
    '___KKYYYFFFFFYYYKK______________',
    '____KKYYFYYFYYKK________________',
    '______KKKYFYKKK_________________',
    '_________KyFyK__________________',
    '_________KyYyK__________________',
    '__________KyYK__________________',
    '__________KyYK__________________',
    '___________KyK__________________',
    '___________KyK__________________',
    '___________KYK__________________',
    '___________KyK__________________',
    '___________KYK__________________',
    '__________KyYyK_________________',
    '_________KyyyyyK________________',
    '__________KKKKK_________________',
    '____F_X_F_Y_F_X_F_______________',
    '___KK_X_FYFYF_X_KK______________',
    '__KpgKXFYYYYYFXKgpK_____________',
    '_KpgggXFYYYYYFXFggpK____________',
    'KXpgggXFYYYYYFXFggpXK___________',
    'KXPPPPPKKKKKKKPPPPPXK___________',
    '_KKKKKK_______KKKKKK____________',
    '________________________________',
    '________________________________',
    '________________________________',
    '________________________________',
    '________________________________',
    '________________________________',
  ],
}

export function axePixelUrl(axeId: number, scale = 4): string {
  const a = Math.min(6, Math.max(1, Math.floor(axeId)))
  return renderPixelMap(AXE_MAPS[a] ?? AXE_MAPS[1], scale, `axe-dig-${a}@${scale}-v3`)
}

/** Pico en mano — cabeza Dig legible a ~32px */
const HELD_PICKS: Record<number, string[]> = {
  1: [
    '_KK____KK_',
    'KGGK__KGGK',
    'KGgKKKKGgK',
    'KGggGGggGK',
    '_KGGWWGGK_',
    '__KKKoKK__',
    '____KoK___',
    '____KoK___',
    '____KOK___',
    '____KoK___',
    '___KOoOK__',
    '____KKKK__',
  ],
  2: [
    '_KK____KK_',
    'KGGK__KGGK',
    'KGgKNKKGgK',
    'KGgNnNggGK',
    '_KGGNNGGK_',
    '__KKKnKK__',
    '____KnK___',
    '____KnK___',
    '____KNK___',
    '____KnK___',
    '___KNnNK__',
    '____KKKK__',
  ],
  3: [
    '_KK____KK_',
    'KUGK__KGUK',
    'KUuKUKUuUK',
    'KUuuUUuuUK',
    '_KUUUUUUK_',
    '__KKKbKK__',
    '____KbK___',
    '____KbK___',
    '____KUK___',
    '____KbK___',
    '___KUbUK__',
    '____KKKK__',
  ],
  4: [
    '_KK____KK_',
    'KYGK__KGYK',
    'KYyKPKYyYK',
    'KYyPpPyyYK',
    '_KYYPPYYK_',
    '__KKKpKK__',
    '____KpK___',
    '____KpK___',
    '____KYK___',
    '____KpK___',
    '___KYpYK__',
    '____KKKK__',
  ],
  5: [
    'KK______KK',
    'KUYK__KYUK',
    'KUuYYYYUuK',
    'KUYYYYYYUK',
    '_KUYUYUYK_',
    '__KKyYKK__',
    '____KyK___',
    '____KyK___',
    '____KYK___',
    '____KyK___',
    '___KYyYK__',
    '____KKKK__',
  ],
  6: [
    'K_K____K_K',
    'KPFK__KFPK',
    'KPYYYYYYPK',
    'KPFYYYYFPK',
    '_KPYFYPYK_',
    '__KKyYKK__',
    '____KyK___',
    '____KyK___',
    '____KYK___',
    '____KyK___',
    '___KYyYK__',
    '____KKKK__',
  ],
}

export function heldPickPixelUrl(axeId: number, scale = 3): string {
  const a = Math.min(6, Math.max(1, Math.floor(axeId)))
  return renderPixelMap(HELD_PICKS[a] ?? HELD_PICKS[1], scale, `held-pick-${a}@${scale}-v4`)
}
