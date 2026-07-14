/* ============================================================
   HET ONEERLIJKE SPEL — editor.js
   Beheeromgeving voor eigen vragen: toevoegen, wijzigen,
   verwijderen, dupliceren, verslepen, zoeken, filteren,
   voorbeeld, exporteren/importeren (JSON) en terugzetten.
   ============================================================ */

const VragenEditor = {
  vragen: [],
  zoekterm: '',
  filterCategorie: '',
  sleepIndex: null,

  open() {
    this.vragen = Opslag.leesVragenlijst();
    this.zoekterm = '';
    this.filterCategorie = '';
    this.render();
  },

  _bewaar() {
    Opslag.bewaarVragenlijst(this.vragen);
  },

  categorieen() {
    const set = new Set(this.vragen.map((v) => v.categorie).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'nl'));
  },

  typeNaam(type) {
    return { meerkeuze: 'Meerkeuze', waarniet: 'Waar of niet waar', open: 'Open vraag' }[type] || type;
  },

  // ---------- Hoofdweergave ----------
  render() {
    const el = document.getElementById('editor-inhoud');
    const cats = this.categorieen();
    const term = this.zoekterm.trim().toLowerCase();
    const zichtbaar = this.vragen
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => {
        if (this.filterCategorie && v.categorie !== this.filterCategorie) return false;
        if (term && !(`${v.vraag} ${v.categorie || ''}`.toLowerCase().includes(term))) return false;
        return true;
      });

    const actiefAantal = this.vragen.filter((v) => v.actief !== false).length;
    const sleepbaar = !term && !this.filterCategorie;

    el.innerHTML = `
      <div class="editor-werkbalk">
        <input type="text" id="editor-zoek" class="editor-zoek" placeholder="🔍 Zoek in vragen…"
               value="${escHtml(this.zoekterm)}" aria-label="Zoek in vragen">
        <select id="editor-filter" class="editor-filter" aria-label="Filter op categorie">
          <option value="">Alle categorieën</option>
          ${cats.map((c) => `<option value="${escHtml(c)}" ${c === this.filterCategorie ? 'selected' : ''}>${escHtml(c)}</option>`).join('')}
        </select>
        <button id="editor-nieuw" class="knop knop-primair">+ Nieuwe vraag</button>
        <button id="editor-exporteer" class="knop knop-secundair">⬇ Exporteren</button>
        <button id="editor-importeer" class="knop knop-secundair">⬆ Importeren</button>
        <button id="editor-herstel" class="knop knop-secundair">↺ Standaardvragen</button>
        <input type="file" id="editor-importbestand" accept="application/json,.json" hidden>
        <p class="editor-info">${this.vragen.length} vragen in de set, ${actiefAantal} actief.
          ${sleepbaar ? 'Versleep vragen met het ⠿-handvat om de volgorde aan te passen.' : 'Wis het zoek- of categoriefilter om te kunnen verslepen.'}</p>
      </div>
      <div class="editor-lijst" id="editor-lijst">
        ${zichtbaar.length ? zichtbaar.map(({ v, i }) => this._itemHtml(v, i, sleepbaar)).join('')
          : '<p style="text-align:center;color:var(--inkt-zacht);padding:20px">Geen vragen gevonden.</p>'}
      </div>
    `;

    // events
    const zoek = document.getElementById('editor-zoek');
    zoek.addEventListener('input', () => { this.zoekterm = zoek.value; this._renderLijstBehoudFocus(); });
    document.getElementById('editor-filter').addEventListener('change', (e) => {
      this.filterCategorie = e.target.value; this.render();
    });
    document.getElementById('editor-nieuw').addEventListener('click', () => { Geluid.knop(); this.bewerken(null); });
    document.getElementById('editor-exporteer').addEventListener('click', () => { Geluid.knop(); this.exporteer(); });
    document.getElementById('editor-importeer').addEventListener('click', () => {
      Geluid.knop();
      document.getElementById('editor-importbestand').click();
    });
    document.getElementById('editor-importbestand').addEventListener('change', (e) => this.importeer(e));
    document.getElementById('editor-herstel').addEventListener('click', () => {
      Geluid.knop();
      UI.bevestig(
        'Standaardvragen terugzetten?',
        'Alle eigen vragen en wijzigingen worden verwijderd. De ingebouwde vragenset komt terug.',
        () => {
          Opslag.herstelStandaardVragen();
          this.open();
          UI.melding('De standaardvragen zijn teruggezet.');
        }
      );
    });

    this._bindItemEvents(sleepbaar);
  },

  // alleen de lijst opnieuw tekenen zodat het zoekveld focus houdt
  _renderLijstBehoudFocus() {
    const term = this.zoekterm.trim().toLowerCase();
    const sleepbaar = !term && !this.filterCategorie;
    const zichtbaar = this.vragen
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => {
        if (this.filterCategorie && v.categorie !== this.filterCategorie) return false;
        if (term && !(`${v.vraag} ${v.categorie || ''}`.toLowerCase().includes(term))) return false;
        return true;
      });
    const lijst = document.getElementById('editor-lijst');
    lijst.innerHTML = zichtbaar.length
      ? zichtbaar.map(({ v, i }) => this._itemHtml(v, i, sleepbaar)).join('')
      : '<p style="text-align:center;color:var(--inkt-zacht);padding:20px">Geen vragen gevonden.</p>';
    this._bindItemEvents(sleepbaar);
  },

  _itemHtml(v, index, sleepbaar) {
    return `
      <div class="editor-item ${v.actief === false ? 'inactief' : ''}" data-index="${index}" ${sleepbaar ? 'draggable="true"' : ''}>
        ${sleepbaar ? '<span class="greep" aria-hidden="true" title="Versleep om te ordenen">⠿</span>' : ''}
        <div class="editor-item-midden">
          <div class="editor-item-vraag">${escHtml(v.vraag)}</div>
          <div class="editor-item-meta">
            <span class="chipje">${escHtml(v.categorie || 'Zonder categorie')}</span>
            <span>${this.typeNaam(v.type)}</span>
            ${v.moeilijkheid ? `<span>Niveau: ${escHtml(v.moeilijkheid)}</span>` : ''}
            ${v.actief === false ? '<span><strong>Inactief</strong></span>' : ''}
          </div>
        </div>
        <div class="editor-item-knoppen">
          <button data-actie="voorbeeld" title="Voorbeeld bekijken" aria-label="Voorbeeld bekijken">👁</button>
          <button data-actie="aanuit" title="${v.actief === false ? 'Vraag activeren' : 'Vraag uitschakelen'}" aria-label="Actief of inactief">${v.actief === false ? '▶' : '⏸'}</button>
          <button data-actie="bewerk" title="Vraag aanpassen" aria-label="Vraag aanpassen">✏️</button>
          <button data-actie="dupliceer" title="Vraag dupliceren" aria-label="Vraag dupliceren">⧉</button>
          <button data-actie="verwijder" title="Vraag verwijderen" aria-label="Vraag verwijderen">🗑</button>
        </div>
      </div>
    `;
  },

  _bindItemEvents(sleepbaar) {
    const lijst = document.getElementById('editor-lijst');
    lijst.querySelectorAll('.editor-item').forEach((item) => {
      const index = parseInt(item.dataset.index, 10);
      item.querySelectorAll('button[data-actie]').forEach((knop) => {
        knop.addEventListener('click', () => {
          Geluid.knop();
          const actie = knop.dataset.actie;
          if (actie === 'bewerk') this.bewerken(index);
          else if (actie === 'dupliceer') this.dupliceer(index);
          else if (actie === 'verwijder') this.verwijder(index);
          else if (actie === 'aanuit') this.wisselActief(index);
          else if (actie === 'voorbeeld') this.voorbeeld(index);
        });
      });

      if (sleepbaar) {
        item.addEventListener('dragstart', (e) => {
          this.sleepIndex = index;
          e.dataTransfer.effectAllowed = 'move';
          try { e.dataTransfer.setData('text/plain', String(index)); } catch (_) {}
        });
        item.addEventListener('dragover', (e) => {
          e.preventDefault();
          item.classList.add('sleep-boven');
        });
        item.addEventListener('dragleave', () => item.classList.remove('sleep-boven'));
        item.addEventListener('drop', (e) => {
          e.preventDefault();
          item.classList.remove('sleep-boven');
          if (this.sleepIndex === null || this.sleepIndex === index) return;
          const [verplaatst] = this.vragen.splice(this.sleepIndex, 1);
          this.vragen.splice(index, 0, verplaatst);
          this.sleepIndex = null;
          this._bewaar();
          this.render();
        });
        item.addEventListener('dragend', () => {
          this.sleepIndex = null;
          lijst.querySelectorAll('.sleep-boven').forEach((n) => n.classList.remove('sleep-boven'));
        });
      }
    });
  },

  // ---------- Acties ----------
  dupliceer(index) {
    const kopie = JSON.parse(JSON.stringify(this.vragen[index]));
    kopie.id = 'eigen-' + Date.now();
    kopie.vraag = kopie.vraag + ' (kopie)';
    this.vragen.splice(index + 1, 0, kopie);
    this._bewaar();
    this.render();
  },

  verwijder(index) {
    const v = this.vragen[index];
    UI.bevestig(
      'Vraag verwijderen?',
      `"${v.vraag.slice(0, 90)}${v.vraag.length > 90 ? '…' : ''}" wordt definitief verwijderd.`,
      () => {
        this.vragen.splice(index, 1);
        this._bewaar();
        this.render();
        UI.melding('De vraag is verwijderd.');
      }
    );
  },

  wisselActief(index) {
    const v = this.vragen[index];
    v.actief = v.actief === false ? true : false;
    this._bewaar();
    this.render();
  },

  voorbeeld(index) {
    const v = this.vragen[index];
    let inhoud = '';
    if (v.type === 'meerkeuze') {
      inhoud = `<div class="vraag-opties een-kolom" style="margin-top:14px">
        ${v.opties.map((o, i) => `
          <div class="optie ${i === v.correct ? 'correct' : ''}" style="--i:${i};animation:none;opacity:1;transform:none">
            <span class="optie-letter">${'ABCDEF'[i]}</span>${escHtml(o)}
          </div>`).join('')}
      </div>`;
    } else if (v.type === 'waarniet') {
      inhoud = `<div class="vraag-opties een-kolom" style="margin-top:14px">
        <div class="optie ${v.correct === true ? 'correct' : ''}" style="animation:none;opacity:1;transform:none"><span class="optie-letter">✓</span>Waar</div>
        <div class="optie ${v.correct === false ? 'correct' : ''}" style="animation:none;opacity:1;transform:none"><span class="optie-letter">✗</span>Niet waar</div>
      </div>`;
    } else {
      inhoud = `<div class="open-antwoord" style="margin-top:14px;animation:none"><span class="label">ANTWOORD</span>${escHtml(v.antwoord || '')}</div>`;
    }
    const el = document.getElementById('vraagbewerken-inhoud');
    el.innerHTML = `
      <h2 class="paneel-kop">👁 Voorbeeld</h2>
      <div class="editor-voorbeeld">
        <div class="vraag-meta" style="margin-bottom:12px"><span class="cat-chip">${escHtml(v.categorie || 'Zonder categorie')}</span></div>
        <div class="vraag-kaart"><p class="vraag-tekst">${escHtml(v.vraag)}</p></div>
        ${inhoud}
        ${v.toelichting ? `<div class="toelichting" style="margin-top:12px"><strong>Toelichting:</strong> ${escHtml(v.toelichting)}</div>` : ''}
      </div>
      <div class="paneel-knoppen">
        <button id="voorbeeld-sluit" class="knop knop-primair">Sluiten</button>
      </div>
    `;
    UI.toonOverlay('overlay-vraagbewerken');
    document.getElementById('voorbeeld-sluit').addEventListener('click', () => {
      Geluid.knop();
      UI.sluitOverlay('overlay-vraagbewerken');
    });
  },

  // ---------- Formulier (nieuw / bewerken) ----------
  bewerken(index) {
    const bestaand = index !== null ? this.vragen[index] : null;
    const v = bestaand ? JSON.parse(JSON.stringify(bestaand)) : {
      id: 'eigen-' + Date.now(),
      type: 'meerkeuze',
      categorie: '',
      vraag: '',
      opties: ['', '', '', ''],
      correct: 0,
      antwoord: '',
      toelichting: '',
      moeilijkheid: '',
      actief: true,
    };
    if (!Array.isArray(v.opties)) v.opties = ['', '', '', ''];

    const el = document.getElementById('vraagbewerken-inhoud');
    const cats = this.categorieen();

    const renderVorm = () => {
      el.innerHTML = `
        <h2 class="paneel-kop">${bestaand ? '✏️ Vraag aanpassen' : '+ Nieuwe vraag'}</h2>
        <div id="vorm-fout" class="vorm-fout" hidden></div>
        <div class="vorm-rij-2">
          <div class="vorm-veld">
            <label for="vorm-type">Vraagvorm</label>
            <select id="vorm-type">
              <option value="meerkeuze" ${v.type === 'meerkeuze' ? 'selected' : ''}>Meerkeuzevraag</option>
              <option value="waarniet" ${v.type === 'waarniet' ? 'selected' : ''}>Waar of niet waar</option>
              <option value="open" ${v.type === 'open' ? 'selected' : ''}>Open vraag</option>
            </select>
          </div>
          <div class="vorm-veld">
            <label for="vorm-categorie">Categorie</label>
            <input type="text" id="vorm-categorie" list="vorm-cats" maxlength="40"
                   value="${escHtml(v.categorie || '')}" placeholder="Bijvoorbeeld: Theater en podium">
            <datalist id="vorm-cats">${cats.map((c) => `<option value="${escHtml(c)}">`).join('')}</datalist>
          </div>
        </div>
        <div class="vorm-veld">
          <label for="vorm-vraag">Vraag</label>
          <textarea id="vorm-vraag" maxlength="300" placeholder="Typ hier de vraag…">${escHtml(v.vraag)}</textarea>
        </div>
        <div id="vorm-typevelden"></div>
        <div class="vorm-veld">
          <label for="vorm-toelichting">Toelichting voor de leerkracht (niet verplicht)</label>
          <textarea id="vorm-toelichting" maxlength="300">${escHtml(v.toelichting || '')}</textarea>
        </div>
        <div class="vorm-rij-2">
          <div class="vorm-veld">
            <label for="vorm-moeilijkheid">Moeilijkheidsgraad</label>
            <select id="vorm-moeilijkheid">
              <option value="" ${!v.moeilijkheid ? 'selected' : ''}>Geen</option>
              <option value="makkelijk" ${v.moeilijkheid === 'makkelijk' ? 'selected' : ''}>Makkelijk</option>
              <option value="gemiddeld" ${v.moeilijkheid === 'gemiddeld' ? 'selected' : ''}>Gemiddeld</option>
              <option value="moeilijk" ${v.moeilijkheid === 'moeilijk' ? 'selected' : ''}>Moeilijk</option>
            </select>
          </div>
          <div class="vorm-veld">
            <label for="vorm-actief">Meespelen in het spel</label>
            <select id="vorm-actief">
              <option value="ja" ${v.actief !== false ? 'selected' : ''}>Actief</option>
              <option value="nee" ${v.actief === false ? 'selected' : ''}>Inactief</option>
            </select>
          </div>
        </div>
        <div class="paneel-knoppen">
          <button id="vorm-annuleer" class="knop knop-secundair">Annuleren</button>
          <button id="vorm-bewaar" class="knop knop-primair">Vraag bewaren</button>
        </div>
      `;

      const typeveldenEl = document.getElementById('vorm-typevelden');
      const renderTypevelden = (type) => {
        if (type === 'meerkeuze') {
          typeveldenEl.innerHTML = `
            <div class="vorm-veld">
              <label>Antwoordopties — klik het rondje aan bij het juiste antwoord</label>
              ${[0, 1, 2, 3].map((i) => `
                <div class="vorm-optie-rij">
                  <input type="radio" name="vorm-correct" value="${i}" ${v.correct === i ? 'checked' : ''}
                         aria-label="Optie ${'ABCD'[i]} is het juiste antwoord">
                  <input type="text" id="vorm-optie-${i}" maxlength="120"
                         value="${escHtml(v.opties[i] || '')}" placeholder="Optie ${'ABCD'[i]}${i > 1 ? ' (niet verplicht)' : ''}">
                </div>`).join('')}
            </div>`;
        } else if (type === 'waarniet') {
          typeveldenEl.innerHTML = `
            <div class="vorm-veld">
              <label>Het juiste antwoord</label>
              <div class="keuzerij">
                <button type="button" class="keuzeknop ${v.correct === true ? 'actief' : ''}" data-waar="ja">✓ Waar</button>
                <button type="button" class="keuzeknop ${v.correct === false ? 'actief' : ''}" data-waar="nee">✗ Niet waar</button>
              </div>
            </div>`;
          typeveldenEl.querySelectorAll('[data-waar]').forEach((k) => {
            k.addEventListener('click', () => {
              v.correct = k.dataset.waar === 'ja';
              typeveldenEl.querySelectorAll('[data-waar]').forEach((n) => n.classList.remove('actief'));
              k.classList.add('actief');
            });
          });
        } else {
          typeveldenEl.innerHTML = `
            <div class="vorm-veld">
              <label for="vorm-antwoord">Het goede antwoord (voor de leerkracht)</label>
              <input type="text" id="vorm-antwoord" maxlength="200" value="${escHtml(v.antwoord || '')}">
            </div>`;
        }
      };
      renderTypevelden(v.type);

      document.getElementById('vorm-type').addEventListener('change', (e) => {
        v.type = e.target.value;
        if (v.type === 'waarniet' && typeof v.correct !== 'boolean') v.correct = true;
        if (v.type === 'meerkeuze' && typeof v.correct !== 'number') v.correct = 0;
        renderTypevelden(v.type);
      });

      document.getElementById('vorm-annuleer').addEventListener('click', () => {
        Geluid.knop();
        UI.sluitOverlay('overlay-vraagbewerken');
      });

      document.getElementById('vorm-bewaar').addEventListener('click', () => {
        Geluid.knop();
        const fouten = [];
        v.vraag = document.getElementById('vorm-vraag').value.trim();
        v.categorie = document.getElementById('vorm-categorie').value.trim();
        v.toelichting = document.getElementById('vorm-toelichting').value.trim();
        v.moeilijkheid = document.getElementById('vorm-moeilijkheid').value;
        v.actief = document.getElementById('vorm-actief').value === 'ja';
        v.type = document.getElementById('vorm-type').value;

        if (!v.vraag) fouten.push('De vraag mag niet leeg zijn.');

        if (v.type === 'meerkeuze') {
          v.opties = [0, 1, 2, 3]
            .map((i) => document.getElementById(`vorm-optie-${i}`).value.trim());
          const radio = document.querySelector('input[name="vorm-correct"]:checked');
          const gekozen = radio ? parseInt(radio.value, 10) : -1;
          // lege opties achteraan weglaten, index van correct bijhouden
          const gevuld = [];
          let nieuwCorrect = -1;
          v.opties.forEach((o, i) => {
            if (o) {
              if (i === gekozen) nieuwCorrect = gevuld.length;
              gevuld.push(o);
            }
          });
          if (gevuld.length < 2) fouten.push('Een meerkeuzevraag heeft minimaal twee antwoordopties nodig.');
          if (gekozen < 0 || nieuwCorrect < 0) fouten.push('Kies precies één juist antwoord (het rondje voor de optie).');
          if (!fouten.length) { v.opties = gevuld; v.correct = nieuwCorrect; }
          delete v.antwoord;
        } else if (v.type === 'waarniet') {
          if (typeof v.correct !== 'boolean') fouten.push('Kies of het antwoord Waar of Niet waar is.');
          delete v.opties; delete v.antwoord;
        } else {
          v.antwoord = (document.getElementById('vorm-antwoord').value || '').trim();
          if (!v.antwoord) fouten.push('Vul het goede antwoord in, zodat het tijdens het spel getoond kan worden.');
          delete v.opties;
          if (typeof v.correct !== 'undefined') delete v.correct;
        }

        const foutEl = document.getElementById('vorm-fout');
        if (fouten.length) {
          foutEl.hidden = false;
          foutEl.textContent = fouten.join(' ');
          foutEl.scrollIntoView({ block: 'nearest' });
          return;
        }

        if (bestaand) this.vragen[index] = v;
        else this.vragen.push(v);
        this._bewaar();
        UI.sluitOverlay('overlay-vraagbewerken');
        this.render();
        UI.melding(bestaand ? 'De vraag is aangepast.' : 'De vraag is toegevoegd.');
      });
    };

    renderVorm();
    UI.toonOverlay('overlay-vraagbewerken');
  },

  // ---------- Export / import ----------
  exporteer() {
    try {
      const data = {
        app: 'het-oneerlijke-spel',
        versie: CONFIG.versie,
        geexporteerd: new Date().toISOString(),
        vragen: this.vragen,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `oneerlijke-spel-vragen-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      UI.melding('De vragenset is opgeslagen als bestand.');
    } catch (e) {
      UI.melding('Het exporteren is niet gelukt. Probeer het opnieuw.');
    }
  },

  importeer(event) {
    const bestand = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!bestand) return;
    const lezer = new FileReader();
    lezer.onload = () => {
      let data;
      try {
        data = JSON.parse(lezer.result);
      } catch (e) {
        UI.melding('Dit vragenbestand kon niet worden geopend. Controleer of je een geldig bestand van Het Oneerlijke Spel gebruikt.');
        return;
      }
      const vragen = Array.isArray(data) ? data : data.vragen;
      const controle = this.controleerImport(vragen);
      if (!controle.ok) {
        UI.melding(controle.melding);
        return;
      }
      UI.bevestig(
        'Vragenset importeren?',
        `Er zijn ${controle.vragen.length} geldige vragen gevonden. De huidige vragenlijst wordt vervangen.`,
        () => {
          this.vragen = controle.vragen;
          this._bewaar();
          this.render();
          UI.melding(`${controle.vragen.length} vragen geïmporteerd.`);
        }
      );
    };
    lezer.onerror = () => UI.melding('Het bestand kon niet worden gelezen.');
    lezer.readAsText(bestand);
  },

  controleerImport(vragen) {
    if (!Array.isArray(vragen) || !vragen.length) {
      return { ok: false, melding: 'Dit vragenbestand kon niet worden geopend. Controleer of je een geldig bestand van Het Oneerlijke Spel gebruikt.' };
    }
    const geldig = [];
    for (const ruw of vragen) {
      if (!ruw || typeof ruw !== 'object') continue;
      const v = {
        id: typeof ruw.id === 'string' ? ruw.id : 'import-' + Math.random().toString(36).slice(2, 9),
        type: ruw.type,
        categorie: typeof ruw.categorie === 'string' ? ruw.categorie.slice(0, 40) : '',
        vraag: typeof ruw.vraag === 'string' ? ruw.vraag.trim().slice(0, 300) : '',
        toelichting: typeof ruw.toelichting === 'string' ? ruw.toelichting.slice(0, 300) : '',
        moeilijkheid: typeof ruw.moeilijkheid === 'string' ? ruw.moeilijkheid : '',
        actief: ruw.actief !== false,
      };
      if (!v.vraag) continue;
      if (v.type === 'meerkeuze') {
        if (!Array.isArray(ruw.opties)) continue;
        v.opties = ruw.opties.filter((o) => typeof o === 'string' && o.trim()).map((o) => o.trim().slice(0, 120));
        if (v.opties.length < 2) continue;
        if (typeof ruw.correct !== 'number' || ruw.correct < 0 || ruw.correct >= v.opties.length) continue;
        v.correct = ruw.correct;
      } else if (v.type === 'waarniet') {
        if (typeof ruw.correct !== 'boolean') continue;
        v.correct = ruw.correct;
      } else if (v.type === 'open') {
        if (typeof ruw.antwoord !== 'string' || !ruw.antwoord.trim()) continue;
        v.antwoord = ruw.antwoord.trim().slice(0, 200);
      } else {
        continue;
      }
      geldig.push(v);
    }
    if (!geldig.length) {
      return { ok: false, melding: 'Dit vragenbestand kon niet worden geopend. Controleer of je een geldig bestand van Het Oneerlijke Spel gebruikt.' };
    }
    return { ok: true, vragen: geldig };
  },
};

// kleine hulpfunctie, ook gebruikt door ui.js
function escHtml(tekst) {
  return String(tekst == null ? '' : tekst)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
