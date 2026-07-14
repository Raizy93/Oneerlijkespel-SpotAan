/* ============================================================
   HET ONEERLIJKE SPEL — opslag.js
   Lokale opslag: instellingen, eigen vragen, lopend spel.
   Alles blijft op het apparaat; er is geen account of server.

   Vragenmodel: zolang de leerkracht niets wijzigt, geldt de
   ingebouwde standaardset. Bij de eerste wijziging wordt de
   volledige lijst overgenomen en beheert de editor die lijst
   (toevoegen, wijzigen, verwijderen, verslepen, aan/uit).
   ============================================================ */

const Opslag = {
  SLEUTEL_INSTELLINGEN: 'oneerlijkespel-instellingen',
  SLEUTEL_VRAGEN: 'oneerlijkespel-vragen-kbw2026',
  SLEUTEL_SPEL: 'oneerlijkespel-lopend-spel-kbw2026',

  _lees(sleutel, standaard) {
    try {
      const ruw = localStorage.getItem(sleutel);
      if (!ruw) return standaard;
      return JSON.parse(ruw);
    } catch (e) {
      // beschadigde opslag: opruimen en standaard teruggeven
      try { localStorage.removeItem(sleutel); } catch (_) {}
      return standaard;
    }
  },

  _schrijf(sleutel, waarde) {
    try {
      localStorage.setItem(sleutel, JSON.stringify(waarde));
      return true;
    } catch (e) {
      return false;
    }
  },

  // ---- Instellingen ----
  leesInstellingen() {
    const opgeslagen = this._lees(this.SLEUTEL_INSTELLINGEN, {});
    // samenvoegen met standaard zodat nieuwe opties altijd bestaan
    return Object.assign({}, CONFIG.standaardInstellingen, opgeslagen);
  },

  bewaarInstellingen(instellingen) {
    return this._schrijf(this.SLEUTEL_INSTELLINGEN, instellingen);
  },

  // ---- Vragen ----
  // Geeft de volledige beheerde vragenlijst (kopie).
  leesVragenlijst() {
    const data = this._lees(this.SLEUTEL_VRAGEN, null);
    if (data && Array.isArray(data.vragen) && data.vragen.length) {
      return data.vragen.slice();
    }
    return STANDAARD_VRAGEN.map((v) => Object.assign({}, v));
  },

  isAangepast() {
    const data = this._lees(this.SLEUTEL_VRAGEN, null);
    return !!(data && Array.isArray(data.vragen) && data.vragen.length);
  },

  bewaarVragenlijst(vragen) {
    return this._schrijf(this.SLEUTEL_VRAGEN, { vragen });
  },

  herstelStandaardVragen() {
    try { localStorage.removeItem(this.SLEUTEL_VRAGEN); } catch (_) {}
  },

  // Alleen de actieve vragen (voor een nieuw spel)
  actieveVragenlijst() {
    return this.leesVragenlijst().filter((v) => v.actief !== false);
  },

  // ---- Lopend spel ----
  bewaarSpel(snapshot) {
    return this._schrijf(this.SLEUTEL_SPEL, snapshot);
  },

  leesSpel() {
    const s = this._lees(this.SLEUTEL_SPEL, null);
    // basale geldigheidscontrole tegen beschadigde opslag
    if (!s || !Array.isArray(s.teams)) return null;
    if (!Array.isArray(s.spotlights) && !Array.isArray(s.vragen)) return null;
    if (s.teams.length < 2 || typeof s.vraagIndex !== 'number') return null;
    return s;
  },

  wisSpel() {
    try { localStorage.removeItem(this.SLEUTEL_SPEL); } catch (_) {}
  },

  wisAlles() {
    try {
      localStorage.removeItem(this.SLEUTEL_INSTELLINGEN);
      localStorage.removeItem(this.SLEUTEL_VRAGEN);
      localStorage.removeItem(this.SLEUTEL_SPEL);
    } catch (_) {}
  },
};
