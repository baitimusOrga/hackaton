// Lucide-style outline icons (24px grid, 1.5px stroke), markup is static and trusted.
export const ICONS = {
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  bookmark: '<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  home: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
  electronics: '<rect x="3" y="4" width="18" height="12"/><path d="M8 20h8M12 16v4"/>',
  furniture: '<path d="M4 10v8M20 10v8M4 14h16M7 10V6h10v4"/>',
  bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-8h5l3 8M10 8h4l-2 8"/>',
  household: '<path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6"/>',
  clothing: '<path d="M8 4l4 2 4-2 4 4-3 2v10H7V10L4 8z"/>',
  kids: '<path d="M4 20h16M6 20V9l6-5 6 5v11M9 20v-5h6v5"/>',
  garden: '<path d="M12 21V11M12 11c-4 0-7-3-7-7 4 0 7 3 7 7zM12 11c4 0 7-3 7-7-4 0-7 3-7 7z"/>',
  machines:
    '<path d="M4 6h10v6H4zM14 9h4l2 3v4h-6M4 12v4h2"/><circle cx="8" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
} as const;

export type IconName = keyof typeof ICONS;
