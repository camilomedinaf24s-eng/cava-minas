# Pagos USDT — CAVA Idle Mine

**Alcance:** cobros USDT por ⚡ energía y cajas (ítems de juego).  
**No incluye:** retiros BTC, promesas de ganancias, yield/APY.

DEMO actual: dirección mock + botón “Ya pagué · entregar ítem” (simulado).

## Precios (1 USDT ≈ 1 USD en DEMO)

| Producto | USDT |
|----------|------|
| ⚡ Básico / Medio / Grande | 0.99 / 2.99 / 6.99 |
| Caja común / rara / legendaria | 0.99 / 4.99 / 14.99 |

## Variables de entorno

```bash
# Modo: demo | nowpayments | stripe_crypto
VITE_PAYMENTS_MODE=demo

# NOWPayments (server preferible; no exponer secret en browser)
NOWPAYMENTS_API_KEY=
NOWPAYMENTS_IPN_SECRET=
# Solo si el cliente necesita algo público:
# VITE_NOWPAYMENTS_API_KEY=

# Stripe Crypto / Checkout
STRIPE_SECRET_KEY=
STRIPE_CRYPTO_WEBHOOK_SECRET=
VITE_STRIPE_PUBLISHABLE_KEY=

# Wallet recepción producción (TRC20 recomendado por fees)
USDT_RECEIVE_ADDRESS=
```

Código stub: `minas-crypto/src/game/paymentsApi.ts`  
Invoice DEMO: `minas-crypto/src/game/usdtPay.ts`

## Pasos keys reales — NOWPayments

1. Cuenta en [NOWPayments](https://nowpayments.io/) → API keys.
2. Crear payment con `pay_currency=usdttrc20` (o red elegida).
3. Guardar `order_id` = invoice CAVA; IPN webhook firma con `NOWPAYMENTS_IPN_SECRET`.
4. Al IPN `finished` / `confirmed` → entregar ítem (mismo grant que DEMO).
5. Poner `VITE_PAYMENTS_MODE=nowpayments` y secrets en host (Cursor bind-app-secrets / Vercel).
6. Reemplazar el stub `createUsdtPayment` por `fetch` **server-side** (API route), nunca la secret en el bundle.

## Pasos keys reales — Stripe Crypto

1. Stripe Dashboard → Crypto / Checkout con currency USDT si disponible en tu cuenta.
2. `STRIPE_SECRET_KEY` solo en server; webhook `STRIPE_CRYPTO_WEBHOOK_SECRET`.
3. Session success → grant ítem; failure → no entregar.
4. `VITE_PAYMENTS_MODE=stripe_crypto`.

## Ready path (código)

```
/api/payments/usdt/invoice?product=<id>&amount=<usdt>
```

Implementar esa ruta en el host antes de salir de DEMO.

## Compliance / producto

- Badge **DEMO** mientras no haya pasarela live.
- Copy: “ítems de juego · sin crypto de inversión · sin retiros BTC”.
- No mostrar ROI, “earn”, ni tip financiero.

## Republish

Tras push a `cava-minas` y keys en secretos del app:

1. `npm run build` en `minas-crypto`
2. `publish-app` (project_dir `minas-crypto`) o redeploy host
3. Probar un pago testnet / sandbox antes de mainnet
