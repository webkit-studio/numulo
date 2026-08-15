# Nastavení Webflow Cloudu — krok za krokem

Tohle jsou kroky, které musíš odklikat ty; z mé strany je nemám jak udělat.
Počítám s tím, že nejsi vývojář — kde je potřeba něco zkopírovat, je to
napsané doslova. Celé to zabere zhruba 20 minut.

Až budeš hotový, napiš mi **URL prostředí** (staging i produkce) a já podle
nich zkontroluju, že to nahoře opravdu běží.

---

## 1. Založ Webflow Cloud app

1. Ve Webflow dashboardu klikni **New Project → App**
   (nebo rovnou <https://webflow.com/dashboard/cloud/deploy>).
2. Klikni **Connect GitHub** a povol Webflow přístup k repozitáři
   `webkit-studio/numo-budget-app`.
3. Vyber ten repozitář a klikni **Import**.
4. Pojmenuj app **numo**.

## 2. Mount path

Při zakládání prostředí tě Webflow vyzve k zadání **mount path**. Je jedno,
co zvolíš — kód se přizpůsobí:

- **kořen (`/`)** — appka poběží na `https://tvoje-doména/`. Tohle máš
  nastavené teď a nic dalšího dělat nemusíš.
- **podcesta (`/numo`)** — appka poběží na `https://tvoje-doména/numo`.
  V tom případě přidej do proměnných prostředí (krok 4)
  `NEXT_PUBLIC_BASE_PATH` = `/numo`.

Mount path svého prostředí poznáš v logu deploye na řádku
`COSMIC_MOUNT_PATH:`.

> Původně jsem měl cestu `/numo` natvrdo v kódu a první deploy na tom spadl.
> Teď se bere z proměnné prostředí a obě varianty jsou odzkoušené.

## 3. Založ dvě prostředí

| Prostředí | Větev  | K čemu                          |
| --------- | ------ | ------------------------------- |
| Produkce  | `main` | ostrá appka                     |
| Staging   | `dev`  | sem se dívej, když ti něco pošlu |

Obě mají stejný mount path `/numo`, ale **vlastní databázi** — staging si
můžeš rozbít, jak chceš, produkce o tom neví.

## 4. Nastav proměnné prostředí

V každém prostředí (produkce i staging) otevři **Settings → Environment
variables** a přidej:

| Název                  | Hodnota                            | Povinné |
| ---------------------- | ---------------------------------- | ------- |
| `RESEND_API_KEY`       | klíč z resend.com                  | ne, ale bez něj nefunguje obnova zapomenutého hesla |
| `NUMO_MAIL_FROM`       | např. `numo <numo@svobs.cz>`       | ne      |
| `ANTHROPIC_API_KEY`    | klíč z console.anthropic.com       | ne      |
| `NUMO_SESSION_SECRET`  | dlouhý náhodný řetězec             | ne      |
| `NEXT_PUBLIC_BASE_PATH`| jen když mount path není kořen     | ne      |

**Žádné heslo se tu nenastavuje.** Přihlašuje se e-mailem a heslem, které si
každý zvolí sám při prvním přihlášení — viz krok 6.

`NUMO_SESSION_SECRET` nechávat nemusíš: když ho nenastavíš, numo si ho při
prvním spuštění vygeneruje samo a uloží do databáze.

Poznámky:

- **`NUMO_PASSWORD`** je jedno sdílené heslo pro tebe i Věrku. Dej mu
  aspoň 16 znaků — appka bude na veřejné adrese. Na staging klidně jiné
  než na produkci. **Nikdy mi ho neposílej** a nedávej ho do repa.
- **`NUMO_SESSION_SECRET`** — když ho nastavíš, změna hesla nevyhodí
  přihlášené. Když ho nenastavíš, appka funguje taky, jen po každé změně
  hesla se oba musíte přihlásit znovu. Vygeneruj si ho třeba na
  <https://www.random.org/strings/> (aspoň 32 znaků).
- **`ANTHROPIC_API_KEY`** je potřeba až ve fázi 4. Bez něj appka běží
  normálně, jen se skryjí AI funkce (návrh mapování sloupců u neznámého
  CSV, návrh kategorie u neznámého obchodníka).

## 5. Deployni

Klikni **Deploy**. Webflow Cloud sám:

- postaví appku,
- založí SQLite databázi (binding `DB`) a Object Storage bucket
  (binding `IMPORTS`),
- spustí migrace ze složky `migrations/` — tím se založí tabulky a nasype
  se seed: účet „Domácnost", uživatelé Lukáš a Věrka, kategorie.

## 6. Zkontroluj, že to jede

Otevři adresu prostředí (při kořenovém mountu `https://<tvoje-doména>/`).
Máš vidět **přihlašovací obrazovku** — appka je celá za přihlášením, to je
správně.

### První přihlášení

V databázi jsou dva účty: `lukas@svobs.cz` a `vera@svobs.cz`. Heslo zatím
ani jeden nemá.

1. Klikni **„Nastavit nebo zapomenuté heslo"**.
2. Zadej svůj e-mail a klikni **Pokračovat**.
3. Protože heslo ještě nemáš, appka tě rovnou pustí si ho nastavit
   (aspoň 10 znaků). Po uložení jsi přihlášený.
4. Věrka udělá totéž se svým e-mailem.

> **Udělej to hned po prvním deployi.** Dokud si heslo nenastavíš, mohl by
> si ho pro tvůj e-mail nastavit kdokoli, kdo tu adresu zná. Jakmile heslo
> existuje, tahle cesta se pro daný účet **natrvalo zavře** a další změna už
> jde jen přes odkaz v e-mailu.

Potřebuješ jiné e-maily než `@svobs.cz`? Řekni a změním je migrací —
registrace je záměrně jen pro adresy, které v databázi už jsou, aby si
cizí člověk nemohl založit přístup k vašim financím.

### Zapomenuté heslo

Stejná cesta: e-mail → Pokračovat. Když už heslo existuje, přijde odkaz
platný hodinu a použitelný jednou. **Tohle vyžaduje `RESEND_API_KEY`** —
bez něj appka řekne, že odesílání není nastavené.

### Kontrola, že databáze žije

Po přihlášení musí stránka ukazovat **Účty 1 · Uživatelé 2 · Kategorie 11**.
Když tam ta čísla jsou, appka běží, přihlášení drží a databáze odpovídá.

### Když něco nesedí

| Co vidíš                          | Co to znamená                                          |
| --------------------------------- | ------------------------------------------------------ |
| `could not find package.json`     | Webflow staví větev, kde kód ještě není — zkontroluj, že prostředí míří na `main` a že je tam smergovaný PR |
| 404 nebo rozbité styly            | `NEXT_PUBLIC_BASE_PATH` nesedí s `COSMIC_MOUNT_PATH` z logu deploye |
| „Databáze neodpovídá"             | migrace neproběhly; pošli mi log z deploye              |
| „E-mail nebo heslo nesedí"        | heslo ještě nemáš — jdi přes „Nastavit nebo zapomenuté heslo" |
| „Odesílání e-mailů není nastavené"| chybí `RESEND_API_KEY`                                  |
| Účty 0 · Uživatelé 0              | migrace proběhly, ale seed ne; pošli mi log             |

---

## Co ode mě ještě potřebuješ (4 tvrdé zastávky)

Tyhle čtyři věci nejde odhadnout a bez nich se fáze 2 nedá začít.
Podrobně jsou rozepsané v `docs/decisions.md`.

1. **Vzorky CSV** — master CSV (7 měsíců historie), reálný výpis z Air Bank
   a reálný výpis z Revolutu. Klidně s vymyšlenými částkami, ale
   se skutečnou strukturou souboru.
2. **Složení fingerprintu** — až budu mít vzorky, předložím ti návrh
   a ty ho odsouhlasíš.
3. **Design tokeny** — bundle z Claude Design se mi odsud nepodařilo
   stáhnout, viz `docs/design-tokens-mapping.md`.
4. **Počáteční stav pro Rezervu** — kolik máte dnes celkem na sledovaných
   účtech a k jakému datu.

## Proměnné prostředí — doplněk k v1.0

Nastavují se v Webflow Cloud UI (Environment → Variables), nikdy v repu.

| Proměnná | Povinná | K čemu |
| --- | --- | --- |
| `NUMO_SESSION_SECRET` | ne | Podpis session cookie. Bez ní si numo klíč vyrobí samo a uloží do databáze. |
| `RESEND_API_KEY` | ne | Odeslání odkazu na nastavení / zapomenuté heslo. |
| `NUMO_MAIL_FROM` | ne | Odesílatel těch e-mailů, např. `numo <numo@svobs.cz>`. |
| `ANTHROPIC_API_KEY` | ne | AI vrstva. Bez ní appka běží a AI prvky se skryjí. |
| `TURNSTILE_SECRET_KEY` | pro registraci | Ochrana proti botům na registračním formuláři. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | pro registraci | Veřejný klíč Turnstile, vykreslí se do formuláře. |

### Turnstile

1. V Cloudflare dashboardu → Turnstile → Add site, doména nasazení.
2. Site key jde do `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, secret do `TURNSTILE_SECRET_KEY`.
3. Bez obou zůstane registrace zavřená — stránka `/registrace` to napíše rovnou.
   Otevřený formulář s tiše vypnutou kontrolou je horší než žádný, protože
   vypadá chráněně a nikdo by se nedozvěděl opak.

Pro lokální vývoj má Cloudflare testovací klíče, které vždycky projdou:
`1x00000000000000000000AA` (site) a `1x0000000000000000000000000000000AA`
(secret). Do produkce nepatří.

## Object Storage

Binding `IMPORTS` (bucket `numo-imports`) drží syrové CSV soubory tak, jak
přišly. Každé číslo v numo se z nich dá znovu spočítat. Když binding chybí,
import projde a jen se nearchivuje — v historii importů je pak u záznamu
„bez archivu".
