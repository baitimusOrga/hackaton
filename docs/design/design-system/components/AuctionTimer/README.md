# AuctionTimer
Countdown to an auction's end in `timer` style on a `blue` block; inverts to `bg-900` in the last ten minutes, then `bg-100` with "Beendet".

**Provide:** `endsAt` (Date or ms); for static renders `value` and `urgent`/`ended`.

**Use**
- In the badge row of an auction card and next to the current bid on the detail page.
- Always `hh:mm:ss`, tabular numerals, no animation on digit change. Over 24h, show the date instead ("Endet 25.10., 18:00") — do not render days in the timer.
- `aria-live` stays off; announce the last minute once via your own live region.

**Don't**
- Never red, never pulsing. Urgency is the inversion to black and the words "Endet in".
