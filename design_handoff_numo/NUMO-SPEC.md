# Numo — specifikace prototypu (desktop + mobil)

Jeden soubor pro předání dál: co Numo je, jak vypadá, jaká data používá, jak se každé číslo počítá a co všechno v UI reaguje. Zdroj: prototypy `Numo Desktop.dc.html` a `Numo Mobil.dc.html`.

---

## 1. Produkt

Numo je česká appka na rodinné finance pro pár s nepravidelnými příjmy (freelance). Uživatelé: **Lukáš (L)** a **Věrka (V)**, účet se jmenuje **Domácnost**, typ **osobní** (podnikatelský je „připravujeme“ a je deaktivovaný).

**Numo odpovídá na tři otázky** a každá stránka odpovídá právě na jednu:

| otázka | stránka |
|---|---|
| Můžu dnes utrácet a kde stojíme? | Přehled |
| Jak nastavíme a zvládáme tenhle měsíc? | Plán |
| Co jede samo a je to zaplacené? | Pravidelné |
| Jak se to vyvíjí a kam to směřuje? | Vývoj |
| Co dlužíme a kdy budeme čistí? | Dluhy |
| Najdu a opravím konkrétní platbu | Transakce |
| Dostanu výpis dovnitř | Import |

Základní pojmy:

- **Měsíční rozpočet** — pevných **63 000 Kč / měsíc**, se kterými domácnost pracuje (v Nastavení účtu jako „měsíční rozpočet“).
- **Zbývá na útratu** — hlavní číslo appky.
- **Rezerva** — aktuální finanční pozice domácnosti = **hotovost − dluhy**, klidně záporná (demo −38 400 Kč).
- **Obálky** — kategorie s limitem a stavem; „domov“ nastavování limitů je Plán → Rozpočty.
- **Spoření** — cíl na měsíc; nastavuje se v Plánu, propisuje se do hlavního čísla.

Slova **„bazén“ a „výplata“ se v produktu nepoužívají.**

Tón: klidný, konkrétní, nikdy nekárá. Věty krátké, malá počáteční písmena u popisků, čísla mluví.

---

## 2. Vizuální styl

Vzdušné sklo na zelenokrémovém podkladu, měkké velké radiusy, mono číslice.

**Barvy**

| účel | hodnota |
|---|---|
| text / ink | `#0E3E2E` |
| sekundární text | `#4C685C` |
| tichý text | `#7E958A`, velmi tichý `#9DB3A5` |
| zelená akce / pozitivní | `#176A4E` |
| varovná (jemná) | `#9A5B22`, badge podklad `rgba(201,154,75,0.16)`, text `#8A5F1E` |
| negativní / mazání | `#A6432E` |
| forecast (body v grafech) | `#C99A4B` |
| pozadí stránky | `#E2EDE4` + radiální světla `rgba(255,255,255,.55)`, `rgba(208,227,208,.6)`, `rgba(242,246,230,.65)` |

**Sklo (karty)**: `background: rgba(255,255,255,0.5–0.6)`, `backdrop-filter: blur(12–16px)`, `border: 1px solid rgba(255,255,255,0.85)`, `border-radius: 20–22px`, padding 18–24 px.
**Dlaždice v kartě**: `rgba(255,255,255,0.45)`, border `rgba(255,255,255,0.75)`, radius 13–14 px.
**Hlavní dlaždice (zbývá na útratu, čistí)**: `rgba(23,106,78,0.08)`, border `rgba(23,106,78,0.16)`, radius 16–18 px.

**Typografie**: Sora 600–800 (nadpisy, wordmark `numo`), Instrument Sans (UI text), IBM Plex Mono (**všechna čísla**).
Velikosti: nadpis stránky 24 px desktop / 21 px mobil; titulek karty 12,5 px 600 `#4C685C`; řádek 13,5 px; tichý popisek 11–12 px.

**Formát čísel**: `cs-CZ`, bez desetinných míst, oddělovač tisíců = úzká nedělitelná mezera (U+202F), za číslem `Kč` (menší, `#4C685C`). Záporné se znaménkem `−`, kladné v grafech s `+`. Čísla vždy v mono a s `white-space: nowrap`.

**Ikony**: Lucide, stroke 2, 13–20 px, `currentColor`.
**Checkbox stavu zaplaceno**: plný zelený rounded rect (`rx=5`, `#176A4E`) s bílou fajfkou = zaplaceno; prázdný kruh `r=9` `#9DB3A5` = čeká. Nikde se nepíše „zaplaceno“ slovem.
**Animace**: `numo-fade` (opacity + 6 px posun, 120–180 ms), spinner `numo-spin` 700 ms.
**Hover**: světlejší sklo (`rgba(255,255,255,0.75–0.95)`), u tlačítek tmavší zelená. **Focus**: `0 0 0 3px rgba(26,127,90,0.16)` + zelený border.

---

## 3. Data (demo, říjen 2026 — den 21 z 30, zbývá 9 dní)

### 3.1 Transakce října (40 položek, `−Kč`)

```
1.  Nájem              Bydlení       11 600  L
2.  Albert             Jídlo            640  V
3.  Lidl               Jídlo            890  L
3.  Kino Aero          Zábava           380  V
4.  Benzina            Doprava        1 450  L
5.  Elektřina          Bydlení          950  L
5.  Penny              Jídlo            412  L
6.  Plyn               Bydlení        1 100  L
6.  dm drogerie        Domácnost        310  V
7.  Dr. Max            Zdraví           240  V
7.  PID                Doprava          380  L
8.  Voda               Bydlení          480  L
8.  Albert             Jídlo            736  V
8.  Pizzerie Kmotra    Rande            640  L
9.  Alza               Domácnost      2 490  L
9.  Knihkupectví—dárek Dárky            460  V
10. Internet           Bydlení          550  L
10. Lidl               Jídlo          1 018  V
10. Kavárna Mezi řádky Zábava           180  L
11. U Kalendů          Jídlo            860  L
12. Pojištění domác.   Bydlení          470  L
12. Penny              Jídlo            534  V
12. Holičství Karlín   Osobní péče      480  L
13. Benzina            Doprava        1 380  L
13. Hospoda U Slunce   Zábava           350  L
14. IKEA               Domácnost      1 930  V
14. Steam              Zábava           420  L
15. Albert             Jídlo            918  V
15. Lékárna Benu       Zdraví           260  V
16. Parkování Letná    Doprava          572  L
16. Dárek—svatba Kláry Dárky          1 800  V
17. Lidl               Jídlo            764  L
18. Kaufland           Domácnost        840  V
18. Kino—rande         Rande            280  V
19. Damascus Kebab     Jídlo            250  L
19. dm drogerie        Osobní péče      260  V
20. Penny              Jídlo            690  L
21. Penny              Jídlo            748  L
21. Flek na kafe       Zábava           350  V
21. PID                Doprava          148  L
```

Září (pro filtr měsíce): Albert 512 (30.), Benzina 1 400 (29.), Lidl 903 (28.), Kino Aero 380 (27.), Penny 655 (26.), Rohlík.cz 1 240 (25.).

Součty: transakce října **39 210**, z toho Bydlení (pravidelné) 15 150 → **variabilní výdaje 24 060**.

Transakce označená jako **podnikání** nebo **převod** ze všech součtů vypadává (viz 4 a 5.6).

### 3.2 Kategorie a barvy

| kategorie | barva | říjen |
|---|---|---|
| Jídlo | `#175C43` | 8 460 |
| Domácnost | `#2F8060` | 5 570 |
| Doprava | `#6FA98C` | 3 930 |
| Dárky | `#C99A4B` | 2 260 |
| Zábava | `#B26A50` | 1 680 |
| Rande | `#D9A85C` | 920 |
| Osobní péče | `#A9C4B1` | 740 |
| Zdraví | `#7E958A` | 500 |
| Bydlení | `#0E3E2E` | 15 150 (v obálkách se nezobrazuje) |

### 3.3 Předplatná (měsíční, 1 990 Kč/měs)

Apple One 249 (3.) · Claude 550 (7.) · Notion 295 (8.) · Infuse 49 (12.) · Spotify 249 (15.) · GeForce Now 598 (21.). Vše se dnem ≤ 21 je zaplaceno.

### 3.4 Pravidelné měsíční platby (celkem 24 774 Kč, zaplaceno 6/8)

Nájem 11 600 (1.) ✓ · Elektřina 950 (5.) ✓ · Plyn 1 100 (6.) ✓ · Voda 480 (8.) ✓ · Internet 550 (10.) ✓ · Pojištění domácnosti 470 (12.) ✓ · **ČSSZ + VZP 9 026 (20.) čeká** · **Mobilní tarify 598 (24.) čeká**.

### 3.5 Roční platby

Povinné ručení 5 600 (listopad) · Dálniční známka 2 300 (leden) · Popelnice 1 760 (březen) · Lítačka 3 650 (srpen). V měsíci splatnosti se propisují do „plánované“ a do křivky hotovosti (jako mimořádný výdaj). V říjnu žádná → zobrazí se jen „–“.

### 3.6 Dluhy

| věřitel | zbývá | splátka | den | účet + VS |
|---|---|---|---|---|
| ČSSZ — nedoplatek | 28 000 | 3 000/měs | 20. | 2200310123/0710 · VS 6512340987 |
| VZP — nedoplatek | 14 000 | 2 000/měs | 20. | 1111111111/0710 · VS 1122334455 |

Původní výše: ČSSZ **42 000** (splaceno 14 000), VZP **20 000** (splaceno 6 000). Celkem zbývá **42 000 Kč**, splácíme **5 000 Kč/měs**.

Datum „čistý“ se počítá u každého dluhu zvlášť (`ceil(zbývá ÷ splátka)` měsíců od října 2026 včetně): ČSSZ ~**červenec 2027** (10 měsíců), VZP ~**duben 2027** (7 měsíců). Souhrn nahoře bere **nejdéle žijící dluh** — tedy ~červenec 2027, ne průměr.

U každého dluhu je akce **zaznamenat platbu** (částka + datum) — sníží „zbývá“, posune progress i datum „čistý“ a potvrdí toastem.

**Splátky jsou uvnitř existující platby ČSSZ + VZP 9 026 Kč** — v Pravidelných se zobrazují jako informativní ztlumené řádky s badge „dluh“ a **do součtů nevstupují** (souhrny zůstávají 24 774 / 11 900). Karta to říká explicitně jednou tichou větou.

### 3.7 Rezerva a hotovost

**Rezerva** (dlaždice na Přehledu) = hotovost **3 600** − dluhy **42 000** = **−38 400 Kč**. Tenhle rozpad je i v ⓘ tooltipu.

**Hotovost v čase** (graf ve Vývoji) je jiná věc — kolik je na účtech. Minulost je ukotvená na dnešních 3 600 (červenec 900 · srpen 1 800 · září 2 500 · **říjen = dnes 3 600**), budoucnost = `předchozí bod + výsledek měsíce − mimořádné výdaje toho měsíce` (roční platby + jednorázové plánované výdaje):

| měsíc | výsledek | mimořádné | hotovost na konci |
|---|---|---|---|
| listopad | +4 900 | Povinné ručení 5 600 + Zimní pneu 4 300 | **−1 400** |
| prosinec | +7 500 | — | 6 100 |
| leden | +8 200 | Dálniční známka 2 300 | 12 000 |
| únor | +10 500 | — | 22 500 |

Měsíc pod nulou má červený bod a nad grafem se objeví jemně varovná věta **„v listopadu hrozí, že hotovost nevyjde“**. Pod nadpisem grafu je tichá věta „cashflow = kolik měsíc vydělal · hotovost = kolik je na účtech“.

### 3.8 Šestiměsíční průměry (Kč/měs)

Bydlení 14 900 · Jídlo 9 300 · Domácnost 5 200 · Doprava 3 600 · Zábava 2 500 · Předplatná 1 990 · Dárky 1 800 · Zdraví 1 000 · Osobní péče 900.

### 3.9 Trendy kategorií (květen → říjen)

| kategorie | řada | říjen vs. průměr |
|---|---|---|
| Jídlo | 10 100 · 8 600 · 9 800 · 9 200 · 9 640 · 8 460 | −9 % |
| Domácnost | 5 400 · 4 800 · 5 600 · 4 900 · 4 930 · 5 570 | +7 % |
| Doprava | 3 700 · 3 400 · 3 600 · 3 500 · 3 470 · 3 930 | +9 % |
| Zábava | 2 700 · 2 900 · 2 600 · 2 500 · 2 620 · 1 680 | −33 % |

Každá řada dává v součtu přesně 6× průměr z 3.8, poslední bod je skutečný říjen z 3.2.

### 3.10 Povinnosti a dlaždice „plánované“

**Povinnosti** (= „zbývá zaplatit“ v Pravidelných) = nezaplacené měsíční platby ČSSZ + VZP 9 026 a Mobilní tarify 598 + nezaplacená předplatná (v říjnu žádné) + jednorázová očekávaná platba Zubař — doplatek 2 276 = **11 900 Kč**.

Dlaždice **„plánované“** v Bilanci = povinnosti 11 900 + plánované výdaje tohoto měsíce z Plánu (Kurz keramiky 1 200, měsíčně) = **13 100 Kč**. Tichý popisek dlaždice: „nezaplacené + z Plánu“.

Plánované položky mají **měsíc** (i jednorázové), takže do měsíce vstupují jen ty, které v něm opravdu jsou: Faktura — klient Nordic +24 000 (říjen 2026), Zimní pneu + servis −4 300 (listopad 2026), Dovolená Chorvatsko −18 000 (červenec 2027), Kurz keramiky −1 200 (každý měsíc).

### 3.11 Cíl měsíce

Čtyři řádky pod sebou:

| řádek | hodnota | popisek |
|---|---|---|
| potřeba měsíce | **68 000 Kč** | ⓘ „rozpočet domácnosti 63 000 (výdaje + spoření) + splátky dluhů 5 000“ |
| přišlo | **41 000 Kč** | skutečně připsáno |
| na cestě | **24 000 Kč** | plánované příjmy měsíce (faktura Nordic) |
| schází | **3 000 Kč** | potřeba − přišlo − na cestě; při ≤ 0 zeleně „pokryto · +X Kč navíc“ |

Pod řádky dvousegmentový bar: zeleně přišlo, okrově na cestě.

### 3.12 Cashflow (výsledek měsíce = příjmy − výdaje)

| měsíc | příjmy | výdaje | výsledek |
|---|---|---|---|
| září (proběhlý) | 58 200 | 51 300 | +6 900 |
| říjen | 63 000 | 60 000 | +3 000 |
| listopad | 63 000 | 58 100 | +4 900 |
| prosinec | 63 000 | 55 500 | +7 500 |
| leden | 63 000 | 54 800 | +8 200 |
| únor | 63 000 | 52 500 | +10 500 |

Říjnové výdaje = `max(63 000 − spoření, výdaje + plánované)`. Plánované výdaje budoucích měsíců zahrnují i splátky dluhů — proto se z nich počítá pohyb rezervy.

---

## 4. Výpočty (všechno musí matematicky sedět)

```
výdaje          = Σ transakcí měsíce (bez podnikání a převodů) + předplatná (1 990) → 41 200
povinnosti      = nezaplacené pravidelné platby + předplatná + očekávané  → 11 900
plánované       = povinnosti + plánované výdaje měsíce z Plánu (1 200)    → 13 100
spoření         = částka nebo % z rozpočtu (nastavení v Plánu)   → 3 000
zbývá na útratu = 63 000 − výdaje − plánované − spoření          → 5 700
denní limit     = zbývá na útratu ÷ zbývající dny (9)            → 633
průměrné tempo  = variabilní výdaje (24 060) ÷ 21 dní            → 1 146 / den
projekce        = zbývá − (tempo × 9)                            → −1 610 (jemně varovná barva)
rezerva         = hotovost (3 600) − dluhy (42 000)              → −38 400
hotovost(m+1)   = hotovost(m) + výsledek měsíce − mimořádné výdaje toho měsíce
cíl měsíce      = 63 000 + splátky dluhů (5 000)                 → 68 000
schází          = cíl − přišlo (41 000) − na cestě (24 000)      → 3 000
čistí (dluh)    = ceil(zbývá ÷ splátka) měsíců od října 2026; souhrn = nejdelší dluh
výsledek měsíce = příjmy − výdaje (živě reaguje na změnu spoření) → +3 000
limit kategorie: zbývá = limit − utraceno; „dochází“ když zbývá < 20 % limitu;
                 přeteklo → zelený segment = limit, červený = přečerpání + „kryto z rezervy“
```

Aktivní limity v demu: Jídlo 11 000, Zábava 2 000, Doprava 3 500. Ostatní kategorie mají limit vypnutý („nastavit limit ›“).

---

## 4b. Jednotný vzor správy seznamů (CRUD)

Platí pro **předplatná, měsíční platby, roční platby, dluhy a plánované položky** — všude stejně:

- Na konci sekce tichý řádek **„+ přidat …“** → rozbalí inline formulář ve stejném vzoru jako plánované položky (Přidat / zrušit).
- U řádku **tužka** = inline úprava hodnot přímo v řádku (řádek se přepne na inputy + uložit/zrušit), **koš** = smazání. Ikony jsou tiché (opacity 0.45, na desktopu se rozsvítí na hover; na mobilu jsou vidět stále, 30–32 px cíle).
- U předplatných zůstává **⊘ = simulace zrušení** („co kdyby“) a je **první**, až za ním tužka a koš. ⊘ jen přeškrtne řádek a přepočítá úsporu, koš předplatné skutečně odebere.
- Každá akce potvrzena toastem („Předplatné přidáno: …“, „… — uloženo“, „Platba odebrána: …“).
- Změna se okamžitě propíše do všech souhrnů (předplatná/měs, měsíční platby, povinnosti, plánované, zbývá na útratu, denní limit, cashflow, hotovost).

## 5. Desktop

Fixní levý sloupec 212 px (sklo), obsah `max-width: 1180px`, padding `26px clamp(16px,2.4vw,32px) 64px`.

Karty jsou flexibilní: řádky `display:flex; flex-wrap:wrap; gap:16px; align-items:stretch` (karty v řádku mají stejnou výšku), jednotlivé karty `flex: <podíl> 1 <basis>; min-width: …` → při zúžení se přeskládají, nikdy se nemačkají.

**Menu** — wordmark `numo`, pak čtyři skupiny s jemným 1px předělem a tichým labelem (9,5 px, uppercase, tracking 0.1em, `#9DB3A5`):

- **Dnes** — Přehled
- **Měsíc** — Plán · Pravidelné
- **Dlouhodobě** — Vývoj · Dluhy
- **Data** — Transakce · Import

Dole karta účtu s popoverem (viz 5.7).

Volba měsíce (pill vpravo nahoře na Přehledu, Plánu, Pravidelných, Transakcích): klik otevře dropdown říjen / září / srpen / červenec 2026 s fajfkou u aktivního; klik mimo nebo na položku zavře.

### 5.1 Přehled — „Můžu utrácet a kde stojíme?“

Pod nadpisem tichý indikátor čerstvosti **„výpis k 21. 10.“**.

1. **Bilance** — mřížka `repeat(auto-fit,minmax(112px,1fr))`: **rozpočet 63 000 · výdaje 41 200 · plánované 13 100** (tichý popisek „nezaplacené + z Plánu“) **· spoření 3 000 · rezerva −38 400** (červeně, tichý popisek „celková pozice“, ⓘ tooltip s rozpadem hotovost − dluhy) a zelená dlaždice `span 2` **zbývá na útratu 5 700 Kč** (31 px mono). Pod mřížkou nad tenkou linkou řádek **„povinnosti 6/8 · zbývá 11 900 Kč ›“** s proklikem na Pravidelné. Klik na spoření → Plán.
2. **Denní limit** — velké mono číslo 633 Kč, ⓘ výpočet, pod tím „tímhle tempem skončíš −1 610 Kč“ s druhým ⓘ. Tooltipy na desktopu na hover i na klik.
3. **Obálky** — sloučené kategorie + rozpočty, plná šířka, 2 sloupce (`minmax(320px,1fr)`, column-gap 36 px). Kategorie s limitem: barevná tečka · název · stav *v klidu / dochází / nad plánem* · vpravo **zbývá X Kč** · dvousegmentový bar · tichý řádek „utraceno … z limitu … Kč“ (+ „· kryto z rezervy“ při přetečení). Bez limitu: tečka · název · utracená částka · **„nastavit limit ›“** → inline input + uložit/zrušit. V hlavičce odkaz „spravovat rozpočty ›“ na Plán.
4. **Útraty podle dnů** (heatmapa) — 7 sloupců `minmax(0,1fr)`, čtverce `aspect-ratio:1`, radius 5, max šířka 322 px. Sytost = útrata dne (5 stupňů: `#CFE3D5 · #A8CBB4 · #74AC8C · #45906A · #1C6B4A`; 0 Kč = `rgba(14,62,46,.05)`; budoucí dny = přerušovaný obrys). Hover = panel s rozpadem dne. Žádná legenda.
5. **Poslední transakce** — 4 řádky (avatar L/V, název, datum: dnes / včera / 19. 10., částka s Kč) + odkaz „všechny ›“.

Na Přehledu **není** cashflow, předplatná, plný seznam pravidelných plateb ani průměry.

### 5.2 Plán — „Jak nastavíme a zvládáme tenhle měsíc?“

1. **Cíl měsíce** — čtyři řádky pod sebou podle §3.11 (potřeba měsíce · přišlo · na cestě · schází) + dvousegmentový bar. Vedle něj v řádku Spoření.
2. **Spoření** — „Tento měsíc chceme ušetřit:“ radio **částku [3 000] Kč** / **procento [10] %** (textboxy stejně široké, jednotka mimo box), pod tím uzávěr sekce „tento měsíc ušetříme **3 000 Kč**“.
3. **Plánované příjmy a výdaje** (plná šířka) — seznam podle §3.10; u jednorázových je badge měsíce, u všech tužka a koš. Formulář: název · částka (Kč mimo box) · toggle **výdaj/příjem** · toggle **jednorázově/měsíčně** (default jednorázově) · **Přidat**. Výdaje tohoto měsíce jdou do dlaždice „plánované“, příjmy do řádku „na cestě“ v Cíli měsíce; ostatní měsíce ovlivňují cashflow a hotovost.
4. **Rozpočty** (plná šířka, **jeden sloupec** — řádky kategorií pod sebou) — „Kategorie, jejich rozpočty a skutečný stav“, stejný vzor jako obálky; tady je domov nastavování limitů.

**Uzávěr stránky**: jediný řádek **„výsledek měsíce podle plánu +3 000 Kč“** (zelené/červené, přepočítává se živě při změně spoření). Cashflow graf na Plánu není — je ve Vývoji.

### 5.3 Pravidelné — „Co jede samo a je to zaplacené?“

Hlavička: nadpis **Pravidelné** + pod ním souhrny oddělené středníkovými tečkami — předplatná **1 990 Kč**/měs · měsíční platby **24 774 Kč** · zaplaceno **6/8** · zbývá zaplatit **11 900 Kč**.

1. **Auto-detekce** (amber karta): „Vypadá to na předplatné — NVIDIA 598 Kč, každý měsíc kolem 21. Přidat mezi předplatná?“ [Přidat] [Není předplatné] + „Skutečné platby se automaticky párují na pravidelné.“
2. **Předplatná** — u každého řádku ikona ⊘ = simulace zrušení: řádek zešedne a přeškrtne se; dole souhrn „zkoušíš zrušit N — ušetříš **+X Kč/měs**“, druhý řádek „+X·12 Kč/rok“ + „zrušit simulaci“.
3. **Měsíční platby** — checklist se stavem zaplaceno (checkbox + den + částka), v hlavičce zaplaceno 6/8. Pod ním **splátky dluhů** jako ztlumené řádky s klikatelným badge **„dluh“** (→ Dluhy) a tichá věta, že jsou uvnitř platby ČSSZ + VZP a do součtů se nepřičítají.
4. **Roční platby** — s badge měsíce.

### 5.4 Vývoj — „Jak se to vyvíjí a kam to směřuje?“

Pod nadpisem tichá legenda „skutečnost zeleně · předpověď okrově“.

1. **Cashflow** (plná šířka) — viz 5.6.
2. **Hotovost v čase** (plná šířka) — křivka podle §3.7, `viewBox 0 0 900 268`, padL 72. Osa Y v „hezkých“ krocích, nulová linka výrazná, záporná zóna podbarvená `rgba(166,67,46,0.06)`. Proběhlé body zelené, forecast okrové, **měsíc pod nulou červený**. Vpravo v hlavičce „na účtech dnes 3 600 Kč“, nad grafem varovná věta, pokud křivka spadne pod nulu. Hover/klik na bod: u minulosti „hotovost na konci“, u dneška „na účtech dnes“, u forecastu „výsledek měsíce / jednotlivé mimořádné výdaje / hotovost na konci“.
3. **Trendy kategorií** (plná šířka, velký blok) — čtyři řady (Jídlo, Domácnost, Doprava, Zábava): název s barevnou tečkou (170 px) · sparkline 320×46 v barvě kategorie s bodem na posledním měsíci · vpravo říjnová hodnota (15 px) a „±X % proti průměru“ (nad průměrem `#9A5B22`, pod průměrem `#176A4E`).
4. **Průměry** — kompaktní karta na plnou šířku, hodnoty ve sloupcích `repeat(auto-fit,minmax(210px,1fr))`, `Kč/měs`.

### 5.5 Dluhy — „Co dlužíme a kdy budeme čistí?“

1. **Souhrn** — dlaždice **celkem dlužíme 42 000 Kč** (červeně) · **splácíme 5 000 Kč/měs** · zelená dlaždice **čistí ~červenec 2027** s tichým popiskem „podle nejdelšího dluhu“.
2. **Seznam dluhů** — každý dluh je blok: věřitel · **splaceno X z Y** · vpravo „zbývá“ · progress bar · pod tím splátka Kč/měs · den · **čistý ~měsíc rok** · účet + VS (mono, viditelné) · vpravo akce **zaznamenat platbu** (inline částka + datum → sníží zbývá, toast). Tužka upraví hodnoty v řádku, koš dluh smaže. Na konci „+ přidat dluh“ ve stejném vzoru jako plánované položky.

Přidání/odebrání dluhu okamžitě mění souhrn, odhad „čistí“, rezervu, cíl měsíce i řádky v Pravidelných.

### 5.6 Cashflow graf

Kreslí **výsledek měsíce** (ne kumulovaný zůstatek). Osa Y: 0 + 4 hodnoty, krok z „hezké“ řady (…, 2 500, 3 000, …, 12 500, …) tak, aby `krok × 4 ≥ maximum`; popisky ve tvaru `12 k`, `9 k`. Osa X: plné názvy měsíců. Nulová linka výrazná, ostatní přerušované; záporná zóna podbarvená jen když je nějaký měsíc v minusu.
Pod každou tečkou je výsledek měsíce (`+6 900`) na jemném bílém podkladu (radius 6 px) — zelený, u minusu červený. Hover / klik na tečku: číslo pod tečkou zmizí a zobrazí se rámeček — u proběhlého měsíce `příjmy +58 200 / výdaje −51 300 / výsledek měsíce +6 900`, u aktuálního a budoucího `plánované příjmy / plánované výdaje / předpokládaný výsledek`.
Proběhlé měsíce mají zelený bod, plánované okrový (`#C99A4B`).
Technika: SVG jen geometrie (mřížka, křivka bezier, body); **všechny popisky jsou HTML divy** absolutně pozicované v procentech nad SVG (v SVG `<text>` se interpolované hodnoty nevykreslí).

### 5.7 Transakce — „Najdu a opravím konkrétní platbu“

Nahoře volba měsíce (reálně přepíná říjen/září; srpen a červenec → toast „V prototypu jsou data za říjen a září 2026“).
Filtry: **Hledat** s ikonou lupy · dropdown **uživatelů** (Všichni / Lukáš / Věrka, vícenásobný výběr checkboxy) · řada chipů kategorií (aktivní tmavě zelený) · po tenkém svislém předělu dva **přerušovaně obtažené chipy Podnikání a Převody** (filtr na označené položky).
Seznam je seskupený po dnech („dnes“, „včera“, „pondělí 19. října“) s denním součtem (označené položky se do součtu nepočítají). Řádek: avatar L/V · název · badge „podnikání“/„převod“ (jen když je označeno) · dvě vedlejší akce (aktovka = podnikání, dvě šipky = převod; aktivní zeleně, druhý klik označení ruší) · chip kategorie s šipkou → dropdown pro přeřazení (toast „Zapamatuji si pravidlo: Penny → Jídlo“) · částka `−748 Kč`.
Označená transakce zešedne na 50 % a **vypadne ze všech metrik** (bilance, denní limit, obálky, heatmapa, kategorie, cashflow) — čísla se změní okamžitě. Prázdný výsledek → „Žádné transakce neodpovídají filtrům.“ + „zrušit filtry“.

### 5.8 Import — „Dostanu výpis dovnitř“

- **Idle**: drop area („Přetáhni výpis sem / nebo klikni a vyber soubor — **CSV**“; drag-over zezelená, po výběru ukáže `vypis-rijen-2026.csv`), textarea **Pokyny k souboru** (placeholder „např. Fio — společný účet. Karta 4321 je Věrky, ostatní Lukáše. Převody na spořicí účet ignoruj.“), tlačítko **Zpracovat** (neaktivní bez souboru) + „41 řádků · Fio — společný účet“. Vedle karta **Poslední importy** (Fio 23. 10. 38 plateb, Revolut — Věrka 2. 10. 21 plateb, Fio 24. 9. 41 plateb).
- **Loading** ~1,7 s: spinner + „Zpracovávám výpis / čtu řádky · páruju na pravidelné platby · hledám duplicity“.
- **Hotovo**: tři karty fungují jako **taby** napojené na panel pod nimi (mřížka `repeat(3,minmax(0,1fr))`, nezalamuje se). Aktivní tab má spodní rohy 0, přechází do panelu bez mezery a dvojité linky, neaktivní jsou o 12 px výš. Panel dorovnává rohy k aktivnímu tabu: první tab → levý horní roh panelu 0, poslední → pravý horní roh 0, prostřední → oba horní rohy zaoblené: **Přidáno 31** · **Duplicitní 6** · **Ke schválení 4** (amber). Neaktivní karta má „procházet ›“.
  - *Přidáno*: všechny řádky hned, u každého editovatelný chip kategorie (dropdown, toast s pravidlem).
  - *Duplicitní*: Albert 918 (15. 10.), Lékárna Benu 260 (15. 10.), Benzina 1 380 (13. 10.), Penny 534 (12. 10.), Lidl 1 018 (10. 10.), Voda 480 (8. 10.) — u řádku ikona lupy, hover ukáže existující platbu („už v Numu: 15. 10. · Albert · −918 Kč · Jídlo · Věrka“).
  - *Ke schválení*: NVIDIA 598, Kaufland 840, Parkování Letná 572, Alza 2 490 s vysvětlením — akce **Přidat** / **podnikání** / **převod** / **Zahodit** (obě prostřední jsou přerušovaně obtažené, potvrzují toastem „mimo součty domácnosti“ / „mimo všechny metriky“). Po vyřízení řádek zmizí a počet v tabu klesne; prázdný stav „Vyřízeno — nic tu nezůstalo. 🌱“.
- Vpravo nahoře „nahrát další výpis“ (reset).

### 5.9 Účet, nastavení, sdílení

Karta účtu vlevo dole: avatar LV, „Domácnost“, pod tím „osobní účet ·“ + dvě kolečka členů s bílým okrajem. Klik otevře popover: aktivní účet Domácnost (fajfka), **Lukáš s.r.o.** s ikonou zámku (podnikatelský, nedostupný), oddělovač, **Nastavení účtu ›**, **Založit nový účet** (deaktivované se zámkem).
Stránka **Nastavení účtu** má taby **Účet** / **Sdílení**:
- *Účet*: název (editovatelný), typ `osobní` + „podnikatelský připravujeme“, vlastník, **měsíční rozpočet 63 000 Kč**.
- *Sdílení*: Lukáš (vlastník, „(ty)“), Věrka (člen) — u členů „předat vlastnictví“ a koš; pozvání e-mailem + toggle **člen / jen čtení** + „Poslat pozvánku“ (přidá řádek „pozvánka odeslána“). Pod tím vysvětlení rolí.

Toasty (tmavě zelená pilulka dole na střed, 2,8 s) potvrzují každou akci.

---

## 6. Mobil (iPhone rám 402×874)

Spodní tab bar: **Přehled · Transakce · Plán · Víc** (44 px cíle). Plovoucí **+** nad barem → sheet **Zapsat výdaj** (částka, obchodník, chipy kategorií, kdo platil L/V, Uložit) — nová transakce se hned objeví ve feedu i v heatmapě a přepočítá Bilanci.

**Domů (Přehled)** — v hlavičce wordmark `numo`, vpravo pill „říjen · den 21 z 30“ a pod ním tichý **„výpis k 21. 10.“**. Pořadí:

1. hero karta: **zbývá na útratu 5 700 Kč** (40 px mono) + **denní limit 633 Kč** s ⓘ a projekcí,
2. **Obálky** (stejná logika jako desktop, odkaz „rozpočty ›“),
3. **Bilance** sekundárně: 2×2 dlaždice (rozpočet · výdaje · plánované · spoření) + **rezerva** s ⓘ a popiskem „celková pozice“ + řádek „povinnosti 6/8 · zbývá 11 900 Kč ›“,
4. **Útraty podle dnů** (tap na den = panel, pod heatmapou legenda méně–více),
5. **Poslední transakce** + „všechny transakce ›“.

**Tab Plán** = Cíl měsíce (čtyři řádky s ⓘ) · Spoření · Plánované příjmy a výdaje · Rozpočty · uzávěr „výsledek měsíce podle plánu +3 000 Kč“.

**Tab Víc** → **Pravidelné** (souhrny v hlavičce, auto-detekce, předplatná se simulací, měsíční platby + splátky dluhů, roční platby), **Vývoj** (Cashflow · Hotovost v čase · Trendy kategorií · Průměry), **Dluhy** (souhrn, seznam, formulář). **Import a Nastavení jsou neaktivní** s vysvětlením pod kartou. Každá podobrazovka má vlevo nahoře chevron ‹ zpět na Víc.

ⓘ tooltipy na mobilu reagují na tap a otevírají se pod textem přes celou šířku karty. Grafy reagují na tap (ne hover).

Texty tooltipů:
- denní limit: „Zbývá 8 700 − spoření 3 000 = 5 700 Kč na útratu. Děleno 9 zbývajícími dny = 633 Kč na den.“
- projekce: „Zatím utrácíš průměrně 1 146 Kč denně (variabilní výdaje 24 060 Kč ÷ 21 dní). Stejným tempem utratíš do konce měsíce ještě asi 10 310 Kč, tedy o 410 Kč víc, než zbývá.“
- rezerva: „Hotovost 3 600 Kč − dluhy 42 000 Kč = −38 400 Kč.“
- cíl měsíce: „Rozpočet domácnosti 63 000 Kč (výdaje + spoření) + splátky dluhů 5 000 Kč = 68 000 Kč.“

---

## 7. Stavy a chování, na která nezapomenout

- Každá interakce má okamžitý dopad na čísla (žádné „Uložit“ u filtrů, spoření, chipů kategorií, označení podnikání/převod ani u dluhů).
- Dropdowny (uživatelé, měsíc, kategorie) se zavírají klikem mimo (fixed overlay pod panelem).
- Přeřazení kategorie = „zapamatuji si pravidlo“ (toast), platí i pro import.
- Ikona = stav, ne text: checkbox zaplaceno, ⊘ simulace zrušení, koš mazání, lupa detail duplicity, aktovka podnikání, šipky převod.
- Prázdné stavy: „–“ místo vysvětlující věty, u filtrů nabídka „zrušit filtry“.
- Stav nikdy jen barvou — vždy barva + text (v klidu / dochází / nad plánem).
- Prototyp má data jen za říjen (a částečně září) 2026; ostatní měsíce odpoví toastem.

## 8. Co v prototypu není

Skutečné napojení na banku, přihlášení, více účtů (přepnutí je zamčené), zakládání účtu, mobilní Import a Nastavení, dark mode, historie beze říjnových dat.
