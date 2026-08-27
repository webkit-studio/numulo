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
| **Vývoj** | Jak se to vyvíjí — a co se stane, když nepřijde žádný klient? |
| **Dluhy** | Co dlužíme a kdy budeme čistí? |
| **Transakce** | Najdu a opravím konkrétní platbu. |
| **Import** | Dostanu výpis z banky dovnitř. |

**Příjmy i výdaje se čtou z transakcí — nikde se nic nenastavuje.** Žádný
měsíční rozpočet v nastavení: co přišlo, je příjem; když nepřišlo nic,
čísla jsou v mínusu, protože jsou.

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

Jedno okno, formát je starost Numula: **CSV** se parsuje deterministicky
(kódování, oddělovač a sloupce si výpis přečte sám), **PDF** přepíše model.
Obě cesty končí ve stejných dveřích — stejný otisk, stejná pravidla:

- **Přidáno** — sedělo pravidlo, kategorie je nastavená
- **Duplicitní** — stejný otisk už v databázi je, neuloží se
- **Ke schválení** — takového obchodníka nikdo ještě neviděl

Po importu se platby s VS nebo číslem účtu samy spárují na dluhy.

## AI

Model dělá tři věci a všechny běží v Supabase Edge Function `ai-worker`,
kde jediné žije `ANTHROPIC_API_KEY`:

1. **Mapování sloupců CSV** — vidí jen nadpisy, nikdy data (Haiku 4.5).
2. **Přepis PDF výpisu** — vidí celý výpis, to jinak nejde (Sonnet 5).
3. **Kategorizace** — vidí jen **názvy obchodníků**, žádné částky ani účty
   (Haiku 4.5). Návrhy se ukládají jako pravidla `obchodník → kategorie`,
   takže příští výpis se roztřídí bez modelu. Umí navrhnout podkategorii
   (Jídlo › Fastfood) — obálky a trendy je sčítají do rodiče.

Výstup modelu **nikdy nejde přímo do tabulek**: přistane jako JSON v
`ai_jobs.result` a aplikace rozhodne, co z něj zapíše. Bez klíče všechno
ostatní funguje dál; tlačítka to řeknou.

## Spuštění

```bash
npm install
cp .env.example .env.local   # a doplnit klíče ze Supabase
npm run dev                  # :3000
```

| proměnná | kde | k čemu | povinná |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Netlify + `.env.local` | adresa projektu | ano |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Netlify + `.env.local` | veřejný klíč (RLS hlídá zbytek) | ano |
| `ANTHROPIC_API_KEY` | **Supabase → Edge Functions → Secrets** | PDF import a kategorizace | ne |

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

Schéma je v Supabase (migrace `numulo_*`). Sedmnáct tabulek, na všech
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
