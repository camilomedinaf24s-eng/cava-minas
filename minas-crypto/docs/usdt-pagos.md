# Pagos USDT — CAVA Idle Mine (NOWPayments on grok.bot)

**Stack:** Next.js 15 App Router (required so `app/api/**/route.ts` runs on publish-app).  
**Alcance:** cobros USDT TRC20 por ⚡ / cajas. **No** retiros BTC.

## Host paths (cava.apps.grok.bot)

| Method | URL |
|--------|-----|
| GET | `https://cava.apps.grok.bot/api/payments/usdt/config` |
| POST | `https://cava.apps.grok.bot/api/payments/usdt/create` |
| GET | `https://cava.apps.grok.bot/api/payments/usdt/status?id=` |
| POST | `https://cava.apps.grok.bot/api/payments/usdt/ipn` |
| POST | `https://cava.apps.grok.bot/api/payments/usdt/redeem` |
| GET | `https://cava.apps.grok.bot/api/me/operator` |

IPN callback in NOWPayments dashboard:

```
https://cava.apps.grok.bot/api/payments/usdt/ipn
```

## Secrets (bind — never paste values)

- `NOWPAYMENTS_API_KEY`
- `NOWPAYMENTS_IPN_SECRET`
- Optional: `NOWPAYMENTS_IPN_URL` (defaults to `{origin}/api/payments/usdt/ipn`)

## LIVE vs DEMO

1. After publish, signed-in browser: `GET /api/payments/usdt/config` must return **JSON** `{ "ready": true }`.
2. If response is HTML → routes not mounted (old Vite build) → DEMO.
3. When `ready`, shop shows **USDT LIVE**; Pagar creates a real NP invoice (address / checkout).
4. Create failure → error, **no** “Ya pagué” grant.
5. DEMO “Ya pagué” only when `ready:false` (no keys / no routes).
6. `demo_*` status is **never** `paid` while keys are live.
7. Server assigns `cava_*` orderId; binds catalog product+amount; status/IPN require match; client redeems HMAC `grantToken`.
8. Operator gifts: only Andres Medina via Cursor identity (`GET /api/me/operator`).

Optional bake: `NEXT_PUBLIC_PAYMENTS_MODE=nowpayments` (auto-LIVE still follows `config.ready`).

## Precios

| Producto | USDT |
|----------|------|
| ⚡ Básico / Medio / Grande | 9.99 / 14.99 / 19.99 |
| Caja común / rara / legendaria | 9.99 / 14.99 / 24.99 |

Floors ≥ NOWPayments USDT network min (~$9 TRC20). Create queries `/min-amount` and may bump further.

## Local

```bash
cd minas-crypto
npm install
NOWPAYMENTS_API_KEY=… NOWPAYMENTS_IPN_SECRET=… npm run dev
# or: npm run build && NOWPAYMENTS_API_KEY=… npm run start
curl -s localhost:5173/api/payments/usdt/config
```
