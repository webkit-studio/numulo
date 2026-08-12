# Master CSV — mapping sloupců a fingerprint

Tohle je návrh ke schválení (tvrdé zastávky č. 1 a 2). Postavený je nad
skutečným souborem, ne z hlavy: 1305 řádků, 2026-01-01 až 2026-07-31,
UTF-8 s BOM, oddělovač `;`, CRLF, 16 sloupců, žádné uvozovky.

## Mapping sloupců

| Sloupec v CSV     | Kam jde                | Poznámka |
| ----------------- | ---------------------- | -------- |
| `datum`           | `date`                 | Datum zaúčtování. `obdobi` z něj sedí na všech 1305 řádcích. |
| `datum_provedeni` | jen do `raw_json`      | Liší se u 942 řádků (karta se zaúčtuje později) — viz otázka níže. |
| `castka_celkem`   | `amount`               | **Ne `castka`.** `castka + poplatek = castka_celkem` platí přesně; 11 řádků má poplatek za výběr, který by se jinak ztratil. |
| `castka`, `poplatek` | jen do `raw_json`   | Rozpad zůstává dohledatelný. |
| `ucet_cislo`      | do fingerprintu, `raw_json` | 5 bankovních účtů domácnosti. |
| `typ`             | řídí čtení protistrany | U karet je `protistrana` držitel karty, ne obchod. |
| `protistrana`     | `merchant` u převodů   | „ČEZ - Záloha na elektřinu", „Věra Svobodová". |
| `popis`           | `description`, `merchant` u karet | U karet obchod + adresa; obchod = část před první čárkou. |
| `karta`           | fallback pro vlastníka | Každá karta patří právě jednomu člověku. |
| `kdo`             | `owner_id`             | Prázdné u 398 řádků. |
| `protiucet`       | do fingerprintu        | Bude potřeba na párování splátek dluhů. |
| `interni_prevod`  | `is_transfer`          | 226 řádků `ano`, jejich součet je **přesně 0** — převody mezi 5 účty jsou spárované. |
| `zdroj_souboru`   | jen do `raw_json`      | |
| — | `is_business` | **V CSV není.** Zatím u všech `false`, viz otázka níže. |
| — | `category_id` | V CSV není; 285 řádků odvozeno z účtu, zbytek čeká. |

### Co z toho vypadlo navíc

- **Vlastník z karty**: sloupec `kdo` pokryl 907 řádků, mapa karta → člověk
  doplnila dalších 26. Zbylých 372 řádků kartu nemá vůbec (převody, trvalé
  příkazy, úroky) — tam vlastník nepatří.
- **Jídlo z účtu**: „Společný účet - Jídlo" (2053627033) neslouží k ničemu
  jinému, takže všech 285 řádků na něm dostalo kategorii Jídlo bez ptaní.
- **VS z textu**: v CSV není samostatný sloupec, ale u 37 řádků je VS uvnitř
  popisu (`VS7456781600`). Vytahuju ho regexem — bude potřeba na dluhy.

## Fingerprint — návrh se změnou

Zadání navrhovalo `sha256(date|amount|currency|counterparty_account|vs|normalized_description)`.
**Nad reálnými daty to nefunguje.**

V souboru je **16 skupin, celkem 33 řádků**, které jsou identické ve *všech*
šestnácti sloupcích — dvě nebo tři jízdenky koupené tentýž den za stejnou
částku na stejné zastávce. Ověřoval jsem, jestli je neodliší aspoň
`datum_provedeni`, `karta` nebo `protistrana`: neodliší. Naivní fingerprint
by je sloučil a `ON CONFLICT DO NOTHING` by **tiše zahodil 17 skutečných
plateb** — měsíční součty by přestaly sedět s bankou a nikdo by nevěděl proč.

Navrhuju přidat dvě složky:

```
sha256( date | amount | currency | counterparty_account | vs
      | normalized_description | own_account | occurrence )
```

- **`own_account`** — číslo vlastního účtu. Bez něj by se tatáž platba, která
  se objeví na dvou sledovaných účtech, deduplikovala sama proti sobě.
- **`occurrence`** — pořadové číslo v rámci skupiny jinak identických řádků
  (0, 1, 2…). Idempotence tím netrpí: tentýž soubor dá tytéž skupiny ve
  stejném pořadí, takže tytéž fingerprinty.

Výsledek nad skutečným souborem: **1305 unikátních fingerprintů z 1305
řádků** (naivní složení jich dávalo 1289). Druhý běh téhož souboru přidá
0 řádků — otestováno.

## Kontrolní součty po měsících

Převody jsou mimo příjmy i výdaje. Porovnej proti výpisům:

| měsíc   | řádků | převody | příjmy  | výdaje  |
| ------- | -----:| -------:| -------:| -------:|
| 2026-01 |   163 |      24 |  57 237 |  50 322 |
| 2026-02 |   158 |      30 |  45 678 |  52 499 |
| 2026-03 |   144 |      16 |  43 328 |  54 876 |
| 2026-04 |   201 |      36 | 104 543 |  86 010 |
| 2026-05 |   216 |      46 | 195 625 | 132 971 |
| 2026-06 |   207 |      32 |  18 482 |  97 193 |
| 2026-07 |   216 |      42 | 126 626 |  81 995 |
| **celkem** | **1305** | **226** | **591 520** | **555 865** |

Hranice historie (`initial_balance_date`) se nastavila na **2026-07-31** —
poslední datum v souboru. Reálné výpisy začínají až za ním.

## Co ještě potřebuju rozhodnout

### 1. Co je podnikání?

V CSV žádný příznak podnikání není a bez něj budou průměry domácnosti lhát.
Z dat to vypadá takhle — potřebuju od tebe potvrdit:

- **Účet „Hlavní" (2840679019)** — 300 548 Kč příjmů za 7 měsíců, samé
  příchozí úhrady s VS a textem „Úhrada faktury č. 2026000X. Odběratel…".
  Vypadá to na fakturační účet OSVČ.
- **Účet „Předplatná" (2840679035)** — 27 123 Kč výdajů: Anthropic/Claude,
  Webflow, Relume, Notion. To jsou nástroje na práci, ne rodinná zábava.
- Na „Hlavním" jsou ale i platby kartou v Tescu a na benzínce, takže „celý
  účet = podnikání" nebude sedět úplně.

### 2. Datum zaúčtování, nebo datum provedení?

Beru `datum` (zaúčtování), protože z něj je odvozené `obdobi` a měsíční
součty tak sedí na výpisy z banky. `datum_provedeni` by bylo pravdivější
k tomu, kdy jste opravdu utráceli (liší se u 942 řádků, typicky o 2–4 dny),
ale rozešlo by čísla s bankou. Přepnutí je jednořádkové.

### 3. Revolut

V datech je „Revolut**3025*" jako běžný výdaj (14 755 Kč / 7 plateb) — dobití
Revolutu, který mezi těmito 5 účty není. Až začneš importovat výpisy
z Revolutu, stane se z toho převod mezi sledovanými účty a bude ho potřeba
přeznačit, jinak se ta částka započítá dvakrát.
