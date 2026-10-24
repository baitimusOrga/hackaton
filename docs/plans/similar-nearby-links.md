# Plan: Similar-nearby cards open their listing

## Bug
On `/listings/:id` the cards under **Ähnlich, in der Nähe** look dead: a click changes nothing on
screen. Reported as "you can't press the listing to go to them".

## Findings (2026-10-24, reproduced on the dev server)
- The cards are fine: `app-summary-card` wraps `app-listing-card` with `[link]="['/listings', id]"`,
  the anchor's `href` is `/listings/<id>`, nothing overlays it, and `listing.spec.ts` already clicks
  such a link and gets the new listing.
- The click does navigate: the URL and the `h1` change. What stays is the **scroll position**. The
  router reuses `ListingPage` for the new id, the page keeps its height, and the browser stays
  scrolled to the bottom. The user keeps looking at a similar-nearby grid (now the new listing's,
  with the old listing swapped in) and sees no change.
- Cause: `app.config.ts` calls `provideRouter(routes, withComponentInputBinding())` without
  `withInMemoryScrolling`, so Angular never scrolls on navigation. The same applies to every route
  (search results → listing lands wherever the list was scrolled), the listing page is just where
  it is most visible.

## Fix (smallest)
- `provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }))`:
  forward navigation scrolls to the top, back/forward restore the stored position.
- `listing.spec.ts`: the existing similar-listings test also asserts the card's `href`; one new test
  boots the real `appConfig` router, clicks the similar card and expects the viewport to scroll to
  the top.

## Not done
- Restoring the position on **back** to a page whose content loads asynchronously (search results)
  is best effort: Angular restores at `NavigationEnd`, before the results are back. Acceptable for
  now; a `Scroll` event listener that waits for the data would fix it if it bothers anyone.
- Anchor scrolling (`#fragment`) stays off: nothing uses it.
