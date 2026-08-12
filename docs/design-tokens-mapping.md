# Mapping design tokenů — čeká na bundle

**Stav: blokováno.** Handoff bundle z Claude Design se mi z tohohle prostředí
nepodařilo otevřít, takže tokeny nemám odkud vzít.

## Co se stalo

Zkoušel jsem projekt
`f687c4ac-8dbd-4e03-9376-0e398c582587` otevřít přes `claude_design` MCP.
Server odpověděl, že potřebuje autorizaci přes `/design-login`, a ta se dá
udělat jen v interaktivním terminálu — tahle session běží v cloudu bez
terminálu. Přímé stažení `https://claude.ai/design/p/…` vrací 403,
protože projekt je za přihlášením. Ve workspace bundle taky nikde není.

## Jak to odblokovat (stačí jedna z možností)

1. **„Send to Claude Code Web"** přímo v Claude Design — nasype bundle do
   workspace a já ho rovnou přečtu. Nejrychlejší cesta.
2. **Přidat soubory do repa** — nahraj do `design/` tyhle soubory a pushni:
   - `Numo Desktop.dc.html`
   - `_ds/numo-design-system-*/\_ds_bundle.js`
   - `_ds/numo-design-system-*/styles.css`
   - `_ds/numo-design-system-*/tokens/colors.css`
   - `_ds/numo-design-system-*/tokens/effects.css`
   - `_ds/numo-design-system-*/tokens/fonts.css`
   - `_ds/numo-design-system-*/tokens/spacing.css`
   - `_ds/numo-design-system-*/tokens/typography.css`
   - `support.js`
3. **Spustit tenhle prompt lokálně** v Claude Code v terminálu, kde
   `/design-login` projde.

## Co je zatím v kódu

`src/styles/tokens.css` má **placeholder tokeny** — neutrální hodnoty, aby
kostra vůbec něco vykreslila. Nejsou to barvy numa a nemají s bundlem nic
společného.

Kód je psaný tak, aby výměna byla jednorázová: každá komponenta sahá na
proměnnou (`var(--numo-…)`), nikde není napsaná konkrétní barva, rádius ani
odsazení. Až bundle dorazí, přepíše se jeden soubor.

## Co ti předložím, až bundle dostanu

Tabulku „token z bundlu → proměnná v numu" ke schválení — tohle je tvoje
tvrdá zastávka č. 3. Vypadat bude takhle:

| Token v bundlu | Hodnota | Proměnná v numu | Kde se to projeví |
| -------------- | ------- | --------------- | ----------------- |
| _(doplní se)_  |         |                 |                   |

U tokenů, které v bundlu nenajdu, ale kód je potřebuje (typicky stavové
barvy pro „pokryto / schází / hrozí"), navrhnu hodnotu odvozenou z palety
bundlu a označím ji jako **návrh**, ať víš, co je z bundlu a co ode mě.
