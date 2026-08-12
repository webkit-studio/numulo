# numo

Rodinná finanční appka pro dvě osoby (Lukáš, Věrka), CZK, účet „Domácnost".
Bez napojení na banky — data jdou dovnitř importem CSV výpisů (Air Bank,
Revolut) a výjimečně ručním zápisem.

numo odpovídá na tři otázky: **Můžu dnes utrácet? Zvládáme tenhle měsíc?
Lezeme z toho ven?**

**Stav: fáze 1 (kostra) hotová.** Co běží: nasazovatelná appka na Webflow
Cloud, brána hesla, databázové schéma s migrací, seed uživatelů a kategorií,
a jádro výpočtů s testy. Obrazovky se staví ve fázích 2–4 — čeká se na
vzorky CSV a na design bundle. Detaily a otevřené otázky: `docs/decisions.md`.

## Stack

| Vrstva      | Volba                                                    |
| ----------- | -------------------------------------------------------- |
| Framework   | Next.js 15 (App Router), React 19                        |
| Hosting     | Webflow Cloud (Cloudflare Workers přes OpenNext), mount `/numo` |
| Databáze    | Webflow Cloud SQLite (D1) + Drizzle ORM, verzované migrace |
| Soubory     | Webflow Cloud Object Storage (archiv syrových CSV)        |
| Testy       | Vitest                                                    |
| AI          | Claude API (`claude-haiku-4-5`), výhradně server-side, volitelné |

## Struktura

```
migrations/            verzované SQL migrace (aplikuje je Webflow Cloud sám)
src/
  app/                 App Router — stránky a API routy
  db/                  Drizzle schéma a připojení k D1
  lib/
    auth/              podepsaná session cookie a brána hesla
    calc/              čisté výpočtové funkce + unit testy
    date.ts money.ts   ISO datumy a peníze v haléřích
  middleware.ts        brána hesla před celou appkou
  styles/tokens.css    design tokeny (zatím placeholder)
docs/                  nastavení, rozhodnutí, mapping tokenů
```

Dvě pravidla, která drží kód čitelný:

- **Peníze jsou celá čísla v haléřích.** Žádné floaty. Výdaje záporné.
  Převod ×100 se smí dít jen v `src/lib/money.ts`.
- **Datumy jsou ISO stringy** (`YYYY-MM-DD`, `YYYY-MM`). Řadí se i porovnávají
  lexikograficky, takže výpočty nepotřebují `Date` ani časové zóny.

## Lokální vývoj

```bash
npm install
cp .env.example .dev.vars     # vyplň NUMO_PASSWORD
npm run db:apply:local        # založí lokální databázi a nasype seed
npm run dev                   # http://localhost:3000/numo
```

Appka na Workers runtime (tak, jak poběží v produkci):

```bash
npm run preview               # http://localhost:8787/numo
```

## Příkazy

| Příkaz                  | Co dělá                                        |
| ----------------------- | ---------------------------------------------- |
| `npm run dev`           | vývojový server                                |
| `npm run preview`       | build + běh na Workers runtime lokálně         |
| `npm test`              | unit testy                                     |
| `npm run typecheck`     | kontrola typů                                  |
| `npm run db:generate`   | vygeneruje migraci ze změn ve schématu         |
| `npm run db:apply:local`| aplikuje migrace na lokální databázi           |
| `npm run cf-typegen`    | přegeneruje typy po změně bindingů             |

## Nasazení

Push do `main` = produkce, větev `dev` = staging. Webflow Cloud si build i
migrace spustí sám. První nastavení (klikací kroky) je v
`docs/setup-webflow-cloud.md`.

## Bezpečnost

Heslo a API klíč se zadávají v UI Webflow Cloudu, nikdy do repa. `.dev.vars`
je v `.gitignore`.
