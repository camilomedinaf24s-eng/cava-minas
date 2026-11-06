# Pagos USDT — CAVA Idle Mine (NOWPayments)

**Alcance:** cobros USDT (TRC20) por ⚡ energía y cajas (ítems de juego).  
**No:** retiros BTC, promesas de ganancias, yield/APY.

## Precios (1 USDT ≈ 1 USD)

| Producto | USDT |
|----------|------|
| ⚡ Básico / Medio / Grande | 0.99 / 2.99 / 6.99 |
| Caja común / rara / legendaria | 0.99 / 4.99 / 14.99 |

## Cómo se enciende LIVE en cava.apps.grok.bot

1. En Cursor → Secrets (My Secrets), asegúrate de tener:
   - `NOWPAYMENTS_API_KEY`
   - `NOWPAYMENTS_IPN_SECRET`  
   (valores ya en tus secrets — **no los pegues en chat**).
2. Bind esos nombres al app `minas-crypto` / publish (publish worker).
3. En el dashboard NOWPayments → IPN callback URL:

```
https://cava.apps.grok.bot/api/payments/usdt/ipn
```

   (Si el slug cambia, usa `https://<tu-host>/api/payments/usdt/ipn`.)

4. Republish el app. El client llama `GET /api/payments/usdt/config`:
   - si el server ve la API key → **LIVE** (aunque `VITE_PAYMENTS_MODE` siga en `demo`)
   - si faltan keys → **DEMO** (“Ya pagué” simulado)

Opcional bake-time: `VITE_PAYMENTS_MODE=nowpayments` en el build. No hace falta si usas auto-flip por `config.ready`.

## Env

```bash
# Client (público / bake)
VITE_PAYMENTS_MODE=demo          # puede quedarse demo; LIVE = keys en server
VITE_PAYMENTS_API_BASE=          # vacío = same origin (cava.apps.grok.bot)

# SERVER ONLY (bind-app-secrets — nunca VITE_)
NOWPAYMENTS_API_KEY=
NOWPAYMENTS_IPN_SECRET=
# Opcional override (default = {origin}/api/payments/usdt/ipn)
NOWPAYMENTS_IPN_URL=https://cava.apps.grok.bot/api/payments/usdt/ipn
```

## Routes (publish-app web handlers)

| Method | Path | Rol |
|--------|------|-----|
| GET | `/api/payments/usdt/config` | `{ ready }` sin secrets |
| POST | `/api/payments/usdt/create` | Crea payment NP (catálogo server) |
| GET | `/api/payments/usdt/status?id=` | Poll NP + cache IPN |
| POST | `/api/payments/usdt/ipn` | Webhook; verifica `x-nowpayments-sig` HMAC-SHA512 |

Código: `api/payments/usdt/*` + client `src/game/paymentsApi.ts` / `nowpayments.ts`.

## Flujo grant

1. Shop → Pagar USDT → `create` → dirección / checkout URL.
2. Usuario paga USDT TRC20.
3. IPN `finished`/`confirmed` → marca paid (y status lo confirma vía NP API).
4. Client poll cada 4s → al `paid` entrega ⚡/caja **una vez** (localStorage anti-doble).
5. Sin keys / create falla → UI DEMO con “Ya pagué”.

## Compliance

- Sin retiros BTC.
- Badge DEMO mientras `config.ready=false`.
- Copy: ítems de juego · sin inversión.
