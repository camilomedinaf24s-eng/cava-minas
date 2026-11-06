# Pagos USDT — CAVA Idle Mine (NOWPayments ready)

**Alcance:** cobros USDT por ⚡ energía y cajas (ítems de juego).  
**No:** retiros BTC, promesas de ganancias, yield/APY.

Hasta que existan secrets → **DEMO** (dirección mock + “Ya pagué”).

## Precios (1 USDT ≈ 1 USD DEMO)

| Producto | USDT |
|----------|------|
| ⚡ Básico / Medio / Grande | 0.99 / 2.99 / 6.99 |
| Caja común / rara / legendaria | 0.99 / 4.99 / 14.99 |

## Env keys

Ver `.env.example` en la raíz del proyecto.

```bash
VITE_PAYMENTS_MODE=demo          # → nowpayments cuando keys listas
VITE_PAYMENTS_API_BASE=          # origin del host con /api/payments/*

# SERVER ONLY (nunca en VITE_ / bundle)
NOWPAYMENTS_API_KEY=
NOWPAYMENTS_IPN_SECRET=
NOWPAYMENTS_IPN_URL=https://<host>/api/payments/usdt/ipn
USDT_RECEIVE_ADDRESS=            # opcional
```

Código:
- `src/game/paymentsApi.ts` — modo + create/status
- `src/game/nowpayments.ts` — fetch a API route + stub server
- `src/game/usdtPay.ts` — invoice DEMO UI

## Activar NOWPayments (pasos Andres)

1. Cuenta [NOWPayments](https://nowpayments.io/) → API key + IPN secret.
2. Desplegar routes server:
   - `POST /api/payments/usdt/create`
   - `GET /api/payments/usdt/status?id=`
   - `POST /api/payments/usdt/ipn`
3. Bind secrets en el host (Cursor / Vercel) — **no** pegar keys en chat.
4. Set `VITE_PAYMENTS_MODE=nowpayments` y `VITE_PAYMENTS_API_BASE=https://tu-host`.
5. Test payment → grant ítem solo en IPN `finished`/`confirmed`.
6. Quitar badge DEMO de cobros cuando el primer IPN live pase.

Plantilla server: comentario `NOWPAYMENTS_SERVER_STUB` en `nowpayments.ts`.

## Compliance

- Badge **DEMO** mientras `VITE_PAYMENTS_MODE=demo` o falle la API.
- Copy: ítems de juego · sin inversión · sin retiros BTC.
