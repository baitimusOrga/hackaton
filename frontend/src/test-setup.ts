// Specs assert the German source texts; jsdom would otherwise pick English from navigator.language.
beforeEach(() => localStorage.setItem('lang', 'de'));
