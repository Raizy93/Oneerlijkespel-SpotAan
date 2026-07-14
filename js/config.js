/* ============================================================
   HET ONEERLIJKE SPEL — Kinderboekenweek 2026: Spot Aan!
   config.js — centrale instellingen, kleuren, puntenmodi
   ============================================================ */

const CONFIG = {
  versie: '2.0',

  maxTeams: 4,
  minTeams: 2,
  maxTeamnaamLengte: 18,

  // Vraag-aantallen per keuze
  vraagAantallen: {
    kort: 8,
    normaal: 12,
    lang: 16,
    // 'alles' = alle beschikbare vragen
  },

  // Aantal laatste vragen dat als "Eindronde" telt
  eindrondeVragen: 3,

  // De waarde groeit mee met het verschil tussen hoogste en laagste
  // score. Het teken blijft altijd volledig neutraal geloot.
  spanning: {
    stapVerschil: 40,       // iedere 40 punten verschil...
    factorPerStap: 0.25,    // ...vergroot de waarde met 25%
    maximaleVerschilBonus: 1.25,
    eindrondeBonus: 0.25,
    maximaleFactor: 2.5,
  },

  // Kans op een speciale gebeurtenis per beurt (0-1)
  gebeurtenisKans: 0.14,
  // Geen speciale gebeurtenissen tijdens de eerste zoveel vragen
  gebeurtenisNietVoorVraag: 1,

  // Teamkleuren (contrastrijk, met naam voor toegankelijkheid)
  teamKleuren: [
    { id: 'geel',      naam: 'Geel',      hex: '#f5c518', tekst: '#2a1a05' },
    { id: 'turquoise', naam: 'Turquoise', hex: '#20c4b4', tekst: '#04211e' },
    { id: 'roze',      naam: 'Roze',      hex: '#f26d9c', tekst: '#2a0715' },
    { id: 'oranje',    naam: 'Oranje',    hex: '#f2882d', tekst: '#2a1403' },
  ],

  // Teamsymbolen — vorm nooit alleen kleur (toegankelijkheid)
  teamSymbolen: [
    { id: 'boek',      naam: 'Boek',          emoji: '📖' },
    { id: 'microfoon', naam: 'Microfoon',     emoji: '🎤' },
    { id: 'masker',    naam: 'Theatermasker', emoji: '🎭' },
    { id: 'lamp',      naam: 'Lamp',          emoji: '💡' },
  ],

  // Standaard thematische teamnamen
  standaardTeamnamen: [
    'De Spotlights',
    'De Boekhelden',
    'De Regisseurs',
    'De Podiumbouwers',
  ],

  // ---- Puntenmodi ----
  // Plus en min hebben in iedere modus exact dezelfde kans. Goed of
  // fout speelt bij de trekking geen enkele rol; alleen de waardepool
  // verschilt per modus.
  modi: {
    mild: {
      id: 'mild',
      naam: 'Mild oneerlijk',
      omschrijving: 'Kleinere verschillen en minder extreme minpunten.',
      kansen: { positief: 0.46, nul: 0.08, negatief: 0.46 },
      waarden: [
        { w: 5, g: 6 }, { w: 10, g: 6 }, { w: 15, g: 5 }, { w: 20, g: 4 },
        { w: 25, g: 3 }, { w: 30, g: 2 }, { w: 40, g: 1 }, { w: 50, g: 1 },
      ],
    },
    klassiek: {
      id: 'klassiek',
      naam: 'Klassiek oneerlijk',
      omschrijving: 'De standaard met flinke verrassingen.',
      kansen: { positief: 0.46, nul: 0.08, negatief: 0.46 },
      waarden: [
        { w: 5, g: 6 }, { w: 10, g: 7 }, { w: 15, g: 6 }, { w: 20, g: 6 },
        { w: 25, g: 5 }, { w: 30, g: 4 }, { w: 35, g: 3 }, { w: 40, g: 3 },
        { w: 50, g: 2 }, { w: 60, g: 1 }, { w: 75, g: 1 }, { w: 100, g: 1 },
      ],
    },
    chaotisch: {
      id: 'chaotisch',
      naam: 'Volledig chaotisch',
      omschrijving: 'Grote verschillen en spectaculaire omkeringen.',
      kansen: { positief: 0.46, nul: 0.08, negatief: 0.46 },
      waarden: [
        { w: 10, g: 6 }, { w: 20, g: 6 }, { w: 25, g: 5 }, { w: 30, g: 5 },
        { w: 40, g: 4 }, { w: 50, g: 4 }, { w: 60, g: 3 }, { w: 75, g: 2 },
        { w: 100, g: 2 }, { w: 125, g: 1 }, { w: 150, g: 1 },
      ],
      gebeurtenisKansExtra: 0.08, // meer speciale gebeurtenissen
    },
  },

  // Standaardinstellingen (worden opgeslagen)
  standaardInstellingen: {
    modus: 'klassiek',
    gebeurtenissenAan: true,
    willekeurigeVolgorde: false,
    finaleVerdubbeling: false,
    vragenSchudden: true,
    toelichtingTonen: true,
    contrast: 'normaal',          // normaal | hoog
    verminderBeweging: false,
    snelleAnimaties: false,
    muziekAan: true,
    effectenAan: true,
    muziekVolume: 0.4,
    effectVolume: 0.7,
    startVolledigScherm: false,
  },

  website: 'www.meesterdanny.com',
  websiteUrl: 'https://www.meesterdanny.com',
  maker: 'meester.danny',
  instagram: 'https://www.instagram.com/meester.danny',
};

// Afwisselende, niet-elke-beurt humormeldingen
const HUMOR_MELDINGEN = {
  positief: ['De spot koos voor plus.', 'Dat pakt gunstig uit voor de ontvanger.'],
  negatief: ['De spot koos voor min.', 'Dat pakte anders uit dan gehoopt.'],
  nul: ['De spot bleef precies op nul staan.'],
};
