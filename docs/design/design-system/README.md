Zweit is a Swiss second-hand marketplace: auctions, fixed-price sales and browsing. Everything here serves three promises — **affordable, green, simple** — and one visual idea: warm near-black type on paper white, with two colours that each mean one thing: cobalt blue for money and action, a deep green for sustainability. No gradients, no shadows, no rounded corners — and no boxes around things that aren't buttons.

## Principles

1. **Space, not boxes.** Cards and sections are not outlined. A listing is separated from its neighbours by the grid gap and its photo block; list rows by a `line-soft` rule; sunken areas by `bg-100`. The strong `line` border exists only on controls (buttons, inputs, chips) so that what is pressable looks pressable.
2. **Blue is money, green is the planet.** `blue` is the only accent that fills: the Bid button, selected filters, the running countdown; `blue-text` carries the current bid. `green-text` appears only as text and a thin outline for 'Grüne Wahl', the CO₂ line and success. There are no tints: a colour is either a solid blue fill or coloured text on paper. Green never becomes a button, and blue never decorates. If a screen has more than two blue fills, one of them is wrong.
3. **Square.** `radius-1` (2px) on every control and container, `radius-0` on images. Nothing is a pill, nothing is a circle except a seller avatar.
4. **Phone first.** Specify every component at 360px width. Touch targets are 44px or taller. Text in inputs is 16px so iOS does not zoom.
5. **Say it plainly.** Short sentences, informal address, numbers before adjectives ("CHF 45.–, wie neu" not "Super Angebot!").

## Content fundamentals

### Voice
Direct and friendly, like a helpful neighbour. Address the user informally in every language: **du** (DE), **tu** (FR), **tu** (IT), **you** (EN). No exclamation marks in interface copy. No marketing superlatives; let the price and the condition speak.

| Do | Don't |
| --- | --- |
| Jetzt bieten | Bieten Sie jetzt mit! |
| Abholung in Bern oder Versand (CHF 9.–) | Flexible Lieferoptionen verfügbar |
| Du wurdest überboten. | Leider wurde Ihr Gebot übertroffen 😢 |
| Gut, günstig, grün. | Nachhaltig shoppen leicht gemacht! |

### Casing
Sentence case everywhere, including buttons and headings. The `caption` style is the only uppercase text (badges, table headers, "FESTPREIS", "AUKTION").

### Four languages
Every string ships in DE, FR, IT and EN. Design for the longest: French and German run 25–35% longer than English. Rules that follow from this:
- Buttons never have a fixed width; they grow with their label and wrap to full width on phones.
- Chips truncate with an ellipsis after 160px, never wrap.
- Prices use the Swiss format in every language: `CHF 1’250.–`, apostrophe thousands separator, `.–` for whole francs, `CHF 12.50` for rappen.
- Dates: `23.10.2026` in DE/FR/IT, `23 Oct 2026` in EN. Countdown is always `hh:mm:ss`.
- Never use emoji in interface copy. Icons carry meaning, words carry tone.

### The three ways to buy
Name them consistently in the UI:

| Mode | Badge (`caption`) | Primary action (`button`) |
| --- | --- | --- |
| Auction | AUKTION · ENCHÈRE · ASTA · AUCTION | Jetzt bieten · Enchérir · Fai un'offerta · Bid now |
| Fixed price | FESTPREIS · PRIX FIXE · PREZZO FISSO · FIXED PRICE | Kaufen · Acheter · Compra · Buy |
| Make an offer | PREISVORSCHLAG · OFFRE · OFFERTA · MAKE AN OFFER | Vorschlag senden · Faire une offre · Invia offerta · Send offer |

### Green, said quietly
The sustainability claim is a fact on the listing, not a slogan. Use the `Badge` in the `green` variant (`green-text` label and outline on `bg-000`) with "Green pick" (DE: "Grüne Wahl") only on items that meet the criteria, and the `green-text` style for "spart ca. 12 kg CO₂" lines. Never a leaf icon, never a green gradient, never "eco" as a prefix.

## Visual foundations

### Colour
The system is five neutrals, two accents and one semantic colour, in two themes. Nothing is tinted: every surface is paper, sunken paper or black.
- Grounds: `bg-000` (warm paper white) for pages and cards, `bg-100` for sunken areas (inputs, filter bars, image placeholders).
- Text: `ink` for all headings and body, `ink-muted` for secondary lines. Both are rated on `bg-000` and `bg-100`.
- Inversion: `bg-900` with `ink-inverse` for primary buttons and the running timer. It replaces shadows as the way to make something heavy — use it once per screen.
- Money accent: `blue` is a FILL — on it, text is `on-blue`. It is 6.4:1 on paper white, so blue controls need no border. As text use `blue-text` (the bid amount, links).
- Planet accent: `green-text` is TEXT and thin outlines only. There is no green fill and no tint token on purpose.
- `danger` is semantic (outbid, errors). It is the only warm colour in the system and must never appear in branding, illustrations or the cover. Always pair it with a word or icon: green and danger differ in lightness, not hue alone.
- Nothing in the system is red or orange for decoration. Nothing is purple.

### Typography
One family, Inter, loaded from Google Fonts in weights 400, 500, 600, 700, 800. Styles: `display` (landing only), `h1`–`h3`, `body`, `body-strong`, `body-sm`, `caption`, `button`, and the numeric styles `price`, `price-lg`, `timer`. All numeric styles set `font-variant-numeric: tabular-nums`. Minimum body size on phones is 16px; `caption` at 12px is uppercase and never used for sentences.

### Spacing and layout
4px base, scale `space-1` … `space-16`. Phone gutter `space-4`, desktop gutter `space-6`. Listing grids: 2 columns at 360px with `space-4` gaps, 3 at 720px, 4 at 1024px, 6 at 1440px. Cards are flush to the grid; the grid itself is never boxed.

### Borders and radii
`border-1` in `line` on controls only: outlined buttons, inputs, chips. `line-soft` for separation that is not a control: list rows, table rules, the edge of a sheet. Cards, sections and the page header have no border at all. `border-2` for the focus ring. `radius-1` (2px) on controls and containers, `radius-0` on images. No box-shadow anywhere, including dialogs — a dialog is a `bg-000` panel with a `line-soft` edge on an `overlay` scrim.

### States
- Hover: invert (`bg-900`/`ink-inverse`) on secondary buttons and chips; primary button hover keeps `bg-900` and underlines the label.
- Focus: `border-2` solid ring in `focus`, offset 2px, on everything that can take focus. Never remove it.
- Disabled: 40% opacity, cursor default. Never grey out the label alone.
- Selected: filter chips fill `blue` with a check; tabs get a `border-2` underline in `ink`.
- Loading: a `bg-100` block in the element's exact size, no shimmer, no spinner on cards.

### Imagery
Photos carry the warmth of the product, so give them room: listing photos are square, cropped centre, `radius-0`, on a `bg-100` placeholder until loaded, and fill the full card width with no padding around them. Sellers' own photos, never stock imagery. No overlays or gradients on photos; price and badges sit below the image, not on it.

### Motion
Transitions are 120ms linear on colour and border only. No movement, no scale, no bounce. The countdown changes digits without animation.

## Iconography
Lucide icons (outline, 1.5px stroke) at 20px in `ink`, 16px inside chips and badges. Icons are in `currentColor` and always accompanied by a visible or `aria-label` word. No filled icons, no emoji, no custom illustrations in the interface.

## Components
Set every component with the classes in `components/bundle.css` on top of the generated `tokens.css`: `Button`, `Input`, `Chip`, `Badge`, `ListingCard`, `AuctionTimer`. Each has its own README with the props the consumer provides. The vanilla helpers in `components/bundle.js` (`window.Zweit`) build the same markup from props when there is no framework.
