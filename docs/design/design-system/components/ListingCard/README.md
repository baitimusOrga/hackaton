# ListingCard
The browse unit: full-width square photo, badge row, title, price, seller line — no border, no shadow; the grid gap and the photo do the separating. Sits in a 2-column grid at 360px.

**Provide:** `title`, `price` (number, CHF), `mode`, `image`, `href`, optionally `condition`, `location`, `originalPrice`, `greenPick`, `co2Saved`, `endsAt`.

**Use**
- `mode: "auction"` shows the current bid as `blue-text` with the label "Gebot" and the `AuctionTimer` in the badge row.
- `mode: "fixed"` shows the price in `ink`; pass `originalPrice` to show "neu CHF …" after it so the saving is visible without a strike-through.
- `greenPick` adds the green `Badge`; `co2Saved` adds one `green-text` line. Both are facts from the listing, not decoration.
- Titles clamp at two lines; the meta line truncates.

**Don't**
- No price, badge or heart on the photo. No "Sale" ribbons. No percentage-off flags.
- Hover only underlines the title.
