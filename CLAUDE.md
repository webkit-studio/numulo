# Numulo — čti tohle před první změnou

Rozpočet pro jednu domácnost. Next.js 15 (App Router) na Netlify, data
a přihlašování v Supabase. Čeština v UI, angličtina v komentářích kódu,
čeština v commit messages.

Tenhle soubor není popis funkcí — ty jsou v README. Je to seznam věcí,
které v téhle codebase nejsou náhoda, a rozbijí se tiše, když se změní
bez rozmyslu.

---

## 1. Devět pravidel, která platí bez výjimky

### Peníze jsou celá čísla haléřů

Všude. V databázi `bigint`, v TypeScriptu `number`, v testech `number`.
Jediné místo, kde se převádí na koruny, je `src/lib/money.ts`
(`czkToHalere`, `halereToCzk`, `formatCzk`).

Kdo někde zapomene převod, dostane číslo stokrát vedle a **nic se nezlomí** —
jen se od té chvíle bude domácnosti zobrazovat jiná částka, než utratila.
Proto nikdy nepočítej v korunách a nepřeváděj až na konci.

```ts
// špatně — desetinná čísla se sčítají s chybou a Kč se míchají s haléři
const total = rows.reduce((s, r) => s + r.amount / 100, 0);

// správně — sčítá se v haléřích, převádí až formatCzk
const total = rows.reduce((s, r) => s + r.amount, 0);
```

### Autorizaci dělá databáze, ne kód

Každá tabulka má row-level security navázanou na členství v domácnosti
(funkce `is_member(household_id)`). 16 tabulek, 16× zapnutá RLS, 57 policies.

Z toho plyne:

- **Nikdy nepřidávej `.eq("household_id", …)` jako bezpečnostní opatření.**
  Už je to vynucené. Přidat to jako filtr, když opravdu chceš jednu
  konkrétní domácnost, je v pořádku — jako ochranu ne, protože to svádí
  k domněnce, že bez toho filtru je díra.
- **Nikdy nepoužívej service-role klíč.** V repu ani v aplikaci žádný není
  a být nemá. Obchází celou RLS.
- Když dotaz vrací prázdno, první hypotéza je chybějící členství, ne
  chybějící data.

Jediné dvě cesty skrz tu zeď jsou `create_household()` a `join_household()` —
`SECURITY DEFINER` funkce, protože musí zapsat členství do domácnosti, kde
volající ještě členem není. Každá si kontroluje svoje podmínky. Když
přidáváš další `SECURITY DEFINER` funkci, ptej se, jestli to fakt musí být.

### Prohlížeč s Supabase nemluví

Žádný `createBrowserClient`. Všechno jde přes Server Components
(`src/lib/supabase/server.ts`) nebo Server Actions (`src/app/actions/*`).

Proto může být session cookie `httpOnly` a `secure`
(`src/lib/supabase/cookies.ts`) — nic ve stránce ji nepotřebuje číst.
**Kdyby někdo přidal klientského Supabase klienta, ta cookie přestane
fungovat** a řešením není zrušit `httpOnly`, ale ten klient nepřidávat.

### Výpočty jsou čisté funkce a testy hlídají specifikaci

`src/lib/calc/index.ts` nezná databázi. Bere čísla, vrací čísla.
`src/lib/calc/calc.test.ts` je připíchnutý na demo měsíc ze specifikace
(`design_handoff_numo/NUMO-SPEC.md`, §3 a §4): výdaje 41 200, cíl měsíce
68 000, denní limit 633, projekce −1 610, dluhy 42 000…

**Když ti po změně vzorce spadne test, je to funkce, ne vada.** Znamená to,
že se výsledek rozešel se specifikací. Buď je změna špatně, nebo se
specifikace mění vědomě — a pak se mění i test, v jednom commitu a s
vysvětlením. Nikdy test neupravuj proto, aby prošel.

### Model nikdy nečte řádky dat

`src/lib/ai/columns.ts` je jediné místo, kde se volá Claude. Dostane
**nadpisy sloupců** výpisu a poznámku od uživatele. Žádnou částku, žádného
obchodníka, žádné datum. Co vrátí, se ověří proti skutečným nadpisům
a co nesedí, se zahodí.

Model tedy *mapuje*, rozhoduje kód. Bez `ANTHROPIC_API_KEY` se ta část
přeskočí a import jede dál na deterministickém odhadu
(`src/lib/import/mapping.ts`). **Nerozšiřuj to na parsování dat** — chyba
v mapování sloupců je vidět, chyba v parsování řádku ne.

### Žádný read-only seznam

Cokoli, co se zobrazuje jako seznam, jde přidat, upravit a smazat. Vzor je
jeden (specifikace §4b): tichý řádek „+ přidat“, tužka = inline úprava,
koš = smazání, toast potvrdí.

Neimplementuje se znovu. Popíšeš sloupce v `src/lib/lists/registry.ts`
a `<CrudList listKey="…">` z toho postaví formulář i akce. Viz §4 níž.

### Datumy jsou ISO řetězce

`YYYY-MM-DD` pro dny, `YYYY-MM` pro měsíce. Žádné `Date` objekty
v doménové logice — porovnávají se lexikograficky a nemají časové pásmo,
o které by šlo přijít. Pomocné funkce v `src/lib/date.ts`.

Výjimka: `todayIso()` v `src/lib/data/months.ts` čte skutečný čas
v pásmu `Europe/Prague`, protože domácnost žije tam.

### Dvě slova se nesmí objevit v kódu ani v UI

Uživatel je vyjmenoval a platí to bez výjimky — **„bazén“** a
**„výplata“**. Ani v záporu, ani ve vysvětlivce: věta „rozpočet není
výplata“ pravidlo porušuje. Napiš „kolik za měsíc smí odejít“.

(Tenhle soubor je ta jediná výjimka. Zákaz se týká aplikace; kdyby ho
dokumentace nesměla pojmenovat, musel by ho každý hádat.)

Kontrola před pushem:

```bash
grep -rni "bazén\|výplat" src/
```

Stavy se pojmenovávají *v klidu / dochází / nad plánem*, nikdy jen barvou.

### Repozitář je veřejný

`webkit-studio/numulo` je public. **Žádný klíč, heslo ani SMTP údaj do
repa.** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` je veřejný záměrně (sám
o sobě nedává nic, RLS drží zbytek), ale `ANTHROPIC_API_KEY`, servisní klíč
Supabase a klíč Resendu patří do proměnných prostředí na Netlify,
respektive do nastavení Supabase.

Kontrola před pushem — hledá klíče v plné délce, takže placeholdery
v `.env.example` nehlásí:

```bash
git ls-files | xargs grep -lE "re_[A-Za-z0-9_]{20,}|sb_secret_[A-Za-z0-9_-]{10,}|sk-ant-[A-Za-z0-9_-]{20,}"
```

---

## 2. Kudy tečou data

```
prohlížeč
   │  formulář (progressive enhancement — funguje i bez JS)
   ▼
Server Action  src/app/actions/*.ts        ← "use server", validace tvaru
   │
   ▼
Supabase klient  src/lib/supabase/server.ts ← cookie = identita
   │
   ▼
Postgres + RLS   ← tady se rozhoduje, kdo co smí
```

Čtení jde opačně a bez akcí: Server Component zavolá funkci z
`src/lib/data/*`, ta se zeptá Supabase a vrátí hotový tvar pro UI.

**Server Action po zápisu volá `revalidatePath("/", "layout")`.** Ne
z lenosti: změna jedné pravidelné platby hne povinnostmi, plánovaným,
zbývá na útratu, denním limitem, cashflow i hotovostí — tedy skoro každou
obrazovkou. Revalidovat jen aktuální cestu by nechalo ostatní čísla stará.

---

## 3. Kde co je

### Doménová logika (bez databáze, testovaná)

| soubor | co dělá | test |
|---|---|---|
| `lib/calc/index.ts` | všechny vzorce ze specifikace §4 | `calc.test.ts` |
| `lib/money.ts` | haléře ↔ koruny, formátování | v `calc.test.ts` |
| `lib/date.ts` | ISO datumy, názvy měsíců, „dnes / včera“ | — |
| `lib/import/sniff.ts` | kódování, oddělovač, hlavička CSV | `mapping.test.ts` |
| `lib/import/mapping.ts` | nadpis sloupce → pole | `mapping.test.ts` |
| `lib/import/fingerprint.ts` | otisk řádku (klíč na duplicity) | — |
| `lib/import/pipeline.ts` | parsování → klasifikace → souhrn | — |
| `lib/recurring/detect.ts` | co vypadá jako předplatné | `detect.test.ts` |
| `lib/debts/match.ts` | párování plateb na dluhy | `match.test.ts` |
| `lib/lists/registry.ts` | popis sloupců všech editovatelných seznamů | — |

### Datová vrstva (čte Supabase, vrací tvar pro UI)

| soubor | vrací |
|---|---|
| `lib/data/household.ts` | přihlášený člověk + jeho domácnost, členové |
| `lib/data/month.ts` | `getMonthSnapshot()` — **každé číslo na Přehledu jedním průchodem** |
| `lib/data/months.ts` | které měsíce mají data, který zobrazit |
| `lib/data/trends.ts` | cashflow, hotovost v čase, trendy, průměry |
| `lib/data/lists.ts` | řádky libovolného seznamu z registru |

`getMonthSnapshot()` je schválně jeden velký objekt: čísla ze specifikace
do sebe zapadají (výdaje → zbývá → denní limit → projekce) a kdyby si je
každá komponenta odvozovala sama, první rozpor by nebyl vidět.

### Obrazovky

`src/app/(app)/` — vše za přihlášením. `layout.tsx` dělá redirecty
(bez session → `/prihlaseni`, bez domácnosti → `/zalozit`) a drží
`ToastProvider` a mobilní FAB.

`src/app/prihlaseni | registrace | heslo | zalozit` — veřejné, mimo shell.

Konvence: `page.tsx` je Server Component (načte data), vedle něj leží
klientské komponenty s interakcí. Data se předávají jako props, ne
načítají v klientu.

### Design

`src/app/globals.css`, ~1700 řádků, jeden soubor. Tokeny nahoře
(`--ink`, `--green`, `--r-2xl`, …), pak komponenty. Žádný Tailwind,
žádné CSS moduly. Hodnoty pocházejí z `design_handoff_numo/` — když
specifikace a design-tokens nesouhlasí, vyhrává specifikace, protože
screenshoty jsou vyrenderované z ní.

---

## 4. Přidat seznam = přidat řádek do registru

Předplatná, měsíční platby, roční platby, plánované položky a dluhy
vypadají a chovají se stejně, protože **je nikdo nepsal pětkrát**.

Šestý seznam se dělá takhle:

```ts
// src/lib/lists/registry.ts
mujseznam: {
  table: "muj_seznam",          // tabulka musí existovat a mít RLS
  noun: "Položka",              // do toastu: "Položka přidána: …"
  titleField: "name",
  addLabel: "+ přidat položku",
  fields: [
    { key: "name",   label: "název",  kind: "text",  grow: 2 },
    { key: "amount", label: "částka", kind: "money" },
  ],
  defaults: { active: true },
}
```

```tsx
<CrudList listKey="mujseznam" householdId={household.id} rows={rows} />
```

Formulář, validace, inline úprava, mazání i toasty z toho vyplynou.
`kind` může být `text | money | day | monthNumber | choice | month`;
`money` bere koruny na vstupu a ukládá haléře.

Registr je zároveň bezpečnostní hranice generických akcí
(`src/app/actions/lists.ts`): klient posílá *klíč seznamu*, ne název
tabulky, takže se nedá sáhnout jinam.

---

## 5. Databáze

Schéma žije v Supabase (projekt `Numulo`, region `eu-central-1`), migrace
mají prefix `numulo_`. V repu není — pull jde přes `supabase db pull`.

16 tabulek, všechny s `household_id` a stejnou čtveřicí policies
(select/insert/update/delete přes `is_member`). Výjimka: `join_attempts`
nemá **žádnou** policy schválně — čte ji jen `join_household()` zevnitř.

Poznámky, které nejsou zřejmé ze schématu:

- `transactions.fingerprint` + `household_id` je unikátní. Import na to
  spoléhá: co obrazovka označí za duplicitu, to insert opravdu neuloží.
- `recurring_payments` = „zaplaceno v tomhle měsíci“. Existence řádku *je*
  ten stav; není žádný boolean, který by se mohl rozejít.
- `subscriptions.simulated_cancel` je simulace „co kdybychom zrušili“.
  Není to `active` a není to `status` — předplatné existuje dál.
- `planned_items.month` **databáze nevynucuje**, ale jednorázová položka
  bez měsíce nespadne do žádného měsíce a tiše zmizí ze všech součtů
  (`appliesThisMonth` v `lib/data/month.ts` porovnává `row.month === month`).
  U `interval = 'monthly'` se `month` ignoruje.
- `categories.monthly_limit = NULL` znamená „limit nikdo nenastavil“.
  Nula by znamenala „nesmíš utratit nic“ a obálka by hned svítila červeně.

---

## 6. Než pushneš

```bash
npm test        # 72 testů, 4 soubory — musí projít všechny
npm run build   # produkční build, musí být bez chyby
npx tsc --noEmit
```

`npm run dev` běží na `:3000` a potřebuje `.env.local` (vzor v
`.env.example`).

Commit messages česky, v tónu ostatních — co se změnilo a **proč**, ne výpis
souborů. Malé commity.

### A srovnej dokumentaci

**Když je změna hotová, přepiš README a tenhle soubor tak, aby popisovaly
stav po ní.** Ne co se změnilo — jak to teď je.

Historie patří do commitů a do popisu PR; tam je dohledatelná i za rok.
Dokumentace, která si vede kroniku („dřív to bylo X, pak jsme přešli na Y,
teď je to Z“), po pár měsících nikomu neřekne, co platí dneska — a to je
jediná otázka, kvůli které ji kdo otevře.

Takže:

- **píše se v přítomném čase** — „e-maily jdou přes Resend“, ne „přešli
  jsme na Resend“,
- **staré tvrzení se nahradí, nepřipíše se pod něj**,
- **čísla se opraví** — když přibude test, změň „72 testů“; když přibude
  tabulka, změň „šestnáct tabulek“. Nesedící číslo v dokumentaci učí
  čtenáře nevěřit zbytku,
- **žádná sekce „changelog“ ani „co je nového“.**

Jediná výjimka je §8 níž: pár vět o minulosti, které vysvětlují, proč něco
v kódu vypadá divně. Tam patří jen to, co by jinak vedlo k chybnému
zásahu — ne seznam toho, co se kdy udělalo. Když důvod pomine, věta se
smaže.

Ověř, co píšeš. Tvrzení v dokumentaci se dá zkontrolovat dotazem do
databáze nebo grepem; hádat se nemá.

---

## 7. Čeho se nedotýkat bez rozmyslu

- **`design_handoff_numo/`** — zadání od uživatele. Referenční, needituje se.
- **`src/middleware.ts`** — matcher schválně nepouští `_next/*` a ikony;
  rozšíření na všechno by protáhlo každý statický soubor ověřením session.
- **`.env.local`** — není v gitu a nemá být.
- **Netlify env vars** — `NEXT_PUBLIC_SUPABASE_URL` a
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` musí existovat v konfiguraci
  projektu, ne jen lokálně. Když chybí, aplikace to řekne jménem proměnné
  (`src/lib/supabase/config.ts`) místo prázdné pětistovky.

---

## 8. Tři věty o minulosti, bez kterých se sáhne špatně

Ne changelog — jen to, co jinak svádí k chybnému zásahu. Když důvod
pomine, věta odsud zmizí.

- **Komentáře občas zmiňují „předchozí verzi“.** Je to verze na Webflow
  Cloudu s vlastním přihlašováním, která data scopovala konstantou
  `ACCOUNT_ID`. Nehledej ji v repu, není tam — a nekopíruj z ní vzory.
- **Slovo „numo“ nepatří do kódu ani do UI.** Aplikace se tak jmenovala,
  než dostala jméno Numulo. Když ho někde najdeš, je to pozůstatek.
- **Změna hesla v Nastavení účtu není duplicita k odkazu v e-mailu.**
  Rutinní změna nemá viset na odesílateli, kterého jde vyčerpat; odkaz je
  pro toho, kdo se dovnitř nedostane vůbec. Neslučuj to.
