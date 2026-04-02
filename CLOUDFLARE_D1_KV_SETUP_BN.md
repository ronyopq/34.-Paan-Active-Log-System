# PRAAN: Cloudflare Pages + D1 + KV Setup (Bangla)

এই গাইড `praan.pages.dev` প্রজেক্টে real data mode চালু করার জন্য।

## Auto Deploy vs D1/KV (সংক্ষেপে)
- Git push হলে **Pages auto deploy** হবে (যদি Git integration connected থাকে)।
- কিন্তু **D1/KV resource creation এবং DB migration একবার manual/CLI করতে হবে**।
- একবার setup হয়ে গেলে পরের push-এ app auto deploy হবে এবং একই D1/KV ব্যবহার করবে।

## 1) CLI Login
```bash
npx wrangler login
```

## 2) Existing Pages config নামাও
```bash
npx wrangler pages download config praan
```

এতে `wrangler.jsonc` আসবে (project অনুযায়ী)।

## 3) D1 + KV create
```bash
npx wrangler d1 create praan_db
npx wrangler kv namespace create PRAAN_CACHE
npx wrangler kv namespace create PRAAN_CACHE --preview
```

Command output থেকে `database_id`, `id`, `preview_id` কপি করো।

## 4) wrangler config-এ bindings বসাও
`wrangler.example.jsonc` দেখে `wrangler.jsonc`-এ add করো:
- `d1_databases` binding = `DB`
- `kv_namespaces` binding = `CACHE`

## 5) D1 migration apply
```bash
npx wrangler d1 execute praan_db --remote --file=./cloudflare/migrations/0001_init.sql
```

Optional seed:
```bash
npx wrangler d1 execute praan_db --remote --file=./cloudflare/seed/001_seed_empty_state.sql
```

## 6) App কে Cloudflare data mode-এ চালাও
`.env.local` এ:
```bash
NEXT_PUBLIC_DATA_MODE=cloudflare
```

## 7) Health check
Deploy-এর পরে:
- `https://praan.pages.dev/api/health`
- `https://praan.pages.dev/api/state`

`/api/health` এ `DB: true` এবং `CACHE: true` দেখালে bindings ঠিক আছে।

## 8) Data flow (Phase-1)
- App state save হবে `/api/state` এ।
- API state D1 + KV তে persist করবে।
- KV cache hit হলে read fast হবে; miss হলে D1 থেকে read করে KV refresh করবে।

---

প্রয়োজনে Phase-2 এ relational model (users, entries, logs, settings আলাদা table) এ ভেঙে migration করা যাবে।
