/* ============================================================
   HET ONEERLIJKE SPEL 2.0 — gebeurtenissen.js

   De actieve ploeg beantwoordt de vraag. `ontvangerTeam` is de
   ploeg die na Incasseren/Uitdelen de oorspronkelijke punten zou
   krijgen. Een gebeurtenis wordt pas daarna bepaald en toegepast.
   ============================================================ */

const GEBEURTENISSEN = [
  {
    id: 'dubbele-spot', naam: 'Dubbele spot', icoon: '🔦', gewicht: 14,
    uitleg: 'Twee spots op de gekozen ontvanger: de punten worden verdubbeld.',
    geldig: (ctx) => ctx.punten !== 0,
    pasToe: (ctx) => ({
      puntenActief: ctx.punten * 2,
      beschrijving: `${ctx.ontvangerTeam.naam} krijgt ${ctx.punten * 2 >= 0 ? '+' : ''}${ctx.punten * 2} punten.`,
    }),
  },
  {
    id: 'gordijn-dicht', naam: 'Gordijn dicht', icoon: '🎭', gewicht: 12,
    uitleg: 'Het doek valt vroegtijdig. De gekozen ontvanger krijgt 0 punten.',
    geldig: (ctx) => ctx.punten !== 0,
    pasToe: (ctx) => ({
      puntenActief: 0,
      beschrijving: `De punten van ${ctx.ontvangerTeam.naam} verdwijnen achter het gordijn: 0 punten.`,
    }),
  },
  {
    id: 'wissel-van-rol', naam: 'Wissel van rol', icoon: '🔄', gewicht: 3,
    uitleg: 'Na deze puntenverwerking wisselen twee teams hun totale score.',
    geldig: (ctx) => ctx.spel.teams.length >= 2 && ctx.vraagNummer > 2 &&
      ctx.spel.teams.some((t) => t.id !== ctx.ontvangerTeam.id && t.score !== ctx.ontvangerTeam.score),
    pasToe: (ctx) => {
      const anderen = ctx.spel.teams.filter((t) => t.id !== ctx.ontvangerTeam.id);
      const ander = anderen[Math.floor(Math.random() * anderen.length)];
      return {
        puntenActief: ctx.punten,
        scoreWissel: { teamA: ctx.ontvangerTeam.id, teamB: ander.id },
        beschrijving: `Eerst krijgt ${ctx.ontvangerTeam.naam} de punten. Daarna wisselt de totaalscore met ${ander.naam}.`,
      };
    },
  },
  {
    id: 'regisseur-grijpt-in', naam: 'De regisseur grijpt in', icoon: '🎬', gewicht: 10,
    uitleg: 'De regisseur keurt de uitslag af: minpunten worden pluspunten.',
    geldig: (ctx) => ctx.punten < 0,
    pasToe: (ctx) => ({
      puntenActief: Math.abs(ctx.punten),
      beschrijving: `${ctx.ontvangerTeam.naam}: ${ctx.punten} wordt +${Math.abs(ctx.punten)} punten.`,
    }),
  },
  {
    id: 'technische-storing', naam: 'Technische storing', icoon: '⚡', gewicht: 10,
    uitleg: 'Kortsluiting in het lichtpaneel: pluspunten worden minpunten.',
    geldig: (ctx) => ctx.punten > 0,
    pasToe: (ctx) => ({
      puntenActief: -ctx.punten,
      beschrijving: `${ctx.ontvangerTeam.naam}: +${ctx.punten} wordt ${-ctx.punten} punten.`,
    }),
  },
  {
    id: 'staande-ovatie', naam: 'Staande ovatie', icoon: '👏', gewicht: 10,
    uitleg: 'De hele zaal klapt: alle teams krijgen 10 punten, de gekozen ontvanger 25.',
    geldig: (ctx) => ctx.spel.teams.length >= 2,
    pasToe: (ctx) => ({
      puntenActief: 25,
      extraScores: ctx.spel.teams
        .filter((t) => t.id !== ctx.ontvangerTeam.id)
        .map((t) => ({ teamId: t.id, punten: 10 })),
      beschrijving: `${ctx.ontvangerTeam.naam} krijgt +25; alle andere teams krijgen +10.`,
    }),
  },
  {
    id: 'achter-de-schermen', naam: 'Achter de schermen', icoon: '🚪', gewicht: 10,
    uitleg: 'Het beslissende team mag deze punten houden of definitief opnieuw draaien.',
    geldig: () => true,
    pasToe: (ctx) => ({
      puntenActief: ctx.punten,
      keuzeNodig: 'opnieuw',
      beschrijving: `${ctx.beslisserTeam.naam} kiest voor ${ctx.punten >= 0 ? '+' : ''}${ctx.punten} houden of opnieuw draaien. De ontvanger blijft ${ctx.ontvangerTeam.naam}.`,
    }),
  },
  {
    id: 'spotlight-gestolen', naam: 'Spotlight gestolen', icoon: '🕵️', gewicht: 8,
    uitleg: 'Een ander team steelt de helft van de punten.',
    // Bij Uitdelen is dit effect bewust uitgeschakeld: twee ontvangers
    // zouden het klassikale overzicht onnodig verwarrend maken.
    geldig: (ctx) => ctx.keuze !== 'uitdelen' && ctx.spel.teams.length >= 2 && ctx.punten > 0,
    pasToe: (ctx) => {
      const anderen = ctx.spel.teams.filter((t) => t.id !== ctx.ontvangerTeam.id);
      const dief = anderen[Math.floor(Math.random() * anderen.length)];
      const helft = Math.round(ctx.punten / 2 / 5) * 5;
      return {
        puntenActief: ctx.punten - helft,
        extraScores: [{ teamId: dief.id, punten: helft }],
        beschrijving: `${ctx.ontvangerTeam.naam} zou +${ctx.punten} krijgen. ${dief.naam} steelt ${helft}; ${ctx.ontvangerTeam.naam} houdt ${ctx.punten - helft}.`,
      };
    },
  },
  {
    id: 'plotwending', naam: 'Plotwending', icoon: '📖', gewicht: 8,
    uitleg: 'Zoals in elk goed verhaal: het onderste team krijgt 30 bonuspunten.',
    geldig: (ctx) => {
      const laagste = Math.min(...ctx.spel.teams.map((t) => t.score));
      return ctx.spel.teams.filter((t) => t.score === laagste).length === 1;
    },
    pasToe: (ctx) => {
      const laagste = ctx.spel.teams.reduce((a, b) => (b.score < a.score ? b : a));
      return {
        puntenActief: ctx.punten + (laagste.id === ctx.ontvangerTeam.id ? 30 : 0),
        extraScores: laagste.id === ctx.ontvangerTeam.id ? [] : [{ teamId: laagste.id, punten: 30 }],
        beschrijving: `${laagste.naam} stond als enige laatste en krijgt 30 bonuspunten.`,
      };
    },
  },
  {
    id: 'recensie-een-ster', naam: 'Recensie met één ster', icoon: '⭐', gewicht: 8,
    uitleg: 'De ontvanger verliest 10 extra punten, maar trekt bij de eigen volgende beurt twee keer.',
    geldig: (ctx) => ctx.punten < 0,
    pasToe: (ctx) => ({
      puntenActief: ctx.punten - 10,
      volgendeBeurtBeste: ctx.ontvangerTeam.id,
      beschrijving: `${ctx.ontvangerTeam.naam} krijgt 10 extra minpunten, maar trekt bij de eigen volgende beurt twee keer.`,
    }),
  },
];
