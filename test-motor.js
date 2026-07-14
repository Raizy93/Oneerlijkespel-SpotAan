const fs = require('fs');
const vm = require('vm');
const path = require('path');

const opslag = new Map();
const testMath = Object.create(Math);
testMath.random = Math.random;
const context = vm.createContext({
  console,
  Date,
  Math: testMath,
  localStorage: {
    getItem: (key) => opslag.has(key) ? opslag.get(key) : null,
    setItem: (key, value) => opslag.set(key, String(value)),
    removeItem: (key) => opslag.delete(key),
  },
});

for (const bestand of ['config.js', 'vragen.js', 'gebeurtenissen.js', 'opslag.js', 'motor.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'js', bestand), 'utf8'), context, { filename: bestand });
}
const api = vm.runInContext('({ CONFIG, Opslag, Motor })', context);
const { Motor } = api;

function assert(voorwaarde, melding) {
  if (!voorwaarde) throw new Error(melding);
}
function opzet(aantal = 8) {
  return {
    teams: ['A', 'B', 'C', 'D', 'E'].map((naam, index) => ({
      naam, kleurId: api.CONFIG.teamKleuren[index % 4].id, symboolId: api.CONFIG.teamSymbolen[index % 4].id,
    })),
    aantalVragen: aantal,
    spelInstellingen: {
      modus: 'klassiek', gebeurtenissenAan: false, willekeurigeVolgorde: false,
      finaleVerdubbeling: false, vragenSchudden: true, toelichtingTonen: true,
    },
  };
}
function nieuweBeurt(spot, goed, keuze, ontvanger) {
  assert(Motor.kiesSpotlight(spot), `spotlight ${spot} moest beschikbaar zijn`);
  Motor.beginBeoordeling(goed);
  Motor.kiesPuntenactie(keuze);
  if (keuze === 'uitdelen') Motor.kiesOntvanger(ontvanger);
}

Motor.nieuwSpel(opzet());
assert(Motor.spel.teams.length === 4, 'meer dan vier teams werd niet afgekapt');
assert(Motor.spel.spotlights.length === 8, 'acht vragen leverde niet acht spotlights op');
assert(new Set(Motor.spel.spotlights.map((s) => s.vraag.id)).size === 8, 'dubbele vragen in spotlights');

// Een spel kan tot één of meer gekozen vraagcategorieën worden beperkt.
const categorieOpzet = opzet(8);
categorieOpzet.spelInstellingen.categorieen = ['Kinderboekenweek 2026'];
Motor.nieuwSpel(categorieOpzet);
assert(Motor.spel.spotlights.length > 0, 'gekozen categorie leverde geen vragen op');
assert(Motor.spel.spotlights.every((spot) => spot.vraag.categorie === 'Kinderboekenweek 2026'), 'niet-geselecteerde categorie kwam toch in het spel');

Motor.nieuwSpel(opzet());

nieuweBeurt(3, true, 'incasseren');
assert(Motor.spel.beurt.resultaat === null, 'punten werden vóór definitieve keuze gegenereerd');
testMath.random = () => 0.1;
let resultaat = Motor.genereerResultaat();
assert(resultaat.puntenActief > 0, 'verwachte positieve incasseeruitkomst');
Motor.pasToe(resultaat);
assert(Motor.team('team-1').score > 0, 'incasseren kwam niet bij actief team terecht');
assert(Motor.spotlight(3).status === 'gespeeld', 'spotlight niet als gespeeld gemarkeerd');
assert(!Motor.kiesSpotlight(3), 'gespeelde spotlight kon opnieuw worden gekozen');

assert(Motor.herstel(), 'laatste beurt kon niet worden hersteld');
assert(Motor.spotlight(3).status === 'beschikbaar', 'spotlight kwam niet terug na herstel');
assert(Motor.vraagNummer() === 1 && Motor.team('team-1').score === 0, 'beurt of score niet volledig hersteld');

nieuweBeurt(2, true, 'uitdelen', 'team-2');
assert(Motor.spel.beurt.resultaat === null, 'punten bestonden al vóór bevestiging Uitdelen');
testMath.random = () => 0.1;
resultaat = Motor.genereerResultaat();
const zelfVoor = Motor.team('team-1').score;
Motor.pasToe(resultaat);
assert(Motor.team('team-1').score === zelfVoor, 'uitdelend team kreeg zelf gewone punten');
assert(Motor.team('team-2').score > 0, 'positieve uitgedeelde punten kwamen niet bij ontvanger');

nieuweBeurt(4, true, 'uitdelen', 'team-3');
testMath.random = () => 0.99;
resultaat = Motor.genereerResultaat();
assert(resultaat.puntenActief < 0, 'verwachte negatieve uitdeeluitkomst');
Motor.pasToe(resultaat);
assert(Motor.team('team-3').score < 0, 'negatieve uitgedeelde punten troffen verkeerde team');

nieuweBeurt(5, false, 'incasseren');
testMath.random = () => 0.1;
resultaat = Motor.genereerResultaat();
assert(resultaat.puntenActief > 0, 'fout antwoord kon niet onverwacht positief uitvallen');
const foutTeam = resultaat.teamId;
const foutBeslisser = resultaat.beslisserTeamId;
assert(foutBeslisser !== foutTeam, 'na fout antwoord besliste niet de tegenstander');
assert(resultaat.selectedRecipientTeamId === foutBeslisser, 'Incasseren na fout ging niet naar de beslissende tegenstander');
const foutScoreVoor = Motor.team(foutTeam).score;
const tegenstanderVoor = Motor.team(foutBeslisser).score;
Motor.pasToe(resultaat);
assert(Motor.team(foutTeam).score === foutScoreVoor, 'fout antwoord gaf gewone punten aan het vragenteam');
assert(Motor.team(foutBeslisser).score > tegenstanderVoor, 'tegenstander kon de punten niet incasseren');

nieuweBeurt(6, true, 'uitdelen', 'team-1');
assert(Motor.spel.beurt.fase === 'bevestiging' && Motor.spel.beurt.resultaat === null, 'bevestigingsfase niet duurzaam opgeslagen');
const momentopname = JSON.parse(JSON.stringify(Motor.spel));
Motor.hervat(momentopname);
assert(Motor.spel.beurt.fase === 'bevestiging' && Motor.spel.beurt.selectedRecipientTeamId === 'team-1', 'hervatten verloor doelteam');
testMath.random = () => 0.1;
const eenmalig = Motor.genereerResultaat();
const nogmaals = Motor.genereerResultaat();
assert(eenmalig === nogmaals && Motor.spel.beurt.resultaat, 'hervatten kon dubbel punten trekken');

// Ontvangerbewuste gebeurtenis na Uitdelen (Dubbele spot).
Motor.nieuwSpel(opzet());
testMath.random = () => 0.1;
nieuweBeurt(1, false, 'incasseren');
Motor.pasToe(Motor.genereerResultaat());
Motor.spel.instellingen.gebeurtenissenAan = true;
nieuweBeurt(2, true, 'uitdelen', 'team-3');
const reeks = [0.1, 0.1, 0, 0];
testMath.random = () => reeks.length ? reeks.shift() : 0;
resultaat = Motor.genereerResultaat();
assert(resultaat.gebeurtenis && resultaat.gebeurtenis.id === 'dubbele-spot', 'speciale gebeurtenis na Uitdelen ontbrak');
const ontvangerVoorEvent = Motor.team('team-3').score;
Motor.pasToe(resultaat);
assert(Motor.team('team-3').score === ontvangerVoorEvent + resultaat.puntenActief, 'gebeurtenis gebruikte verkeerde ontvanger');

// Correctheid heeft geen invloed op plus/min; alleen één neutrale kansverdeling bestaat.
for (const modus of Object.values(api.CONFIG.modi)) {
  assert(typeof modus.kansen.positief === 'number' && !modus.kansen.goed && !modus.kansen.fout,
    `${modus.id} bevat nog antwoordafhankelijke kansen`);
  assert(modus.kansen.positief === modus.kansen.negatief, `${modus.id} heeft geen gelijke plus- en minkans`);
  assert(Array.isArray(modus.waarden) && !modus.positief && !modus.negatief,
    `${modus.id} gebruikt niet één gezamenlijke waardepool voor plus en min`);
}

// Een grotere scoreafstand vergroot alleen de waarde, niet het teken.
Motor.nieuwSpel(opzet());
Motor.team('team-1').score = 200;
const spanning = Motor.spanningsInfo();
assert(spanning.verschil === 200 && spanning.factor > 2, 'scoreverschil verhoogde de puntenfactor niet');
nieuweBeurt(1, true, 'incasseren');
testMath.random = () => 0.1;
resultaat = Motor.genereerResultaat();
assert(resultaat.spanningsFactor === spanning.factor && Math.abs(resultaat.trekkingen[0]) >= Math.abs(resultaat.ruweTrekkingen[0]),
  'spanningsfactor werd niet op de waarde toegepast');

// Laatste spotlight rondt het spel automatisch af.
Motor.nieuwSpel(opzet());
testMath.random = () => 0.1;
for (let nummer = 1; nummer <= 8; nummer++) {
  nieuweBeurt(nummer, false, 'incasseren');
  Motor.pasToe(Motor.genereerResultaat());
}
assert(Motor.spel.fase === 'klaar' && Motor.spel.spotlights.every((spot) => spot.status === 'gespeeld'), 'laatste spotlight opende de eindfase niet');

console.log('Alle motor-scenario’s geslaagd.');
