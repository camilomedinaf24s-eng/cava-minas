# Publish CAVA on Cursor Apps (grok.bot)

**Framework:** Next.js 15 — required for `app/api/payments/usdt/*/route.ts` and `app/api/me/operator` serverless handlers.

Vite-only static deploys **do not** run API routes; that was why checkout stayed DEMO. Vite entry files live under `_legacy-vite/` only.

## Build

Default Next `distDir` is **`.next`** (do not set `distDir: 'dist'` — publish-app Next host looks for `.next`). `vercel.json` marks `framework: nextjs`. API routes run via `next start`.

```bash
cd minas-crypto
npm install
npm run build   # writes .next/
npm run start   # :4173
```

Dev: `npm run dev` (:5173).

## Secrets / env

Bind (names only):

| Name | Purpose |
|------|---------|
| `NOWPAYMENTS_API_KEY` | Live checkout (`config.ready`) |
| `NOWPAYMENTS_IPN_SECRET` | IPN HMAC + grant-token signing |
| `NOWPAYMENTS_IPN_URL` | Optional absolute IPN URL |
| `OPERATOR_EMAILS` | Optional extra allowlist (comma emails) |

## Operator gifts (who can claim)

Only **Andres Medina** via Cursor identity email allowlist:

- Default: `camilo.medinaf24s@gmail.com`
- Plus any emails in `OPERATOR_EMAILS`
- `PLAYER` brand string is **not** authorization
- Endpoint: `GET /api/me/operator` → `{ operator: true|false }`
- App must be published **private** or **team** so identity headers exist

## Payments security

- Server assigns `cava_*` `orderId`; binds `productId` + catalog `amountUsdt`
- `demo_*` **never** returns `paid` while keys are live
- Status/IPN mark paid only on product+amount match
- Client redeems short-lived HMAC `grantToken` via `POST /api/payments/usdt/redeem`
- DEMO `Ya pagué` only when `config.ready === false`

## Post-publish check

Signed in → `GET /api/payments/usdt/config` → JSON `ready: true`.  
Shop: USDT LIVE · real pay address (not `TCaVaDemo…`).  
`GET /api/me/operator` → `operator: true` only for Andres.
