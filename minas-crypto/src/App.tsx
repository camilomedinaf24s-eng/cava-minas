import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  AD_REWARDS,
  AD_SIM_DURATION_MS,
  BRAND,
  BRAND_SUB,
  CLAIM_MIN_AMOUNT,
  CLAIM_MIN_MINUTES,
  IAP_PACKS,
  PLAYER,
  TOKEN,
  UPGRADES,
  formatDuration,
  formatMine,
  formatUsd,
  upgradeCost,
  type AdRewardId,
  type IapSku,
} from './game/economy'
import { AXES } from './game/axes'
import {
  BOXES,
  RARITY_COLOR,
  RARITY_LABEL,
  displayAttrs,
  getRank,
  minerHashRate,
  skillName,
  upgradeMinerCost,
  RANKS,
  type BoxId,
  type Miner,
} from './game/miners'
import { AxeSprite } from './components/AxeSprite'
import { MineScene } from './components/MineScene'
import { MinerSprite } from './components/MinerSprite'
import {
  isMusicOn,
  loadMutePref,
  setMuted,
  startMusic,
  stopMusic,
  toggleMusic,
} from './game/audio'
import { ENERGY_PACKS, type EnergyPack, type EnergyPackId } from './game/energy'
import { BLOCK_META, LAYER_META, MAX_MINERS } from './game/mineField'
import { yourRank, weeklyBoard } from './game/ranking'
import { SEASON, SEASON_TRACK, SKINS, type SkinId } from './game/season'
import { STRIPE_PRODUCTS, type StripeProductId } from './game/stripeMock'
import { OPERATOR_GIFTS, isOperatorSession } from './game/gifts'
import { createUsdtPayment, isPaymentsDemo, readPaymentsMode } from './game/paymentsApi'
import {
  createUsdtInvoice,
  formatUsdt,
  type UsdtInvoice,
} from './game/usdtPay'
import { useGame } from './game/useGame'
import './index.css'

function EnergyPacksShop({
  onBuyUsd,
  onBuyUsdt,
}: {
  onBuyUsd: (id: EnergyPack['id']) => void
  onBuyUsdt: (id: EnergyPack['id']) => void
}) {
  return (
    <div className="energy-shop energy-packs" id="energy-shop">
      {ENERGY_PACKS.map((pack) => (
        <div key={pack.id} className={`energy-card tier-${pack.tier}`} data-pack={pack.id}>
          <div className="energy-bolt" aria-hidden data-bolts={pack.bolts}>
            <span className="bolt-icon">⚡</span>
            {pack.bolts > 1 && <span className="bolt-count">×{pack.bolts}</span>}
          </div>
          <div>
            <h3>
              ⚡ Pack {pack.name}{' '}
              <span className="price-usd">{formatUsd(pack.priceUsd)}</span>
            </h3>
            <p>{pack.blurb}</p>
            <div className="energy-meta">
              <span>Cap {pack.maxEnergy}</span>
              <span>{pack.bolts}× rayo</span>
              <span className="soft-alt">{pack.priceMine} {TOKEN}</span>
            </div>
            <div className="pay-row">
              <button type="button" className="btn btn-ghost btn-wide" onClick={() => onBuyUsd(pack.id)}>
                DEMO {formatUsd(pack.priceUsd)}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-wide btn-usdt"
                onClick={() => onBuyUsdt(pack.id)}
              >
                Pagar USDT {formatUsdt(pack.priceUsd)}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

type Nav = 'mine' | 'shop' | 'miners' | 'axes' | 'boosts' | 'refs' | 'rank' | 'pass' | 'pay'
type Modal =
  | { type: 'ad'; adId: AdRewardId }
  | { type: 'iap'; sku: IapSku }
  | { type: 'usd'; kind: 'energy'; id: EnergyPackId }
  | { type: 'usd'; kind: 'box'; id: BoxId }
  | { type: 'stripe'; productId: StripeProductId }
  | { type: 'usdt'; invoice: UsdtInvoice }
  | null

export default function App() {
  const g = useGame()
  const [nav, setNav] = useState<Nav>('mine')
  const [modal, setModal] = useState<Modal>(null)
  const [adDone, setAdDone] = useState(false)
  const [reveal, setReveal] = useState(false)
  const [refCode, setRefCode] = useState('')
  const [mute, setMute] = useState(() => loadMutePref())
  const [music, setMusic] = useState(false)
  const [usdtBusy, setUsdtBusy] = useState(false)
  const [giftOpen, setGiftOpen] = useState(false)
  const [giftOpened, setGiftOpened] = useState(false)

  useEffect(() => {
    if (!g.operatorGiftsClaimed && isOperatorSession()) {
      const id = window.setTimeout(() => setGiftOpen(true), 600)
      return () => window.clearTimeout(id)
    }
  }, [g.operatorGiftsClaimed])

  const openUsdtEnergy = (id: EnergyPackId) => {
    const pack = ENERGY_PACKS.find((p) => p.id === id)!
    setModal({
      type: 'usdt',
      invoice: createUsdtInvoice({
        kind: 'energy',
        productId: id,
        label: `⚡ Pack ${pack.name}`,
        amountUsd: pack.priceUsd,
      }),
    })
  }
  const openUsdtBox = (id: BoxId) => {
    const box = BOXES.find((b) => b.id === id)!
    setModal({
      type: 'usdt',
      invoice: createUsdtInvoice({
        kind: 'box',
        productId: id,
        label: box.name,
        amountUsd: box.priceUsd,
      }),
    })
  }

  const confirmUsdtDemo = async () => {
    if (!modal || modal.type !== 'usdt' || usdtBusy) return
    setUsdtBusy(true)
    const inv = modal.invoice
    try {
      await createUsdtPayment({
        productId: inv.productId,
        amountUsdt: inv.amountUsdt,
        orderId: inv.id,
      })
      if (inv.kind === 'energy') g.buyEnergy(inv.productId as EnergyPackId, 'usd')
      else if (inv.kind === 'box') {
        g.buyBox(inv.productId as BoxId, 'usd')
        setNav('shop')
      }
      setModal(null)
    } finally {
      setUsdtBusy(false)
    }
  }
  const board = useMemo(
    () => weeklyBoard(g.weekMined || g.minedTotal, g.crew.length, PLAYER),
    [g.weekMined, g.minedTotal, g.crew.length],
  )
  const myRank = yourRank(board)

  useEffect(() => {
    if (modal?.type !== 'ad') {
      setAdDone(false)
      return
    }
    setAdDone(false)
    const id = window.setTimeout(() => setAdDone(true), AD_SIM_DURATION_MS)
    return () => window.clearTimeout(id)
  }, [modal])

  useEffect(() => {
    if (!g.opening) {
      setReveal(false)
      return
    }
    setReveal(false)
    const id = window.setTimeout(() => setReveal(true), 1500)
    return () => window.clearTimeout(id)
  }, [g.opening])

  const minByTime = g.ratePerHour * (CLAIM_MIN_MINUTES / 60)
  const claimProgress = useMemo(() => {
    const a = g.pending / CLAIM_MIN_AMOUNT
    const b = minByTime > 0 ? g.pending / minByTime : 0
    return Math.min(1, Math.max(a, b, 0))
  }, [g.pending, minByTime])

  const claimHint = useMemo(() => {
    if (g.claimCooldownLeft > 0) return `Cooldown ${formatDuration(g.claimCooldownLeft)}`
    if (g.canClaim) return `Listo: cobra ${formatMine(g.pending, 2)} ${TOKEN}`
    const need5 = Math.max(0, CLAIM_MIN_AMOUNT - g.pending)
    const need10 = Math.max(0, minByTime - g.pending)
    const closer = need5 <= need10 ? need5 : need10
    return `Faltan ${formatMine(closer, 2)} ${TOKEN}`
  }, [g, minByTime])

  const showDualRail = nav === 'mine' || nav === 'shop' || nav === 'miners'
  const showAxesRail = nav === 'axes'
  const showFeatureRail = nav === 'refs' || nav === 'rank' || nav === 'pass' || nav === 'pay' || nav === 'boosts'

  return (
    <div className="desk">
      <div className="demo-banner" role="status">
        <span className="dot" />
        <span className="demo-badge">DEMO</span>
        <em>
          Sin crypto real · sin NFT on-chain · sin wallets · retiros ficticios · marca CAVA
          {isPaymentsDemo() ? ' · USDT DEMO' : ` · pagos ${readPaymentsMode()}`}
        </em>
      </div>

      <div className="desk-body">
        <aside className="sidebar">
          <div className="brand-block">
            <div className="logo">{BRAND}</div>
            <div className="demo-pill brand-demo">DEMO</div>
            <div className="sub">{BRAND_SUB}</div>
            <div className="player">
              Operador
              <strong>{PLAYER}</strong>
            </div>
            {!g.operatorGiftsClaimed && isOperatorSession() && (
              <button type="button" className="gift-chip" onClick={() => setGiftOpen(true)}>
                2 cajas REGALO
              </button>
            )}
          </div>

          <nav className="side-nav">
            {(
              [
                ['mine', 'Mina'],
                ['shop', 'Box Shop'],
                ['miners', 'Mis mineros'],
                ['axes', 'Hachas'],
                ['refs', 'Referidos'],
                ['rank', 'Ranking'],
                ['pass', 'Pase'],
                ['boosts', 'Audio'],
                ['pay', 'USDT'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" className={nav === id ? 'on' : ''} onClick={() => setNav(id)}>
                {label}
              </button>
            ))}
          </nav>

          <div className="side-stats">
            <div className="stat">
              <span>Wallet</span>
              <strong>
                {formatMine(g.balance)} {TOKEN}
              </strong>
            </div>
            <div className="stat">
              <span>Hash rate</span>
              <strong>
                {formatMine(g.ratePerHour, 1)}/h
              </strong>
            </div>
            <div className="stat">
              <span>Hacha</span>
              <strong style={{ color: g.equippedAxe.color, fontSize: 10 }}>
                {g.equippedAxe.name.replace('Hacha ', '')}
              </strong>
            </div>
          </div>
        </aside>

        <section className="stage">
          <div className="stage-top">
            <div>
              <h1>Mapa de minas</h1>
              <div className="hint">
                {g.crew.length
                  ? `${g.crew.length}/${MAX_MINERS} mineros · energía baja al picar · ${g.equippedAxe.name}`
                  : 'Sin mineros — abre una caja con MINE'}
              </div>
            </div>
            <div className="stage-top-stats">
              <div className="hint" id="crew-energy-hint">
                ⚡{' '}
                <strong style={{ color: g.crew.some((m) => (m.energy ?? 0) <= 0) ? 'var(--ember)' : '#4ad2ff' }}>
                  {g.crew.length
                    ? `${Math.round(g.crew.reduce((s, m) => s + (m.energy ?? 0), 0) / g.crew.length)}%`
                    : '—'}
                </strong>{' '}
                media
              </div>
              <button
                type="button"
                className="btn btn-primary btn-energy-buy"
                id="energy-buy-stage"
                disabled={g.crew.length === 0}
                onClick={() => setModal({ type: 'usd', kind: 'energy', id: 'basic' })}
                title={g.energyItem.blurb}
              >
                ⚡ Básico · {formatUsd(g.energyItem.priceUsd)}
              </button>
              <div className="hint">
                Minado: <strong style={{ color: 'var(--amber)' }}>{formatMine(g.minedTotal, 1)}</strong> {TOKEN}
              </div>
              {g.boost && g.boostLeftMs > 0 && (
                <div className="hint" style={{ color: 'var(--ember)' }}>
                  {g.boost.source} · {formatDuration(g.boostLeftMs)}
                </div>
              )}
            </div>
          </div>

          {nav === 'miners' ? (
            <div className="dig-showcase" id="ranks-gallery">
              {RANKS.map((r) => (
                <div
                  className="g-item px-card dig-rank-card"
                  key={r.rank}
                  style={{ background: r.cardBg, borderColor: r.color }}
                >
                  <span className="dig-badge">NIVEL {r.rank}</span>
                  <MinerSprite
                    miner={{ level: r.rank, rarity: 'common', name: r.name }}
                    size="card"
                    hideCaption
                    axeId={Math.min(6, r.rank)}
                  />
                  <div className="px-card-meta">
                    <div className="px-title">{r.name.toUpperCase()}</div>
                    <div className="px-rarity" style={{ color: r.color, borderColor: r.color }}>
                      {r.rarity}
                    </div>
                    <div className="dig-attrs px-attrs">
                      <div className="attr">
                        <b>{r.attrs.fuerza}</b>
                        <span>Fuerza</span>
                      </div>
                      <div className="attr">
                        <b>{r.attrs.resistencia}</b>
                        <span>Resist.</span>
                      </div>
                      <div className="attr">
                        <b>{r.attrs.productividad}</b>
                        <span>Product.</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : nav === 'axes' ? (
            <div className="dig-showcase axes-showcase" id="axes-gallery">
              {AXES.map((a) => (
                <div
                  key={a.id}
                  className="g-item px-card dig-axe-show"
                  style={
                    {
                      background: a.cardBg,
                      borderColor: a.color,
                      '--axe-glow': a.color,
                    } as CSSProperties
                  }
                >
                  <div className="axe-frame-gem" style={{ background: a.color }} />
                  <div className="px-title">{a.name.toUpperCase()}</div>
                  <div className="px-rarity dig-pill" style={{ background: a.color, color: '#0a0c0e', borderColor: '#000' }}>
                    {a.rarity}
                  </div>
                  <div className="axe-art-wrap dig-axe-stage">
                    <AxeSprite axeId={a.id} size="lg" />
                  </div>
                  <div className="dig-attrs axe-attrs dig-axe-stats">
                    <div className="attr">
                      <i className="ic ic-poder" aria-hidden />
                      <b>{a.poder}</b>
                      <span>Poder</span>
                    </div>
                    <div className="attr">
                      <i className="ic ic-vel" aria-hidden />
                      <b>{a.velocidad.toFixed(1)}x</b>
                      <span>Velocidad</span>
                    </div>
                    <div className="attr">
                      <i className="ic ic-ext" aria-hidden />
                      <b>{a.extraccion}x</b>
                      <span>Extracción</span>
                    </div>
                    <div className="attr">
                      <i className="ic ic-dur" aria-hidden />
                      <b>{a.durabilidad}</b>
                      <span>Durabilidad</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            nav === 'refs' || nav === 'rank' || nav === 'pass' || nav === 'pay' ? (
              <div className="feature-stage" id={`stage-${nav}`}>
                {nav === 'refs' && (
                  <div className="feature-card" id="referral-panel">
                    <h2>Referidos DEMO</h2>
                    <p>Invita amigos → {150} MINE + caja común. Marca CAVA.</p>
                    <div className="ref-code-box">
                      Tu código <strong id="ref-code">{g.referral?.code ?? '—'}</strong>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => void navigator.clipboard?.writeText(g.referral?.code ?? '')}
                      >
                        Copiar
                      </button>
                    </div>
                    <p>
                      Invitados: <strong>{g.referral?.invited ?? 0}</strong>
                    </p>
                    <button type="button" className="btn btn-primary" onClick={() => g.simulateInvite()}>
                      Simular invitado (+150 MINE)
                    </button>
                    <div className="ref-redeem">
                      <input
                        value={refCode}
                        onChange={(e) => setRefCode(e.target.value)}
                        placeholder="CAVA-XXXX"
                        aria-label="Código referido"
                      />
                      <button type="button" className="btn btn-ember" onClick={() => g.redeemReferral(refCode)}>
                        Canjear código
                      </button>
                    </div>
                  </div>
                )}
                {nav === 'rank' && (
                  <div className="feature-card" id="ranking-panel">
                    <h2>Ranking semanal</h2>
                    <p>
                      Tu puesto: <strong>#{myRank}</strong> · minado semana {formatMine(g.weekMined || 0, 1)} MINE
                    </p>
                    <ol className="rank-list">
                      {board.slice(0, 10).map((e, i) => (
                        <li key={e.id} className={e.you ? 'you' : ''}>
                          <span>#{i + 1}</span>
                          <strong>{e.name}</strong>
                          <em>{e.mined} MINE</em>
                          <i>{e.miners} mineros</i>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {nav === 'pass' && (
                  <div className="feature-card" id="season-panel">
                    <h2>
                      {SEASON.name} <span className="demo-pill">DEMO</span>
                    </h2>
                    <p>
                      XP {g.season?.xp ?? 0} · Tier {g.seasonTier} · {SEASON.daysLeft}d ·{' '}
                      {g.season?.premium ? 'Premium ON' : `Pase $${SEASON.priceUsd}`}
                    </p>
                    {!g.season?.premium && (
                      <button type="button" className="btn btn-primary" onClick={() => g.buySeasonPass()}>
                        Pagar DEMO ${SEASON.priceUsd}
                      </button>
                    )}
                    <div className="season-track">
                      {SEASON_TRACK.map((row) => (
                        <div key={row.tier} className="season-tier">
                          <b>T{row.tier}</b>
                          <span>{row.free.label}</span>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={(g.season?.xp ?? 0) < row.xpNeed || g.season?.claimedFree.includes(row.tier)}
                            onClick={() => g.claimSeasonTier(row.tier, 'free')}
                          >
                            Free
                          </button>
                          <span>{row.premium.label}</span>
                          <button
                            type="button"
                            className="btn btn-ember"
                            disabled={
                              !g.season?.premium ||
                              (g.season?.xp ?? 0) < row.xpNeed ||
                              g.season?.claimedPremium.includes(row.tier)
                            }
                            onClick={() => g.claimSeasonTier(row.tier, 'premium')}
                          >
                            Prem
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="skin-row" id="skins-row">
                      {(Object.keys(SKINS) as SkinId[]).map((id) => {
                        const owned = g.season?.ownedSkins.includes(id)
                        const eq = g.season?.equippedSkin === id
                        return (
                          <button
                            key={id}
                            type="button"
                            className={`skin-chip ${eq ? 'on' : ''} ${owned ? '' : 'locked'}`}
                            style={{ borderColor: SKINS[id].tint }}
                            disabled={!owned}
                            onClick={() => g.equipSkin(id)}
                          >
                            {SKINS[id].name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                {nav === 'pay' && (
                  <div className="feature-card pay-stage" id="stripe-panel">
                    <h2>
                      USDT · NOWPayments <span className="demo-pill">{isPaymentsDemo() ? 'DEMO' : readPaymentsMode()}</span>
                    </h2>
                    <p>
                      Hooks listos · secrets en server · ver <code>docs/usdt-pagos.md</code> +{' '}
                      <code>.env.example</code>. Hasta keys → DEMO.
                    </p>
                    <ul className="pay-keys">
                      <li>
                        <code>VITE_PAYMENTS_MODE</code> = demo | nowpayments
                      </li>
                      <li>
                        <code>NOWPAYMENTS_API_KEY</code> + <code>NOWPAYMENTS_IPN_SECRET</code> (server)
                      </li>
                      <li>
                        Routes: <code>/api/payments/usdt/create</code> · status · ipn
                      </li>
                    </ul>
                    <div className="stripe-grid">
                      {STRIPE_PRODUCTS.map((p) => (
                        <div key={p.id} className="stripe-card" data-stripe={p.id}>
                          <h3>
                            {p.name} <span className="price-usd">${p.priceUsd.toFixed(2)}</span>
                          </h3>
                          <p>{p.blurb}</p>
                          <code>/api/stripe/checkout?price={p.id}</code>
                          <button
                            type="button"
                            className="btn btn-primary btn-wide"
                            onClick={() => setModal({ type: 'stripe', productId: p.id })}
                          >
                            Checkout DEMO
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
            <MineScene
              blocks={g.mineBlocks}
              crew={g.crew}
              agents={g.agents}
              axeId={g.equippedAxe.id}
              boosted={!!g.boost}
              floaters={g.floaters}
              now={g.now}
              skin={g.season?.equippedSkin ?? 'default'}
            />
            )
          )}

          <div className="stage-bottom">
            <div className="claim-box">
              <div className="row">
                <span className="label">Mineral acumulado</span>
                <span className="label">{Math.round(claimProgress * 100)}%</span>
              </div>
              <div className="amt">
                {formatMine(g.pending, 3)} <small>{TOKEN}</small>
              </div>
              <div className="meter">
                <div style={{ width: `${claimProgress * 100}%` }} />
              </div>
              <p className="hint">{claimHint}</p>
              <div className="facility">
                {UPGRADES.map((u) => {
                  const level = g.state.levels[u.id]
                  const maxed = level >= u.maxLevel
                  const cost = maxed ? 0 : upgradeCost(u, level)
                  const ready = !maxed && g.balance >= cost
                  return (
                    <div className="up" key={u.id}>
                      <div>
                        <strong>
                          {u.name} nv.{level}
                        </strong>
                      </div>
                      <button
                        type="button"
                        className={ready ? 'go' : ''}
                        disabled={maxed || !ready}
                        onClick={() => g.buyUpgrade(u.id)}
                      >
                        {maxed ? 'MAX' : `${formatMine(cost, 0)} ${TOKEN}`}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="claim-actions">
              <button
                type="button"
                className={`btn btn-primary ${g.canClaim ? 'ready' : ''}`}
                disabled={!g.canClaim}
                onClick={g.claim}
              >
                {g.canClaim
                  ? 'Cobrar a wallet'
                  : g.claimCooldownLeft > 0
                    ? `Espera ${formatDuration(g.claimCooldownLeft)}`
                    : 'Claim bloqueado'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={g.withdrawDemo}>
                Retiro DEMO
              </button>
              <button type="button" className="btn btn-ghost" onClick={g.resetDemo}>
                Reiniciar DEMO
              </button>
            </div>
          </div>
        </section>

        <aside className={`rail ${showDualRail ? '' : 'single'}`}>
          {showAxesRail && (
            <div className="rail-panel" id="axes-panel">
              <h2>
                Armería · Hachas <span>Dig DEMO</span>
              </h2>
              <p className="empty" style={{ marginBottom: 10 }}>
                Equipar multiplica rate: vel × extracción × (1+poder/250). Se ve en el pico del minero.
              </p>
              <div className="axes-gallery pixel-gallery" id="axes-thumbs">
                {AXES.map((a) => (
                  <div key={a.id} className="axe-thumb px-card" style={{ borderColor: a.color, background: a.cardBg }}>
                    <AxeSprite axeId={a.id} size="sm" />
                    <span className="px-name" style={{ color: a.color }}>
                      N{a.id}
                    </span>
                  </div>
                ))}
              </div>
              <div className="axe-list">
                {AXES.map((a) => {
                  const owned = g.ownedAxes.includes(a.id)
                  const eq = g.equippedAxe.id === a.id
                  return (
                    <div
                      key={a.id}
                      className={`axe-card dig-axe-card px-card ${eq ? 'is-equipped' : ''}`}
                      style={{ borderColor: a.color, background: a.cardBg }}
                    >
                      <div className="axe-art-wrap">
                        <AxeSprite axeId={a.id} size="lg" />
                      </div>
                      <div>
                        <h3>{a.name.toUpperCase()}</h3>
                        <span className="dig-rarity px-rarity" style={{ color: a.color, borderColor: a.color }}>
                          {a.rarity}
                        </span>
                        <div className="dig-attrs axe-attrs">
                          <div className="attr">
                            <b>{a.poder}</b>
                            <span>Poder</span>
                          </div>
                          <div className="attr">
                            <b>{a.velocidad.toFixed(1)}x</b>
                            <span>Veloc.</span>
                          </div>
                          <div className="attr">
                            <b>{a.extraccion}x</b>
                            <span>Extrac.</span>
                          </div>
                          <div className="attr">
                            <b>{a.durabilidad}</b>
                            <span>Durab.</span>
                          </div>
                        </div>
                        <div className="dig-rate">{a.look}</div>
                        <div className="actions">
                          {owned ? (
                            <button
                              type="button"
                              className="btn btn-primary btn-wide"
                              disabled={eq}
                              onClick={() => g.equipAxe(a.id)}
                            >
                              {eq ? 'Equipada' : 'Equipar'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-ember btn-wide"
                              disabled={g.balance < a.priceMine}
                              onClick={() => g.buyAxe(a.id)}
                            >
                              Comprar {a.priceMine} {TOKEN}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {showDualRail && (
            <>
              <div className="rail-panel" id="energy-shop-rail">
                <h2>
                  Energía <span>⚡ USD DEMO</span>
                </h2>
                <EnergyPacksShop
                  onBuyUsd={(id) => setModal({ type: 'usd', kind: 'energy', id })}
                  onBuyUsdt={openUsdtEnergy}
                />
              </div>
              <div className="rail-panel" id="box-shop">
                <h2>
                  Box Shop <span>USDT · probs Dig</span>
                </h2>
                <div className="box-list" id="box-shop-list">
                  {BOXES.map((box) => (
                    <div className={`box-card ${box.id}`} key={box.id} data-box={box.id}>
                      <div className="crate" />
                      <div>
                        <h3>
                          {box.name} <span className="price-usd">{formatUsd(box.priceUsd)}</span>
                        </h3>
                        <p>{box.blurb}</p>
                        <div className="odds">
                          {box.weights
                            .filter((w) => w.w > 0)
                            .map((w) => (
                              <i key={w.rarity} style={{ color: RARITY_COLOR[w.rarity] }}>
                                {RARITY_LABEL[w.rarity]} {w.w}%
                              </i>
                            ))}
                        </div>
                        <div className="pay-row">
                          <button
                            type="button"
                            className="btn btn-ghost btn-wide"
                            disabled={g.miners.length >= MAX_MINERS}
                            onClick={() => setModal({ type: 'usd', kind: 'box', id: box.id as BoxId })}
                          >
                            {g.miners.length >= MAX_MINERS ? `Máx ${MAX_MINERS}` : `DEMO ${formatUsd(box.priceUsd)}`}
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-wide btn-usdt"
                            disabled={g.miners.length >= MAX_MINERS}
                            onClick={() => openUsdtBox(box.id as BoxId)}
                          >
                            {g.miners.length >= MAX_MINERS
                              ? `Máx ${MAX_MINERS}`
                              : `Pagar USDT ${formatUsdt(box.priceUsd)}`}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rail-panel" id="miners-panel">
                <h2>
                  Mis mineros{' '}
                  <span>
                    {g.miners.length}/{MAX_MINERS} · activos {g.crew.length}
                  </span>
                </h2>
                <p className="empty" style={{ marginBottom: 8 }}>
                  Máx {MAX_MINERS}. Despliega a la mina; con MINE compra cajas.
                </p>
                <div className="miner-list" id="miners-ten-list">
                  {g.miners.map((m) => (
                    <MinerRow
                      key={m.id}
                      miner={m}
                      active={g.miner?.id === m.id}
                      deployed={g.deployedMinerIds.includes(m.id)}
                      balance={g.balance}
                      axeId={g.equippedAxe.id}
                      onToggleDeploy={() => g.toggleDeploy(m.id)}
                      onUpgrade={() => g.upgradeMiner(m.id)}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {showFeatureRail && (
            <div className="rail-panel" id="boosts-energy-panel">
              <h2>
                Audio & shop <span>CAVA DEMO</span>
              </h2>
              <div className="audio-panel" id="audio-panel">
                <h3>🔊 Sonido mina</h3>
                <p>Hits al picar · break · loop suave.</p>
                <div className="audio-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      const next = !mute
                      setMuted(next)
                      setMute(next)
                      if (next) {
                        stopMusic()
                        setMusic(false)
                      }
                    }}
                  >
                    {mute ? 'Unmute' : 'Mute'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ember"
                    disabled={mute}
                    onClick={() => {
                      const on = toggleMusic()
                      setMusic(on)
                      if (on) startMusic()
                    }}
                  >
                    {music || isMusicOn() ? 'Stop música' : 'Play música'}
                  </button>
                </div>
              </div>
              <div className="layer-legend" id="layer-legend">
                <h3>Capas Dig</h3>
                {Object.entries(LAYER_META).map(([id, meta]) => (
                  <div key={id}>
                    <b>{meta.label}</b> · filas {meta.rows.join('-')}
                  </div>
                ))}
                <p className="empty">Raros: {Object.values(BLOCK_META).filter((b) => b.rare).map((b) => b.label).join(', ')}</p>
              </div>
              <EnergyPacksShop
                onBuyUsd={(id) => setModal({ type: 'usd', kind: 'energy', id })}
                onBuyUsdt={openUsdtEnergy}
              />
              <div className="boost-grid" id="iap-shop">
                {AD_REWARDS.map((ad) => {
                  const used = g.state.daily.adsByType[ad.id] ?? 0
                  return (
                    <div className="boost-card" key={ad.id}>
                      <h3>
                        {ad.name} ({used}/{ad.dailyLimit})
                      </h3>
                      <p>{ad.blurb}</p>
                      <button
                        type="button"
                        className="btn btn-ember btn-wide"
                        disabled={used >= ad.dailyLimit || g.adCooldownLeft > 0}
                        onClick={() => setModal({ type: 'ad', adId: ad.id })}
                      >
                        Ver anuncio simulado
                      </button>
                    </div>
                  )
                })}
                {IAP_PACKS.map((pack) => (
                  <div className={`boost-card ${pack.id === 'starter' ? 'starter-card' : ''}`} key={pack.id} data-iap={pack.id}>
                    <h3>
                      {pack.name} <span className="price-usd">{pack.price}</span>
                    </h3>
                    <p>{pack.blurb}</p>
                    <button
                      type="button"
                      className="btn btn-primary btn-wide"
                      onClick={() => setModal({ type: 'iap', sku: pack.id })}
                    >
                      Pagar DEMO {pack.price}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      <AnimatePresence>
        {g.toast && (
          <motion.div className="toast" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {g.toast}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {giftOpen && !g.operatorGiftsClaimed && (
          <motion.div
            className="modal-backdrop gift-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="modal gift-modal"
              initial={{ scale: 0.88, y: 18 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            >
              <p className="gift-kicker">Operador · {PLAYER}</p>
              <h3>2 cajas REGALO</h3>
              <p className="gift-lead">
                Ambas Minero Mítico · F/R/P 150 + hacha 6 · reclamo único al empezar en vivo
              </p>
              <div className={`gift-row ${giftOpened ? 'opened' : ''}`}>
                {OPERATOR_GIFTS.map((gf, i) => (
                  <motion.div
                    key={gf.id}
                    className={`gift-box gift-${gf.id}`}
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.12 + i * 0.1 }}
                  >
                    <div className="gift-lid" />
                    <div className="gift-body">
                      <span className="gift-ribbon" />
                      <strong>{gf.title}</strong>
                      <em>{gf.blurb}</em>
                      <small>
                        Rank {gf.minerRank} · Hacha {gf.axeId}
                      </small>
                    </div>
                  </motion.div>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-primary btn-wide gift-claim"
                onClick={() => {
                  setGiftOpened(true)
                  window.setTimeout(() => {
                    g.claimOperatorGifts()
                    setGiftOpen(false)
                    setNav('miners')
                  }, 520)
                }}
              >
                Reclamar regalos (una vez)
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-wide"
                style={{ marginTop: 8 }}
                onClick={() => setGiftOpen(false)}
              >
                Más tarde
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {g.opening && (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.div className="modal" initial={{ scale: 0.92 }} animate={{ scale: 1 }}>
              <h3>Abriendo caja DEMO…</h3>
              <div className={`crate-anim ${reveal ? 'open' : ''}`} />
              {reveal ? (
                <>
                  <MinerSprite miner={g.opening.miner} size="hero" />
                  <p className="reveal-title" style={{ color: getRank(g.opening.miner.level).color }}>
                    {getRank(g.opening.miner.level).rarity}
                  </p>
                  <p className="reveal-name">{getRank(g.opening.miner.level).name}</p>
                  <div className="dig-attrs" style={{ maxWidth: 320, margin: '0 auto 8px' }}>
                    {(['fuerza', 'resistencia', 'productividad'] as const).map((k) => (
                      <div className="attr" key={k}>
                        <b>{displayAttrs(g.opening!.miner)[k]}</b>
                        <span>{k.slice(0, 3).toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="skills-row" style={{ justifyContent: 'center', marginTop: 8 }}>
                    {g.opening.miner.skills.map((s) => (
                      <span key={s}>{skillName(s)}</span>
                    ))}
                  </div>
                  <p style={{ marginTop: 10 }}>
                    {formatMine(minerHashRate(g.opening.miner), 1)} {TOKEN}/h · NIVEL{' '}
                    {g.opening.miner.level}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-wide"
                    style={{ marginTop: 12 }}
                    onClick={() => {
                      g.selectMiner(g.opening!.miner.id)
                      g.dismissOpening()
                      setNav('miners')
                    }}
                  >
                    Equipar y ver mineros
                  </button>
                  <button type="button" className="btn btn-ghost btn-wide" style={{ marginTop: 8 }} onClick={g.dismissOpening}>
                    Seguir
                  </button>
                </>
              ) : (
                <p>Tirando rareza…</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modal && (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setModal(null)}>
            <motion.div className="modal" onClick={(e) => e.stopPropagation()}>
              {modal.type === 'ad' && (
                <>
                  <h3>Anuncio simulado</h3>
                  <p>No hay red publicitaria real.</p>
                  <div className="ad-progress">
                    <div key={modal.adId} />
                  </div>
                  <button
                    type="button"
                    className="btn btn-ember btn-wide"
                    disabled={!adDone}
                    onClick={() => {
                      g.grantAdReward(modal.adId)
                      setModal(null)
                    }}
                  >
                    {adDone ? 'Reclamar' : 'Viendo…'}
                  </button>
                </>
              )}
              {modal.type === 'iap' && (
                <>
                  <h3>Pago DEMO · {IAP_PACKS.find((p) => p.id === modal.sku)?.price}</h3>
                  <p>{IAP_PACKS.find((p) => p.id === modal.sku)?.blurb}</p>
                  <p className="pay-demo-note">Simulado · sin Stripe / sin cargo real</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        g.buyIap(modal.sku)
                        setModal(null)
                      }}
                    >
                      Confirmar pago
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>
                      Cancelar
                    </button>
                  </div>
                </>
              )}
              {modal.type === 'usd' && (
                <>
                  <h3>
                    Pago DEMO ·{' '}
                    {modal.kind === 'energy'
                      ? formatUsd(ENERGY_PACKS.find((p) => p.id === modal.id)?.priceUsd ?? 0)
                      : formatUsd(BOXES.find((b) => b.id === modal.id)?.priceUsd ?? 0)}
                  </h3>
                  <p>
                    {modal.kind === 'energy'
                      ? `⚡ Pack ${ENERGY_PACKS.find((p) => p.id === modal.id)?.name}`
                      : BOXES.find((b) => b.id === modal.id)?.name}
                  </p>
                  <p className="pay-demo-note">Simulado · sin Stripe / sin cargo real</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      id="confirm-usd-pay"
                      onClick={() => {
                        if (modal.kind === 'energy') g.buyEnergy(modal.id, 'usd')
                        else {
                          g.buyBox(modal.id, 'usd')
                          setNav('shop')
                        }
                        setModal(null)
                      }}
                    >
                      Confirmar pago
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>
                      Cancelar
                    </button>
                  </div>
                </>
              )}
              {modal.type === 'stripe' && (
                <>
                  <h3>Stripe Checkout DEMO</h3>
                  <p>{STRIPE_PRODUCTS.find((p) => p.id === modal.productId)?.name}</p>
                  <p className="pay-demo-note">
                    Ready path:{' '}
                    <code>/api/stripe/checkout?price={modal.productId}</code>
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      id="confirm-stripe-mock"
                      onClick={() => {
                        g.completeStripeMock(modal.productId)
                        setModal(null)
                      }}
                    >
                      Pagar mock
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>
                      Cancelar
                    </button>
                  </div>
                </>
              )}
              {modal.type === 'usdt' && (
                <>
                  <h3 id="usdt-pay-title">Pagar con USDT</h3>
                  <p>
                    {modal.invoice.label} · <strong>{formatUsdt(modal.invoice.amountUsdt)}</strong>
                  </p>
                  <p className="pay-demo-note">
                    DEMO · sin on-chain · sin retiros BTC · ítems de juego solamente
                  </p>
                  <div className="usdt-invoice" id="usdt-invoice">
                    <div>
                      Red <b>{modal.invoice.network}</b>
                    </div>
                    <div className="usdt-addr" title="Dirección mock DEMO">
                      {modal.invoice.address}
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-wide"
                      onClick={() => void navigator.clipboard?.writeText(modal.invoice.address)}
                    >
                      Copiar dirección DEMO
                    </button>
                    <code className="usdt-path">{modal.invoice.gatewayPath}</code>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-usdt"
                      id="confirm-usdt-demo"
                      disabled={usdtBusy}
                      onClick={() => void confirmUsdtDemo()}
                    >
                      {usdtBusy ? 'Confirmando…' : 'Ya pagué · entregar ítem'}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>
                      Cancelar
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MinerRow({
  miner,
  active,
  deployed,
  balance,
  axeId,
  onToggleDeploy,
  onUpgrade,
}: {
  miner: Miner
  active: boolean
  deployed: boolean
  balance: number
  axeId: number
  onToggleDeploy: () => void
  onUpgrade: () => void
}) {
  const rank = getRank(miner.level)
  const attrs = displayAttrs(miner)
  const cost = upgradeMinerCost(miner.level)
  const rarityLabel = miner.operatorGift || miner.rarity === 'super_legendary' ? 'Mítico' : rank.rarity
  return (
    <div
      className={`dig-card ${active ? 'is-active' : ''} ${deployed ? 'is-deployed' : ''}`}
      style={{ borderColor: rank.color, background: rank.cardBg }}
      data-gift={miner.operatorGift ? '1' : undefined}
    >
      <span className="dig-badge">NIVEL {miner.level}</span>
      <MinerSprite
        key={`${miner.id}-rank${miner.level}-axe${axeId}-f${attrs.fuerza}`}
        miner={miner}
        size="card"
        hideCaption
        axeId={axeId}
      />
      <div className="dig-meta">
        <h3>{miner.name}</h3>
        <span className="dig-rarity" style={{ color: rank.color, borderColor: rank.color }}>
          {rarityLabel}
          {deployed ? ' · EN MINA' : ''}
        </span>
        <div className="dig-attrs">
          <div className="attr">
            <b>{attrs.fuerza}</b>
            <span>Fuerza</span>
          </div>
          <div className="attr">
            <b>{attrs.resistencia}</b>
            <span>Resist.</span>
          </div>
          <div className="attr">
            <b>{attrs.productividad}</b>
            <span>Product.</span>
          </div>
        </div>
        <div className="skills-row">
          {miner.skills.map((s) => (
            <span key={s}>{skillName(s)}</span>
          ))}
        </div>
        <div className="dig-rate">
          {formatMine(minerHashRate(miner), 1)} {TOKEN}/h · {rank.look}
        </div>
        <div className="dig-energy">
          <div className="lbl">
            ⚡ {(miner.energy ?? 100) <= 0 ? 'CANSADO' : `${Math.round(miner.energy ?? 100)}/${miner.maxEnergy || 100}`}
          </div>
          <div className="bar">
            <i
              style={{
                width: `${Math.max(0, ((miner.energy ?? 100) / (miner.maxEnergy || 100)) * 100)}%`,
                background: (miner.energy ?? 100) <= 0 ? '#ff4a3a' : undefined,
              }}
            />
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={onToggleDeploy}>
            {deployed ? 'Retirar' : 'Desplegar'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={balance < cost || miner.level >= 6}
            onClick={onUpgrade}
          >
            {miner.level >= 6 ? 'MÁX' : `Subir ${formatMine(cost, 0)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
