import type { Messages } from '../i18n';

export const AUCTION_MESSAGES: Messages = {
  'Gekauft! Du findest den Kauf unter «Käufe und Verkäufe».': {
    fr: 'Acheté ! Tu retrouves l’achat sous « Achats et ventes ».',
    it: 'Acquistato! Trovi l’acquisto sotto «Acquisti e vendite».',
    en: 'Bought! You can find the purchase under “Purchases and sales”.',
  },
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
  'Das ist dein Inserat.': {
    fr: 'C’est ton annonce.',
    it: 'È il tuo annuncio.',
    en: 'This is your listing.',
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
  'Du hast gewonnen': { fr: 'Tu as gagné', it: 'Hai vinto', en: 'You won' },
  'Für {price}.': { fr: 'Pour {price}.', it: 'Per {price}.', en: 'For {price}.' },
  'Jemand hat mehr geboten': {
    fr: 'Quelqu’un a offert plus',
    it: 'Qualcuno ha offerto di più',
    en: 'Someone bid more',
  },
  'Verkauft für {price}. Dein Maximum war {max}.': {
    fr: 'Vendu pour {price}. Ton maximum était de {max}.',
    it: 'Venduto per {price}. Il tuo massimo era {max}.',
    en: 'Sold for {price}. Your maximum was {max}.',
  },
  'Du führst mit {price}': {
    fr: 'Tu mènes à {price}',
    it: 'Sei in testa a {price}',
    en: 'You lead at {price}',
  },
  'Gebot angenommen. Dein Maximum {max} bleibt geheim; wir bieten automatisch für dich, bis es erreicht ist.':
    {
      fr: "Offre acceptée. Ton maximum de {max} reste secret ; nous enchérissons automatiquement pour toi jusqu'à ce montant.",
      it: 'Offerta accettata. Il tuo massimo di {max} resta segreto; offriamo automaticamente per te fino a raggiungerlo.',
      en: 'Bid accepted. Your maximum of {max} stays secret; we bid for you automatically up to it.',
    },
  'Dein Maximum ist {max}; wir bieten automatisch für dich, bis es erreicht ist.': {
    fr: "Ton maximum est de {max} ; nous enchérissons automatiquement pour toi jusqu'à ce montant.",
    it: 'Il tuo massimo è {max}; offriamo automaticamente per te fino a raggiungerlo.',
    en: 'Your maximum is {max}; we bid for you automatically up to it.',
  },
  'Du wurdest überboten': {
    fr: 'Ton offre a été dépassée',
    it: 'La tua offerta è stata superata',
    en: 'You have been outbid',
  },
  'Gebot angenommen, aber ein anderes Maximum ist höher. Der Preis stieg automatisch auf {price}. Biete mindestens {min}, um zu führen.':
    {
      fr: 'Offre acceptée, mais un autre maximum est plus élevé. Le prix est monté automatiquement à {price}. Offre au moins {min} pour mener.',
      it: 'Offerta accettata, ma un altro massimo è più alto. Il prezzo è salito automaticamente a {price}. Offri almeno {min} per essere in testa.',
      en: 'Bid accepted, but another maximum is higher. The price rose automatically to {price}. Bid at least {min} to lead.',
    },
  'Dein Maximum war {max}. Biete mindestens {min}, um wieder zu führen.': {
    fr: 'Ton maximum était de {max}. Offre au moins {min} pour reprendre la tête.',
    it: 'Il tuo massimo era {max}. Offri almeno {min} per tornare in testa.',
    en: 'Your maximum was {max}. Bid at least {min} to lead again.',
  },
  'Der Preis bleibt bei {price}. Du erhöhst nur dein Maximum auf {max}.': {
    fr: 'Le prix reste à {price}. Tu augmentes seulement ton maximum à {max}.',
    it: 'Il prezzo resta a {price}. Aumenti solo il tuo massimo a {max}.',
    en: 'The price stays at {price}. You only raise your maximum to {max}.',
  },
  'Dein Gebot startet bei {min}. Bietet jemand mit, erhöhen wir automatisch bis {max}.': {
    fr: "Ton offre commence à {min}. Si quelqu'un enchérit, nous augmentons automatiquement jusqu'à {max}.",
    it: 'La tua offerta parte da {min}. Se qualcuno rilancia, aumentiamo automaticamente fino a {max}.',
    en: 'Your bid starts at {min}. If someone else bids, we raise it automatically up to {max}.',
  },
  'Gib den Betrag an, den du höchstens zahlen willst. Wir bieten nur so viel wie nötig und erhöhen automatisch, bis er erreicht ist. Niemand sieht dein Maximum.':
    {
      fr: "Indique le montant maximum que tu es prêt à payer. Nous n'enchérissons que le nécessaire et augmentons automatiquement jusqu'à ce montant. Personne ne voit ton maximum.",
      it: 'Indica l’importo massimo che vuoi pagare. Offriamo solo il necessario e aumentiamo automaticamente fino a raggiungerlo. Nessuno vede il tuo massimo.',
      en: 'Enter the most you are willing to pay. We only bid as much as needed and raise it automatically up to that amount. Nobody sees your maximum.',
    },
  'Maximum erhöhen': { fr: 'Augmenter le maximum', it: 'Aumenta il massimo', en: 'Raise maximum' },
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
