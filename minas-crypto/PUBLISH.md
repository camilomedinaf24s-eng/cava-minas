# Publish CAVA on Cursor Apps (grok.bot)

**Framework:** Next.js 15 — required for `app/api/payments/usdt/*/route.ts` serverless handlers.

Vite-only static deploys **do not** run API routes; that was why checkout stayed DEMO.

## Build

```bash
cd minas-crypto
npm install
npm run build
npm run start   # :4173
```

Dev: `npm run dev` (:5173).

## Secrets

Bind (names only): `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`.

## Post-publish check

Signed in → `GET /api/payments/usdt/config` → JSON `ready: true`.  
Shop: USDT LIVE · real pay address (not `TCaVaDemo…`).
