/* Basketball Duel — procedural team logos + team/player selection screen.
 * Plain script: defines window.PotaLogo and window.PotaSelect.
 * Data: window.POTA_TEAMS = { TEAMS, byId } (lib/teams.js) — read at call time.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* i18n — ps.* dictionaries (i18n.js is loaded BEFORE select.js)       */ 
  /* ------------------------------------------------------------------ */
  var T = function (k, v) { return window.PotaI18n ? window.PotaI18n.t(k, v) : k; };
  if (window.PotaI18n && window.PotaI18n.add) window.PotaI18n.add({
    en: {
      'ps.pickTeam': 'Pick your team', 'ps.pickPlayer': 'Pick your player',
      'ps.back': 'Back', 'ps.close': 'Close',
      'ps.searchTeam': 'Search teams…', 'ps.noTeams': 'No teams found',
      'ps.leagues': 'League', 'ps.leagueUSA': 'USA', 'ps.leagueEU': 'EU',
      'ps.next': 'Next', 'ps.chooseTeam': 'Pick a team', 'ps.ready': 'Ready',
      'ps.onCourt': 'On court', 'ps.selected': 'Selected',
      'ps.posG': 'Guard', 'ps.posF': 'Forward', 'ps.posC': 'Center',
      'ps.stat3': '3PT', 'ps.stat2': '2PT', 'ps.statLayup': 'Layup', 'ps.statDunk': 'Dunk', 'ps.statDef': 'Defense',
      'ps.badgeStrong': 'Strong', 'ps.badgeTall': 'Tall', 'ps.badgeQuick': 'Quick',
      'ps.decimal': '.', 'ps.height': '{v} m', 'ps.weight': '{v} kg'
    },
    es: {
      'ps.pickTeam': 'Elige tu equipo', 'ps.pickPlayer': 'Elige tu jugador',
      'ps.back': 'Atrás', 'ps.close': 'Cerrar',
      'ps.searchTeam': 'Buscar equipo…', 'ps.noTeams': 'No hay equipos',
      'ps.leagues': 'Liga', 'ps.leagueUSA': 'USA', 'ps.leagueEU': 'EU',
      'ps.next': 'Siguiente', 'ps.chooseTeam': 'Elige equipo', 'ps.ready': '¡Listo!',
      'ps.onCourt': 'En pista', 'ps.selected': 'Elegido',
      'ps.posG': 'Base', 'ps.posF': 'Alero', 'ps.posC': 'Pívot',
      'ps.stat3': 'Triple', 'ps.stat2': 'Doble', 'ps.statLayup': 'Bandeja', 'ps.statDunk': 'Mate', 'ps.statDef': 'Defensa',
      'ps.badgeStrong': 'Fuerte', 'ps.badgeTall': 'Alto', 'ps.badgeQuick': 'Ágil',
      'ps.decimal': ',', 'ps.height': '{v} m', 'ps.weight': '{v} kg'
    },
    fr: {
      'ps.pickTeam': 'Choisis ton équipe', 'ps.pickPlayer': 'Choisis ton joueur',
      'ps.back': 'Retour', 'ps.close': 'Fermer',
      'ps.searchTeam': 'Chercher une équipe…', 'ps.noTeams': 'Aucune équipe trouvée',
      'ps.leagues': 'Ligue', 'ps.leagueUSA': 'USA', 'ps.leagueEU': 'EU',
      'ps.next': 'Suivant', 'ps.chooseTeam': 'Choisis une équipe', 'ps.ready': 'Prêt',
      'ps.onCourt': 'En jeu', 'ps.selected': 'Choisi',
      'ps.posG': 'Meneur', 'ps.posF': 'Ailier', 'ps.posC': 'Pivot',
      'ps.stat3': '3 pts', 'ps.stat2': '2 pts', 'ps.statLayup': 'Lay-up', 'ps.statDunk': 'Dunk', 'ps.statDef': 'Défense',
      'ps.badgeStrong': 'Costaud', 'ps.badgeTall': 'Grand', 'ps.badgeQuick': 'Vif',
      'ps.decimal': ',', 'ps.height': '{v} m', 'ps.weight': '{v} kg'
    },
    de: {
      'ps.pickTeam': 'Team wählen', 'ps.pickPlayer': 'Spieler wählen',
      'ps.back': 'Zurück', 'ps.close': 'Schließen',
      'ps.searchTeam': 'Team suchen…', 'ps.noTeams': 'Kein Team gefunden',
      'ps.leagues': 'Liga', 'ps.leagueUSA': 'USA', 'ps.leagueEU': 'EU',
      'ps.next': 'Weiter', 'ps.chooseTeam': 'Team wählen', 'ps.ready': 'Bereit',
      'ps.onCourt': 'Im Spiel', 'ps.selected': 'Gewählt',
      'ps.posG': 'Guard', 'ps.posF': 'Forward', 'ps.posC': 'Center',
      'ps.stat3': '3er', 'ps.stat2': '2er', 'ps.statLayup': 'Korbleger', 'ps.statDunk': 'Dunk', 'ps.statDef': 'Abwehr',
      'ps.badgeStrong': 'Stark', 'ps.badgeTall': 'Groß', 'ps.badgeQuick': 'Flink',
      'ps.decimal': ',', 'ps.height': '{v} m', 'ps.weight': '{v} kg'
    },
    tr: {
      'ps.pickTeam': 'Takımını seç', 'ps.pickPlayer': 'Oyuncunu seç',
      'ps.back': 'Geri', 'ps.close': 'Kapat',
      'ps.searchTeam': 'Takım ara…', 'ps.noTeams': 'Takım bulunamadı',
      'ps.leagues': 'Lig', 'ps.leagueUSA': 'USA', 'ps.leagueEU': 'EU',
      'ps.next': 'Devam', 'ps.chooseTeam': 'Takım seç', 'ps.ready': 'Hazırım',
      'ps.onCourt': 'Sahada', 'ps.selected': 'Seçildi',
      'ps.posG': 'Guard', 'ps.posF': 'Forvet', 'ps.posC': 'Pivot',
      'ps.stat3': '3’lük', 'ps.stat2': '2’lik', 'ps.statLayup': 'Turnike', 'ps.statDunk': 'Smaç', 'ps.statDef': 'Savunma',
      'ps.badgeStrong': 'Güçlü', 'ps.badgeTall': 'Uzun', 'ps.badgeQuick': 'Çevik',
      'ps.decimal': ',', 'ps.height': '{v} m', 'ps.weight': '{v} kg'
    },
    ar: {
      'ps.pickTeam': 'اختر فريقك', 'ps.pickPlayer': 'اختر لاعبك',
      'ps.back': 'رجوع', 'ps.close': 'إغلاق',
      'ps.searchTeam': 'ابحث عن فريق…', 'ps.noTeams': 'لا توجد فرق',
      'ps.leagues': 'الدوري', 'ps.leagueUSA': 'USA', 'ps.leagueEU': 'EU',
      'ps.next': 'التالي', 'ps.chooseTeam': 'اختر فريقًا', 'ps.ready': 'جاهز',
      'ps.onCourt': 'في الملعب', 'ps.selected': 'تم الاختيار',
      'ps.posG': 'حارس', 'ps.posF': 'جناح', 'ps.posC': 'مركز',
      'ps.stat3': 'ثلاثية', 'ps.stat2': 'ثنائية', 'ps.statLayup': 'لاي أب', 'ps.statDunk': 'دانك', 'ps.statDef': 'دفاع',
      'ps.badgeStrong': 'قوي', 'ps.badgeTall': 'طويل', 'ps.badgeQuick': 'سريع',
      'ps.decimal': '.', 'ps.height': '{v} م', 'ps.weight': '{v} كغ'
    }
  });

  /* ------------------------------------------------------------------ */
  /* Helpers                                                              */
  /* ------------------------------------------------------------------ */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function color(c, fallback) {
    return (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c)) ? c : fallback;
  }
  function clamp01(v) { v = +v; return isFinite(v) ? Math.max(0, Math.min(1, v)) : 0; }
  function teamsData() {
    var d = window.POTA_TEAMS;
    return (d && Array.isArray(d.TEAMS)) ? d.TEAMS : [];
  }
  function teamById(id) {
    var d = window.POTA_TEAMS;
    if (d && d.byId) {
      if (typeof d.byId === 'function') return d.byId(id) || null;
      if (d.byId[id]) return d.byId[id];
    }
    return teamsData().find(function (t) { return t.id === id; }) || null;
  }

  /* ------------------------------------------------------------------ */
  /* Logo                                                                */
  /* ------------------------------------------------------------------ */
  // Shapes are in a 100x100 box. ~3px of margin so the stroke doesn't overflow.
  function starPoints(cx, cy, ro, ri) {
    var p = [];
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? ri : ro;
      p.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
    }
    return p.join(' ');
  }
  var SHAPES = {
    circle:  function (a) { return '<circle cx="50" cy="50" r="46" ' + a + '/>'; },
    shield:  function (a) { return '<path d="M50 4 L90 14 V48 C90 72 74 88 50 97 C26 88 10 72 10 48 V14 Z" ' + a + '/>'; },
    diamond: function (a) { return '<path d="M50 3 L97 50 L50 97 L3 50 Z" ' + a + '/>'; },
    hex:     function (a) { return '<path d="M50 3 L91 26 V74 L50 97 L9 74 V26 Z" ' + a + '/>'; },
    roundsq: function (a) { return '<rect x="5" y="5" width="90" height="90" rx="24" ' + a + '/>'; },
    star:    function (a) { return '<polygon points="' + starPoints(50, 54, 49, 27) + '" ' + a + '/>'; }
  };
  // Layout per shape: icon center/scale, text center, max width/height for the text.
  var LAYOUT = {
    circle:  { ix: 50, iy: 34, is: .92, ty: 73, tw: 58, fs: 28, cy: 52, cw: 64, cf: 38 },
    shield:  { ix: 50, iy: 33, is: .92, ty: 71, tw: 56, fs: 28, cy: 50, cw: 60, cf: 38 },
    diamond: { ix: 50, iy: 36, is: .62, ty: 66, tw: 40, fs: 22, cy: 52, cw: 50, cf: 30 },
    hex:     { ix: 50, iy: 34, is: .88, ty: 72, tw: 56, fs: 27, cy: 51, cw: 60, cf: 36 },
    roundsq: { ix: 50, iy: 34, is: .92, ty: 73, tw: 62, fs: 29, cy: 52, cw: 66, cf: 40 },
    star:    { ix: 50, iy: 46, is: .46, ty: 69, tw: 36, fs: 18, cy: 56, cw: 42, cf: 26 }
  };

  // Icons use -20..20 local coordinates; f = icon color (secondary), b = background color (primary), t = text color.
  var ICONS = {
    ball: function (f, b) {
      return '<circle r="18" fill="' + f + '"/>' +
        '<g fill="none" stroke="' + b + '" stroke-width="2.2" stroke-linecap="round">' +
        '<path d="M-18 0H18M0-18V18"/><path d="M-12.7-12.7Q-5 0-12.7 12.7M12.7-12.7Q5 0 12.7 12.7"/></g>';
    },
    star: function (f) { return '<polygon points="' + starPoints(0, 1, 21, 9) + '" fill="' + f + '"/>'; },
    crown: function (f, b) {
      return '<path d="M-19 13L-21-11L-9 0L0-15L9 0L21-11L19 13Z" fill="' + f + '" stroke-linejoin="round"/>' +
        '<rect x="-19" y="14" width="38" height="4" rx="1.5" fill="' + f + '"/>' +
        '<circle cx="0" cy="3" r="2.6" fill="' + b + '"/>';
    },
    flame: function (f, b) {
      return '<path d="M0-21C3-11 16-7 16 6C16 15 9 21 0 21C-9 21-16 15-16 6C-16-1-11-4-9-9C-6-5-4-3-3 0C-1-7-2-14 0-21Z" fill="' + f + '"/>' +
        '<path d="M0 6C5 10 7 14 0 19C-7 14-4 10 0 6Z" fill="' + b + '" opacity=".55"/>';
    },
    bolt: function (f) { return '<path d="M5-21L-12 4H-2L-6 21L13-5H2Z" fill="' + f + '" stroke-linejoin="round"/>'; },
    wing: function (f) {
      return '<path d="M-21 14C-19-6-4-18 21-17C13-13 9-9 7-5C13-7 17-7 21-7C13-1 9 3 5 5C9 5 13 5 17 5C9 12 0 16-21 14Z" fill="' + f + '"/>';
    },
    horn: function (f) {
      return '<path d="M-21-14C-21 4-11 13 0 13C11 13 21 4 21-14C17-3 9 4 0 4C-9 4-17-3-21-14Z" fill="' + f + '"/>' +
        '<path d="M-6-4L0-14L6-4Z" fill="' + f + '"/>';
    },
    paw: function (f) {
      return '<ellipse cx="0" cy="9" rx="11" ry="9" fill="' + f + '"/>' +
        '<circle cx="-14" cy="-1" r="5" fill="' + f + '"/><circle cx="-5" cy="-11" r="5.5" fill="' + f + '"/>' +
        '<circle cx="5" cy="-11" r="5.5" fill="' + f + '"/><circle cx="14" cy="-1" r="5" fill="' + f + '"/>';
    },
    wave: function (f) {
      return '<g fill="none" stroke="' + f + '" stroke-width="5" stroke-linecap="round">' +
        '<path d="M-20-10Q-10-20 0-10T20-10"/><path d="M-20 2Q-10-8 0 2T20 2"/><path d="M-20 14Q-10 4 0 14T20 14"/></g>';
    },
    leaf: function (f, b) {
      return '<path d="M-16 17C-21-4-4-21 19-19C21 5 6 21-16 17Z" fill="' + f + '"/>' +
        '<path d="M-15 16L8-8" stroke="' + b + '" stroke-width="2.4" stroke-linecap="round" fill="none"/>';
    },
    anchor: function (f) {
      return '<g fill="none" stroke="' + f + '" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="0" cy="-15" r="4.5"/><path d="M0-10.5V19M-8-4H8M-16 5Q-14 19 0 19Q14 19 16 5"/></g>';
    },
    sun: function (f) {
      var r = '';
      for (var i = 0; i < 8; i++) {
        var a = i * Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
        r += 'M' + (c * 13).toFixed(1) + ' ' + (s * 13).toFixed(1) + 'L' + (c * 20).toFixed(1) + ' ' + (s * 20).toFixed(1);
      }
      return '<circle r="9" fill="' + f + '"/><path d="' + r + '" stroke="' + f + '" stroke-width="4" stroke-linecap="round"/>';
    },
    mountain: function (f, b, t) {
      return '<path d="M-22 18L-6-13L2 2L8-6L22 18Z" fill="' + f + '" stroke-linejoin="round"/>' +
        '<path d="M-6-13L-0.5-3L-6-6L-11-3Z" fill="' + t + '"/>';
    },
    tower: function (f, b) {
      return '<path d="M-9 19V-3H-13V-17H-7V-12H-3V-17H3V-12H7V-17H13V-3H9V19Z" fill="' + f + '"/>' +
        '<path d="M-3 19V9Q0 5 3 9V19Z" fill="' + b + '"/>';
    },
    clover: function (f) {
      return '<circle cx="-7" cy="-7" r="8" fill="' + f + '"/><circle cx="7" cy="-7" r="8" fill="' + f + '"/>' +
        '<circle cx="-7" cy="7" r="8" fill="' + f + '"/><circle cx="7" cy="7" r="8" fill="' + f + '"/>' +
        '<path d="M2 8Q3 16 9 21" stroke="' + f + '" stroke-width="3.4" stroke-linecap="round" fill="none"/>';
    }
  };

  function logoParts(team) {
    var t = team || {};
    var c = t.colors || {}, l = t.logo || {};
    var p = color(c.primary, '#334'), s = color(c.secondary, '#fc3'), tx = color(c.text, '#fff');
    return { p: p, s: s, tx: tx, shape: SHAPES[l.shape] ? l.shape : 'circle', icon: ICONS[l.icon] ? l.icon : 'none', text: String(l.text || t.short || '').slice(0, 4) };
  }

  function textEl(txt, cx, cy, maxW, maxF, fill, outline) {
    if (!txt) return '';
    var fs = maxF, w = fs * 0.66 * txt.length;
    if (w > maxW) fs = maxW / (0.66 * txt.length);
    fs = Math.round(fs * 10) / 10;
    return '<text x="' + cx + '" y="' + (cy + fs * 0.36).toFixed(1) + '" text-anchor="middle" font-size="' + fs +
      '" font-weight="900" font-family="\'Arial Black\',Impact,system-ui,-apple-system,Segoe UI,Roboto,sans-serif" ' +
      'fill="' + fill + '" stroke="' + outline + '" stroke-opacity=".45" stroke-width="3" stroke-linejoin="round" paint-order="stroke">' +
      esc(txt) + '</text>';
  }

  function svg(team, size) {
    size = size || 48;
    var q = logoParts(team), L = LAYOUT[q.shape], shape = SHAPES[q.shape];
    var out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="' + size + '" height="' + size + '" role="img" aria-label="' + esc((team && team.name) || '') + '">';
    out += shape('fill="' + q.p + '" stroke="' + q.s + '" stroke-width="5" stroke-linejoin="round"');
    if (size >= 40) { // thin inner line at large sizes
      out += '<g transform="translate(50 ' + (q.shape === 'star' ? 54 : 50) + ') scale(.8) translate(-50 ' + (q.shape === 'star' ? -54 : -50) + ')" opacity=".4">' +
        shape('fill="none" stroke="' + q.s + '" stroke-width="1.6" stroke-linejoin="round"') + '</g>';
    }
    if (q.icon !== 'none') {
      out += '<g transform="translate(' + L.ix + ' ' + L.iy + ') scale(' + L.is + ')">' + ICONS[q.icon](q.s, q.p, q.tx) + '</g>';
      out += textEl(q.text, 50, L.ty, L.tw, L.fs, q.tx, q.p);
    } else {
      out += textEl(q.text, 50, L.cy, L.cw, L.cf, q.tx, q.p);
    }
    return out + '</svg>';
  }

  function dataUrl(team, size) {
    return 'data:image/svg+xml,' + encodeURIComponent(svg(team, size));
  }

  // Jersey (tank top): sleeveless jersey, numbered.
  function jersey(team, num, size) {
    size = size || 64;
    var q = logoParts(team), n = String(num == null ? '' : num).slice(0, 2);
    var h = Math.round(size * 1.1);
    var body = 'M30 6 L38 6 Q50 24 62 6 L70 6 Q74 22 80 30 L80 100 Q80 106 74 106 L26 106 Q20 106 20 100 L20 30 Q26 22 30 6 Z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 110" width="' + size + '" height="' + h + '" aria-hidden="true">' +
      '<path d="' + body + '" fill="' + q.p + '" stroke="' + q.s + '" stroke-width="5" stroke-linejoin="round"/>' +
      '<path d="M38 6 Q50 24 62 6" fill="none" stroke="' + q.s + '" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M22 98 H78" stroke="' + q.s + '" stroke-width="5" opacity=".9"/>' +
      textEl(n, 50, 64, 40, 44, q.tx, q.p) + '</svg>';
  }

  window.PotaLogo = { svg: svg, dataUrl: dataUrl, jersey: jersey };

  /* ------------------------------------------------------------------ */
  /* Selection screen                                                     */
  /* ------------------------------------------------------------------ */
  var POS = { G: 'ps.posG', F: 'ps.posF', C: 'ps.posC' };
  var LEAGUES = [{ id: 'USA', key: 'ps.leagueUSA' }, { id: 'EU', key: 'ps.leagueEU' }];
  var current = null;       // close() of the open screen
  var relangCurrent = null; // redraws the open screen for the new language
  function isRTL() { return !!(window.PotaI18n && window.PotaI18n.isRTL && window.PotaI18n.isRTL()); }
  function leagueLabel(id) {
    var l = LEAGUES.find(function (x) { return x.id === id; });
    return l ? T(l.key) : String(id || '');
  }
  if (window.PotaI18n && window.PotaI18n.onChange) {
    window.PotaI18n.onChange(function () { if (relangCurrent) relangCurrent(); });
  }

  function randomPick() {
    var ts = teamsData();
    if (!ts.length) return null;
    var t = ts[Math.floor(Math.random() * ts.length)];
    var n = (t.players && t.players.length) || 1;
    return { teamId: t.id, playerIdx: Math.floor(Math.random() * n) };
  }

  function trNorm(s) { // Turkish/accent-insensitive search
    return String(s || '').toLocaleLowerCase('tr').replace(/ı/g, 'i').normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function open(opts) {
    opts = opts || {};
    if (current) current();
    var host = document.getElementById('app') || document.body;
    var teams = teamsData();
    var init = opts.initial || {};
    var initTeam = init.teamId ? teamById(init.teamId) : null;

    var lock = !!(opts.lockTeam && initTeam);
    var st = {
      league: (initTeam && initTeam.league) || 'USA',
      q: '',
      teamId: initTeam ? initTeam.id : null,
      playerIdx: null,
      step: 1
    };
    if (initTeam && initTeam.players && initTeam.players[init.playerIdx]) {
      st.playerIdx = init.playerIdx;
      st.step = 2; // remembered pick: go straight to "Ready"
    }
    if (lock) st.step = 2; // team locked: go straight to player selection
    if (!teams.some(function (t) { return t.league === st.league; })) {
      st.league = teams.length ? teams[0].league : 'USA';
    }

    var root = document.createElement('div');
    root.className = 'ps-root';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.style.setProperty('--ps-accent', opts.accent || 'var(--host)');
    root.setAttribute('lang', (window.PotaI18n && window.PotaI18n.lang) || 'en');
    root.setAttribute('dir', isRTL() ? 'rtl' : 'ltr');
    root.innerHTML =
      '<header class="ps-head">' +
        '<button type="button" class="ps-back" data-act="back"></button>' +
        '<div class="ps-titlebox"><div class="ps-step"></div><h2 class="ps-title"></h2><div class="ps-sub"></div></div>' +
        (opts.onCancel ? '<button type="button" class="ps-x" data-act="cancel">✕</button>' : '<span class="ps-x ps-x-ph"></span>') +
      '</header>' +
      '<div class="ps-view ps-v1">' +
        '<div class="ps-tools">' +
          '<div class="ps-tabs" role="tablist"></div>' +
          '<input class="ps-search" type="search" autocomplete="off" autocapitalize="off" spellcheck="false">' +
        '</div>' +
        '<div class="ps-grid"></div>' +
      '</div>' +
      '<div class="ps-view ps-v2"></div>' +
      '<footer class="ps-foot"><button type="button" class="ps-go" data-act="go"></button></footer>';
    host.appendChild(root);

    var $ = function (s) { return root.querySelector(s); };
    var elTitle = $('.ps-title'), elSub = $('.ps-sub'), elStep = $('.ps-step'), elBack = $('.ps-back');
    var v1 = $('.ps-v1'), v2 = $('.ps-v2'), tabs = $('.ps-tabs'), grid = $('.ps-grid');
    var search = $('.ps-search'), go = $('.ps-go');

    // Language-dependent static texts + direction (on open and on language change)
    function applyStatic() {
      root.setAttribute('lang', (window.PotaI18n && window.PotaI18n.lang) || 'en');
      root.setAttribute('dir', isRTL() ? 'rtl' : 'ltr');
      elBack.textContent = '‹'; // in RTL, bidi mirroring turns it into › automatically
      elBack.setAttribute('aria-label', T('ps.back'));
      var x = $('.ps-x[data-act]'); if (x) x.setAttribute('aria-label', T('ps.close'));
      search.placeholder = T('ps.searchTeam');
      search.setAttribute('aria-label', T('ps.searchTeam'));
      tabs.setAttribute('aria-label', T('ps.leagues'));
    }
    function relang() {
      applyStatic(); renderTabs(); renderGrid();
      if (st.step === 2) renderPlayers();
      updateChrome();
    }

    function renderTabs() {
      tabs.innerHTML = LEAGUES.map(function (l) {
        var n = teams.filter(function (t) { return t.league === l.id; }).length;
        return '<button type="button" role="tab" class="ps-tab' + (st.league === l.id ? ' on' : '') + '" data-league="' + l.id +
          '" aria-selected="' + (st.league === l.id) + '">' + esc(T(l.key)) + '<i>' + n + '</i></button>';
      }).join('');
    }

    function renderGrid() {
      var q = trNorm(st.q.trim());
      var list = teams.filter(function (t) {
        if (t.league !== st.league) return false;
        return !q || trNorm(t.name + ' ' + t.city + ' ' + t.short).indexOf(q) >= 0;
      });
      if (!list.length) {
        grid.innerHTML = '<div class="ps-empty">' + esc(T('ps.noTeams')) + '</div>';
        return;
      }
      grid.innerHTML = list.map(function (t) {
        var on = t.id === st.teamId;
        return '<button type="button" class="ps-team' + (on ? ' on' : '') + '" data-team="' + esc(t.id) + '" aria-pressed="' + on + '">' +
          '<span class="ps-tlogo">' + svg(t, 56) + '</span>' +
          '<span class="ps-tname">' + esc(t.name) + '</span>' +
          '<span class="ps-tcity">' + esc(t.city) + '</span>' +
          (on ? '<span class="ps-check" data-label="' + esc(T('ps.selected')) + '"></span>' : '') +
          '</button>';
      }).join('');
    }

    function bar(label, v) {
      var pct = Math.round(clamp01(v) * 100);
      return '<div class="ps-stat"><span class="ps-sl">' + esc(label) + '</span>' +
        '<span class="ps-track"><span class="ps-fill" style="width:' + pct + '%"></span></span>' +
        '<span class="ps-sv">' + pct + '</span></div>';
    }

    function fmtBody(p) {
      var h = +p.h, w = +p.w, hasH = isFinite(h) && h > 0, hasW = isFinite(w) && w > 0, parts = [];
      if (hasH) parts.push(esc(T('ps.height', { v: (h / 100).toFixed(2).replace('.', T('ps.decimal')) })));
      if (hasW) parts.push(esc(T('ps.weight', { v: Math.round(w) })));
      var badge = '';
      if (hasH && hasW && w / Math.pow(h / 100, 2) >= 27.5) badge = ['str', '💪 ' + T('ps.badgeStrong')];
      else if (hasH && h >= 208) badge = ['tall', '📏 ' + T('ps.badgeTall')];
      else if (hasH && h <= 193) badge = ['quick', '⚡ ' + T('ps.badgeQuick')];
      if (!parts.length && !badge) return '';
      return '<span class="ps-body">' +
        (parts.length ? '<span class="ps-hw">' + parts.join(' · ') + '</span>' : '') +
        (badge ? '<span class="ps-badge ps-b-' + badge[0] + '">' + esc(badge[1]) + '</span>' : '') + '</span>';
    }

    function renderPlayers() {
      var t = teamById(st.teamId);
      if (!t) { v2.innerHTML = ''; return; }
      var ps = t.players || [];
      v2.innerHTML =
        '<div class="ps-banner">' +
          '<span class="ps-blogo">' + svg(t, 64) + '</span>' +
          '<span class="ps-binfo"><span class="ps-bname">' + esc(t.name) + '</span>' +
          '<span class="ps-bcity">' + esc(t.city) + ' · ' + esc(leagueLabel(t.league)) + '</span></span>' +
        '</div>' +
        '<div class="ps-players">' +
        ps.map(function (p, i) {
          var on = i === st.playerIdx;
          return '<button type="button" class="ps-player' + (on ? ' on' : '') + '" data-player="' + i + '" aria-pressed="' + on + '">' +
            '<span class="ps-jersey">' + jersey(t, p.num, 60) +
              (i === opts.currentIdx ? '<span class="ps-now">' + esc(T('ps.onCourt')) + '</span>' : '') + '</span>' +
            '<span class="ps-pinfo">' +
              '<span class="ps-prow"><span class="ps-pname">' + esc(p.name) + '</span>' +
              '<span class="ps-pos">' + esc(POS[p.pos] ? T(POS[p.pos]) : (p.pos || '')) + '</span></span>' + fmtBody(p) +
              '<span class="ps-stats">' + bar(T('ps.stat3'), p.three) + bar(T('ps.stat2'), p.two) + (p.layup != null ? bar(T('ps.statLayup'), p.layup) : '') + (p.dunk != null ? bar(T('ps.statDunk'), p.dunk) : '') + bar(T('ps.statDef'), p.def) + '</span>' +
            '</span>' +
            (on ? '<span class="ps-check" data-label="' + esc(T('ps.selected')) + '"></span>' : '') +
            '</button>';
        }).join('') +
        '</div>';
    }

    function updateChrome() {
      var s2 = st.step === 2;
      v1.style.display = s2 ? 'none' : '';
      v2.style.display = s2 ? '' : 'none';
      elBack.style.visibility = (s2 && !lock) ? 'visible' : 'hidden';
      elBack.disabled = !!lock;
      elSub.textContent = opts.subtitle ? String(opts.subtitle) : '';
      elSub.style.display = opts.subtitle ? '' : 'none';
      var stepNo = '\u2066' + (s2 ? '2' : '1') + ' / 2\u2069'; // LTR isolation: avoid "2 / 1" in RTL
      elStep.textContent = stepNo;
      var stepName = T(s2 ? 'ps.pickPlayer' : 'ps.pickTeam');
      elTitle.textContent = opts.title ? String(opts.title) : stepName;
      if (opts.title) elStep.textContent = stepName + ' · ' + stepNo;
      if (lock) elStep.textContent = opts.title ? stepName : '';
      if (s2) {
        go.textContent = opts.goLabel ? String(opts.goLabel) : T('ps.ready');
        go.disabled = st.playerIdx == null;
      } else {
        go.textContent = T(st.teamId ? 'ps.next' : 'ps.chooseTeam');
        go.disabled = !st.teamId;
      }
    }

    function setStep(n) {
      st.step = n;
      if (n === 2) { renderPlayers(); v2.scrollTop = 0; }
      updateChrome();
    }

    function close() {
      if (current === close) { current = null; relangCurrent = null; }
      document.removeEventListener('keydown', onKey, true);
      if (root.parentNode) root.parentNode.removeChild(root);
    }

    function onKey(e) {
      if (e.key === 'Escape' && opts.onCancel) { e.preventDefault(); close(); opts.onCancel(); }
    }

    root.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button');
      if (!b || !root.contains(b)) return;
      var act = b.getAttribute('data-act');
      if (b.hasAttribute('data-league')) {
        st.league = b.getAttribute('data-league');
        renderTabs(); renderGrid(); grid.scrollTop = 0;
      } else if (b.hasAttribute('data-team')) {
        var id = b.getAttribute('data-team');
        if (id !== st.teamId) { st.teamId = id; st.playerIdx = null; }
        renderGrid(); updateChrome();
      } else if (b.hasAttribute('data-player')) {
        st.playerIdx = +b.getAttribute('data-player');
        renderPlayers(); updateChrome();
      } else if (act === 'back') {
        if (!lock) setStep(1);
      } else if (act === 'cancel') {
        close(); if (opts.onCancel) opts.onCancel();
      } else if (act === 'go') {
        if (go.disabled) return;
        if (st.step === 1) { setStep(2); return; }
        var res = { teamId: st.teamId, playerIdx: st.playerIdx };
        close();
        if (opts.onDone) opts.onDone(res);
      }
    });
    search.addEventListener('input', function () { st.q = search.value; renderGrid(); });
    search.addEventListener('keydown', function (e) { if (e.key === 'Enter') search.blur(); });
    document.addEventListener('keydown', onKey, true);

    applyStatic();
    renderTabs(); renderGrid();
    if (st.step === 2) renderPlayers();
    updateChrome();
    current = close;
    relangCurrent = relang;
    // Scroll the selected team into view
    var sel = grid.querySelector('.ps-team.on');
    if (sel && st.step === 1) grid.scrollTop = Math.max(0, sel.offsetTop - grid.clientHeight / 2 + sel.offsetHeight / 2);
    return close;
  }

  window.PotaSelect = { open: open, randomPick: randomPick };
})();
