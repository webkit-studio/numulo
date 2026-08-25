# Numulo

Rozpočet pro jednu domácnost. Next.js 15 na Netlify, data a přihlašování
v Supabase.

## Co to dělá

Přehled o měsíci (kolik zbývá, denní limit, obálky podle kategorií),
Plán (cíl měsíce, spoření, plánované položky, rozpočty), Pravidelné
(předplatná, měsíční a roční platby), Vývoj (cashflow, hotovost v čase,
trendy), Dluhy, Transakce a Import bankovního výpisu.

Čísla se počítají v `src/lib/calc` — čisté funkce bez databáze, ověřené
testy proti demu ze specifikace. Když se něco na obrazovce nezdá, odpověď
je tam.

## Spuštění

```bash
npm install
cp .env.example .env.local   # a doplnit klíče ze Supabase
npm run dev
```

| proměnná | k čemu |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | adresa projektu |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | veřejný klíč (RLS hlídá zbytek) |
| `ANTHROPIC_API_KEY` | volitelně — pomoc s mapováním sloupců při importu |

Bez `ANTHROPIC_API_KEY` funguje všechno kromě té jedné pomoci; import si
sloupce odvodí sám.

**Heslo ani servisní klíč nikdy do repa.** Tenhle repozitář je veřejný.

## Testy

```bash
npm test        # vitest — výpočty, import, detekce pravidelných plateb
npm run build   # produkční build
```

## Databáze

Schéma je v Supabase (migrace `numulo_*`). Kdo co smí číst a psát,
rozhoduje row-level security podle členství v domácnosti — ne podmínka
v aplikačním kódu. Jediné dvě cesty skrz tu zeď jsou `create_household`
a `join_household`, a každá si kontroluje svoje.

Peníze jsou všude celá čísla haléřů. Převod na koruny dělá jenom
`src/lib/money.ts`.
