# Handoff: Numo — osobní finance (desktop + mobil)

Zadání pro Claude Code. Tenhle balíček obsahuje všechno, co potřebuješ k implementaci aplikace Numo: kompletní specifikaci, design tokens, screenshoty všech obrazovek a zdrojové HTML prototypy jako referenci.

## Co je Numo

Česká appka na rodinné finance pro pár s nepravidelnými příjmy. Odpovídá na tři otázky — *Můžu dnes utrácet? Zvládáme tenhle měsíc? Lezeme z toho ven?* — a každá stránka odpovídá právě na jednu. Sedm stránek na desktopu (Přehled · Plán · Pravidelné · Vývoj · Dluhy · Transakce · Import), čtyři taby na mobilu (Přehled · Transakce · Plán · Víc).

## Jak s balíčkem pracovat

1. **`NUMO-SPEC.md` je zdroj pravdy** — kompletní specifikace: demo data, všechny vzorce (musí matematicky sedět!), rozložení každé obrazovky, interakce, stavy, texty tooltipů, formát čísel.
2. **`screenshots/`** — vizuální reference všech obrazovek (index níže). Vzhled implementuj podle nich.
3. **`design-tokens/`** — CSS custom properties designového systému (barvy, typografie, spacing, stíny). Použij je jako základ theme.
4. **`prototyp/`** — zdrojové HTML prototypy. **Jsou to design reference, ne produkční kód** — vznikly v interním prototypovacím prostředí a bez něj se samy neotevřou. Čti je jako zdroj přesných hodnot (inline styly = přesné barvy, velikosti, paddingy, SVG ikony) a logiky výpočtů (třída `Component` na konci souboru). Nekopíruj je, reimplementuj ve zvoleném frameworku.

Cíl: **high-fidelity** — prototypy jsou pixel-perfect, implementace má vypadat stejně (barvy, fonty, rozměry, radiusy, sklo, animace) a čísla musí sedět podle vzorců ve spec §4.

Pokud neexistuje cílová codebase, zvol moderní webový stack (např. React + Vite); mobil je responzivní web (viewport 402×874, spodní tab bar), ne nativní appka.

## Vizuální jazyk v kostce

Detaily ve spec §2 a v `design-tokens/`. Zkráceně:

- **Podklad**: `#E2EDE4` + čtyři radiální světlé přechody (fixed). **Karty**: sklo — `rgba(255,255,255,0.5–0.6)` + `backdrop-filter: blur(12–16px)` + border `1px rgba(255,255,255,0.85)` + radius 20–22 px.
- **Barvy**: ink `#0E3E2E`, sekundární `#4C685C`, tiché `#7E958A`/`#9DB3A5`, zelená `#176A4E`, negativní `#A6432E`, forecast okrová `#C99A4B`, jemné varování `#9A5B22` na `rgba(201,154,75,0.16)`.
- **Fonty**: Sora (nadpisy, wordmark `numo`), Instrument Sans (UI), IBM Plex Mono (**každé číslo**). Google Fonts.
- **Čísla**: cs-CZ, `12 345 Kč` s úzkou nedělitelnou mezerou (U+202F), mono, nikdy nezalamovat. Záporná `−` (U+2212), v grafech kladná s `+`.
- **Ikony**: Lucide, stroke 2. Checkbox zaplaceno = plný zelený rounded rect s bílou fajfkou; čekající = prázdný kruh.
- **Animace**: fade + 6px posun, 120–180 ms, ease-out. Toast = tmavě zelená pilulka dole, 2,8 s.

## Index screenshotů

Desktop (`NN-desktop.png`):

| # | obrazovka |
|---|---|
| 01 | Přehled — Bilance + Rezerva, Denní limit |
| 02 | Přehled — Obálky, heatmapa, poslední transakce |
| 03 | Plán — Cíl měsíce (4 řádky), Spoření |
| 04 | Plán — Plánované položky, Rozpočty, uzávěr |
| 05 | Pravidelné — souhrny, auto-detekce, Předplatná, Měsíční platby |
| 06 | Pravidelné — dole (roční platby, splátky s badge „dluh“) |
| 07 | Vývoj — Cashflow |
| 08 | Vývoj — Hotovost v čase (varování listopad) |
| 09 | Vývoj — Trendy kategorií, Průměry |
| 10 | Dluhy — souhrn + seznam s progress bary |
| 11 | Transakce — filtry, chipy, seskupení po dnech |
| 12 | Import — výsledek, tab Přidáno |
| 13 | Import — tab Ke schválení (podnikání/převod) |
| 14 | Nastavení účtu — tab Účet |
| 15 | Nastavení účtu — tab Sdílení |

Mobil (`NN-mobil.png`):

| # | obrazovka |
|---|---|
| 01 | Domů — zbývá na útratu + denní limit |
| 02 | Domů — Obálky |
| 03 | Domů — Bilance + Rezerva, heatmapa |
| 04 | Transakce |
| 05 | Plán — Cíl měsíce |
| 06 | Plán — Plánované položky, Rozpočty |
| 07 | Víc — menu |
| 08 | Pravidelné — souhrny, předplatná |
| 09 | Pravidelné — měsíční platby + splátky dluhů |
| 10 | Vývoj — Cashflow + Hotovost v čase |
| 11 | Vývoj — Trendy, Průměry |
| 12–13 | Dluhy — souhrn, seznam, formulář |

## Na co si dát pozor

- Všechna čísla v UI jsou provázaná — jedna změna (spoření, označení transakce, smazání předplatného) se okamžitě propíše do všech metrik. Vzorce a demo hodnoty: spec §3–4.
- Jednotný CRUD vzor u všech seznamů (spec §4b): „+ přidat“, tužka inline, koš, toast.
- Slova **„bazén“ a „výplata“ se nikde nepoužívají**. Stavová slova: *v klidu / dochází / nad plánem*.
- Stav nikdy jen barvou — vždy barva + text. Touch cíle na mobilu ≥ 44 px.
- Import a Nastavení jsou na mobilu záměrně neaktivní.

## Soubory

```
design_handoff_numo/
├── README.md            ← tenhle soubor
├── NUMO-SPEC.md         ← kompletní specifikace (zdroj pravdy)
├── screenshots/         ← 15× desktop, 13× mobil (PNG)
├── design-tokens/       ← colors / typography / spacing / effects / fonts (CSS custom properties)
└── prototyp/            ← HTML design reference (neotevírat jako appku, číst jako zdroj hodnot)
```
