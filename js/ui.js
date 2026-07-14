/* ============================================================
   HET ONEERLIJKE SPEL — ui.js
   Alle schermen, overgangen en spelregie. De spelregels zelf
   staan in motor.js; dit bestand toont en bedient ze.
   ============================================================ */

const UI = {
  instellingen: null,
  setup: null,           // wizardstatus
  setupStap: 0,
  fase: null,            // zichtbare spelfase; de duurzame fase staat ook in Motor.spel.beurt
  resultaat: null,       // beurtresultaat tijdens de onthulling
  bezig: false,          // blokkeert dubbele acties tijdens kritieke animaties
  timers: [],
  rolStop: null,
  meldingTimer: null,
  fullscreenTipTimer: null,
  fullscreenTipVerbergTimer: null,
  laatsteOpzet: null,

  // ---------- Hulpfuncties ----------
  el(id) { return document.getElementById(id); },

  kleur(id) { return CONFIG.teamKleuren.find((k) => k.id === id) || CONFIG.teamKleuren[0]; },
  symbool(id) { return CONFIG.teamSymbolen.find((s) => s.id === id) || CONFIG.teamSymbolen[0]; },

  minderBeweging() {
    return this.instellingen.verminderBeweging ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },

  animFactor() {
    if (this.minderBeweging()) return 0;
    return this.instellingen.snelleAnimaties ? 0.45 : 1;
  },

  wacht(ms) {
    return new Promise((klaar) => {
      const t = setTimeout(klaar, ms * (this.animFactor() || 0.02));
      this.timers.push(t);
    });
  },

  stopTimers() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
  },

  scherm(id) {
    this.stopTimers();
    document.querySelectorAll('.os-scherm').forEach((s) => (s.hidden = s.id !== id));
  },

  toonOverlay(id) { this.el(id).hidden = false; },
  sluitOverlay(id) { this.el(id).hidden = true; },

  melding(tekst) {
    const m = this.el('melding');
    m.textContent = tekst;
    m.hidden = false;
    clearTimeout(this.meldingTimer);
    this.meldingTimer = setTimeout(() => { m.hidden = true; }, 3400);
  },

  bevestig(titel, tekst, bijJa) {
    this.el('bevestig-titel').textContent = titel;
    this.el('bevestig-tekst').textContent = tekst;
    this._bevestigActie = bijJa;
    this.toonOverlay('overlay-bevestig');
    this.el('knop-bevestig-nee').focus();
  },

  pasWeergaveToe() {
    const i = this.instellingen;
    document.documentElement.dataset.contrast = i.contrast;
    document.documentElement.dataset.beweging = i.verminderBeweging ? 'minder' : 'normaal';
    document.documentElement.dataset.snel = i.snelleAnimaties ? 'ja' : 'nee';
  },

  bewaarInstellingen() {
    Opslag.bewaarInstellingen(this.instellingen);
    this.pasWeergaveToe();
    Geluid.zetVolumes();
  },

  volledigScherm() {
    this.sluitFullscreenTip();
    const d = document;
    if (d.fullscreenElement) {
      d.exitFullscreen().catch(() => {});
    } else {
      d.documentElement.requestFullscreen().catch(() => {});
    }
  },

  // ---------- Start ----------
  init() {
    this.instellingen = Opslag.leesInstellingen();
    this.pasWeergaveToe();
    Geluid.init(this.instellingen);

    // muziek + audiocontext bij de eerste interactie (autoplay-regel)
    const eersteAanraking = () => {
      Geluid.muziekStartStop();
      Geluid.zetVolumes();
    };
    window.addEventListener('pointerdown', eersteAanraking, { once: true });
    window.addEventListener('keydown', eersteAanraking, { once: true });

    this._bindVasteKnoppen();
    this._bindToetsenbord();
    this.instellingenNaarKnoppen();
    this.toonFullscreenTip();
    this._startTitelIntro();

    // onafgemaakt spel?
    const bewaard = Opslag.leesSpel();
    if (bewaard && bewaard.fase === 'beurt') this._toonHervatOverlay(bewaard);
  },

  _bindVasteKnoppen() {
    const k = (id, fn) => this.el(id).addEventListener('click', (e) => { Geluid.knop(); fn(e); });

    // titel
    k('knop-titel-start', () => this.startWizard());
    k('knop-titel-uitleg', () => { this._uitlegTerug = 'scherm-titel'; this.scherm('scherm-uitleg'); });
    k('knop-titel-instellingen', () => { this._instTerug = 'scherm-titel'; this.openInstellingen(); });
    k('knop-titel-vragen', () => { this._editorTerug = 'scherm-titel'; this.scherm('scherm-editor'); VragenEditor.open(); });
    k('knop-titel-muziek', () => this.wisselMuziek());
    k('knop-titel-geluid', () => this.wisselEffecten());
    k('knop-titel-fullscreen', () => this.volledigScherm());

    // menu
    k('knop-menu-nieuw', () => this.startWizard());
    k('knop-menu-uitleg', () => { this._uitlegTerug = 'scherm-menu'; this.scherm('scherm-uitleg'); });
    k('knop-menu-vragen', () => { this._editorTerug = 'scherm-menu'; this.scherm('scherm-editor'); VragenEditor.open(); });
    k('knop-menu-instellingen', () => { this._instTerug = 'scherm-menu'; this.openInstellingen(); });
    k('knop-menu-terug', () => this.scherm('scherm-titel'));
    k('knop-menu-muziek', () => this.wisselMuziek());
    k('knop-menu-geluid', () => this.wisselEffecten());
    k('knop-menu-fullscreen', () => this.volledigScherm());

    k('knop-fullscreen-tip-sluiten', () => this.sluitFullscreenTip());

    // uitleg / instellingen / editor terug
    k('knop-uitleg-klaar', () => this.scherm(this._uitlegTerug || 'scherm-menu'));
    k('knop-instellingen-terug', () => this.scherm(this._instTerug || 'scherm-menu'));
    k('knop-editor-terug', () => this.scherm(this._editorTerug || 'scherm-menu'));

    // wizard
    k('knop-setup-vorige', () => this.wizardVorige());
    k('knop-setup-volgende', () => this.wizardVolgende());

    // startanimatie
    k('knop-startanim-overslaan', () => this._startanimKlaar());

    // spel-topbar
    k('knop-spel-pauze', () => this.openPauze());
    k('knop-spel-fullscreen', () => this.volledigScherm());
    k('knop-spel-muziek', () => this.wisselMuziek());
    k('knop-spel-geluid', () => this.wisselEffecten());

    // overlays
    k('knop-bevestig-nee', () => this.sluitOverlay('overlay-bevestig'));
    k('knop-bevestig-ja', () => {
      this.sluitOverlay('overlay-bevestig');
      if (this._bevestigActie) { const f = this._bevestigActie; this._bevestigActie = null; f(); }
    });
    k('knop-hervat-ja', () => {
      this.sluitOverlay('overlay-hervat');
      const bewaard = Opslag.leesSpel();
      if (!bewaard) { this.melding('Het opgeslagen spel kon niet worden geladen.'); return; }
      Motor.hervat(bewaard);
      this.instellingenNaarKnoppen();
      this.scherm('scherm-spel');
      this.renderSpelVast();
      this.hervatSpelfase();
    });
    k('knop-hervat-opnieuw', () => {
      Opslag.wisSpel();
      this.sluitOverlay('overlay-hervat');
      this.el('knop-hervat-ja').hidden = false;
      if (this._hervatIncompatibel) {
        this._hervatIncompatibel = false;
        this._nieuweWizard();
      }
    });

    // gordijnknoppen bestaan niet: overgang is puur visueel
    document.addEventListener('fullscreenchange', () => {
      this.werkFullscreenKnoppenBij();
    });
  },

  toonFullscreenTip() {
    const tip = this.el('fullscreen-tip');
    if (!tip) return;
    clearTimeout(this.fullscreenTipTimer);
    clearTimeout(this.fullscreenTipVerbergTimer);
    tip.hidden = false;
    tip.classList.remove('verdwijnt');
    requestAnimationFrame(() => tip.classList.add('zichtbaar'));
    this.fullscreenTipTimer = setTimeout(() => this.sluitFullscreenTip(), 8000);
  },

  sluitFullscreenTip() {
    const tip = this.el('fullscreen-tip');
    if (!tip || tip.hidden) return;
    clearTimeout(this.fullscreenTipTimer);
    clearTimeout(this.fullscreenTipVerbergTimer);
    tip.classList.remove('zichtbaar');
    tip.classList.add('verdwijnt');
    this.fullscreenTipVerbergTimer = setTimeout(() => {
      tip.hidden = true;
      tip.classList.remove('verdwijnt');
    }, this.minderBeweging() ? 20 : 450);
  },

  werkFullscreenKnoppenBij() {
    const actief = !!document.fullscreenElement;
    ['knop-titel-fullscreen', 'knop-menu-fullscreen', 'knop-spel-fullscreen'].forEach((id) => {
      const knop = this.el(id);
      if (!knop) return;
      knop.textContent = actief ? '🗗' : '⛶';
      knop.setAttribute('aria-label', actief ? 'Volledig scherm verlaten' : 'Volledig scherm');
    });
  },

  _toonHervatOverlay(bewaard) {
    const teVeelTeams = bewaard.teams.length > CONFIG.maxTeams;
    this._hervatIncompatibel = teVeelTeams;
    const totaal = Array.isArray(bewaard.spotlights) ? bewaard.spotlights.length :
      (Array.isArray(bewaard.vragen) ? bewaard.vragen.length : 0);
    this.el('hervat-titel').textContent = teVeelTeams ? 'Oudere spelstand' : '🎭 Onafgemaakt spel';
    this.el('hervat-tekst').textContent = teVeelTeams
      ? 'Deze spelstand is gemaakt met een oudere versie waarin meer dan vier teams mogelijk waren. Start een nieuw spel om verder te gaan.'
      : 'Er is een onafgemaakt spel gevonden. Wil je verdergaan?';
    this.el('hervat-detail').textContent = teVeelTeams ? `${bewaard.teams.length} teams` :
      `Beurt ${Math.min(bewaard.vraagIndex + 1, totaal)} van ${totaal} · ${bewaard.teams.length} teams`;
    this.el('knop-hervat-ja').hidden = teVeelTeams;
    this.el('knop-hervat-opnieuw').textContent = teVeelTeams ? 'Nieuw spel starten' : 'Opnieuw beginnen';
    this.toonOverlay('overlay-hervat');
  },

  hervatSpelfase() {
    const beurt = Motor.spel.beurt || { fase: 'intro' };
    this.resultaat = beurt.resultaat || null;
    switch (beurt.fase) {
      case 'spotlights': this.faseSpotlights(); break;
      case 'vraag': this.faseVraag(); break;
      case 'antwoord': this.faseAntwoord(); break;
      case 'keuze': this.fasePuntenkeuze(); break;
      case 'doelteam': this.faseDoelteam(); break;
      case 'bevestiging': this.faseOntvangerBevestigen(); break;
      case 'klaar-voor-onthulling':
        this.resultaat = Motor.genereerResultaat();
        this.faseOnthulling(true);
        break;
      case 'onthulling': this.faseOnthulling(true); break;
      case 'klaar': this.startEinde(); break;
      default: this.faseIntro();
    }
  },

  _bindToetsenbord() {
    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typt = tag === 'input' || tag === 'textarea' || tag === 'select';

      if (e.key === 'Escape') {
        if (!this.el('overlay-bevestig').hidden) { this.sluitOverlay('overlay-bevestig'); return; }
        if (!this.el('overlay-vraagbewerken').hidden) { this.sluitOverlay('overlay-vraagbewerken'); return; }
        if (!this.el('overlay-hervat').hidden) return;
        if (!this.el('overlay-pauze').hidden) { this.sluitPauze(); return; }
        if (!this.el('scherm-spel').hidden) { this.openPauze(); return; }
        return;
      }

      if (typt) return;

      if (e.key === 'f' || e.key === 'F') { this.volledigScherm(); return; }

      if (e.key === 'Enter') {
        // activeer de zichtbare primaire knop (niet bij bevestigingsvragen)
        if (!this.el('overlay-bevestig').hidden) return;
        let bereik = null;
        if (!this.el('overlay-hervat').hidden) bereik = this.el('overlay-hervat');
        else if (!this.el('overlay-vraagbewerken').hidden) bereik = this.el('overlay-vraagbewerken');
        else if (!this.el('overlay-pauze').hidden) bereik = this.el('overlay-pauze');
        else bereik = document.querySelector('.os-scherm:not([hidden])');
        if (!bereik) return;
        const primair = bereik.querySelector('.knop-primair:not([disabled])');
        if (primair && document.activeElement !== primair &&
            !(document.activeElement && document.activeElement.classList &&
              document.activeElement.classList.contains('knop'))) {
          e.preventDefault();
          primair.click();
        }
      }
    });
  },

  // ---------- Titelscherm ----------
  _startTitelIntro() {
    const scherm = this.el('scherm-titel');
    const fases = ['fase-licht', 'fase-spot', 'fase-titel', 'fase-klaar'];
    if (this.animFactor() === 0) {
      scherm.classList.add(...fases);
      return;
    }
    const tijden = [350, 1100, 1650, 3100].map((t) => t * this.animFactor());
    fases.forEach((f, i) => {
      this.timers.push(setTimeout(() => {
        scherm.classList.add(f);
        if (f === 'fase-spot') Geluid.spotAan();
      }, tijden[i]));
    });
    // klikken slaat de intro over
    const sla = () => {
      this.stopTimers();
      scherm.classList.add(...fases);
    };
    scherm.addEventListener('pointerdown', sla, { once: true });
  },

  // ---------- Instellingen ----------
  openInstellingen() {
    this.scherm('scherm-instellingen');
    this.renderInstellingen();
  },

  _schakelHtml(id, aan, label, sub) {
    return `
      <div class="inst-rij">
        <span class="inst-label">${label}${sub ? `<span class="inst-sub">${sub}</span>` : ''}</span>
        <span>
          <button class="schakel" id="${id}" role="switch" aria-pressed="${aan ? 'true' : 'false'}" aria-label="${label}"></button>
          <span class="schakel-label" data-voor="${id}">${aan ? 'aan' : 'uit'}</span>
        </span>
      </div>`;
  },

  _bindSchakel(id, bijWissel) {
    const kn = this.el(id);
    kn.addEventListener('click', () => {
      Geluid.knop();
      const nieuw = kn.getAttribute('aria-pressed') !== 'true';
      kn.setAttribute('aria-pressed', nieuw ? 'true' : 'false');
      const lbl = document.querySelector(`[data-voor="${id}"]`);
      if (lbl) lbl.textContent = nieuw ? 'aan' : 'uit';
      bijWissel(nieuw);
    });
  },

  renderInstellingen() {
    const i = this.instellingen;
    const el = this.el('instellingen-inhoud');
    el.innerHTML = `
      <div class="inst-groep">
        <h3 class="inst-groep-kop">🎲 Spel</h3>
        <div class="inst-rij">
          <span class="inst-label">Standaard puntenmodus<span class="inst-sub">Voor nieuwe spellen; per spel aan te passen.</span></span>
          <span class="keuzerij" id="inst-modus">
            ${Object.values(CONFIG.modi).map((m) => `<button class="keuzeknop ${i.modus === m.id ? 'actief' : ''}" data-modus="${m.id}">${m.naam}</button>`).join('')}
          </span>
        </div>
        ${this._schakelHtml('inst-gebeurtenissen', i.gebeurtenissenAan, 'Speciale gebeurtenissen', 'Zeldzame plotwendingen tijdens de puntenonthulling.')}
        ${this._schakelHtml('inst-volgorde', i.willekeurigeVolgorde, 'Willekeurige teamvolgorde', 'Eerlijk verdeeld, nooit twee keer hetzelfde team achter elkaar.')}
        ${this._schakelHtml('inst-finale', i.finaleVerdubbeling, 'Finalevraag met dubbele kans', 'De gewone puntenwaarde van de laatste vraag telt dubbel.')}
        ${this._schakelHtml('inst-schudden', i.vragenSchudden, 'Vragen automatisch schudden', 'Bij ieder nieuw spel een andere volgorde.')}
        ${this._schakelHtml('inst-toelichting', i.toelichtingTonen, 'Uitleg bij antwoorden tonen', 'Korte toelichting voor de leerkracht bij het juiste antwoord.')}
      </div>
      <div class="inst-groep">
        <h3 class="inst-groep-kop">🖥 Weergave</h3>
        <div class="inst-rij">
          <span class="inst-label">Contrast</span>
          <span class="keuzerij" id="inst-contrast">
            <button class="keuzeknop ${i.contrast === 'normaal' ? 'actief' : ''}" data-contrast="normaal">Normaal</button>
            <button class="keuzeknop ${i.contrast === 'hoog' ? 'actief' : ''}" data-contrast="hoog">Hoog contrast</button>
          </span>
        </div>
        ${this._schakelHtml('inst-beweging', i.verminderBeweging, 'Verminder beweging', 'Geen draaiende puntenmachine en kortere overgangen.')}
        ${this._schakelHtml('inst-snel', i.snelleAnimaties, 'Snelle animaties', 'Alle animaties korter.')}
        ${this._schakelHtml('inst-fsstart', i.startVolledigScherm, 'Volledig scherm bij spelstart', '')}
      </div>
      <div class="inst-groep">
        <h3 class="inst-groep-kop">🔊 Geluid</h3>
        ${this._schakelHtml('inst-muziek', i.muziekAan, 'Muziek', 'Zachte achtergrondmuziek.')}
        ${this._schakelHtml('inst-effecten', i.effectenAan, 'Geluidseffecten', '')}
        <div class="inst-rij">
          <span class="inst-label">Muziekvolume</span>
          <input type="range" class="regelaar" id="inst-muziekvolume" min="0" max="100" value="${Math.round(i.muziekVolume * 100)}" aria-label="Muziekvolume">
        </div>
        <div class="inst-rij">
          <span class="inst-label">Effectenvolume</span>
          <input type="range" class="regelaar" id="inst-effectvolume" min="0" max="100" value="${Math.round(i.effectVolume * 100)}" aria-label="Effectenvolume">
        </div>
      </div>
      <div class="inst-groep">
        <h3 class="inst-groep-kop">💾 Gegevens</h3>
        <div class="inst-rij">
          <span class="inst-label">Vragenset<span class="inst-sub">Bewaar of laad je eigen vragen als bestand.</span></span>
          <span class="keuzerij">
            <button class="keuzeknop" id="inst-exporteer">⬇ Exporteren</button>
            <button class="keuzeknop" id="inst-importeer">⬆ Importeren</button>
            <input type="file" id="inst-importbestand" accept="application/json,.json" hidden>
          </span>
        </div>
        <div class="inst-rij">
          <span class="inst-label">Opnieuw beginnen</span>
          <span class="keuzerij">
            <button class="keuzeknop" id="inst-herstelvragen">↺ Standaardvragen herstellen</button>
            <button class="keuzeknop" id="inst-wisalles">🗑 Alle lokale gegevens wissen</button>
          </span>
        </div>
      </div>
    `;

    // events
    this.el('inst-modus').querySelectorAll('[data-modus]').forEach((kn) => {
      kn.addEventListener('click', () => {
        Geluid.knop();
        i.modus = kn.dataset.modus;
        this.el('inst-modus').querySelectorAll('.keuzeknop').forEach((n) => n.classList.remove('actief'));
        kn.classList.add('actief');
        this.bewaarInstellingen();
      });
    });
    this.el('inst-contrast').querySelectorAll('[data-contrast]').forEach((kn) => {
      kn.addEventListener('click', () => {
        Geluid.knop();
        i.contrast = kn.dataset.contrast;
        this.el('inst-contrast').querySelectorAll('.keuzeknop').forEach((n) => n.classList.remove('actief'));
        kn.classList.add('actief');
        this.bewaarInstellingen();
      });
    });
    this._bindSchakel('inst-gebeurtenissen', (v) => { i.gebeurtenissenAan = v; this.bewaarInstellingen(); });
    this._bindSchakel('inst-volgorde', (v) => { i.willekeurigeVolgorde = v; this.bewaarInstellingen(); });
    this._bindSchakel('inst-finale', (v) => { i.finaleVerdubbeling = v; this.bewaarInstellingen(); });
    this._bindSchakel('inst-schudden', (v) => { i.vragenSchudden = v; this.bewaarInstellingen(); });
    this._bindSchakel('inst-toelichting', (v) => { i.toelichtingTonen = v; this.bewaarInstellingen(); });
    this._bindSchakel('inst-beweging', (v) => { i.verminderBeweging = v; this.bewaarInstellingen(); });
    this._bindSchakel('inst-snel', (v) => { i.snelleAnimaties = v; this.bewaarInstellingen(); });
    this._bindSchakel('inst-fsstart', (v) => { i.startVolledigScherm = v; this.bewaarInstellingen(); });
    this._bindSchakel('inst-muziek', (v) => { i.muziekAan = v; this.bewaarInstellingen(); Geluid.muziekStartStop(); });
    this._bindSchakel('inst-effecten', (v) => { i.effectenAan = v; this.bewaarInstellingen(); });
    this.el('inst-muziekvolume').addEventListener('input', (e) => {
      i.muziekVolume = e.target.value / 100; this.bewaarInstellingen();
    });
    this.el('inst-effectvolume').addEventListener('input', (e) => {
      i.effectVolume = e.target.value / 100; this.bewaarInstellingen(); Geluid.knop();
    });
    this.el('inst-exporteer').addEventListener('click', () => {
      Geluid.knop();
      VragenEditor.vragen = Opslag.leesVragenlijst();
      VragenEditor.exporteer();
    });
    this.el('inst-importeer').addEventListener('click', () => {
      Geluid.knop();
      this.el('inst-importbestand').click();
    });
    this.el('inst-importbestand').addEventListener('change', (e) => {
      VragenEditor.vragen = Opslag.leesVragenlijst();
      VragenEditor.importeer(e);
    });
    this.el('inst-herstelvragen').addEventListener('click', () => {
      Geluid.knop();
      this.bevestig('Standaardvragen terugzetten?', 'Alle eigen vragen en wijzigingen worden verwijderd.', () => {
        Opslag.herstelStandaardVragen();
        this.melding('De standaardvragen zijn teruggezet.');
      });
    });
    this.el('inst-wisalles').addEventListener('click', () => {
      Geluid.knop();
      this.bevestig('Alle lokale gegevens wissen?', 'Instellingen, eigen vragen en het opgeslagen spel worden verwijderd.', () => {
        Opslag.wisAlles();
        this.instellingen = Opslag.leesInstellingen();
        this.pasWeergaveToe();
        this.renderInstellingen();
        this.melding('Alle lokale gegevens zijn gewist.');
      });
    });
  },

  // ---------- Nieuw spel: wizard ----------
  startWizard() {
    const bewaard = Opslag.leesSpel();
    if (bewaard && bewaard.fase === 'beurt' && !Motor.spel) {
      this._toonHervatOverlay(bewaard);
      return;
    }
    this._nieuweWizard();
  },

  _nieuweWizard(voorafTeams) {
    const i = this.instellingen;
    const alleCategorieen = this._vraagCategorieen().map((item) => item.naam);
    this.setup = {
      aantalTeams: voorafTeams ? Math.min(voorafTeams.length, CONFIG.maxTeams) : 4,
      teams: [],
      aantalVragen: 12,
      categorieen: alleCategorieen,
      modus: i.modus,
      gebeurtenissenAan: i.gebeurtenissenAan,
      willekeurigeVolgorde: i.willekeurigeVolgorde,
      finaleVerdubbeling: i.finaleVerdubbeling,
      vragenSchudden: i.vragenSchudden,
      toelichtingTonen: i.toelichtingTonen,
    };
    this._vulTeams(this.setup.aantalTeams, voorafTeams);
    this.setupStap = 0;
    this.scherm('scherm-setup');
    this.renderWizard();
  },

  _vraagCategorie(vraag) {
    return (vraag.categorie || '').trim() || 'Zonder categorie';
  },

  _vraagCategorieen() {
    const aantallen = new Map();
    Opslag.actieveVragenlijst().forEach((vraag) => {
      const naam = this._vraagCategorie(vraag);
      aantallen.set(naam, (aantallen.get(naam) || 0) + 1);
    });
    return Array.from(aantallen, ([naam, aantal]) => ({ naam, aantal }))
      .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
  },

  _vragenVoorSetup() {
    const geselecteerd = new Set(this.setup.categorieen || []);
    return Opslag.actieveVragenlijst().filter((vraag) => geselecteerd.has(this._vraagCategorie(vraag)));
  },

  _vulTeams(aantal, vooraf) {
    const bestaand = this.setup.teams;
    const teams = [];
    aantal = Math.max(CONFIG.minTeams, Math.min(CONFIG.maxTeams, aantal));
    for (let t = 0; t < aantal; t++) {
      if (vooraf && vooraf[t]) teams.push({ naam: vooraf[t].naam, kleurId: vooraf[t].kleurId, symboolId: vooraf[t].symboolId });
      else if (bestaand[t]) teams.push(bestaand[t]);
      else teams.push({
        naam: CONFIG.standaardTeamnamen[t],
        kleurId: CONFIG.teamKleuren[t].id,
        symboolId: CONFIG.teamSymbolen[t].id,
      });
    }
    this.setup.teams = teams;
  },

  wizardStappen: ['Teams', 'Namen en kleuren', 'Vragen', 'Puntenmodus', 'Samenvatting'],

  renderWizard() {
    const balk = this.el('setup-stappenbalk');
    balk.innerHTML = this.wizardStappen.map((naam, i) => `
      <span class="setup-stap-punt ${i === this.setupStap ? 'actief' : ''} ${i < this.setupStap ? 'af' : ''}">
        <span class="nr">${i < this.setupStap ? '✓' : i + 1}</span>${naam}
      </span>`).join('');

    this.el('knop-setup-vorige').disabled = false;
    this.el('knop-setup-vorige').textContent = this.setupStap === 0 ? '← Stoppen' : '← Vorige';
    this.el('knop-setup-volgende').textContent =
      this.setupStap === this.wizardStappen.length - 1 ? '🎬 Start de voorstelling' : 'Volgende →';

    const el = this.el('setup-inhoud');
    const s = this.setup;

    if (this.setupStap === 0) {
      el.innerHTML = `
        <h3 class="setup-kop">Hoeveel teams spelen mee?</h3>
        <p class="setup-sub">Kies het aantal teams. Ieder team krijgt straks een eigen naam, kleur en symbool.</p>
        <div class="keuzekaarten">
          ${[2, 3, 4].map((n) => `
            <button class="keuzekaart ${s.aantalTeams === n ? 'actief' : ''}" data-aantal="${n}">
              <span class="groot">${n}</span><span class="klein">teams</span>
            </button>`).join('')}
        </div>`;
      el.querySelectorAll('[data-aantal]').forEach((kn) => {
        kn.addEventListener('click', () => {
          Geluid.knop();
          s.aantalTeams = parseInt(kn.dataset.aantal, 10);
          this._vulTeams(s.aantalTeams);
          el.querySelectorAll('.keuzekaart').forEach((n) => n.classList.remove('actief'));
          kn.classList.add('actief');
        });
      });
    }

    else if (this.setupStap === 1) {
      el.innerHTML = `
        <h3 class="setup-kop">Namen, kleuren en symbolen</h3>
        <p class="setup-sub">Pas de teamnamen aan (maximaal ${CONFIG.maxTeamnaamLengte} tekens). Klik op het symbool om te wisselen en kies een kleur.</p>
        <div class="team-instelling">
          ${s.teams.map((t, i) => this._teamInstelHtml(t, i)).join('')}
        </div>
        <div id="setup-foutmelding" class="setup-fout" hidden></div>`;
      s.teams.forEach((t, i) => {
        const naamEl = this.el(`team-naam-${i}`);
        naamEl.addEventListener('input', () => { t.naam = naamEl.value; });
        this.el(`team-symbool-${i}`).addEventListener('click', () => {
          Geluid.knop();
          // volgende vrije symbool
          const inGebruik = new Set(s.teams.filter((x) => x !== t).map((x) => x.symboolId));
          const alle = CONFIG.teamSymbolen.map((x) => x.id);
          let idx = alle.indexOf(t.symboolId);
          for (let stap = 1; stap <= alle.length; stap++) {
            const kandidaat = alle[(idx + stap) % alle.length];
            if (!inGebruik.has(kandidaat)) { t.symboolId = kandidaat; break; }
          }
          this.renderWizard();
        });
        document.querySelectorAll(`#team-kleuren-${i} .kleurstip`).forEach((stip) => {
          stip.addEventListener('click', () => {
            Geluid.knop();
            const nieuw = stip.dataset.kleur;
            const ander = s.teams.find((x) => x !== t && x.kleurId === nieuw);
            if (ander) ander.kleurId = t.kleurId; // kleuren ruilen
            t.kleurId = nieuw;
            this.renderWizard();
          });
        });
      });
    }

    else if (this.setupStap === 2) {
      const categorieen = this._vraagCategorieen();
      const geselecteerd = new Set(s.categorieen || []);
      const beschikbaar = this._vragenVoorSetup().length;
      const keuzes = [
        { id: 8, naam: 'Kort spel', uitleg: '8 vragen' },
        { id: 12, naam: 'Normaal spel', uitleg: '12 vragen' },
        { id: 16, naam: 'Lang spel', uitleg: '16 vragen' },
        { id: 'alles', naam: 'Volledige set', uitleg: `alle ${beschikbaar} vragen` },
      ];
      el.innerHTML = `
        <h3 class="setup-kop">Hoeveel vragen spelen jullie?</h3>
        <p class="setup-sub"><strong id="setup-beschikbaar">${beschikbaar}</strong> actieve vragen uit ${geselecteerd.size} geselecteerde ${geselecteerd.size === 1 ? 'categorie' : 'categorieën'}.</p>
        <section class="categorie-kiezer" aria-labelledby="categorie-kop">
          <div class="categorie-kiezer-kop">
            <div>
              <h4 id="categorie-kop">Kies de categorieën</h4>
              <p>Alleen vragen uit de geselecteerde categorieën doen mee.</p>
            </div>
            <div class="categorie-snelkeuze">
              <button type="button" class="knop knop-tekst" id="categorie-alles">Alles selecteren</button>
              <button type="button" class="knop knop-tekst" id="categorie-geen">Alles uitzetten</button>
            </div>
          </div>
          <div class="categorie-raster">
            ${categorieen.map((categorie, index) => `
              <button type="button" class="categorie-keuze ${geselecteerd.has(categorie.naam) ? 'actief' : ''}"
                      data-categorie-index="${index}" aria-pressed="${geselecteerd.has(categorie.naam)}">
                <span class="categorie-vink" aria-hidden="true">${geselecteerd.has(categorie.naam) ? '✓' : ''}</span>
                <span class="categorie-naam">${escHtml(categorie.naam)}</span>
                <span class="categorie-aantal">${categorie.aantal} ${categorie.aantal === 1 ? 'vraag' : 'vragen'}</span>
              </button>`).join('')}
          </div>
        </section>
        <div class="keuzekaarten">
          ${keuzes.map((kz) => {
            const teWeinig = typeof kz.id === 'number' && beschikbaar < kz.id;
            return `
            <button class="keuzekaart ${String(s.aantalVragen) === String(kz.id) ? 'actief' : ''}" data-vragen="${kz.id}">
              <span class="groot">${typeof kz.id === 'number' ? kz.id : '∞'}</span>
              <span class="klein">${kz.naam}</span>
              <span class="uitleg">${teWeinig ? `let op: er zijn er maar ${beschikbaar}` : kz.uitleg}</span>
            </button>`;
          }).join('')}
        </div>`;
      el.querySelectorAll('[data-vragen]').forEach((kn) => {
        kn.addEventListener('click', () => {
          Geluid.knop();
          const w = kn.dataset.vragen;
          s.aantalVragen = w === 'alles' ? 'alles' : parseInt(w, 10);
          el.querySelectorAll('.keuzekaart').forEach((n) => n.classList.remove('actief'));
          kn.classList.add('actief');
        });
      });
      el.querySelectorAll('[data-categorie-index]').forEach((kn) => {
        kn.addEventListener('click', () => {
          Geluid.knop();
          const naam = categorieen[Number(kn.dataset.categorieIndex)].naam;
          const set = new Set(s.categorieen || []);
          if (set.has(naam)) set.delete(naam);
          else set.add(naam);
          s.categorieen = categorieen.map((item) => item.naam).filter((item) => set.has(item));
          this.renderWizard();
        });
      });
      this.el('categorie-alles').addEventListener('click', () => {
        Geluid.knop();
        s.categorieen = categorieen.map((item) => item.naam);
        this.renderWizard();
      });
      this.el('categorie-geen').addEventListener('click', () => {
        Geluid.knop();
        s.categorieen = [];
        this.renderWizard();
      });
    }

    else if (this.setupStap === 3) {
      el.innerHTML = `
        <h3 class="setup-kop">Hoe oneerlijk wordt het?</h3>
        <p class="setup-sub">Kies de puntenmodus voor dit spel.</p>
        <div class="keuzekaarten moduskaarten">
          ${Object.values(CONFIG.modi).map((m) => `
            <button class="keuzekaart ${s.modus === m.id ? 'actief' : ''}" data-modus="${m.id}">
              <span class="moduskaart-titel">${m.naam}</span>
              <span class="uitleg">${m.omschrijving}</span>
            </button>`).join('')}
        </div>
        <div style="max-width:700px;margin:18px auto 0">
          ${this._schakelHtml('setup-gebeurtenissen', s.gebeurtenissenAan, 'Speciale gebeurtenissen', 'Zeldzame plotwendingen zoals Dubbele spot of Staande ovatie.')}
          ${this._schakelHtml('setup-volgorde', s.willekeurigeVolgorde, 'Willekeurige teamvolgorde', 'Eerlijk verdeeld, nooit twee keer hetzelfde team direct achter elkaar.')}
          ${this._schakelHtml('setup-finale', s.finaleVerdubbeling, 'Finalevraag met dubbele kans', 'De gewone puntenwaarde van de laatste vraag telt dubbel.')}
          ${this._schakelHtml('setup-schudden', s.vragenSchudden, 'Vragen schudden', 'Bij ieder spel een andere volgorde.')}
        </div>`;
      el.querySelectorAll('[data-modus]').forEach((kn) => {
        kn.addEventListener('click', () => {
          Geluid.knop();
          s.modus = kn.dataset.modus;
          el.querySelectorAll('[data-modus]').forEach((n) => n.classList.remove('actief'));
          kn.classList.add('actief');
        });
      });
      this._bindSchakel('setup-gebeurtenissen', (v) => (s.gebeurtenissenAan = v));
      this._bindSchakel('setup-volgorde', (v) => (s.willekeurigeVolgorde = v));
      this._bindSchakel('setup-finale', (v) => (s.finaleVerdubbeling = v));
      this._bindSchakel('setup-schudden', (v) => (s.vragenSchudden = v));
    }

    else if (this.setupStap === 4) {
      const beschikbaar = this._vragenVoorSetup().length;
      const echtAantal = s.aantalVragen === 'alles' ? beschikbaar : Math.min(s.aantalVragen, beschikbaar);
      el.innerHTML = `
        <h3 class="setup-kop">Klaar voor de voorstelling?</h3>
        <p class="setup-sub">Controleer de instellingen en start het spel.</p>
        <div class="samenvatting">
          <div class="samenvatting-blok">
            <h4>👥 ${s.teams.length} teams</h4>
            <ul>
              ${s.teams.map((t) => `<li><span class="samenvatting-stip" style="background:${this.kleur(t.kleurId).hex}"></span>${this.symbool(t.symboolId).emoji} ${escHtml(t.naam)}</li>`).join('')}
            </ul>
          </div>
          <div class="samenvatting-blok">
            <h4>❓ Vragen</h4>
            <p>${echtAantal} vragen${s.vragenSchudden ? ', geschud' : ', in vaste volgorde'}</p>
            <div class="samenvatting-categorieen">${(s.categorieen || []).map((categorie) => `<span>${escHtml(categorie)}</span>`).join('')}</div>
            <h4 style="margin-top:10px">🎲 Puntenmodus</h4>
            <p>${CONFIG.modi[s.modus].naam}</p>
          </div>
          <div class="samenvatting-blok">
            <h4>⚙ Opties</h4>
            <ul>
              <li>${s.gebeurtenissenAan ? '✓' : '—'} Speciale gebeurtenissen</li>
              <li>${s.willekeurigeVolgorde ? '✓' : '—'} Willekeurige volgorde</li>
              <li>${s.finaleVerdubbeling ? '✓' : '—'} Finalevraag dubbele kans</li>
              <li>${this.instellingen.effectenAan ? '✓' : '—'} Geluidseffecten</li>
              <li>${this.instellingen.muziekAan ? '✓' : '—'} Muziek</li>
            </ul>
          </div>
        </div>`;
    }
  },

  _teamInstelHtml(t, i) {
    const kleur = this.kleur(t.kleurId);
    const sym = this.symbool(t.symboolId);
    return `
      <div class="team-instel-kaart" style="--teamkleur:${kleur.hex}">
        <button class="team-instel-symbool" id="team-symbool-${i}" title="Klik om het symbool te wisselen (nu: ${sym.naam})" aria-label="Symbool van team ${i + 1} wisselen, nu ${sym.naam}">${sym.emoji}</button>
        <input type="text" class="team-instel-naam" id="team-naam-${i}" maxlength="${CONFIG.maxTeamnaamLengte}"
               value="${escHtml(t.naam)}" aria-label="Naam van team ${i + 1}">
        <span class="kleurstippen" id="team-kleuren-${i}" role="group" aria-label="Kleur van team ${i + 1}">
          ${CONFIG.teamKleuren.map((k) => `
            <button class="kleurstip ${t.kleurId === k.id ? 'actief' : ''}" data-kleur="${k.id}"
                    style="background:${k.hex}" title="${k.naam}" aria-label="${k.naam}"></button>`).join('')}
        </span>
      </div>`;
  },

  wizardVorige() {
    if (this.setupStap === 0) { this.scherm('scherm-menu'); return; }
    this.setupStap--;
    this.renderWizard();
  },

  wizardVolgende() {
    const s = this.setup;
    if (this.setupStap === 1) {
      // teamnamen controleren
      const fouten = [];
      const namen = new Set();
      s.teams.forEach((t, i) => {
        t.naam = (t.naam || '').trim().slice(0, CONFIG.maxTeamnaamLengte);
        if (!t.naam) fouten.push(`Team ${i + 1} heeft nog geen naam.`);
        const sleutel = t.naam.toLowerCase();
        if (t.naam && namen.has(sleutel)) fouten.push(`De naam "${t.naam}" wordt twee keer gebruikt.`);
        namen.add(sleutel);
      });
      if (fouten.length) {
        const f = this.el('setup-foutmelding');
        f.hidden = false;
        f.textContent = fouten[0];
        return;
      }
    }
    if (this.setupStap === 2) {
      const beschikbaar = this._vragenVoorSetup().length;
      if (beschikbaar < 2) {
        this.melding('Selecteer categorieën met samen minimaal twee actieve vragen.');
        return;
      }
    }
    if (this.setupStap < this.wizardStappen.length - 1) {
      this.setupStap++;
      this.renderWizard();
      return;
    }
    // Start de voorstelling!
    this.startSpel();
  },

  // ---------- Spel starten ----------
  startSpel() {
    const s = this.setup;
    if (this.instellingen.startVolledigScherm && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    this.laatsteOpzet = JSON.parse(JSON.stringify(s));
    Motor.nieuwSpel({
      teams: s.teams,
      aantalVragen: s.aantalVragen,
      spelInstellingen: {
        modus: s.modus,
        gebeurtenissenAan: s.gebeurtenissenAan,
        willekeurigeVolgorde: s.willekeurigeVolgorde,
        finaleVerdubbeling: s.finaleVerdubbeling,
        vragenSchudden: s.vragenSchudden,
        toelichtingTonen: this.instellingen.toelichtingTonen,
        categorieen: s.categorieen.slice(),
      },
    });
    this.speelStartanimatie();
  },

  speelStartanimatie() {
    this.scherm('scherm-startanim');
    const el = this.el('startanim-inhoud');
    const teams = Motor.spel.teams;
    el.innerHTML = `
      <div class="startanim-posters">
        ${teams.map((t, i) => `
          <div class="poster" id="poster-${i}" style="--teamkleur:${this.kleur(t.kleurId).hex};--rot:${(i % 2 ? 1 : -1) * (1 + (i % 3))}deg">
            <span class="poster-symbool">${this.symbool(t.symboolId).emoji}</span>
            <span class="poster-naam">${escHtml(t.naam)}</span>
          </div>`).join('')}
      </div>
      <div class="startanim-tekst" id="startanim-tekst">DE ZAAL IS VOL</div>
    `;
    const tekstEl = this.el('startanim-tekst');

    const spelDoor = async () => {
      for (let i = 0; i < teams.length; i++) {
        this.el(`poster-${i}`).classList.add('zichtbaar');
        Geluid.radTik();
        await this.wacht(230);
      }
      // ieder team even in de spotlight
      for (let i = 0; i < teams.length; i++) {
        this.el(`poster-${i}`).classList.add('uitgelicht');
        if (i === 0) Geluid.spotAan();
        await this.wacht(330);
        this.el(`poster-${i}`).classList.remove('uitgelicht');
      }
      tekstEl.classList.add('zichtbaar');
      await this.wacht(1000);
      tekstEl.textContent = 'DE TEAMS ZIJN KLAAR';
      await this.wacht(1000);
      tekstEl.textContent = 'SPOT AAN!';
      Geluid.spotAan();
      await this.wacht(900);
      this._startanimKlaar();
    };
    spelDoor();
  },

  _startanimKlaar() {
    if (this._startanimAf) return;
    this._startanimAf = true;
    this.stopTimers();
    this.gordijnOvergang('', () => {
      this._startanimAf = false;
      this.instellingenNaarKnoppen();
      this.scherm('scherm-spel');
      this.renderSpelVast();
      this.faseIntro();
    });
  },

  // gordijn dicht → actie → gordijn open
  gordijnOvergang(tekst, tussenin) {
    const g = this.el('overgang-gordijn');
    this.el('overgang-tekst').textContent = tekst;
    g.hidden = false;
    Geluid.gordijn();
    // setTimeout i.p.v. requestAnimationFrame: rAF vuurt niet in een
    // onzichtbaar tabblad en dan zou de overgang blijven hangen
    setTimeout(() => {
      g.classList.add('dicht');
      const wachttijd = (tekst ? 2100 : 850) * (this.animFactor() || 0.02);
      setTimeout(() => {
        tussenin();
        setTimeout(() => {
          Geluid.gordijn();
          g.classList.remove('dicht');
          setTimeout(() => { g.hidden = true; }, 800 * (this.animFactor() || 0.02) + 40);
        }, 120);
      }, wachttijd);
    }, 20);
  },

  // ---------- Spelscherm: vaste onderdelen ----------
  instellingenNaarKnoppen() {
    ['knop-titel-muziek', 'knop-menu-muziek', 'knop-spel-muziek'].forEach((id) => {
      const knop = this.el(id);
      if (knop) knop.classList.toggle('uit', !this.instellingen.muziekAan);
    });
    ['knop-titel-geluid', 'knop-menu-geluid', 'knop-spel-geluid'].forEach((id) => {
      const knop = this.el(id);
      if (knop) knop.classList.toggle('uit', !this.instellingen.effectenAan);
    });
    this.werkFullscreenKnoppenBij();
  },

  wisselMuziek() {
    this.instellingen.muziekAan = !this.instellingen.muziekAan;
    this.bewaarInstellingen();
    Geluid.muziekStartStop();
    this.instellingenNaarKnoppen();
  },

  wisselEffecten() {
    this.instellingen.effectenAan = !this.instellingen.effectenAan;
    this.bewaarInstellingen();
    this.instellingenNaarKnoppen();
  },

  renderSpelVast() {
    this.renderTopbar();
    this.renderScores();
    this.renderVoortgang();
  },

  renderTopbar() {
    this.el('spel-vraagnr').textContent = `Vraag ${Math.min(Motor.vraagNummer(), Motor.totaalVragen())} van ${Motor.totaalVragen()}`;
    const eindronde = Motor.isEindronde() && Motor.spel.fase === 'beurt';
    this.el('spel-eindronde').hidden = !eindronde;
  },

  renderScores() {
    const teams = Motor.ranglijst();
    const houder = this.el('spel-scores');
    houder.classList.remove('compact');
    houder.style.setProperty('--kolommen', Motor.spel.teams.length);
    const actiefId = Motor.spel.fase === 'beurt' ? Motor.huidigTeam().id : null;

    // FLIP: oude posities bewaren voor soepel verschuiven
    const oudePos = {};
    houder.querySelectorAll('.team-kaart').forEach((k) => {
      oudePos[k.dataset.team] = k.getBoundingClientRect();
    });

    houder.innerHTML = teams.map(({ team }) => `
      <div class="team-kaart ${team.id === actiefId ? 'actief' : ''}" data-team="${team.id}"
           style="--teamkleur:${this.kleur(team.kleurId).hex}">
        <span class="team-kaart-symbool" aria-hidden="true">${this.symbool(team.symboolId).emoji}</span>
        <span class="team-kaart-midden">
          <span class="team-kaart-naam">${escHtml(team.naam)}</span>
          <span class="team-kaart-beurt">● AAN DE BEURT</span>
        </span>
        <span class="team-kaart-score ${team.score < 0 ? 'negatief' : ''}" data-score="${team.score}">${team.score}</span>
        <span class="team-kaart-delta" aria-hidden="true"></span>
      </div>`).join('');

    if (this.animFactor() > 0) {
      houder.querySelectorAll('.team-kaart').forEach((k) => {
        const oud = oudePos[k.dataset.team];
        if (!oud) return;
        const nieuw = k.getBoundingClientRect();
        const dx = oud.left - nieuw.left;
        const dy = oud.top - nieuw.top;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          k.style.transition = 'none';
          k.style.transform = `translate(${dx}px, ${dy}px)`;
          setTimeout(() => {
            k.style.transition = 'transform 0.5s ease';
            k.style.transform = '';
            setTimeout(() => { k.style.transition = ''; }, 550);
          }, 20);
        }
      });
    }
  },

  renderVoortgang() {
    const totaal = Motor.totaalVragen();
    const nu = Motor.spel.fase === 'klaar' ? totaal : Motor.spel.vraagIndex;
    const houder = this.el('spel-voortgang');
    const eindrondeVanaf = Math.max(0, totaal - CONFIG.eindrondeVragen);
    let html = '';
    for (let i = 0; i < totaal; i++) {
      const kl = ['voortgang-lamp'];
      if (i < nu) kl.push('af');
      if (i === nu && Motor.spel.fase === 'beurt') kl.push('nu');
      if (i >= eindrondeVanaf) kl.push('eindronde');
      html += `<span class="${kl.join(' ')}"></span>`;
    }
    houder.innerHTML = html;
  },

  // ---------- Spelfasen ----------
  faseIntro() {
    if (Motor.spel.fase === 'klaar') { this.startEinde(); return; }
    Motor.zetBeurtFase('intro');
    this.fase = 'intro';
    this.bezig = false;
    this.el('scherm-spel').classList.remove('toon-tussenstand', 'toon-plotwending');
    this.renderSpelVast();
    const team = Motor.huidigTeam();
    const kleur = this.kleur(team.kleurId);
    this.el('spel-podium').innerHTML = `
      <div class="beurt-intro">
        ${Motor.isEindronde() ? '<div class="finale-chip">🔥 Eindronde — alles kan nog veranderen</div>' : ''}
        <div class="beurt-intro-label">AAN DE BEURT</div>
        <div class="beurt-intro-team" style="--teamkleur:${kleur.hex}">
          <span class="beurt-intro-symbool" aria-hidden="true">${this.symbool(team.symboolId).emoji}</span>
          <span>
            <span class="beurt-intro-naam">${escHtml(team.naam)}</span>
          </span>
        </div>
        ${team.dubbelTrekken ? '<div class="dubbel-badge">⭐ Recensie-voordeel: deze beurt wordt twee keer gedraaid en de beste uitkomst telt</div>' : ''}
        <button id="knop-toon-vraag" class="knop knop-primair knop-groot">Kies een spotlight</button>
      </div>`;
    Geluid.spotAan();
    this.el('knop-toon-vraag').addEventListener('click', () => {
      Geluid.knop();
      this.faseSpotlights();
    });
  },

  faseSpotlights() {
    this.fase = 'spotlights';
    this.bezig = false;
    Motor.zetBeurtFase('spotlights');
    const team = Motor.huidigTeam();
    const spots = Motor.spel.spotlights;
    this.el('spel-podium').innerHTML = `
      <div class="spotlight-bord ${spots.length <= 8 ? 'spot-8' : spots.length <= 12 ? 'spot-12' : spots.length <= 16 ? 'spot-16' : 'veel'}">
        <div class="spotlight-bord-kop">
          <span class="team-chip"><span class="stip" style="--teamkleur:${this.kleur(team.kleurId).hex}"></span>${escHtml(team.naam)}</span>
          <h3>Kies een nog brandende spotlight</h3>
          <p>De vraag blijft verborgen totdat de leerkracht op het gekozen nummer klikt.</p>
        </div>
        <div class="spotlight-raster" style="--spot-count:${spots.length}">
          ${spots.map((spot) => `
            <button class="podiumspot ${spot.status !== 'beschikbaar' ? 'gespeeld' : ''}"
                    data-spotlight="${spot.nummer}" ${spot.status !== 'beschikbaar' ? 'disabled' : ''}
                    aria-label="Spotlight ${spot.nummer}${spot.status !== 'beschikbaar' ? ', gespeeld' : ', beschikbaar'}">
              <span class="podiumspot-kegel" aria-hidden="true"></span>
              <span class="podiumspot-nummer">${spot.nummer}</span>
              <span class="podiumspot-status">${spot.status !== 'beschikbaar' ? '✓ gespeeld' : 'Spotlight'}</span>
            </button>`).join('')}
        </div>
      </div>`;
    this.el('spel-podium').querySelectorAll('[data-spotlight]:not([disabled])').forEach((knop) => {
      knop.addEventListener('click', async () => {
        if (this.bezig) return;
        this.bezig = true;
        const nummer = Number(knop.dataset.spotlight);
        if (!Motor.kiesSpotlight(nummer)) { this.bezig = false; return; }
        Geluid.spotAan();
        knop.classList.add('opent');
        await this.wacht(650);
        this.faseVraag();
      });
    });
  },

  faseVraag() {
    this.fase = 'vraag';
    this.bezig = false;
    Motor.zetBeurtFase('vraag');
    this.el('scherm-spel').classList.remove('toon-tussenstand');
    const vraag = Motor.huidigeVraag();
    const team = Motor.huidigTeam();
    const kleur = this.kleur(team.kleurId);
    Geluid.vraag();

    let optiesHtml = '';
    if (vraag.type === 'meerkeuze') {
      optiesHtml = `<div class="vraag-opties ${vraag.opties.length <= 2 ? 'een-kolom' : ''}">
        ${vraag.opties.map((o, i) => `
          <div class="optie" style="--i:${i}" data-optie="${i}">
            <span class="optie-letter">${'ABCDEF'[i]}</span><span>${escHtml(o)}</span>
          </div>`).join('')}
      </div>`;
    } else if (vraag.type === 'waarniet') {
      optiesHtml = `<div class="vraag-opties een-kolom">
        <div class="optie" style="--i:0" data-optie="waar"><span class="optie-letter">✓</span><span>Waar</span></div>
        <div class="optie" style="--i:1" data-optie="nietwaar"><span class="optie-letter">✗</span><span>Niet waar</span></div>
      </div>`;
    }

    this.el('spel-podium').innerHTML = `
      <div class="vraag-blok">
        <div class="vraag-meta">
          <span class="cat-chip">${escHtml(vraag.categorie || 'Vraag')}</span>
          <span class="team-chip"><span class="stip" style="--teamkleur:${kleur.hex}"></span>${escHtml(team.naam)}</span>
          ${vraag.type === 'open' ? '<span class="team-chip">✏️ Open vraag</span>' : ''}
        </div>
        <div class="vraag-kaart">
          <p class="vraag-tekst">${escHtml(vraag.vraag)}</p>
        </div>
        ${optiesHtml}
        <div class="vraag-knoppen">
          <button id="knop-toon-antwoord" class="knop knop-primair">Toon antwoord</button>
          <button id="knop-sla-over" class="knop knop-tekst">Sla vraag over</button>
        </div>
      </div>`;

    this.el('knop-toon-antwoord').addEventListener('click', () => {
      Geluid.knop();
      this.faseAntwoord();
    });
    this.el('knop-sla-over').addEventListener('click', () => {
      Geluid.knop();
      this.bevestig('Vraag overslaan?', 'Deze vraag telt dan niet mee en er worden geen punten verdeeld.', () => {
        const r = Motor.slaVraagOver();
        if (r.klaar) { this.startEinde(); return; }
        this.renderSpelVast();
        this.faseTussenstand();
        this.melding('De spotlight is overgeslagen en blijft gespeeld.');
      });
    });
  },

  faseAntwoord() {
    this.fase = 'antwoord';
    this.bezig = false;
    Motor.zetBeurtFase('antwoord');
    const vraag = Motor.huidigeVraag();
    const team = Motor.huidigTeam();
    const kleur = this.kleur(team.kleurId);
    Geluid.antwoord();

    let antwoordHtml = '';
    if (vraag.type === 'meerkeuze') {
      antwoordHtml = `<div class="vraag-opties ${vraag.opties.length <= 2 ? 'een-kolom' : ''}">
        ${vraag.opties.map((o, i) => `
          <div class="optie ${i === vraag.correct ? 'correct' : 'gedimd'}" style="--i:0;animation:none;opacity:1;transform:none">
            <span class="optie-letter">${'ABCDEF'[i]}</span><span>${escHtml(o)}</span>
          </div>`).join('')}
      </div>`;
    } else if (vraag.type === 'waarniet') {
      antwoordHtml = `<div class="vraag-opties een-kolom">
        <div class="optie ${vraag.correct === true ? 'correct' : 'gedimd'}" style="animation:none;opacity:1;transform:none"><span class="optie-letter">✓</span><span>Waar</span></div>
        <div class="optie ${vraag.correct === false ? 'correct' : 'gedimd'}" style="animation:none;opacity:1;transform:none"><span class="optie-letter">✗</span><span>Niet waar</span></div>
      </div>`;
    } else {
      antwoordHtml = `<div class="open-antwoord"><span class="label">HET GOEDE ANTWOORD</span>${escHtml(vraag.antwoord || '')}</div>`;
    }

    const toelichting = Motor.spel.instellingen.toelichtingTonen && vraag.toelichting
      ? `<div class="toelichting"><strong>Toelichting:</strong> ${escHtml(vraag.toelichting)}</div>` : '';

    this.el('spel-podium').innerHTML = `
      <div class="vraag-blok">
        <div class="vraag-meta">
          <span class="cat-chip">${escHtml(vraag.categorie || 'Vraag')}</span>
          <span class="team-chip"><span class="stip" style="--teamkleur:${kleur.hex}"></span>${escHtml(team.naam)}</span>
        </div>
        <div class="vraag-kaart">
          <p class="vraag-tekst">${escHtml(vraag.vraag)}</p>
        </div>
        ${antwoordHtml}
        ${toelichting}
        <div class="vraag-knoppen">
          <span style="font-weight:800;color:var(--paars-licht);font-size:clamp(0.95rem,1.5vw,1.2rem)">Had ${escHtml(team.naam)} het goed?</span>
        </div>
        <div class="oordeel-knoppen">
          <button id="knop-goed" class="knop-goed"><span class="oordeel-teken">✓</span>GOED</button>
          <button id="knop-fout" class="knop-fout"><span class="oordeel-teken">✗</span>FOUT</button>
        </div>
        <div class="vraag-knoppen">
          <button id="knop-toch-terug" class="knop knop-tekst">← Toch terug naar de vraag</button>
        </div>
      </div>`;

    const oordeel = (goed) => {
      if (this.bezig) return;
      this.bezig = true;
      this.el('knop-goed').disabled = true;
      this.el('knop-fout').disabled = true;
      Geluid.knop();
      Motor.beginBeoordeling(goed);
      this.fasePuntenkeuze();
    };
    this.el('knop-goed').addEventListener('click', () => oordeel(true));
    this.el('knop-fout').addEventListener('click', () => oordeel(false));
    this.el('knop-toch-terug').addEventListener('click', () => {
      Geluid.knop();
      this.faseVraag();
    });
  },

  fasePuntenkeuze() {
    this.fase = 'keuze';
    this.bezig = false;
    Motor.zetBeurtFase('keuze');
    const vraagteam = Motor.huidigTeam();
    const beslisser = Motor.beslisserTeam();
    const goed = Motor.spel.beurt.goed;
    this.el('spel-podium').innerHTML = `
      <div class="puntenkeuze">
        <div class="besluit-team" style="--teamkleur:${this.kleur(beslisser.kleurId).hex}">
          <span aria-hidden="true">${this.symbool(beslisser.symboolId).emoji}</span>
          <strong>${escHtml(beslisser.naam)}</strong>
        </div>
        <h3>${goed
          ? `Goed antwoord! Wat doet ${escHtml(beslisser.naam)} met de nog onbekende punten?`
          : `Fout antwoord van ${escHtml(vraagteam.naam)}! ${escHtml(beslisser.naam)} mag beslissen.`}</h3>
        ${goed ? '' : '<p class="tegenstander-uitleg">De eerstvolgende tegenstander krijgt het blinde puntenbesluit.</p>'}
        <div class="verborgen-punten" aria-label="De punten zijn nog volledig onbekend">
          <span class="verborgen-gordijn links"></span><span>WAARDE VERBORGEN</span><span class="verborgen-gordijn rechts"></span>
        </div>
        <div class="besluit-panelen">
          <button id="keuze-incasseren" class="besluit-paneel">
            <span class="besluit-titel">INCASSEREN</span>
            <span>De onbekende punten zijn voor ${escHtml(beslisser.naam)}.</span>
          </button>
          <button id="keuze-uitdelen" class="besluit-paneel">
            <span class="besluit-titel">UITDELEN</span>
            <span>Kies een ander team dat de onbekende punten krijgt.</span>
          </button>
        </div>
        <p class="blind-waarschuwing">Ook uitgedeelde punten kunnen negatief zijn.</p>
      </div>`;
    this.el('keuze-incasseren').addEventListener('click', () => {
      if (this.bezig) return;
      this.bezig = true;
      Geluid.knop();
      Motor.kiesPuntenactie('incasseren');
      this.resultaat = Motor.genereerResultaat();
      this.faseOnthulling();
    });
    this.el('keuze-uitdelen').addEventListener('click', () => {
      Geluid.knop();
      Motor.kiesPuntenactie('uitdelen');
      this.faseDoelteam();
    });
  },

  faseDoelteam() {
    this.fase = 'doelteam';
    this.bezig = false;
    Motor.zetBeurtFase('doelteam');
    const beslisser = Motor.beslisserTeam();
    const anderen = Motor.spel.teams.filter((team) => team.id !== beslisser.id);
    this.el('spel-podium').innerHTML = `
      <div class="doelteam-keuze">
        <h3>Aan welk team delen jullie de onbekende punten uit?</h3>
        <p>${escHtml(beslisser.naam)} beslist en kan zichzelf niet kiezen.</p>
        <div class="doelteam-raster">
          ${anderen.map((team) => `
            <button class="doelteam-kaart" data-doelteam="${team.id}" style="--teamkleur:${this.kleur(team.kleurId).hex}">
              <span aria-hidden="true">${this.symbool(team.symboolId).emoji}</span>
              <strong>${escHtml(team.naam)}</strong>
              <small>Huidige score: ${team.score}</small>
            </button>`).join('')}
        </div>
      </div>`;
    this.el('spel-podium').querySelectorAll('[data-doelteam]').forEach((knop) => {
      knop.addEventListener('click', () => {
        Geluid.knop();
        if (Motor.kiesOntvanger(knop.dataset.doelteam)) this.faseOntvangerBevestigen();
      });
    });
  },

  faseOntvangerBevestigen() {
    this.fase = 'bevestiging';
    this.bezig = false;
    Motor.zetBeurtFase('bevestiging');
    const ontvanger = Motor.team(Motor.spel.beurt.selectedRecipientTeamId);
    this.el('spel-podium').innerHTML = `
      <div class="ontvanger-bevestiging">
        <h3>Deze onbekende punten gaan naar:</h3>
        <div class="doelteam-kaart gekozen" style="--teamkleur:${this.kleur(ontvanger.kleurId).hex}">
          <span aria-hidden="true">${this.symbool(ontvanger.symboolId).emoji}</span>
          <strong>${escHtml(ontvanger.naam)}</strong>
        </div>
        <p>De waarde is nog steeds volledig verborgen en kan positief, nul of negatief zijn.</p>
        <div class="vraag-knoppen">
          <button id="ontvanger-anders" class="knop knop-secundair">Ander team kiezen</button>
          <button id="ontvanger-bevestig" class="knop knop-primair knop-groot">Keuze bevestigen</button>
        </div>
      </div>`;
    this.el('ontvanger-anders').addEventListener('click', () => {
      Geluid.knop();
      Motor.wijzigOntvanger();
      this.faseDoelteam();
    });
    this.el('ontvanger-bevestig').addEventListener('click', () => {
      if (this.bezig) return;
      this.bezig = true;
      Geluid.knop();
      this.resultaat = Motor.genereerResultaat();
      this.faseOnthulling();
    });
  },

  // ---------- De oneerlijke puntenonthulling ----------
  async faseOnthulling(hervat) {
    this.fase = 'onthulling';
    const r = this.resultaat || Motor.spel.beurt.resultaat;
    if (!r) return;
    this.resultaat = r;
    this.el('scherm-spel').classList.remove('toon-plotwending');
    const team = Motor.team(r.teamId);
    const beslisser = Motor.team(r.beslisserTeamId);
    const ontvanger = Motor.team(r.selectedRecipientTeamId);
    const kleur = this.kleur(team.kleurId);

    this.el('spel-podium').innerHTML = `
      <div class="onthulling">
        <div class="onthulling-team">
          <span class="stip" style="--teamkleur:${kleur.hex}"></span>
          ${this.symbool(team.symboolId).emoji} ${escHtml(team.naam)}
          <span class="punten-uitkomst ${r.goed ? 'goed' : 'fout'}">${r.goed ? '✓ GOED beantwoord' : '✗ FOUT beantwoord'}</span>
        </div>
        <div class="beurt-keuze-regel">
          ${escHtml(team.naam)} antwoordde ${r.goed ? 'goed' : 'fout'}.
          <strong>${escHtml(beslisser.naam)}</strong> koos voor
          <strong>${r.keuze === 'uitdelen' ? 'Uitdelen' : 'Incasseren'}</strong>.
          De punten gaan naar <strong>${escHtml(ontvanger.naam)}</strong>.
        </div>
        ${r.finaleVerdubbeld ? '<div class="finale-chip">🔥 Finalevraag: de puntenwaarde telt dubbel</div>' : ''}
        <div class="puntenmachine" id="puntenmachine" title="Klik om te versnellen">
          <div class="punten-display" id="punten-display">···</div>
          <div class="punten-label">HET LICHTBORD BESLIST</div>
        </div>
        <div id="onthulling-extra" class="onthulling" style="gap:10px"></div>
        <div class="vraag-knoppen" id="onthulling-knoppen">
          <button id="knop-versnel" class="knop knop-tekst">Versnellen ▸▸</button>
        </div>
      </div>`;

    const machine = this.el('puntenmachine');
    let overslaan = false;
    const slaOver = () => { overslaan = true; };
    machine.addEventListener('click', slaOver);
    this.el('knop-versnel').addEventListener('click', () => { Geluid.knop(); slaOver(); });

    // dubbel gedraaid door recensie-voordeel?
    if (r.dubbelGebruikt) {
      this.el('onthulling-extra').innerHTML =
        `<div class="humor-regel">⭐ Twee keer gedraaid (${r.trekkingen.map((t) => (t >= 0 ? '+' : '') + t).join(' en ')}) — de beste uitkomst telt.</div>`;
    }

    // 1. het rad rolt naar de gewone puntenwaarde
    await this._rolNaar(r.basisPunten, () => overslaan);

    // 2. speciale gebeurtenis?
    if (r.gebeurtenis) {
      await this.wacht(650);
      await this._toonGebeurtenis(r);
      if (r.gebeurtenis.keuzeNodig === 'opnieuw') return; // wacht op keuze
    }

    this._onthullingAfronden();
  },

  async _rolNaar(eind, moetOverslaan) {
    const display = this.el('punten-display');
    if (!display) return;
    const modus = CONFIG.modi[Motor.spel.instellingen.modus];
    const factor = (this.resultaat && this.resultaat.spanningsFactor) || 1;
    const pool = modus.waarden.flatMap((p) => [p.w, -p.w]).concat(0).map((waarde) => {
      if (!waarde) return 0;
      return Math.sign(waarde) * Math.max(5, Math.round(Math.abs(waarde) * factor / 5) * 5);
    });

    const zetWaarde = (w) => {
      display.textContent = (w > 0 ? '+' : '') + w;
      display.classList.toggle('negatief', w < 0);
      display.classList.toggle('nul', w === 0);
    };

    if (this.animFactor() === 0) {
      zetWaarde(eind);
      display.classList.add('klaar');
      this._puntGeluid(eind);
      return;
    }

    const machine = this.el('puntenmachine');
    machine.classList.add('spint');
    Geluid.radStart();

    let vertraging = 65;
    const eindtijd = performance.now() + 2400 * this.animFactor();
    await new Promise((klaar) => {
      const stap = () => {
        if (moetOverslaan() || performance.now() > eindtijd) { klaar(); return; }
        zetWaarde(pool[Math.floor(Math.random() * pool.length)]);
        vertraging = Math.min(280, vertraging * 1.07);
        const t = setTimeout(stap, vertraging);
        this.timers.push(t);
      };
      stap();
    });

    Geluid.radStop();
    machine.classList.remove('spint');
    zetWaarde(eind);
    display.classList.remove('klaar');
    void display.offsetWidth; // herstart de landingsanimatie
    display.classList.add('klaar');
    this._puntGeluid(eind);
    await this.wacht(350);
  },

  _puntGeluid(punten) {
    if (punten >= 60) Geluid.groot();
    else if (punten > 0) Geluid.positief();
    else if (punten === 0) Geluid.nul();
    else Geluid.negatief();
  },

  async _toonGebeurtenis(r) {
    const extra = this.el('onthulling-extra');
    this.el('scherm-spel').classList.add('toon-plotwending');
    Geluid.gebeurtenis();
    extra.innerHTML = `<div class="plotwending-banner">✦ SPECIALE PLOTWENDING ✦</div>`;
    await this.wacht(1100);
    extra.innerHTML = `
      <div class="gebeurtenis-kaart">
        <span class="gebeurtenis-icoon" aria-hidden="true">${r.gebeurtenis.icoon}</span>
        <span class="gebeurtenis-naam">${escHtml(r.gebeurtenis.naam)}</span>
        <span class="gebeurtenis-uitleg">${escHtml(r.gebeurtenis.uitleg)}</span>
        <span class="gebeurtenis-effect">${escHtml(r.gebeurtenis.beschrijving)}</span>
      </div>`;
    await this.wacht(900);

    if (r.gebeurtenis.keuzeNodig === 'opnieuw') {
      const knoppen = this.el('onthulling-knoppen');
      knoppen.innerHTML = `
        <button id="knop-houden" class="knop knop-primair">Punten houden (${r.puntenActief >= 0 ? '+' : ''}${r.puntenActief})</button>
        <button id="knop-opnieuw" class="knop knop-secundair">🎲 Opnieuw draaien</button>`;
      this.el('knop-houden').addEventListener('click', () => {
        Geluid.knop();
        r.gebeurtenis.keuzeNodig = null;
        this._onthullingAfronden();
      });
      this.el('knop-opnieuw').addEventListener('click', async () => {
        Geluid.knop();
        this.el('onthulling-knoppen').innerHTML = '<button id="knop-versnel-2" class="knop knop-tekst">Versnellen ▸▸</button>';
        Motor.herdraai(r);
        this.el('onthulling-extra').innerHTML = '<div class="humor-regel">De tweede uitkomst is definitief…</div>';
        let overslaan = false;
        this.el('knop-versnel-2').addEventListener('click', () => { overslaan = true; });
        await this._rolNaar(r.puntenActief, () => overslaan);
        this._onthullingAfronden();
      });
      return;
    }

    // eindresultaat na de gebeurtenis groot tonen als het afwijkt van de trekking
    if (r.puntenActief !== r.basisPunten) {
      const display = this.el('punten-display');
      display.textContent = (r.puntenActief > 0 ? '+' : '') + r.puntenActief;
      display.classList.toggle('negatief', r.puntenActief < 0);
      display.classList.toggle('nul', r.puntenActief === 0);
      display.classList.remove('klaar');
      void display.offsetWidth;
      display.classList.add('klaar');
      this._puntGeluid(r.puntenActief);
      await this.wacht(400);
    }
  },

  _onthullingAfronden() {
    const r = this.resultaat;
    const knoppen = this.el('onthulling-knoppen');
    if (!knoppen) return;
    const humor = r.humor ? `<div class="humor-regel">${escHtml(r.humor)}</div>` : '';
    this.el('onthulling-extra').insertAdjacentHTML('beforeend', humor);
    knoppen.innerHTML = `<button id="knop-punten-toepassen" class="knop knop-primair knop-groot">Punten toepassen</button>`;
    this.el('knop-punten-toepassen').addEventListener('click', () => {
      if (this._toepassenBezig) return;
      this._toepassenBezig = true;
      Geluid.knop();
      this.pasResultaatToe();
    });
    this.bezig = false;
  },

  async pasResultaatToe() {
    const r = this.resultaat;
    this.el('scherm-spel').classList.remove('toon-plotwending');
    const oudeScores = {};
    Motor.spel.teams.forEach((t) => (oudeScores[t.id] = t.score));
    const deltas = Motor.pasToe(r);
    this.resultaat = null;
    this._toepassenBezig = false;

    // scorebord bijwerken met tellende animatie en delta-wolkjes
    this.renderScores();
    this.renderVoortgang();
    const houder = this.el('spel-scores');
    Motor.spel.teams.forEach((team) => {
      const kaart = houder.querySelector(`[data-team="${team.id}"]`);
      if (!kaart) return;
      const delta = deltas[team.id] || 0;
      if (delta !== 0) {
        const badge = kaart.querySelector('.team-kaart-delta');
        badge.textContent = (delta > 0 ? '+' : '') + delta;
        badge.classList.add(delta > 0 ? 'plus' : 'min', 'zichtbaar');
        this._telScore(kaart.querySelector('.team-kaart-score'), oudeScores[team.id], team.score);
      }
    });

    await this.wacht(1250);
    this.faseTussenstand();
  },

  _telScore(el, van, naar) {
    if (!el) return;
    if (this.animFactor() === 0) {
      el.textContent = naar;
      el.classList.toggle('negatief', naar < 0);
      return;
    }
    const duur = 750 * this.animFactor();
    const start = performance.now();
    let laatsteTik = 0;
    const stap = (nu) => {
      const p = Math.min(1, (nu - start) / duur);
      const eased = 1 - Math.pow(1 - p, 2);
      const waarde = Math.round(van + (naar - van) * eased);
      el.textContent = waarde;
      el.classList.toggle('negatief', waarde < 0);
      if (nu - laatsteTik > 90) { Geluid.telTik(); laatsteTik = nu; }
      if (p < 1) requestAnimationFrame(stap);
    };
    requestAnimationFrame(stap);
  },

  faseTussenstand(bekijkModus) {
    this.fase = 'tussenstand';
    this.bezig = false;
    this.el('scherm-spel').classList.add('toon-tussenstand');
    const lijst = Motor.ranglijst();
    const deltas = Motor.spel.laatsteDeltas || {};
    const klaar = Motor.spel.fase === 'klaar';
    const beurt = Motor.spel.laatsteBeurt;
    const vraagteam = beurt ? Motor.team(beurt.actiefTeamId) : null;
    const beslisser = beurt && beurt.beslisserTeamId ? Motor.team(beurt.beslisserTeamId) : null;
    const ontvanger = beurt && beurt.selectedRecipientTeamId ? Motor.team(beurt.selectedRecipientTeamId) : null;

    this.el('spel-podium').innerHTML = `
      <div class="tussenstand">
        <h3 class="tussenstand-kop">Tussenstand</h3>
        ${beurt && beurt.keuze !== 'overgeslagen' ? `
          <div class="beurt-overzicht">
            <strong>${escHtml(vraagteam.naam)}</strong> beantwoordde de vraag
            ${beurt.goed ? 'goed' : 'fout'}.
            ${beslisser ? `<strong>${escHtml(beslisser.naam)}</strong> koos <strong>${beurt.keuze === 'uitdelen' ? 'Uitdelen' : 'Incasseren'}</strong>.` : ''}
            ${ontvanger ? `De punten gingen naar <strong>${escHtml(ontvanger.naam)}</strong>:` : ''}
            <span class="beurt-overzicht-punten">${beurt.uiteindelijkePunten > 0 ? '+' : ''}${beurt.uiteindelijkePunten}</span>
            ${beurt.gebeurtenis ? `<span class="beurt-overzicht-event">${beurt.gebeurtenis.icoon} ${escHtml(beurt.gebeurtenis.naam)}</span>` : ''}
          </div>` : beurt ? `<div class="beurt-overzicht"><strong>${escHtml(vraagteam.naam)}</strong> sloeg spotlight ${beurt.spotlightNummer} over.</div>` : ''}
        <div class="stand-lijst">
          ${lijst.map(({ rang, team }) => {
            const d = deltas[team.id] || 0;
            return `
            <div class="stand-rij ${rang === 1 ? 'eerste' : ''}" style="--teamkleur:${this.kleur(team.kleurId).hex}">
              <span class="stand-rang">${rang}.</span>
              <span class="stand-symbool" aria-hidden="true">${this.symbool(team.symboolId).emoji}</span>
              <span class="stand-naam">${escHtml(team.naam)}</span>
              <span class="stand-rollen">
                ${vraagteam && team.id === vraagteam.id ? '<small>🎭 speelde de vraag</small>' : ''}
                ${beslisser && team.id === beslisser.id ? '<small>🎛 nam het puntenbesluit</small>' : ''}
                ${ontvanger && team.id === ontvanger.id ? '<small>🎯 ontving de punten</small>' : ''}
              </span>
              <span class="stand-delta ${d > 0 ? 'plus' : d < 0 ? 'min' : 'nul'}">${d > 0 ? '+' + d : d}</span>
              <span class="stand-score ${team.score < 0 ? 'negatief' : ''}">${team.score}</span>
            </div>`;
          }).join('')}
        </div>
        <div class="vraag-knoppen">
          ${bekijkModus
            ? '<button id="knop-stand-terug" class="knop knop-primair">← Terug naar het spel</button>'
            : `<button id="knop-volgende-beurt" class="knop knop-primair knop-groot">${klaar ? '🎭 Naar de einduitslag' : 'Volgende beurt →'}</button>`}
        </div>
      </div>`;

    if (bekijkModus) {
      this.el('knop-stand-terug').addEventListener('click', () => {
        Geluid.knop();
        this._herstelFase(bekijkModus);
      });
    } else {
      this.el('knop-volgende-beurt').addEventListener('click', () => {
        if (this.bezig) return;
        this.bezig = true;
        Geluid.knop();
        if (klaar) this.startEinde();
        else this.faseIntro();
      });
    }
  },

  _herstelFase(fase) {
    if (fase === 'intro') this.faseIntro();
    else if (fase === 'spotlights') this.faseSpotlights();
    else if (fase === 'vraag') this.faseVraag();
    else if (fase === 'antwoord') this.faseAntwoord();
    else if (fase === 'keuze') this.fasePuntenkeuze();
    else if (fase === 'doelteam') this.faseDoelteam();
    else if (fase === 'bevestiging') this.faseOntvangerBevestigen();
    else if (fase === 'onthulling') this.faseOnthulling(true);
    else this.faseIntro();
  },

  // ---------- Pauzemenu ----------
  openPauze() {
    if (!this.el('scherm-spel') || this.el('scherm-spel').hidden) return;
    const inhoud = this.el('pauze-inhoud');
    const i = this.instellingen;
    inhoud.innerHTML = `
      <button id="pauze-hervat" class="knop knop-primair">▶ Spel hervatten</button>
      <div class="pauze-rij">
        <button id="pauze-muziek" class="knop knop-secundair">🎵 Muziek: ${i.muziekAan ? 'aan' : 'uit'}</button>
        <button id="pauze-geluid" class="knop knop-secundair">🔊 Effecten: ${i.effectenAan ? 'aan' : 'uit'}</button>
      </div>
      <div class="pauze-rij">
        <button id="pauze-snel" class="knop knop-secundair">⚡ Animaties: ${i.snelleAnimaties ? 'snel' : 'normaal'}</button>
        <button id="pauze-fullscreen" class="knop knop-secundair">⛶ Volledig scherm</button>
      </div>
      <hr class="pauze-scheiding">
      <button id="pauze-stand" class="knop knop-secundair">📊 Tussenstand bekijken</button>
      <button id="pauze-vraag" class="knop knop-secundair">🔁 Vraag opnieuw tonen</button>
      <button id="pauze-herstel" class="knop knop-secundair" ${Motor.kanHerstellen() ? '' : 'disabled'}>↩ Laatste actie herstellen</button>
      <hr class="pauze-scheiding">
      <button id="pauze-einde" class="knop knop-secundair">🏁 Spel voortijdig beëindigen</button>
      <button id="pauze-menu" class="knop knop-gevaar">🚪 Terug naar hoofdmenu</button>
    `;
    this.toonOverlay('overlay-pauze');

    const k = (id, fn) => this.el(id).addEventListener('click', () => { Geluid.knop(); fn(); });
    k('pauze-hervat', () => this.sluitPauze());
    k('pauze-muziek', () => { this.wisselMuziek(); this.openPauze(); });
    k('pauze-geluid', () => { this.wisselEffecten(); this.openPauze(); });
    k('pauze-snel', () => {
      i.snelleAnimaties = !i.snelleAnimaties;
      this.bewaarInstellingen();
      this.openPauze();
    });
    k('pauze-fullscreen', () => this.volledigScherm());
    k('pauze-stand', () => {
      const vorige = this.fase;
      this.sluitPauze();
      if (this.fase !== 'tussenstand') this.faseTussenstand(vorige);
    });
    k('pauze-vraag', () => {
      this.sluitPauze();
      if (Motor.spel.fase === 'beurt') {
        if (Motor.spel.beurt.spotlightNummer) this.faseVraag();
        else this.faseSpotlights();
      }
    });
    k('pauze-herstel', () => {
      this.bevestig(
        'Laatste actie herstellen?',
        'De volledige laatste beurt wordt teruggezet. De spotlight wordt weer beschikbaar en eerder getrokken punten vervallen.',
        () => {
          if (Motor.herstel()) {
            this.resultaat = null;
            this.sluitPauze();
            this.renderSpelVast();
            this.faseIntro();
            this.melding('De laatste beurt is hersteld. De spotlight is weer beschikbaar.');
          } else {
            this.melding('Er is geen actie om te herstellen.');
          }
        }
      );
    });
    k('pauze-einde', () => {
      this.bevestig(
        'Spel voortijdig beëindigen?',
        'De huidige stand wordt de einduitslag.',
        () => {
          Motor.spel.fase = 'klaar';
          Motor.bewaar();
          this.sluitPauze();
          this.startEinde();
        }
      );
    });
    k('pauze-menu', () => {
      this.bevestig(
        'Terug naar het hoofdmenu?',
        'Het spel wordt bewaard; je kunt het later hervatten via Spel starten.',
        () => {
          this.sluitPauze();
          Motor.spel = null;
          this.scherm('scherm-menu');
        }
      );
    });
  },

  sluitPauze() { this.sluitOverlay('overlay-pauze'); },

  // ---------- Einde ----------
  startEinde() {
    Motor.spel.fase = 'klaar';
    Motor.bewaar();
    this.bezig = false;
    Geluid.eindOnthulling();
    this.gordijnOvergang('DE PUNTEN ZIJN GETELD', () => {
      this.scherm('scherm-einde');
      this.renderEindOnthulling();
    });
  },

  renderEindOnthulling() {
    const lijst = Motor.ranglijst().slice().reverse(); // laagste eerst
    const el = this.el('einde-inhoud');
    el.innerHTML = `
      <div class="einde-groot">De einduitslag</div>
      <div class="einde-sub">Van de laatste plaats naar de hoofdrol…</div>
      <div class="uitslag-onthulling" id="uitslag-onthulling"></div>
      <div class="vraag-knoppen">
        <button id="knop-onthul" class="knop knop-primair knop-groot">Onthul de volgende plaats</button>
      </div>`;

    const houder = this.el('uitslag-onthulling');
    let index = 0;

    const onthul = () => {
      if (index >= lijst.length) return;
      const { rang, team } = lijst[index];
      Geluid.antwoord();
      houder.insertAdjacentHTML('afterbegin', `
        <div class="uitslag-rij" style="--teamkleur:${this.kleur(team.kleurId).hex}">
          <span class="stand-rang">${rang}.</span>
          <span class="stand-symbool" aria-hidden="true">${this.symbool(team.symboolId).emoji}</span>
          <span class="stand-naam">${escHtml(team.naam)}</span>
          <span class="stand-score ${team.score < 0 ? 'negatief' : ''}">${team.score} punten</span>
        </div>`);
      index++;
      const knop = this.el('knop-onthul');
      if (index >= lijst.length) {
        knop.textContent = '🏆 Naar het podium';
        knop.onclick = () => { Geluid.knop(); this.renderPodium(); };
      } else if (index === lijst.length - 1) {
        knop.textContent = '✨ Onthul de winnaar';
      }
    };

    this.el('knop-onthul').onclick = () => { Geluid.knop(); onthul(); };
    onthul(); // eerste (laagste) meteen tonen
  },

  renderPodium() {
    const ranglijst = Motor.ranglijst();
    const winnaars = Motor.winnaars();
    const gedeeld = winnaars.length > 1;
    const el = this.el('einde-inhoud');

    const perRang = {};
    ranglijst.forEach(({ rang, team }) => {
      (perRang[rang] = perRang[rang] || []).push(team);
    });

    const teamKaart = (team) => `
      <div class="podium-team" style="--teamkleur:${this.kleur(team.kleurId).hex}">
        <span class="sym" aria-hidden="true">${this.symbool(team.symboolId).emoji}</span>
        <span class="naam">${escHtml(team.naam)}</span>
        <span class="score ${team.score < 0 ? 'negatief' : ''}">${team.score} punten</span>
      </div>`;

    const podiumPlek = (rang, cssKlasse) => {
      const teams = perRang[rang];
      if (!teams) return '';
      return `
        <div class="podium-plek ${cssKlasse}">
          ${teams.map(teamKaart).join('')}
          <div class="podium-blok">${rang}</div>
        </div>`;
    };

    const rest = ranglijst.filter(({ rang }) => rang > 3);

    el.innerHTML = `
      <div class="winnaar-banner">
        <div class="label">${gedeeld ? '✨ GEDEELDE HOOFDROL ✨' : 'DE WINNAARS VAN HET ONEERLIJKE SPEL'}</div>
        <div class="namen">${winnaars.map((t) => escHtml(t.naam)).join(' · ')}</div>
      </div>
      <div class="podium-weergave">
        ${podiumPlek(2, 'podium-2')}
        ${podiumPlek(1, 'podium-1')}
        ${podiumPlek(3, 'podium-3')}
      </div>
      ${rest.length ? `<div class="einde-restlijst">
        ${rest.map(({ rang, team }) => `
          <span class="einde-rest-item">${rang}. ${this.symbool(team.symboolId).emoji} ${escHtml(team.naam)} — ${team.score}</span>`).join('')}
      </div>` : ''}
      <div class="paneel-knoppen">
        <button id="einde-nogeens" class="knop knop-primair">🔁 Nog een keer met dezelfde teams</button>
        <button id="einde-nieuw" class="knop knop-secundair">Nieuw spel instellen</button>
        <button id="einde-opslaan" class="knop knop-secundair">🖼 Eindstand opslaan</button>
        <button id="einde-menu" class="knop knop-secundair">Hoofdmenu</button>
      </div>
      <footer class="os-footer">
        <a href="https://www.meesterdanny.com" target="_blank" rel="noopener">www.meesterdanny.com</a>
        <span class="footer-scheiding">·</span>
        <span>meester.danny</span>
      </footer>`;

    Geluid.applaus();
    this._strooiPaginas(el);

    const k = (id, fn) => this.el(id).addEventListener('click', () => { Geluid.knop(); fn(); });
    k('einde-nogeens', () => {
      const teams = Motor.spel.teams.map((t) => ({ naam: t.naam, kleurId: t.kleurId, symboolId: t.symboolId }));
      const inst = Motor.spel.instellingen;
      const aantal = Motor.spel.spotlights.length;
      Opslag.wisSpel();
      Motor.nieuwSpel({
        teams,
        aantalVragen: aantal,
        spelInstellingen: JSON.parse(JSON.stringify(inst)),
      });
      this.speelStartanimatie();
    });
    k('einde-nieuw', () => {
      Opslag.wisSpel();
      Motor.spel = null;
      this._nieuweWizard();
    });
    k('einde-opslaan', () => {
      if (EindstandExport.download(Motor.spel)) this.melding('De eindstand is opgeslagen als afbeelding.');
      else this.melding('Het opslaan is niet gelukt. Probeer het opnieuw.');
    });
    k('einde-menu', () => {
      Opslag.wisSpel();
      Motor.spel = null;
      this.scherm('scherm-menu');
    });
  },

  // een paar rustig dwarrelende boekpagina's/kaartjes (functioneel feestje, geen confettiregen)
  _strooiPaginas(houder) {
    if (this.animFactor() === 0) return;
    const symbolen = ['📄', '🎟', '📖', '⭐'];
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('span');
      s.className = 'pagina-vlucht';
      s.textContent = symbolen[i % symbolen.length];
      s.style.left = 6 + Math.random() * 88 + '%';
      s.style.setProperty('--tol', (Math.random() * 360 - 180) + 'deg');
      s.style.animationDuration = 5 + Math.random() * 4 + 's';
      s.style.animationDelay = Math.random() * 2.5 + 's';
      houder.appendChild(s);
      setTimeout(() => s.remove(), 12000);
    }
  },
};

// ---------- Start ----------
document.addEventListener('DOMContentLoaded', () => UI.init());
