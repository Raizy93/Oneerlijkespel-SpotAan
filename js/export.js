/* ============================================================
   HET ONEERLIJKE SPEL — export.js
   Eindstand als scherpe PNG-afbeelding (canvas, 1600×900).
   Geen leerlinggegevens verlaten het apparaat: de afbeelding
   wordt lokaal gedownload.
   ============================================================ */

const EindstandExport = {
  maak(spel) {
    const ranglijst = Motor.ranglijst();
    const winnaars = Motor.winnaars();
    const B = 1600, H = 900;
    const c = document.createElement('canvas');
    c.width = B; c.height = H;
    const ctx = c.getContext('2d');

    // --- achtergrond: donker theater ---
    const lucht = ctx.createLinearGradient(0, 0, 0, H);
    lucht.addColorStop(0, '#1a1033');
    lucht.addColorStop(0.7, '#241242');
    lucht.addColorStop(1, '#160b2b');
    ctx.fillStyle = lucht;
    ctx.fillRect(0, 0, B, H);

    // spotlichtkegels
    ctx.save();
    ctx.globalAlpha = 0.14;
    for (const [x, breed] of [[380, 330], [1220, 330]]) {
      const g = ctx.createLinearGradient(x, 0, x, H);
      g.addColorStop(0, '#ffe9a3');
      g.addColorStop(1, 'rgba(255,233,163,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 30, 0);
      ctx.lineTo(x + 30, 0);
      ctx.lineTo(x + breed / 2, H);
      ctx.lineTo(x - breed / 2, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // gordijnen links en rechts
    this._gordijn(ctx, 0, 150, H, false);
    this._gordijn(ctx, B - 150, 150, H, true);
    // lambrequin boven
    ctx.fillStyle = '#7a1428';
    ctx.fillRect(0, 0, B, 70);
    ctx.fillStyle = '#5f0e1f';
    for (let x = 0; x < B; x += 100) {
      ctx.beginPath();
      ctx.ellipse(x + 50, 70, 52, 26, 0, 0, Math.PI);
      ctx.fill();
    }
    ctx.fillStyle = '#f5c518';
    ctx.fillRect(0, 92, B, 4);

    // --- titel ---
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f5c518';
    ctx.font = 'bold 64px "Baloo 2", "Trebuchet MS", sans-serif';
    ctx.shadowColor = 'rgba(245,197,24,0.45)';
    ctx.shadowBlur = 26;
    ctx.fillText('HET ONEERLIJKE SPEL', B / 2, 185);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e8ddff';
    ctx.font = '600 30px "Nunito", "Trebuchet MS", sans-serif';
    ctx.fillText('Kinderboekenweek 2026: Spot Aan!', B / 2, 232);

    const datum = new Date().toLocaleDateString('nl-NL', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    ctx.fillStyle = 'rgba(232,221,255,0.75)';
    ctx.font = '24px "Nunito", "Trebuchet MS", sans-serif';
    ctx.fillText(datum, B / 2, 272);

    // --- winnaarsband ---
    const winTekst = winnaars.length > 1 ? 'GEDEELDE HOOFDROL' : 'DE WINNAARS VAN HET ONEERLIJKE SPEL';
    ctx.fillStyle = '#f5c518';
    this._rondRect(ctx, B / 2 - 520, 300, 1040, 96, 18);
    ctx.fill();
    ctx.fillStyle = '#2a1a05';
    ctx.font = 'bold 26px "Nunito", "Trebuchet MS", sans-serif';
    ctx.fillText(winTekst, B / 2, 340);
    ctx.font = 'bold 40px "Baloo 2", "Trebuchet MS", sans-serif';
    ctx.fillText(winnaars.map((t) => t.naam).join('  •  '), B / 2, 384);

    // --- ranglijst ---
    const rijen = ranglijst.length;
    const rijH = Math.min(64, 420 / rijen);
    const startY = 440;
    const breedte = 1000;
    ctx.font = '600 30px "Nunito", "Trebuchet MS", sans-serif';
    ranglijst.forEach((r, i) => {
      const y = startY + i * (rijH + 8);
      const kleur = CONFIG.teamKleuren.find((k) => k.id === r.team.kleurId) || CONFIG.teamKleuren[0];
      const sym = CONFIG.teamSymbolen.find((s) => s.id === r.team.symboolId) || CONFIG.teamSymbolen[0];
      ctx.fillStyle = r.rang === 1 ? 'rgba(245,197,24,0.16)' : 'rgba(255,255,255,0.08)';
      this._rondRect(ctx, B / 2 - breedte / 2, y, breedte, rijH, 14);
      ctx.fill();
      // kleurblok
      ctx.fillStyle = kleur.hex;
      this._rondRect(ctx, B / 2 - breedte / 2 + 10, y + 8, 14, rijH - 16, 6);
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f3edff';
      const fs = Math.min(32, rijH * 0.52);
      ctx.font = `700 ${fs}px "Nunito", "Trebuchet MS", sans-serif`;
      ctx.fillText(`${r.rang}.`, B / 2 - breedte / 2 + 44, y + rijH / 2 + fs * 0.36);
      ctx.fillText(`${sym.emoji}  ${r.team.naam}`, B / 2 - breedte / 2 + 110, y + rijH / 2 + fs * 0.36);
      ctx.textAlign = 'right';
      ctx.fillStyle = r.team.score < 0 ? '#ff9d97' : '#ffe9a3';
      ctx.fillText(`${r.team.score} punten`, B / 2 + breedte / 2 - 36, y + rijH / 2 + fs * 0.36);
      ctx.textAlign = 'center';
    });

    // --- footer ---
    ctx.fillStyle = 'rgba(232,221,255,0.7)';
    ctx.font = '22px "Nunito", "Trebuchet MS", sans-serif';
    ctx.fillText('www.meesterdanny.com   •   meester.danny', B / 2, H - 26);

    return c;
  },

  download(spel) {
    try {
      const canvas = this.maak(spel);
      const datum = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.download = `oneerlijke-spel-eindstand-${datum}.png`;
      a.href = canvas.toDataURL('image/png');
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    } catch (e) {
      return false;
    }
  },

  _rondRect(ctx, x, y, b, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + b, y, x + b, y + h, r);
    ctx.arcTo(x + b, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + b, y, r);
    ctx.closePath();
  },

  _gordijn(ctx, x, breed, hoog, rechts) {
    const g = ctx.createLinearGradient(x, 0, x + breed, 0);
    if (rechts) {
      g.addColorStop(0, '#5f0e1f'); g.addColorStop(1, '#8f1b30');
    } else {
      g.addColorStop(0, '#8f1b30'); g.addColorStop(1, '#5f0e1f');
    }
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, breed, hoog);
    // plooien
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 8;
    for (let i = 1; i < 5; i++) {
      const px = x + (breed / 5) * i;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.quadraticCurveTo(px + (rechts ? 14 : -14), hoog / 2, px, hoog);
      ctx.stroke();
    }
  },
};
