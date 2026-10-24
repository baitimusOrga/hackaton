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
  electronics: '<rect x="3" y="4" width="18" height="12"/><path d="M8 20h8M12 16v4"/>',
  furniture: '<path d="M4 10v8M20 10v8M4 14h16M7 10V6h10v4"/>',
  bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-8h5l3 8M10 8h4l-2 8"/>',
  household: '<path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6"/>',
  computer:
    '<rect x="3" y="4" width="12" height="9"/><path d="M6 18h6M9 13v5"/><rect x="17" y="4" width="4" height="14"/>',
  laptop: '<rect x="5" y="5" width="14" height="10"/><path d="M3 19h18"/>',
  phone: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  tablet: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M11 18h2"/>',
  printer: '<path d="M7 9V3h10v6M7 17H4V9h16v8h-3"/><rect x="7" y="14" width="10" height="7"/>',
  audio:
    '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1"/><rect x="17" y="14" width="4" height="6" rx="1"/>',
  gaming:
    '<rect x="2" y="8" width="20" height="10" rx="5"/><path d="M7 11v4M5 13h4"/><circle cx="16" cy="12" r="0.5"/><circle cx="18" cy="14" r="0.5"/>',
  tv: '<rect x="3" y="6" width="18" height="12" rx="1"/><path d="M8 21h8M9 3l3 3 3-3"/>',
} as const;

export type IconName = keyof typeof ICONS;
