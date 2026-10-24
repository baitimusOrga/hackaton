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
  'Du führst. Dein Maximum ist {max}; wir bieten automatisch für dich, bis es erreicht ist.': {
    fr: "Tu mènes. Ton maximum est de {max} ; nous enchérissons automatiquement pour toi jusqu'à ce montant.",
    it: 'Sei in testa. Il tuo massimo è {max}; offriamo automaticamente per te fino a raggiungerlo.',
    en: 'You are leading. Your maximum is {max}; we bid for you automatically up to it.',
  },
  'Das ist dein Inserat. Du kannst nicht mitbieten.': {
    fr: 'C’est ton annonce. Tu ne peux pas enchérir.',
    it: 'Questo è il tuo annuncio. Non puoi fare offerte.',
    en: 'This is your listing. You cannot bid on it.',
  },
  'Wird gesendet…': { fr: 'Envoi…', it: 'Invio…', en: 'Sending…' },
  'Maximum {max} bieten': {
    fr: 'Enchérir jusqu’à {max}',
    it: 'Offri fino a {max}',
    en: 'Bid up to {max}',
  },
  'Maximum {max}': { fr: 'maximum {max}', it: 'massimo {max}', en: 'maximum {max}' },
  'Gib dein Maximum in CHF ein.': {
    fr: 'Saisis ton maximum en CHF.',
    it: 'Inserisci il tuo massimo in CHF.',
    en: 'Enter your maximum in CHF.',
  },
  'Höchstens zwei Stellen nach dem Komma.': {
    fr: 'Au maximum deux décimales.',
    it: 'Al massimo due decimali.',
    en: 'At most two decimal places.',
  },
  'Du führst schon mit einem Maximum von {max}. Erhöhe es oder lass es so.': {
    fr: 'Tu mènes déjà avec un maximum de {max}. Augmente-le ou laisse-le ainsi.',
    it: 'Sei già in testa con un massimo di {max}. Aumentalo o lascialo così.',
    en: 'You already lead with a maximum of {max}. Raise it or leave it as it is.',
  },
  'Dein Maximum muss mindestens {min} sein.': {
    fr: 'Ton maximum doit être d’au moins {min}.',
    it: 'Il tuo massimo deve essere almeno {min}.',
    en: 'Your maximum must be at least {min}.',
  },
  'Gebot angenommen. Du führst mit {price}, dein Maximum {max} bleibt geheim.': {
    fr: 'Offre acceptée. Tu mènes à {price}, ton maximum de {max} reste secret.',
    it: 'Offerta accettata. Sei in testa a {price}, il tuo massimo di {max} resta segreto.',
    en: 'Bid accepted. You lead at {price}; your maximum of {max} stays secret.',
  },
  'Gebot angenommen, aber ein anderes Maximum ist höher. Der Preis steigt automatisch auf {price}.':
    {
      fr: 'Offre acceptée, mais un autre maximum est plus élevé. Le prix monte automatiquement à {price}.',
      it: 'Offerta accettata, ma un altro massimo è più alto. Il prezzo sale automaticamente a {price}.',
      en: 'Bid accepted, but another maximum is higher. The price rises automatically to {price}.',
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
