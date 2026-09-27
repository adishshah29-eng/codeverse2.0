/* CodeVerse 2.0 · the one file you edit.
   Everything on the site that changes over time lives here. */
window.CONFIG = {
  // TODO: replace with the event's Unstop page. Every "Join the crew" button uses it.
  unstopUrl: 'https://unstop.com/',

  // Dates are IST (+05:30). Registration closes at the end of 6 October.
  registrationOpens: '2026-09-29T00:00:00+05:30',
  registrationCloses: '2026-10-06T23:59:59+05:30',
  eventStart: '2026-10-09T08:00:00+05:30',
  eventEnd: '2026-10-09T18:00:00+05:30',

  // Shows "N of 45 seats left" in the status bar. Set to a number once registrations start; null hides it.
  seatsTotal: 45,
  seatsTaken: null,

  instagram: 'djscodeai',
  contact: { name: 'Adish Shah', phone: '+919819486535', display: '+91 98194 86535' },

  venue: {
    name: 'Dwarkadas J. Sanghvi College of Engineering',
    address: 'Bhaktivedanta Swami Marg, Vile Parle (West), Mumbai',
    mapsQuery: 'Dwarkadas J. Sanghvi College of Engineering, Vile Parle West, Mumbai',
  },

  // Sections below stay hidden until you add entries.
  // sponsors: [{ name: 'Acme', logo: 'assets/sponsors/acme.png', url: 'https://…' }]
  sponsors: [],
  // crew: [{ codename: 'Tokyo', name: 'Full Name', role: 'Organizer', photo: 'assets/crew/tokyo.jpg' }]
  crew: [],

  shareText: 'Join our crew for CodeVerse 2.0, a Money Heist themed event on 9 October at DJSCE. Teams of 3. ₹99.',
};
