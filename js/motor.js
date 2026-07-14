/* ============================================================
   HET ONEERLIJKE SPEL 2.0 — motor.js
   Spelmotor met vaste spotlightkoppeling, blinde puntenkeuze,
   serialiseerbare tussenfasen en volledig herstel per beurt.
   ============================================================ */

function gewogenKeuze(pool) {
  const totaal = pool.reduce((som, item) => som + item.g, 0);
  let getal = Math.random() * totaal;
  for (const item of pool) {
    getal -= item.g;
    if (getal <= 0) return item.w;
  }
  return pool[pool.length - 1].w;
}

function schud(lijst) {
  const kopie = lijst.slice();
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
  }
  return kopie;
}

const Motor = {
  spel: null,

  nieuwSpel(opzet) {
    const gekozenCategorieen = Array.isArray(opzet.spelInstellingen.categorieen)
      ? new Set(opzet.spelInstellingen.categorieen)
      : null;
    const alleVragen = schud(Opslag.actieveVragenlijst().filter((vraag) => {
      if (!gekozenCategorieen) return true; // oudere spelopzetten: alle categorieën
      const categorie = (vraag.categorie || '').trim() || 'Zonder categorie';
      return gekozenCategorieen.has(categorie);
    }));
    const aantal = opzet.aantalVragen === 'alles'
      ? alleVragen.length
      : Math.min(opzet.aantalVragen, alleVragen.length);
    const gekozenVragen = alleVragen.slice(0, aantal);
    const teams = opzet.teams.slice(0, CONFIG.maxTeams).map((team, index) => ({
      id: `team-${index + 1}`,
      naam: team.naam,
      kleurId: team.kleurId,
      symboolId: team.symboolId,
      score: 0,
      dubbelTrekken: false,
    }));

    this.spel = {
      versie: CONFIG.versie,
      gestart: Date.now(),
      instellingen: opzet.spelInstellingen,
      gekozenAantalVragen: aantal,
      teams,
      spotlights: gekozenVragen.map((vraag, index) => ({
        nummer: index + 1,
        vraag,
        status: 'beschikbaar',
      })),
      volgorde: this._maakVolgorde(teams, aantal, opzet.spelInstellingen.willekeurigeVolgorde),
      vraagIndex: 0,
      fase: 'beurt',
      beurt: this._legeBeurt('intro'),
      laatsteDeltas: {},
      laatsteVragenteamId: null,
      laatsteOntvangerTeamId: null,
      laatsteBeurt: null,
      historie: null,
      gebeurtenisGeteld: 0,
    };
    this.bewaar();
    return this.spel;
  },

  _legeBeurt(fase) {
    return {
      fase: fase || 'intro',
      spotlightNummer: null,
      goed: null,
      beslisserTeamId: null,
      keuze: null,
      selectedRecipientTeamId: null,
      resultaat: null,
    };
  },

  _maakVolgorde(teams, aantal, willekeurig) {
    const ids = teams.map((team) => team.id);
    const volgorde = [];
    if (!willekeurig) {
      for (let i = 0; i < aantal; i++) volgorde.push(ids[i % ids.length]);
      return volgorde;
    }
    while (volgorde.length < aantal) {
      let blok = schud(ids);
      let pogingen = 0;
      while (volgorde.length && blok[0] === volgorde[volgorde.length - 1] && pogingen < 20) {
        blok = schud(ids);
        pogingen++;
      }
      if (volgorde.length && blok[0] === volgorde[volgorde.length - 1]) blok.push(blok.shift());
      volgorde.push(...blok);
    }
    return volgorde.slice(0, aantal);
  },

  team(id) { return this.spel.teams.find((team) => team.id === id); },
  huidigTeam() { return this.team(this.spel.volgorde[this.spel.vraagIndex]); },
  volgendeTegenstander() {
    const actief = this.huidigTeam();
    for (let index = this.spel.vraagIndex + 1; index < this.spel.volgorde.length; index++) {
      const kandidaat = this.team(this.spel.volgorde[index]);
      if (kandidaat && kandidaat.id !== actief.id) return kandidaat;
    }
    const teamIndex = this.spel.teams.findIndex((team) => team.id === actief.id);
    return this.spel.teams[(teamIndex + 1) % this.spel.teams.length];
  },
  beslisserTeam() { return this.team(this.spel.beurt.beslisserTeamId); },
  spotlight(nummer) { return this.spel.spotlights.find((spot) => spot.nummer === Number(nummer)); },
  huidigeSpotlight() { return this.spotlight(this.spel.beurt.spotlightNummer); },
  huidigeVraag() { const spot = this.huidigeSpotlight(); return spot ? spot.vraag : null; },
  vraagNummer() { return this.spel.vraagIndex + 1; },
  totaalVragen() { return this.spel.spotlights.length; },
  isEindronde() { return this.totaalVragen() - this.vraagNummer() < CONFIG.eindrondeVragen; },
  isLaatsteVraag() { return this.vraagNummer() === this.totaalVragen(); },

  ranglijst() {
    const gesorteerd = this.spel.teams.slice().sort((a, b) => b.score - a.score);
    let rang = 0;
    let vorige = null;
    return gesorteerd.map((team, index) => {
      if (vorige === null || team.score < vorige) { rang = index + 1; vorige = team.score; }
      return { rang, team };
    });
  },

  winnaars() {
    const hoogste = Math.max(...this.spel.teams.map((team) => team.score));
    return this.spel.teams.filter((team) => team.score === hoogste);
  },

  zetBeurtFase(fase) {
    this.spel.beurt.fase = fase;
    this.bewaar();
  },

  kiesSpotlight(nummer) {
    const spot = this.spotlight(nummer);
    if (!spot || spot.status !== 'beschikbaar' || this.spel.beurt.spotlightNummer !== null) return false;
    this._maakHerstelpunt();
    spot.status = 'gekozen';
    this.spel.beurt = this._legeBeurt('vraag');
    this.spel.beurt.spotlightNummer = spot.nummer;
    this.bewaar();
    return true;
  },

  beginBeoordeling(goed) {
    const beurt = this.spel.beurt;
    beurt.goed = !!goed;
    beurt.beslisserTeamId = goed ? this.huidigTeam().id : this.volgendeTegenstander().id;
    beurt.keuze = null;
    beurt.selectedRecipientTeamId = null;
    beurt.resultaat = null;
    beurt.fase = 'keuze';
    this.bewaar();
  },

  kiesPuntenactie(keuze) {
    if (this.spel.beurt.goed === null || !['incasseren', 'uitdelen'].includes(keuze)) return false;
    const beurt = this.spel.beurt;
    beurt.keuze = keuze;
    beurt.selectedRecipientTeamId = keuze === 'incasseren' ? beurt.beslisserTeamId : null;
    beurt.fase = keuze === 'incasseren' ? 'klaar-voor-onthulling' : 'doelteam';
    this.bewaar();
    return true;
  },

  kiesOntvanger(teamId) {
    const team = this.team(teamId);
    if (!team || team.id === this.spel.beurt.beslisserTeamId || this.spel.beurt.keuze !== 'uitdelen') return false;
    this.spel.beurt.selectedRecipientTeamId = team.id;
    this.spel.beurt.fase = 'bevestiging';
    this.bewaar();
    return true;
  },

  wijzigOntvanger() {
    this.spel.beurt.selectedRecipientTeamId = null;
    this.spel.beurt.fase = 'doelteam';
    this.bewaar();
  },

  _trekPunten() {
    const modus = CONFIG.modi[this.spel.instellingen.modus];
    const kansen = modus.kansen;
    const getal = Math.random();
    if (getal < kansen.positief) return gewogenKeuze(modus.waarden);
    if (getal < kansen.positief + kansen.nul) return 0;
    return -gewogenKeuze(modus.waarden);
  },

  spanningsInfo() {
    const scores = this.spel.teams.map((team) => team.score);
    const verschil = Math.max(...scores) - Math.min(...scores);
    const instelling = CONFIG.spanning;
    const stappen = Math.floor(verschil / instelling.stapVerschil);
    const verschilBonus = Math.min(instelling.maximaleVerschilBonus, stappen * instelling.factorPerStap);
    const eindrondeBonus = this.isEindronde() ? instelling.eindrondeBonus : 0;
    const factor = Math.min(instelling.maximaleFactor, 1 + verschilBonus + eindrondeBonus);
    return { verschil, factor, verschilBonus, eindrondeBonus };
  },

  _schaalPunten(punten, factor) {
    if (punten === 0) return 0;
    return Math.sign(punten) * Math.max(5, Math.round(Math.abs(punten) * factor / 5) * 5);
  },

  _kiesGebeurtenis(ctx) {
    const instellingen = this.spel.instellingen;
    if (!instellingen.gebeurtenissenAan || this.vraagNummer() <= CONFIG.gebeurtenisNietVoorVraag) return null;
    const modus = CONFIG.modi[instellingen.modus];
    if (Math.random() > CONFIG.gebeurtenisKans + (modus.gebeurtenisKansExtra || 0)) return null;
    const kandidaten = GEBEURTENISSEN.filter((item) => {
      try { return item.geldig(ctx); } catch (_) { return false; }
    });
    if (!kandidaten.length) return null;
    let getal = Math.random() * kandidaten.reduce((som, item) => som + item.gewicht, 0);
    for (const item of kandidaten) {
      getal -= item.gewicht;
      if (getal <= 0) return item;
    }
    return kandidaten[kandidaten.length - 1];
  },

  genereerResultaat() {
    const beurt = this.spel.beurt;
    if (beurt.resultaat) return beurt.resultaat;
    if (!beurt.selectedRecipientTeamId || beurt.goed === null) return null;

    const actiefTeam = this.huidigTeam();
    const beslisserTeam = this.beslisserTeam();
    const ontvangerTeam = this.team(beurt.selectedRecipientTeamId);
    const spanning = this.spanningsInfo();
    const ruweTrekkingen = [this._trekPunten()];
    let dubbelGebruikt = false;
    if (actiefTeam.dubbelTrekken) {
      ruweTrekkingen.push(this._trekPunten());
      dubbelGebruikt = true;
    }
    const trekkingen = ruweTrekkingen.map((punten) => this._schaalPunten(punten, spanning.factor));
    let punten = Math.max(...trekkingen);
    let finaleVerdubbeld = false;
    if (this.isLaatsteVraag() && this.spel.instellingen.finaleVerdubbeling) {
      punten *= 2;
      finaleVerdubbeld = true;
    }

    const ctx = {
      spel: this.spel,
      team: actiefTeam,
      actiefTeam,
      beslisserTeam,
      ontvangerTeam,
      selectedRecipientTeamId: ontvangerTeam.id,
      keuze: beurt.keuze,
      punten,
      vraagNummer: this.vraagNummer(),
      totaalVragen: this.totaalVragen(),
    };
    const gebeurtenis = this._kiesGebeurtenis(ctx);
    const effect = gebeurtenis ? gebeurtenis.pasToe(ctx) : null;
    if (gebeurtenis) this.spel.gebeurtenisGeteld++;

    const resultaat = {
      teamId: actiefTeam.id,
      beslisserTeamId: beslisserTeam.id,
      selectedRecipientTeamId: ontvangerTeam.id,
      keuze: beurt.keuze,
      goed: beurt.goed,
      spotlightNummer: beurt.spotlightNummer,
      trekkingen,
      ruweTrekkingen,
      spanningsFactor: spanning.factor,
      scoreVerschil: spanning.verschil,
      dubbelGebruikt,
      basisPunten: punten,
      finaleVerdubbeld,
      gebeurtenis: gebeurtenis ? {
        id: gebeurtenis.id,
        naam: gebeurtenis.naam,
        icoon: gebeurtenis.icoon,
        uitleg: gebeurtenis.uitleg,
        beschrijving: effect.beschrijving || '',
        keuzeNodig: effect.keuzeNodig || null,
      } : null,
      puntenActief: effect ? effect.puntenActief : punten,
      extraScores: (effect && effect.extraScores) || [],
      scoreWissel: (effect && effect.scoreWissel) || null,
      volgendeBeurtBeste: (effect && effect.volgendeBeurtBeste) || null,
      humor: this._kiesHumor(effect ? effect.puntenActief : punten),
    };
    beurt.resultaat = resultaat;
    beurt.fase = 'onthulling';
    this.bewaar();
    return resultaat;
  },

  herdraai(resultaat) {
    const spanning = this.spanningsInfo();
    const ruw = this._trekPunten();
    let punten = this._schaalPunten(ruw, spanning.factor);
    if (this.isLaatsteVraag() && this.spel.instellingen.finaleVerdubbeling) punten *= 2;
    resultaat.basisPunten = punten;
    resultaat.ruweTrekkingen = [ruw];
    resultaat.trekkingen = [punten];
    resultaat.spanningsFactor = spanning.factor;
    resultaat.scoreVerschil = spanning.verschil;
    resultaat.puntenActief = punten;
    resultaat.extraScores = [];
    resultaat.scoreWissel = null;
    resultaat.volgendeBeurtBeste = null;
    resultaat.gebeurtenis.keuzeNodig = null;
    resultaat.gebeurtenis.beschrijving = `De tweede uitkomst is definitief en gaat naar ${this.team(resultaat.selectedRecipientTeamId).naam}.`;
    resultaat.humor = this._kiesHumor(punten);
    this.bewaar();
    return resultaat;
  },

  _kiesHumor(punten) {
    if (Math.random() < 0.45) return null;
    const lijst = punten > 0 ? HUMOR_MELDINGEN.positief : punten < 0 ? HUMOR_MELDINGEN.negatief : HUMOR_MELDINGEN.nul;
    return lijst[Math.floor(Math.random() * lijst.length)];
  },

  pasToe(resultaat) {
    const spel = this.spel;
    if (!resultaat || spel.beurt.fase === 'toegepast') return null;
    const scoresVoor = Object.fromEntries(spel.teams.map((team) => [team.id, team.score]));
    const deltas = Object.fromEntries(spel.teams.map((team) => [team.id, 0]));
    const ontvanger = this.team(resultaat.selectedRecipientTeamId);

    ontvanger.score += resultaat.puntenActief;
    deltas[ontvanger.id] += resultaat.puntenActief;
    for (const extra of resultaat.extraScores) {
      const team = this.team(extra.teamId);
      if (team) { team.score += extra.punten; deltas[team.id] += extra.punten; }
    }

    // Wissel van rol gebeurt nadrukkelijk ná de gewone puntenverwerking.
    if (resultaat.scoreWissel) {
      const teamA = this.team(resultaat.scoreWissel.teamA);
      const teamB = this.team(resultaat.scoreWissel.teamB);
      if (teamA && teamB) {
        const oudA = teamA.score;
        teamA.score = teamB.score;
        teamB.score = oudA;
        deltas[teamA.id] = teamA.score - scoresVoor[teamA.id];
        deltas[teamB.id] = teamB.score - scoresVoor[teamB.id];
      }
    }

    const actief = this.team(resultaat.teamId);
    if (resultaat.dubbelGebruikt) actief.dubbelTrekken = false;
    if (resultaat.volgendeBeurtBeste) {
      const voordeelTeam = this.team(resultaat.volgendeBeurtBeste);
      if (voordeelTeam) voordeelTeam.dubbelTrekken = true;
    }

    const spot = this.spotlight(resultaat.spotlightNummer);
    if (spot) spot.status = 'gespeeld';
    const scoresNa = Object.fromEntries(spel.teams.map((team) => [team.id, team.score]));
    spel.laatsteDeltas = deltas;
    spel.laatsteVragenteamId = resultaat.teamId;
    spel.laatsteOntvangerTeamId = resultaat.selectedRecipientTeamId;
    spel.laatsteBeurt = {
      actiefTeamId: resultaat.teamId,
      beslisserTeamId: resultaat.beslisserTeamId,
      spotlightNummer: resultaat.spotlightNummer,
      vraag: spot ? spot.vraag : null,
      goed: resultaat.goed,
      keuze: resultaat.keuze,
      selectedRecipientTeamId: resultaat.selectedRecipientTeamId,
      getrokkenPunten: resultaat.basisPunten,
      uiteindelijkePunten: resultaat.puntenActief,
      spanningsFactor: resultaat.spanningsFactor,
      scoreVerschil: resultaat.scoreVerschil,
      gebeurtenis: resultaat.gebeurtenis,
      scoresVoor,
      scoresNa,
      spotlightStatus: 'gespeeld',
      volgendActiefTeamId: spel.volgorde[spel.vraagIndex + 1] || null,
    };
    spel.beurt.fase = 'toegepast';
    spel.vraagIndex++;
    if (spel.vraagIndex >= spel.spotlights.length) spel.fase = 'klaar';
    spel.beurt = this._legeBeurt(spel.fase === 'klaar' ? 'klaar' : 'intro');
    this.bewaar();
    return deltas;
  },

  slaVraagOver() {
    const spot = this.huidigeSpotlight();
    if (!spot) return { klaar: false };
    spot.status = 'gespeeld';
    const actief = this.huidigTeam();
    this.spel.laatsteDeltas = Object.fromEntries(this.spel.teams.map((team) => [team.id, 0]));
    this.spel.laatsteVragenteamId = actief.id;
    this.spel.laatsteOntvangerTeamId = null;
    this.spel.laatsteBeurt = {
      actiefTeamId: actief.id,
      beslisserTeamId: null,
      spotlightNummer: spot.nummer,
      vraag: spot.vraag,
      goed: null,
      keuze: 'overgeslagen',
      selectedRecipientTeamId: null,
      getrokkenPunten: null,
      uiteindelijkePunten: 0,
      spanningsFactor: 1,
      scoreVerschil: 0,
      gebeurtenis: null,
      scoresVoor: Object.fromEntries(this.spel.teams.map((team) => [team.id, team.score])),
      scoresNa: Object.fromEntries(this.spel.teams.map((team) => [team.id, team.score])),
      spotlightStatus: 'gespeeld',
      volgendActiefTeamId: this.spel.volgorde[this.spel.vraagIndex + 1] || null,
    };
    this.spel.vraagIndex++;
    if (this.spel.vraagIndex >= this.spel.spotlights.length) this.spel.fase = 'klaar';
    this.spel.beurt = this._legeBeurt(this.spel.fase === 'klaar' ? 'klaar' : 'intro');
    this.bewaar();
    return { klaar: this.spel.fase === 'klaar', vervangen: false };
  },

  _maakHerstelpunt() {
    const spel = this.spel;
    spel.historie = JSON.parse(JSON.stringify({
      teams: spel.teams,
      spotlights: spel.spotlights,
      volgorde: spel.volgorde,
      vraagIndex: spel.vraagIndex,
      fase: spel.fase,
      beurt: this._legeBeurt('intro'),
      laatsteDeltas: spel.laatsteDeltas,
      laatsteVragenteamId: spel.laatsteVragenteamId,
      laatsteOntvangerTeamId: spel.laatsteOntvangerTeamId,
      laatsteBeurt: spel.laatsteBeurt,
      gebeurtenisGeteld: spel.gebeurtenisGeteld,
    }));
  },

  kanHerstellen() { return !!(this.spel && this.spel.historie); },

  herstel() {
    const spel = this.spel;
    if (!spel || !spel.historie) return false;
    const herstel = spel.historie;
    spel.teams = herstel.teams;
    spel.spotlights = herstel.spotlights;
    spel.volgorde = herstel.volgorde;
    spel.vraagIndex = herstel.vraagIndex;
    spel.fase = herstel.fase;
    spel.beurt = herstel.beurt;
    spel.laatsteDeltas = herstel.laatsteDeltas;
    spel.laatsteVragenteamId = herstel.laatsteVragenteamId;
    spel.laatsteOntvangerTeamId = herstel.laatsteOntvangerTeamId;
    spel.laatsteBeurt = herstel.laatsteBeurt;
    spel.gebeurtenisGeteld = herstel.gebeurtenisGeteld;
    spel.historie = null;
    this.bewaar();
    return true;
  },

  bewaar() { if (this.spel) Opslag.bewaarSpel(this.spel); },

  hervat(snapshot) {
    // Veilige migratie van 1.x-spellen met maximaal vier teams.
    if (!snapshot.spotlights && Array.isArray(snapshot.vragen)) {
      snapshot.spotlights = snapshot.vragen.map((vraag, index) => ({
        nummer: index + 1,
        vraag,
        status: index < snapshot.vraagIndex ? 'gespeeld' : 'beschikbaar',
      }));
      snapshot.gekozenAantalVragen = snapshot.spotlights.length;
      snapshot.beurt = this._legeBeurt('intro');
      snapshot.laatsteVragenteamId = null;
      snapshot.laatsteOntvangerTeamId = null;
      snapshot.laatsteBeurt = null;
    }
    if (!snapshot.beurt) snapshot.beurt = this._legeBeurt('intro');
    if (snapshot.beurt.goed !== null && !snapshot.beurt.beslisserTeamId) {
      this.spel = snapshot;
      snapshot.beurt.beslisserTeamId = snapshot.beurt.goed ? this.huidigTeam().id : this.volgendeTegenstander().id;
    }
    this.spel = snapshot;
    this.bewaar();
    return this.spel;
  },

  beeindig() {
    this.spel = null;
    Opslag.wisSpel();
  },
};
