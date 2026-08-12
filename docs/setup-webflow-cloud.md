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

## 2. Nastav mount path na `/numo`

Při zakládání prostředí tě Webflow vyzve k zadání **mount path**. Zadej:

```
/numo
```

> **Tohle musí sedět přesně.** V kódu je `basePath: "/numo"` v souboru
> `next.config.ts`. Když zvolíš jinou cestu, appka se nenačte —
> napiš mi to a já cestu v kódu změním.

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

| Název                | Hodnota                              | Povinné |
| -------------------- | ------------------------------------ | ------- |
| `NUMO_PASSWORD`      | heslo do appky, které si vymyslíš    | ano     |
| `NUMO_SESSION_SECRET`| dlouhý náhodný řetězec               | ne, ale doporučuju |
| `ANTHROPIC_API_KEY`  | klíč z console.anthropic.com         | ne      |

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

Otevři `https://<tvoje-doména>/numo`. Máš vidět:

1. **přihlašovací obrazovku** — appka je celá za heslem, tohle je správně,
2. po zadání hesla stránku, kde stojí **Účty 1 · Uživatelé 2 · Kategorie 11**.

Když tam ta čísla jsou, znamená to, že appka běží, brána hesla drží
a databáze odpovídá. To je celý obsah fáze 1.

### Když něco nesedí

| Co vidíš                          | Co to znamená                                          |
| --------------------------------- | ------------------------------------------------------ |
| 404                               | mount path není `/numo` — napiš mi, jaký je             |
| „Databáze neodpovídá"             | migrace neproběhly; pošli mi log z deploye              |
| Heslo nikdy neprojde              | `NUMO_PASSWORD` není nastavené v tom správném prostředí |
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
