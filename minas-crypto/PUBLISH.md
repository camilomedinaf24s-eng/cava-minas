# Publicar CAVA Idle Mine (DEMO)

Marca: **CAVA** · badge **DEMO** · sin crypto real.

## Build local

```bash
cd minas-crypto
npm install
npm run build
npm run preview   # http://127.0.0.1:4173
```

Dev:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

## Hosting sugerido

1. Subir carpeta `dist/` a Vercel / Netlify / Cloudflare Pages (static).
2. O conectar repo GitHub y auto-deploy en push a `main`.

## Bloqueo actual

- Este entorno **no tiene `git remote` / origin** configurado.
- Sin URL de repo vacío de Andres no se puede `git push` ni publicar desde CI.
- Cuando exista remote:

```bash
git remote add origin git@github.com:<ORG>/cava-idle-mine.git
git push -u origin cursor/minas-crypto-mvp-cbf7
```

Luego conectar el host al repo y activar preview.

## Checklist pre-publish

- [x] `npm run build` OK
- [x] Marca CAVA + DEMO badge en UI
- [x] Pagos = mock / DEMO (Stripe path documentado)
- [ ] Remote GitHub
- [ ] Dominio / env secrets (Stripe keys reales — solo después del mock)

## Stripe (siguiente)

Mock listo en app (`/api/stripe/checkout?price=…` ready path).  
Para real: crear Prices en Stripe Dashboard y un endpoint serverless que cree Checkout Session.
