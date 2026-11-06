# Minas Crypto · DEMO

Idle mining freemium (estilo GoArbit) para **Andres Medina**.

- Token DEMO: `MINE` — sin crypto real ni wallets
- Economía: Project store `docs/economia-mvp.md`
- Persistencia: `localStorage` (`minas-crypto-mvp-v2`)
- UI: español, mobile-first

## Correr

```bash
cd minas-crypto
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Abrir: http://127.0.0.1:5173

Build producción:

```bash
npm run build
```

## Publicar

Ver [PUBLISH.md](./PUBLISH.md). Requiere `git remote` + push; este entorno cloud no tiene `origin`/GitHub auth todavía.

## MVP

- Mina animada + hash rate + Claim con barra de progreso / hints
- Wallet strip sticky + badge DEMO claro
- Upgrades Pickaxe / Rig / Power
- Ads e IAP simulados
- Retiro DEMO → Demo Vault + historial
