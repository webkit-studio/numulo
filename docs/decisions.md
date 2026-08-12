# Rozhodnutí, odchylky a otevřené otázky

Zápisník toho, co jsem musel rozhodnout sám, kde jsem se odchýlil od zadání
a na co potřebuju odpověď od tebe. Aktualizuju ho průběžně.

---

## 1. Co v repu ani v prostředí nebylo

### `docs/numo-spec.md` chybí

Prompt ji uvádí jako přiloženou a jako zdroj pravdy pro §2 vizuál, §3 demo
data, **§4 výpočty (závazné)**, §5.7 chování importu, §6 mobilní vzory a §7
stavy. V repu byl při startu jen `README.md`, spec nikde.

Důsledek: naprogramoval jsem **jen ty vzorce, které stojí doslova v promptu**
(Rezerva, Cíl měsíce, cashflow forecast, hotovost v čase, odhad splacení
dluhů) a nechal jsem být ty, které bez spec §4 neznám — **denní limit** a
**obálky**. Radši je nechám nenapsané, než abych vymyslel čísla, která pak
budou v appce vypadat autoritativně a budou špatně.

**Potřebuju od tebe:** `docs/numo-spec.md`. Až dorazí, projedu §4 proti
existujícím testům a doplním chybějící výpočty.

### Design bundle není dosažitelný

Viz `docs/design-tokens-mapping.md`. Tokeny v `src/styles/tokens.css` jsou
placeholder.

---

## 2. Doplňky schématu nad rámec seznamu v promptu

Seznam tabulek v promptu neměl kam uložit pár věcí, které tentýž prompt
vyžaduje po UI. Přidal jsem tohle — každou položku ber jako návrh, klidně
kteroukoliv zamítni:

| Doplněk | Proč | Bez něj by nešlo |
| --- | --- | --- |
| `categories.monthly_limit` | Obálky rozlišují „s limitem" a „bez limitu" | zobrazit „zbývá" a dvousegmentový bar |
| `categories.in_envelopes` | Prompt říká „Bydlení mimo obálky" | vyřadit Bydlení z obálek, ale nechat ho v součtech |
| `recurring_payments` | Prompt zmiňuje „vazební tabulku" u měsíčních plateb; stejný checklist ale potřebují i předplatná a roční platby | odškrtávat „zaplaceno" per měsíc |
| `debt_payments` | Akce „zaznamenat platbu" a automatické párování podle protiúčtu/VS | mimořádné splátky a auditovatelné snižování `remaining_amount` |
| `subscriptions.status` | Auto-detekce vytváří **návrhy**, ne hotová předplatná | odlišit návrh od potvrzeného |
| `active` na `recurring_*` a `planned_items` | Simulace zrušení ⊘ a měkké mazání | vypnout položku bez ztráty historie |
| `format_profiles.header_fingerprint` | Rozpoznání profilu podle hlavičky | krok 2 import pipeline |
| `import_batches.format_profile_id` | Dohledat, čím se batch parsoval | audit špatného importu |

`monthly_limit` jsem dal jako **jeden limit na kategorii**, ne limit per měsíc.
Jednodušší a sedí to na „kategorie: s limitem → zbývá". Když budeš chtít
měnit limity po měsících, je to tabulka navíc — řekni.

## 3. Číslování migrací

Prompt mluví o „migraci 0001". Drizzle čísluje od `0000`, takže úvodní
migrace je `migrations/0000_init.sql`. Přejmenovat ji na `0001` by znamenalo,
že příští vygenerovaná migrace dostane taky `0001` a přepíše ji. Nechal jsem
proto Drizzle konvenci.

Seed (účet, uživatelé, kategorie) je **uvnitř téže migrace**, ne ve zvláštním
skriptu — Webflow Cloud spouští migrace při deployi sám, takže se seed
nasype bez ručního zásahu. Je psaný přes `INSERT OR IGNORE` s pevnými id,
takže opakované spuštění nic nerozbije (ověřeno).

Tohle **není demo data**. Dev seed (`pnpm seed:demo`) je fáze 5 a do produkce
se nikdy nedostane.

## 4. Kategorie jsou provizorní

Seed kategorií měl podle promptu vzniknout „dle spec §3.2". Spec nemám,
takže jsem nasadil rozumnou českou domácnostní sadu: Jídlo, Restaurace,
Doprava, Domácnost, Drogerie a zdraví, Děti, Zábava, Oblečení, Dárky,
Ostatní, Bydlení (mimo obálky). Barvy jsou placeholder.

Jakmile dorazí spec, přepíšu to migrací. Dokud v `transactions` nic není,
je přepis bezbolestný — proto to chci vyřešit **před** seed importem
master CSV.

## 5. Bezpečnost brány hesla

- Cookie je podepsaná HMAC-SHA256 (Web Crypto, edge-safe), `httpOnly`,
  `Secure` v produkci, `SameSite=Lax`, scope `/numo` — na zbytek webu
  se neposílá. Platnost 30 dní.
- Porovnání hesla i podpisu je časově konstantní.
- Ověřeno end-to-end: neexistující cookie, podvržený podpis i posunutá
  expirace vedou na přihlášení; `/numo/api/*` vrací 401 místo redirectu.
- **Co tam není: omezení počtu pokusů o heslo.** Appka bude na veřejné
  adrese, takže hrubá síla je reálná. Proto to heslo aspoň 16 znaků.
  Když budeš chtít, dodělám zámek po N pokusech — je to malá práce,
  jen jsem ji do fáze 1 nepašoval bez domluvy.

## 6. Verze balíčků

Dokumentace Webflow Cloudu ukazuje `@opennextjs/cloudflare@1.6.5`. Nasadil
jsem `^1.20.2` — stejná major verze, ale umí novější Next. Postaveno
a odzkoušeno lokálně na Workers runtime (`npm run preview`), takže build,
který spustí Webflow Cloud, je ověřený. Kdyby jejich build přesto spadl,
stačí verzi stáhnout zpátky na 1.6.5.

Nenainstaloval jsem zatím **PapaParse** ani `better-sqlite3` — první je
potřeba až na import (fáze 2), druhý jen pro lokální SQLite a nese s sebou
nativní build. Doinstaluju je, až budou k něčemu.

---

## 7. Otevřené otázky — potřebuju odpověď

### Tvrdé zastávky (bez nich se fáze 2 nedá začít)

1. **Vzorky CSV** — master CSV se 7 měsíci historie, reálný výpis z Air Bank,
   reálný výpis z Revolutu. Mapování sloupců nechci stavět z hlavy.
   Klidně anonymizované částky, ale skutečná struktura souboru.
2. **Složení fingerprintu** — návrh ti předložím nad reálným vzorkem.
3. **Design tokeny** — viz `docs/design-tokens-mapping.md`.
4. **Počáteční stav Rezervy** — kolik máte dneska celkem na sledovaných
   účtech (bez dluhů, ty se odečtou samy) a k jakému datu. Tohle datum je
   zároveň hranice, kde končí master CSV a začínají reálné výpisy.

### Věcné otázky, kde jsem nechtěl hádat

5. **Kam ve forecastu vstupuje spoření?**
   Prompt říká, že se forecast živě přepočítává „při změně spoření, dluhů
   a plánovaných položek", ale ve vzorci pro cashflow spoření není. Jsou
   tři možnosti a každá dá jiné číslo:
   - snižuje rozpočet domácnosti (spoření se odloží dřív, než se utrácí),
   - je to další výdajová položka forecastu,
   - je to jen zobrazovací údaj a do cashflow nevstupuje vůbec.

   Naprogramoval jsem vzorec **přesně jak je napsaný**, tedy bez spoření.
   Řekni která.

6. **Patří příjmy z podnikání do cashflow grafu?**
   Pravidlo v promptu zní, že **výdajové** agregace filtrují `is_business`.
   U Cíle měsíce zase „přišlo" podnikání **zahrnuje**. Držel jsem se toho
   doslova: v grafu jsou příjmy včetně podnikání, výdaje bez podnikání.
   Je to konzistentní se zadáním, ale výsledek měsíce to nadhodnocuje
   o zisk z podnikání. Alternativa: v cashflow vyřadit podnikání z obou
   stran a nechat ho jen v Cíli měsíce. Co je blíž tomu, jak to čtete?

7. **Vzorec denního limitu a obálek** — čekám na spec §4.

8. **Mount path** — počítám s `/numo`. Když ve Webflow Cloudu zvolíš jinou
   cestu, změním jeden řádek v `next.config.ts`.
