# Numulo

Rozpočet pro jednu domácnost. Next.js 15 na Netlify, data a přihlašování
v Supabase.

**Živě: [numulo.netlify.app](https://numulo.netlify.app)**

> Pracuješ na tomhle repu s Claudem nebo jiným agentem? Přečti si nejdřív
> [`CLAUDE.md`](CLAUDE.md) — je tam devět pravidel, která se dají porušit,
> aniž by cokoli spadlo.

## Co to dělá

| obrazovka | odpovídá na otázku |
|---|---|
| **Přehled** | Můžu dneska utrácet a jak na tom jsme? |
| **Plán** | Jak nastavíme a zvládáme tenhle měsíc? |
| **Pravidelné** | Co jede samo a je to zaplacené? |
| **Vývoj** | Jak se to vyvíjí a kam to směřuje? |
| **Dluhy** | Co dlužíme a kdy budeme čistí? |
| **Transakce** | Najdu a opravím konkrétní platbu. |
| **Import** | Dostanu výpis z banky dovnitř. |

Ke každému číslu vede ⓘ s rozpadem, jak vzniklo. Stav se nikdy neříká jen
barvou — vždycky je u něj slovo (*v klidu / dochází / nad plánem*).

Čísla se počítají v `src/lib/calc` — čisté funkce bez databáze, ověřené
testy proti demu ze specifikace. Když se něco na obrazovce nezdá, odpověď
je tam.

## Účty

Uživatel se zaregistruje, pak se **kódem** připojí k domácnosti, nebo si
založí vlastní. Kód najde ten, kdo domácnost vede, v Nastavení účtu —
a dá se kdykoli vyrobit nový. Deset špatných pokusů za hodinu a je konec.

Kdo co uvidí, rozhoduje row-level security podle členství v domácnosti,
ne podmínka v aplikačním kódu.

## Import

Přetáhneš CSV z jakékoli banky. Numulo si přečte kódování a oddělovač,
odvodí sloupce, otiskne řádky a roztřídí je:

- **Přidáno** — sedělo pravidlo, kategorie je nastavená
- **Duplicitní** — stejný otisk už v databázi je, neuloží se
- **Ke schválení** — takového obchodníka nikdo ještě neviděl

Přeřazení kategorie se zapamatuje jako pravidlo pro obchodníka, takže
příští výpis se roztřídí sám.

Volitelně pomůže s mapováním sloupců model (Claude Haiku 4.5). Dostane
**jen nadpisy sloupců** a poznámku od uživatele — žádnou platbu. Bez
`ANTHROPIC_API_KEY` import funguje dál, jen bez té pomoci.

## Spuštění

```bash
npm install
cp .env.example .env.local   # a doplnit klíče ze Supabase
npm run dev                  # :3000
```

| proměnná | k čemu | povinná |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | adresa projektu | ano |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | veřejný klíč (RLS hlídá zbytek) | ano |
| `ANTHROPIC_API_KEY` | pomoc s mapováním sloupců při importu | ne |

Když povinná proměnná chybí, aplikace to řekne jménem té proměnné —
ne prázdnou pětistovkou.

**Heslo ani servisní klíč nikdy do repa.** Tenhle repozitář je veřejný.

## Testy

```bash
npm test        # 72 testů — výpočty, import, detekce, párování dluhů
npm run build   # produkční build
npx tsc --noEmit
```

Testy výpočtů jsou připíchnuté na demo měsíc ze specifikace. Když spadnou
po změně vzorce, znamená to, že se výsledek rozešel se zadáním — ne že je
vadný test.

## Databáze

Schéma je v Supabase (migrace `numulo_*`). Šestnáct tabulek, na všech
zapnutá row-level security navázaná na členství v domácnosti. Jediné dvě
cesty skrz tu zeď jsou `create_household()` a `join_household()`, a každá
si kontroluje svoje.

Peníze jsou všude celá čísla haléřů. Převod na koruny dělá jenom
`src/lib/money.ts`.

## E-maily

Potvrzení registrace a obnova hesla jdou přes Resend z domény
`numulo.webkit.studio`. Vestavěný mailer Supabase posílá jen pár zpráv za
hodinu, takže na ostrý provoz nestačí.

Heslo se dá změnit přímo v Nastavení účtu, bez e-mailu — odkaz na obnovu
je pro toho, kdo se dovnitř nedostane vůbec.

## Zadání

`design_handoff_numo/` obsahuje specifikaci, design tokeny a screenshoty,
podle kterých je aplikace postavená. Je to reference, ne kód — needituje se.
Když se specifikace a design tokeny neshodnou, vyhrává specifikace:
screenshoty jsou vyrenderované z ní.
