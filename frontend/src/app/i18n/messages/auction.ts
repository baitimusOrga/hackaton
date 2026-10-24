import type { Messages } from '../i18n';

export const AUCTION_MESSAGES: Messages = {
  'Verkauft für {price}': {
    fr: 'Vendu pour {price}',
    it: 'Venduto per {price}',
    en: 'Sold for {price}',
  },
  'Ohne Gebot beendet': {
    fr: 'Terminée sans offre',
    it: 'Conclusa senza offerte',
    en: 'Ended without a bid',
  },
  'Du wurdest überboten. Dein Maximum war {max}.': {
    fr: 'Ton offre a été dépassée. Ton maximum était de {max}.',
    it: 'La tua offerta è stata superata. Il tuo massimo era {max}.',
    en: 'You have been outbid. Your maximum was {max}.',
  },
  'Du führst mit {price}': {
    fr: 'Tu mènes avec {price}',
    it: 'Sei in testa con {price}',
    en: 'You are leading at {price}',
  },
  'Dein Maximum (CHF)': {
    fr: 'Ton maximum (CHF)',
    it: 'Il tuo massimo (CHF)',
    en: 'Your maximum (CHF)',
  },
  'Mindestens {min} · Schritte von {inc}': {
    fr: 'Au moins {min} · par paliers de {inc}',
    it: 'Almeno {min} · a passi di {inc}',
    en: 'At least {min} · steps of {inc}',
  },
  'Maximum wählen': { fr: 'Choisir le maximum', it: 'Scegli il massimo', en: 'Choose a maximum' },
  'Jetzt bieten': { fr: 'Enchérir', it: 'Fai un’offerta', en: 'Bid now' },
  'Endet {date} · Ein Gebot in den letzten 2 Minuten verlängert um 2 Minuten. Bei gleichem Maximum gewinnt das frühere.':
    {
      fr: 'Se termine le {date} · Une offre dans les 2 dernières minutes prolonge de 2 minutes. À maximum égal, la première l’emporte.',
      it: 'Termina il {date} · Un’offerta negli ultimi 2 minuti prolunga di 2 minuti. A parità di massimo vince quella precedente.',
      en: 'Ends {date} · A bid in the last 2 minutes extends by 2 minutes. On equal maximums the earlier one wins.',
    },
  'Letzte Gebote': { fr: 'Dernières offres', it: 'Ultime offerte', en: 'Latest bids' },
  'Alle {count} Gebote': {
    fr: 'Toutes les {count} offres',
    it: 'Tutte le {count} offerte',
    en: 'All {count} bids',
  },
  Du: { fr: 'Toi', it: 'Tu', en: 'You' },
  automatisch: { fr: 'automatique', it: 'automatica', en: 'automatic' },
};
