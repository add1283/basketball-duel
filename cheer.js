/* MANYAFEST cheer squad: stick-figure cheerleaders, karaoke lyrics and a neon title.
 * Plain script, no assets. Attaches to window.PotaCheer.
 * All coordinates are CSS pixels; the caller owns the ctx transform (dpr). */
(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var D = Math.PI / 180;
  var FONT = 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var EMPTY = {};
  var MOVE_MS = 2000;   // each move lasts 4 beats
  var BEAT_MS = 500;    // one beat
  var MOVES = 5;
  var LINE_MS = 2400;

  var LYRICS = ['Oyna, at potaya, hileli', 'Tra-la-la, pota-la-la', 'Sana smaç yok, parmak şak!'];

  var LIGHT = '#ffd9bd', TAN = '#8d5a3b';
  var NG = 5;
  // hair: 0 long straight, 1 long wavy, 4 short bob/pixie, 6 extra-long straight (side-swept)
  // len = y of the hair bottom (smaller = longer); 1 short blonde, 2 blue, 3 orange, 4 long blonde, 5 black on tan skin
  var GIRLS = [
    { hair: 4, len: -51.5, skin: LIGHT, hc: '#ffd23a', hl: '#fff1a0', top: '#ff3d9a', skirt: '#2d2d4d', stripe: '#ff3d9a' },
    { hair: 1, len: -33, skin: LIGHT, hc: '#2f7bff', hl: '#9cc6ff', top: '#ffffff', skirt: '#9b5de5', stripe: '#ffffff' },
    { hair: 0, len: -35, skin: LIGHT, hc: '#ff7a1a', hl: '#ffbf80', top: '#35e0b0', skirt: '#ff6f91', stripe: '#ffffff' },
    { hair: 6, len: -24, skin: LIGHT, hc: '#ffdf5a', hl: '#fff7c2', top: '#b8a1ff', skirt: '#c9d0de', stripe: '#b8a1ff' },
    { hair: 1, len: -31, skin: TAN, hc: '#14121c', hl: '#8a84b8', top: '#ffe14d', skirt: '#1fa2a8', stripe: '#ffe14d' }
  ];

  // ---- scratch state (allocated once) ----
  var P = { ra1: 0, ra2: 0, la1: 0, la2: 0, rl1: 82, rl2: 82, ll1: 98, ll2: 98, dx: 0, dy: 0, tilt: 0, hs: 0, sk: 0, air: 0 };
  var J = new Float64Array(16); // joints: [0..3] R leg, [4..7] R arm, [8..11] L arm, [12..15] L leg
  var widthCache = {};          // text -> width at 100px
  var fontReady = false;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, k) { return a + (b - a) * k; }

  // two-bone limb: angles in degrees (screen coords, 0 = right, 90 = down)
  function limb(ox, oy, a1, a2, l1, l2, o) {
    var r1 = a1 * D, r2 = a2 * D;
    var mx = ox + Math.cos(r1) * l1, my = oy + Math.sin(r1) * l1;
    J[o] = mx; J[o + 1] = my;
    J[o + 2] = mx + Math.cos(r2) * l2; J[o + 3] = my + Math.sin(r2) * l2;
  }

  // ---------------------------------------------------------------- choreography
  function setPose(move, beat, i) {
    var gb, k, s, ks, sw, p, h, u;
    P.dx = 0; P.dy = 0; P.tilt = 0; P.sk = 0; P.air = 0;
    P.rl1 = 82; P.rl2 = 82; P.ll1 = 98; P.ll2 = 98;
    P.hs = Math.sin(beat * TAU + i * 0.6) * 0.5;
    switch (move) {
      case 0: // pom-poms up "V", pumping, wave offset across the row
        gb = beat - i * 0.07;
        u = 0.5 + 0.5 * Math.sin(gb * TAU);
        P.ra1 = -55 - 8 * u; P.ra2 = -88 + 30 * u;
        P.la1 = 180 - P.ra1; P.la2 = 180 - P.ra2;
        P.dy = -Math.abs(Math.sin(beat * Math.PI)) * 2;
        break;
      case 1: // side punches, alternating
        k = 0.5 + 0.5 * Math.sin(beat * Math.PI);
        P.ra1 = lerp(62, -32, k); P.ra2 = lerp(-105, -32, k);
        P.la1 = 180 - lerp(62, -32, 1 - k); P.la2 = 180 - lerp(-105, -32, 1 - k);
        P.rl1 = P.rl2 = 76; P.ll1 = P.ll2 = 104;
        P.tilt = (k - 0.5) * 0.14;
        P.dy = -Math.abs(Math.sin(beat * Math.PI)) * 1.5;
        break;
      case 2: // high kick, alternating legs
        s = Math.sin(beat * Math.PI);
        ks = Math.abs(s);
        ks = ks * ks * (3 - 2 * ks);
        u = Math.sin(beat * TAU) * 8;
        P.ra1 = -38 + u; P.ra2 = -40 + u;
        P.la1 = 180 - (-38 - u); P.la2 = 180 - (-40 - u);
        if (s > 0) {
          P.rl1 = lerp(82, -35, ks); P.rl2 = lerp(82, -55, ks);
          P.ll1 = P.ll2 = 94;
        } else {
          P.ll1 = 180 - lerp(82, -35, ks); P.ll2 = 180 - lerp(82, -55, ks);
          P.rl1 = P.rl2 = 86;
        }
        P.tilt = -s * 0.09;
        break;
      case 3: // little star jump
        gb = beat - i * 0.04;
        p = gb - Math.floor(gb);
        h = 4 * p * (1 - p);
        P.dy = -h * 13; P.air = h;
        u = Math.sin(beat * TAU * 2) * 7 * h;
        P.ra1 = lerp(-48, -60, h); P.ra2 = -70 + u;
        P.la1 = 180 - P.ra1; P.la2 = 180 - (-70 - u);
        P.rl1 = P.rl2 = lerp(82, 62, h);
        P.ll1 = P.ll2 = 180 - lerp(82, 62, h);
        break;
      default: // hip sway + overhead wave
        sw = Math.sin(beat * Math.PI + i * 0.5);
        P.dx = sw * 3.5; P.tilt = sw * 0.1; P.sk = sw * 2.5; P.hs = sw;
        P.ra1 = -52 + 24 * sw; P.ra2 = -68 + 34 * sw;
        P.la1 = -128 + 24 * sw; P.la2 = -112 + 34 * sw;
        P.rl1 = P.rl2 = 82 + sw * 5; P.ll1 = P.ll2 = 98 + sw * 5;
    }
  }

  // ---------------------------------------------------------------- hair helpers
  function backLong(ctx, w, bottom, hs, hl) {
    ctx.beginPath();
    ctx.moveTo(8.2, -57);
    ctx.arc(0, -57, 8.2, 0, Math.PI, true);
    ctx.bezierCurveTo(-9, -48, -w, -44, -w + 0.4 + hs, bottom);
    ctx.quadraticCurveTo(hs, bottom + 2.6, w - 0.4 + hs, bottom);
    ctx.bezierCurveTo(w, -44, 9, -48, 8.2, -57);
    ctx.fill();
    ctx.strokeStyle = hl; ctx.globalAlpha = 0.55; ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function fringe(ctx, cx, cy) {
    ctx.beginPath();
    ctx.moveTo(-8.2, -56);
    ctx.arc(0, -57, 8.2, Math.PI, TAU);
    ctx.quadraticCurveTo(cx, cy, -8.2, -56);
    ctx.fill();
  }

  function circ(ctx, x, y, r) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }

  function hairBack(ctx, g, hs) {
    ctx.fillStyle = g.hc;
    switch (g.hair) {
      case 0: backLong(ctx, 10.4, g.len, hs * 1.2, g.hl); break;
      case 1: backLong(ctx, 11.6, g.len, hs * 1.6, g.hl); break;
      case 6: backLong(ctx, 12.2, g.len, hs * 1.8, g.hl); break;
      case 2: // ponytail, swings with the dance
        ctx.save();
        ctx.strokeStyle = g.hc; ctx.lineCap = 'round';
        ctx.lineWidth = 4.6;
        ctx.beginPath(); ctx.moveTo(3, -65);
        ctx.quadraticCurveTo(16 + hs * 2, -69, 12 + hs * 4, -47);
        ctx.stroke();
        ctx.lineWidth = 2.6; ctx.strokeStyle = g.hl; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(4, -66);
        ctx.quadraticCurveTo(15 + hs * 2, -69, 12 + hs * 4, -52);
        ctx.stroke();
        ctx.restore();
        break;
      case 3: // curly: ring of curls
        ctx.beginPath();
        circ(ctx, 0, -57, 8.4);
        for (var k = 0; k < 10; k++) {
          var a = k * 36 * D;
          circ(ctx, Math.cos(a) * 8.6, -57 + Math.sin(a) * 8.2, 4.1);
        }
        circ(ctx, -9.4, -48.5, 3.9); circ(ctx, 9.4, -48.5, 3.9);
        circ(ctx, -9.6, -43.5, 3.5); circ(ctx, 9.6, -43.5, 3.5);
        ctx.fill();
        break;
      case 4: backLong(ctx, 10.6, g.len, hs * 0.6, g.hl); break;
      default: // space buns
        ctx.beginPath();
        circ(ctx, -6.8, -65, 4.4); circ(ctx, 6.8, -65, 4.4);
        ctx.fill();
        ctx.fillStyle = g.hl;
        ctx.beginPath();
        circ(ctx, -7.8, -66, 1.3); circ(ctx, 5.8, -66, 1.3);
        ctx.fill();
    }
  }

  function hairFront(ctx, g) {
    ctx.fillStyle = g.hc;
    switch (g.hair) {
      case 0: fringe(ctx, 0, -63); // middle part
        ctx.strokeStyle = g.hl; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(0, -57, 6.4, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      case 1: fringe(ctx, -4, -61.5); break;     // side-swept
      case 6: fringe(ctx, -5, -61); break;
      case 2: fringe(ctx, 0, -64); break;
      case 3: // curly bangs
        ctx.beginPath();
        ctx.moveTo(-8.2, -56); ctx.arc(0, -57, 8.2, Math.PI, TAU);
        ctx.quadraticCurveTo(0, -63, -8.2, -56);
        circ(ctx, -5.6, -61.4, 3.3); circ(ctx, -1.6, -63.3, 3.4); circ(ctx, 2.6, -63, 3.4); circ(ctx, 6, -60.5, 3.2);
        ctx.fill();
        break;
      case 4: fringe(ctx, 0, -62); // blunt bangs + clip
        ctx.fillStyle = '#ff7bc0';
        ctx.beginPath(); circ(ctx, 5.4, -61, 1.2); ctx.fill();
        break;
      default: fringe(ctx, 0, -63.5);
        ctx.fillStyle = '#ff7bc0';
        ctx.beginPath(); circ(ctx, -6.6, -62, 1.2); circ(ctx, 6.6, -62, 1.2); ctx.fill();
    }
  }

  // ---------------------------------------------------------------- pom-pom
  function pom(ctx, x, y, t, seed, c1, c2) {
    var k, a, r = 3.1, w = t * 0.018 + seed;
    ctx.fillStyle = c2;
    ctx.beginPath();
    for (k = 1; k < 6; k += 2) {
      a = k * 60 * D + seed;
      circ(ctx, x + Math.cos(a) * 3.6 + Math.sin(w + k) * 0.5, y + Math.sin(a) * 3.6 + Math.cos(w + k * 2) * 0.5, r);
    }
    ctx.fill();
    ctx.fillStyle = c1;
    ctx.beginPath();
    for (k = 0; k < 6; k += 2) {
      a = k * 60 * D + seed + 0.5;
      circ(ctx, x + Math.cos(a) * 3.6 + Math.sin(w + k + 1) * 0.5, y + Math.sin(a) * 3.6 + Math.cos(w + k) * 0.5, r);
    }
    circ(ctx, x, y, 3.6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); circ(ctx, x - 1.1, y - 1.3, 1.2); ctx.fill();
  }

  // ---------------------------------------------------------------- one girl
  function drawGirl(ctx, g, i, x, baseY, s, t, c1, c2, shadow) {
    var rad;
    if (shadow) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(x, baseY + 1 * s, 13 * s * (1 - P.air * 0.35), 3 * s * (1 - P.air * 0.35), 0, 0, TAU);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(x + P.dx * s, baseY + P.dy * s);
    ctx.scale(s, s);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // legs
    limb(3, -30, P.rl1, P.rl2, 15, 15, 0);
    limb(-3, -30, P.ll1, P.ll2, 15, 15, 12);
    ctx.strokeStyle = g.skin; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(3, -30); ctx.lineTo(J[0], J[1]); ctx.lineTo(J[2], J[3]);
    ctx.moveTo(-3, -30); ctx.lineTo(J[12], J[13]); ctx.lineTo(J[14], J[15]);
    ctx.stroke();
    // white platform sneakers with an accent dot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); circ(ctx, J[2], J[3] + 0.6, 2.9); circ(ctx, J[14], J[15] + 0.6, 2.9); ctx.fill();
    ctx.fillStyle = g.top;
    ctx.beginPath(); circ(ctx, J[2], J[3] + 0.7, 1.2); circ(ctx, J[14], J[15] + 0.7, 1.2); ctx.fill();

    // upper body pivots around the hip
    ctx.translate(0, -30); ctx.rotate(P.tilt); ctx.translate(0, 30);

    hairBack(ctx, g, P.hs);

    // torso
    ctx.strokeStyle = g.skin; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, -50); ctx.lineTo(0, -30); ctx.stroke();

    // pleated mini skirt (trapezoid)
    ctx.fillStyle = g.skirt;
    ctx.beginPath();
    ctx.moveTo(-4.2, -35); ctx.lineTo(4.2, -35);
    ctx.lineTo(10.2 + P.sk, -23); ctx.lineTo(-10.2 + P.sk, -23);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-2.2, -35); ctx.lineTo(-6.4 + P.sk, -23.4);
    ctx.moveTo(0, -35); ctx.lineTo(P.sk, -23.4);
    ctx.moveTo(2.2, -35); ctx.lineTo(6.4 + P.sk, -23.4);
    ctx.stroke();
    ctx.strokeStyle = g.stripe; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(-10 + P.sk, -23.6); ctx.lineTo(10 + P.sk, -23.6); ctx.stroke();

    // crop top
    ctx.fillStyle = g.top;
    ctx.beginPath();
    ctx.moveTo(-4.4, -48); ctx.lineTo(4.4, -48); ctx.lineTo(3.6, -40); ctx.lineTo(-3.6, -40);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); circ(ctx, 0, -44, 1); ctx.fill();

    // arms
    limb(2.5, -46.5, P.ra1, P.ra2, 9, 9, 4);
    limb(-2.5, -46.5, P.la1, P.la2, 9, 9, 8);
    ctx.strokeStyle = g.skin; ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(2.5, -46.5); ctx.lineTo(J[4], J[5]); ctx.lineTo(J[6], J[7]);
    ctx.moveTo(-2.5, -46.5); ctx.lineTo(J[8], J[9]); ctx.lineTo(J[10], J[11]);
    ctx.stroke();

    // head + face
    ctx.fillStyle = g.skin;
    ctx.beginPath(); circ(ctx, 0, -57, 7.4); ctx.fill();
    hairFront(ctx, g);
    ctx.fillStyle = '#2a1a2e';
    ctx.beginPath(); circ(ctx, -2.7, -56.3, 0.95); circ(ctx, 2.7, -56.3, 0.95); ctx.fill();
    ctx.fillStyle = g.skin === TAN ? 'rgba(255,140,140,0.35)' : 'rgba(255,100,150,0.45)';
    ctx.beginPath(); circ(ctx, -4.4, -54.4, 1.3); circ(ctx, 4.4, -54.4, 1.3); ctx.fill();
    ctx.strokeStyle = '#2a1a2e'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(0, -55.4, 2.3, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();

    // pom-poms last, a little beyond each hand
    rad = P.ra2 * D;
    pom(ctx, J[6] + Math.cos(rad) * 3.4, J[7] + Math.sin(rad) * 3.4, t, i, c1, c2);
    rad = P.la2 * D;
    pom(ctx, J[10] + Math.cos(rad) * 3.4, J[11] + Math.sin(rad) * 3.4, t, i + 3, c2, c1);

    ctx.restore();
  }

  // ---------------------------------------------------------------- shared helpers
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function textW100(ctx, text) {
    var w = widthCache[text];
    if (w === undefined) {
      ctx.font = 'italic 800 100px ' + FONT;
      w = ctx.measureText(text).width;
      widthCache[text] = w;
    }
    return w;
  }

  function note(ctx, x, y, sz, dbl, color) {
    ctx.fillStyle = color; ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, sz * 0.12);
    ctx.beginPath();
    ctx.ellipse(x, y, sz * 0.28, sz * 0.2, -0.45, 0, TAU);
    if (dbl) { ctx.moveTo(x + sz * 0.98, y - sz * 0.1); ctx.ellipse(x + sz * 0.7, y - sz * 0.12, sz * 0.28, sz * 0.2, -0.45, 0, TAU); }
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + sz * 0.25, y - sz * 0.05); ctx.lineTo(x + sz * 0.25, y - sz * 0.95);
    if (dbl) {
      ctx.moveTo(x + sz * 0.95, y - sz * 0.17); ctx.lineTo(x + sz * 0.95, y - sz * 1.05);
      ctx.stroke();
      ctx.lineWidth = sz * 0.2;
      ctx.beginPath(); ctx.moveTo(x + sz * 0.25, y - sz * 0.93); ctx.lineTo(x + sz * 0.95, y - sz * 1.03);
      ctx.stroke();
    } else {
      ctx.moveTo(x + sz * 0.25, y - sz * 0.95);
      ctx.quadraticCurveTo(x + sz * 0.75, y - sz * 0.7, x + sz * 0.55, y - sz * 0.35);
      ctx.stroke();
    }
  }

  // ---------------------------------------------------------------- API
  var PotaCheer = {
    GROUP: 'MANYAFEST',
    LYRICS: LYRICS,

    drawSquad: function (ctx, cx, baseY, width, t, opts) {
      opts = opts || EMPTY;
      var cols = opts.colors || null;
      var c1 = cols ? cols[0] : '#ff4fd8', c2 = cols ? cols[1] : '#4fe3ff';
      var s = (opts.scale || 1) * width / 308;
      var beat = t / BEAT_MS;
      var move = opts.move != null ? opts.move : Math.floor(t / MOVE_MS) % MOVES;
      var step = width / NG, x0 = cx - width / 2 + step / 2;
      var shadow = opts.shadow !== false;
      ctx.save();
      for (var i = 0; i < NG; i++) {
        setPose(move, beat, i);
        drawGirl(ctx, GIRLS[i], i, x0 + step * i, baseY, s, t, c1, c2, shadow);
      }
      ctx.restore();
    },

    drawLyrics: function (ctx, W, H, t, opts) {
      opts = opts || EMPTY;
      var n = LYRICS.length;
      var L = Math.floor(t / LINE_MS);
      var lt = (t - L * LINE_MS) / LINE_MS;
      var idx = ((L % n) + n) % n;
      var right = (((L % 2) + 2) % 2) === 1;
      var text = LYRICS[idx];
      var cols = opts.colors || null;
      var b1 = cols ? cols[0] : '#ff4fd8', b2 = cols ? cols[1] : '#4fe3ff';
      var margin = 10;

      ctx.save();
      var w100 = textW100(ctx, text);
      var size = opts.size || 20;
      var sz = Math.min(size, (W - margin * 2) / (w100 / 100 + 1.4)); // pill (text + 2*0.7*sz padding) must fit
      if (sz < 8) sz = 8;
      var pad;
      pad = sz * 0.7;
      var tw = w100 * sz / 100;
      var bw = tw + pad * 2, bh = sz * 1.9;
      var y = opts.y != null ? opts.y : H * 0.3;
      var bx = right ? W - margin - bw : margin;

      // pop-in / out
      var inT = clamp(lt / 0.16, 0, 1);
      var c = 1.70158, q = inT - 1;
      var eb = 1 + (c + 1) * q * q * q + c * q * q;       // easeOutBack
      var outT = clamp((lt - 0.88) / 0.12, 0, 1);
      var alpha = clamp(inT * 1.4, 0, 1) * (1 - outT);
      var scl = 0.55 + 0.45 * eb;
      var slide = (1 - inT) * (right ? 24 : -24);
      var pcx = bx + bw / 2;
      ctx.globalAlpha = alpha;
      ctx.translate(pcx + slide, y); ctx.scale(scl, scl); ctx.translate(-pcx, -y);

      // pill
      rr(ctx, bx, y - bh / 2, bw, bh, bh / 2);
      ctx.fillStyle = 'rgba(10,12,42,0.66)'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = right ? b2 : b1;
      ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // base text (unsung)
      var tx = bx + pad;
      ctx.font = 'italic 800 ' + sz + 'px ' + FONT;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = sz * 0.16; ctx.strokeStyle = 'rgba(4,4,24,0.85)';
      ctx.strokeText(text, tx, y + sz * 0.05);
      ctx.fillStyle = 'rgba(232,238,255,0.96)';
      ctx.fillText(text, tx, y + sz * 0.05);

      // highlight sweep (karaoke)
      var p = clamp((lt - 0.1) / 0.62, 0, 1);
      var ex = tx + tw * p;
      if (p > 0) {
        ctx.save();
        ctx.beginPath(); ctx.rect(tx - 2, y - bh, tw * p + 2, bh * 2); ctx.clip();
        var gr = ctx.createLinearGradient(tx, 0, tx + tw, 0);
        gr.addColorStop(0, '#ffe14d'); gr.addColorStop(1, '#ff6ad5');
        ctx.fillStyle = gr;
        ctx.fillText(text, tx, y + sz * 0.05);
        ctx.restore();
      }
      if (p > 0 && p < 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillRect(ex - 1, y - sz * 0.62, 2, sz * 1.24);
        // bouncing karaoke ball
        var bounce = Math.abs(Math.sin(p * tw / (sz * 1.6) * Math.PI)) * sz * 0.35;
        ctx.fillStyle = '#ffe14d';
        ctx.beginPath(); ctx.arc(ex, y - bh / 2 - sz * 0.22 - bounce, sz * 0.2, 0, TAU); ctx.fill();
      }

      // floating notes
      for (var j = 0; j < 4; j++) {
        var ph = (lt * 1.25 + j * 0.25) % 1;
        var nx = bx + bw * (0.14 + 0.24 * j) + Math.sin(ph * 6 + j * 2) * 6;
        var ny = y - bh / 2 - 2 - ph * 40;
        ctx.globalAlpha = alpha * Math.sin(ph * Math.PI) * 0.95;
        note(ctx, nx, ny, sz * 0.8, (j & 1) === 1, (j & 1) ? b2 : b1);
      }
      ctx.restore();
    },

    drawTitle: function (ctx, cx, y, t, opts) {
      opts = opts || EMPTY;
      var title = PotaCheer.GROUP;
      var len = title.length;
      var size = opts.size || 28;
      var maxW = opts.maxWidth || 0;
      var c1 = '#ff4fd8', c2 = '#4fe3ff';
      if (opts.colors) { c1 = opts.colors[0] || c1; c2 = opts.colors[1] || c2; }
      var k, ch, wk;

      ctx.save();
      // letter widths from a cached 100px measurement
      var spacing = 0.1;
      var w100 = textW100(ctx, title) + 100 * spacing * (len - 1);
      if (maxW && w100 * size / 100 > maxW) size = maxW / (w100 / 100);
      var sc = size / 100;
      var total = w100 * sc;
      ctx.font = 'italic 900 ' + size + 'px ' + FONT;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';

      // global flicker + one unstable letter
      var ph = t % 4300, base = 1;
      if (ph < 70) base = 0.4; else if (ph > 160 && ph < 215) base = 0.65;
      base *= 0.95 + 0.05 * Math.sin(t * 0.03);

      if (opts.frame !== false) {
        var fw = total + size * 1.1, fh = size * 1.75;
        rr(ctx, cx - fw / 2, y - fh / 2, fw, fh, fh * 0.32);
        ctx.fillStyle = 'rgba(8,6,28,0.62)'; ctx.fill();
        ctx.globalAlpha = base * 0.85;
        ctx.lineWidth = 1.6; ctx.strokeStyle = c2;
        ctx.shadowColor = c2; ctx.shadowBlur = size * 0.4;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      var x = cx - total / 2;
      for (k = 0; k < len; k++) {
        ch = title.charAt(k);
        wk = textW100(ctx, ch);
        // textW100 changes ctx.font; restore real size
        ctx.font = 'italic 900 ' + size + 'px ' + FONT;
        var a = base;
        if (k === 5) a *= ((t + 977) % 2900 < 110) ? 0.25 : 1;
        var col = (k & 1) ? c2 : c1;
        ctx.globalAlpha = a;
        ctx.shadowColor = col; ctx.shadowBlur = size * 0.55;
        ctx.strokeStyle = col; ctx.lineWidth = size * 0.13;
        ctx.strokeText(ch, x, y);
        ctx.shadowBlur = size * 0.12;
        ctx.fillStyle = '#fff';
        ctx.fillText(ch, x, y);
        x += (wk + 100 * spacing) * sc;
      }
      ctx.restore();
    }
  };

  if (typeof window !== 'undefined') window.PotaCheer = PotaCheer;
  else if (typeof module !== 'undefined') module.exports = PotaCheer;
})();
