# Chip
Toggle for filters and categories in the browse bar. Selected chips fill `blue` with a check.

**Provide:** `label`, `selected`, `onChange`.

**Use**
- In a horizontally scrolling row under the search field, `space-2` apart; the row bleeds to the screen edge on phones.
- Labels are nouns: "Unter CHF 50", "Nur Auktionen", "Abholung", "Grüne Wahl".
- A chip truncates at 160px — keep labels short in French.

**Don't**
- Chips are not navigation and not removable tags; use a `Badge` for status.
