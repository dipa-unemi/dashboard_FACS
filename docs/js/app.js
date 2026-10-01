/*
 * Dashboard de Desempeño de la Carrera · FACS · UNEMI
 * Lee window.FACS_DATA (agregado por scripts/agregar_facs.py) y
 * window.FACS_INDICADORES (catálogo y metas). No hay microdatos en el navegador.
 *
 * Regla de periodo: cada indicador se muestra en su periodicidad real. La tarjeta
 * toma la última medición disponible hasta el año elegido y la compara con la
 * medición inmediatamente anterior; no se inventan valores para años sin medición.
 *
 * Filtro cruzado: pulsar un punto o una barra de un periodo filtra todo el
 * tablero a ese periodo; pulsar una carrera (leyenda o etiqueta) cambia la
 * carrera; pulsar un nivel socioeconómico recalcula los indicadores de
 * estudiantes para ese nivel. Lo que no tiene ese desglose lo dice en su tarjeta.
 */
(function () {
  'use strict';
  const D = window.FACS_DATA, CAT = window.FACS_INDICADORES;
  const NOM = { FACS: 'Toda la facultad', ENF: 'Enfermería', NUT: 'Nutrición y Dietética' };
  const CORTO = { FACS: 'Facultad', ENF: 'Enfermería', NUT: 'Nutrición' };
  const COL = { FACS: '#1c3247', ENF: '#3c7aa0', NUT: '#f48521' };
  const GRIS = '#9aabb8';

  /* ------------------------------------------------------------ vistas */
  const IC = {
    inicio: '<path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>',
    estudiantes: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 14.6c2.6.2 4.5 2.2 4.5 5.4"/>',
    aprendizaje: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.2"/>',
    grupos: '<path d="M4 5h11a1 1 0 011 1v7a1 1 0 01-1 1H9l-4 3v-3H4a1 1 0 01-1-1V6a1 1 0 011-1z"/><path d="M16 9h4a1 1 0 011 1v6a1 1 0 01-1 1h-1v3l-3.5-3H11"/>',
    docentes: '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/>',
    planificacion: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
    investigacion: '<path d="M4 20h16"/><rect x="5" y="12" width="3" height="6"/><rect x="10.5" y="8" width="3" height="10"/><rect x="16" y="4" width="3" height="14"/>',
    vinculacion: '<circle cx="12" cy="5" r="2.3"/><circle cx="5" cy="18" r="2.3"/><circle cx="19" cy="18" r="2.3"/><path d="M11 7l-5 9M13 7l5 9M7.3 18h9.4"/>',
    apoyo: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
    idea: '<path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0012 3z"/>'
  };
  const VISTAS = [
    { id: 'inicio', num: '', nom: 'Vista general', obj: 'Lectura ejecutiva de los indicadores estratégicos de la carrera.' },
    { sep: true },
    { id: 'grupos', num: '3', nom: 'Grupos de interés', obj: 'Percepción de estudiantes, graduados y docentes sobre la carrera.' },
    { id: 'investigacion', num: '6', nom: 'Investigación y actividad académica', obj: 'Producción científica del cuerpo docente: cuánto se publica, dónde y con quién.' },
    { id: 'vinculacion', num: '7', nom: 'Vinculación e impacto', obj: 'Actividad, cobertura y resultados de los proyectos de vinculación con la sociedad.' },
    { id: 'apoyo', num: '8', nom: 'Servicios de apoyo', obj: 'Acceso, cobertura y percepción de los servicios que acompañan la trayectoria del estudiante.' }
  ];

  /* ------------------------------------------------------------ estado */
  const anios = [];
  for (let a = 2021; a <= D.anioActual; a++) anios.push(a);
  const st = { car: 'FACS', anio: D.anioActual, vista: 'inicio', foco: null, sem: null, gse: null };
  /* Indicadores de estudiantes: los únicos que se pueden desglosar por nivel socioeconómico. */
  const GSE_IND = new Set(['sat_est', 'sat_serv', 'tut_cob', 'tut_ejec', 'tut_int', 'beca_cob']);
  const GSE_DET = new Set(['sat_est', 'sat_serv', 'beca_tipo']);
  const GSE_NOM = { 'BAJO': 'Bajo', 'MEDIO BAJO': 'Medio bajo', 'MEDIO TÍPICO': 'Medio típico', 'MEDIO ALTO': 'Medio alto', 'ALTO': 'Alto' };
  const GSE_ORD = Object.keys(GSE_NOM);

  /* ------------------------------------------------------------ formato */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function num(v, dec) {
    if (v == null || isNaN(v)) return '—';
    const p = Math.abs(v).toFixed(dec || 0).split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (v < 0 ? '−' : '') + p.join(',');
  }
  const unidad = id => CAT[id].unidad;
  function fmt(id, v) {
    if (v == null) return '—';
    const u = unidad(id);
    return u === '%' ? num(v, 1) + ' %' : u === 'N.º' ? num(v, 0) : num(v, 1);
  }
  function valHTML(id, v) {
    if (v == null) return '—';
    const u = unidad(id);
    return u === '%' ? num(v, 1) + '<small>%</small>' : esc(fmt(id, v));
  }
  const tick = p => /^\d{4}$/.test(p) ? p : p.replace('-', ' ');
  function ordenP(p) { if (/^\d{4}$/.test(p)) return +p * 10; const [s, a] = p.split('-'); return +a * 10 + +s[0]; }

  /* ------------------------------------------------------------ datos */
  const conGse = (id, car) => st.gse && GSE_IND.has(id) ? car + '|' + st.gse : car;
  const serie = (id, car) => (D.ind[id] && D.ind[id][conGse(id, car)]) || [];
  const detDe = (nombre, car) => (D.det[nombre] || {})[st.gse && GSE_DET.has(nombre) ? car + '|' + st.gse : car];
  const esAnual = p => /^\d{4}$/.test(p);
  const anioCorte = () => st.sem ? +st.sem.slice(-4) : st.anio;
  /* Corte temporal: hasta el semestre pulsado, o hasta el año elegido. */
  const dentroP = p => esAnual(p) ? +p <= anioCorte() : (st.sem ? ordenP(p) <= ordenP(st.sem) : +p.slice(-4) <= st.anio);
  const dentro = pt => dentroP(pt.p);
  const esSel = x => st.sem ? (x.p === st.sem || (esAnual(x.p) && x.a === anioCorte())) : x.a === st.anio;
  const hasta = (id, car) => serie(id, car).filter(dentro);
  const hayMeta = id => metaDe(id, st.car) != null && CAT[id].sentido !== 'info';
  const etiquetaCorte = () => st.sem ? lblDe(st.sem) : 'hasta ' + st.anio;
  function medir(id, car) {
    const pts = hasta(id, car).filter(p => p.v != null);
    return { cur: pts[pts.length - 1] || null, prev: pts[pts.length - 2] || null, pts };
  }
  function metaDe(id, car) {
    const c = CAT[id];
    return c.metas && c.metas[car] != null ? c.metas[car] : c.meta;
  }
  function tendencia(id, cur, prev) {
    if (!cur || !prev) return { cls: 'neu', html: '<span class="trend neu">Primera medición</span>', txt: 'primera medición' };
    const c = CAT[id], d = cur.v - prev.v;
    if (cur.parcial && (c.acumula || c.unidad === 'N.º'))
      return { cls: 'neu', html: '<span class="trend neu" title="El año todavía no termina: no se compara con un año completo">Año en curso</span>', txt: 'año en curso' };
    const rel = c.unidad === '%' ? Math.abs(d) : Math.abs(d) / Math.max(Math.abs(prev.v), 1);
    const sig = rel >= c.umbral;
    const dir = !sig ? 0 : d > 0 ? 1 : -1;
    let cls = 'neu';
    if (dir && c.sentido === 'mayor') cls = dir > 0 ? 'fav' : 'desf';
    if (dir && c.sentido === 'menor') cls = dir < 0 ? 'fav' : 'desf';
    const flecha = dir > 0 ? '↑' : dir < 0 ? '↓' : '→';
    const cant = c.unidad === '%' ? num(Math.abs(d), 1) + ' pp' : num(Math.abs(d), c.unidad === 'N.º' ? 0 : 1);
    const lect = !dir ? 'sin variación significativa' : (dir > 0 ? 'sube ' : 'baja ') + cant;
    const title = `${lect[0].toUpperCase() + lect.slice(1)} frente a ${prev.l} (${fmt(id, prev.v)})` +
      (cls === 'fav' ? ': mejora.' : cls === 'desf' ? ': empeora.' : '.');
    return { cls, dir, d, html: `<span class="trend ${cls}" title="${esc(title)}">${flecha} ${dir ? cant : 'Estable'}</span>`, txt: lect };
  }
  function estado(id, car, v) {
    const meta = metaDe(id, car), c = CAT[id];
    if (meta == null || v == null || c.sentido === 'info')
      return { cls: 'sin', html: '<span class="estado sin" title="La carrera aún no ha fijado una meta para este indicador">Sin meta</span>' };
    const t = c.tolerancia || 0;
    let k;
    if (c.sentido === 'menor') k = v <= meta ? 'ok' : v <= meta + t ? 'seg' : 'mal';
    else if (c.sentido === 'rango' && Array.isArray(meta)) k = v >= meta[0] && v <= meta[1] ? 'ok' : (v >= meta[0] - t && v <= meta[1] + t) ? 'seg' : 'mal';
    else k = v >= meta ? 'ok' : v >= meta - t ? 'seg' : 'mal';
    const lab = { ok: '✓ Cumple', seg: '! En seguimiento', mal: '✕ No cumple' }[k];
    return { cls: k, html: `<span class="estado ${k}">${lab}</span>` };
  }
  const metaTxt = (id, car) => { const m = metaDe(id, car); return m == null ? 'Por definir' : Array.isArray(m) ? fmt(id, m[0]) + ' – ' + fmt(id, m[1]) : (CAT[id].sentido === 'menor' ? '≤ ' : '≥ ') + fmt(id, m); };

  function baseTxt(id, p) {
    if (!p) return '';
    const n = p.n, k = p.num;
    switch (id) {
      case 'sat_est': case 'sat_serv': return `${num(n)} estudiantes encuestados` + (p.cob != null ? ` · ${num(p.cob, 0)} % de la matrícula` : '');
      case 'sat_doc': return `${num(n)} docentes encuestados` + (p.cob != null ? ` · ${num(p.cob, 0)} % de la planta` : '');
      case 'sat_grad': return `${num(n)} graduado${n === 1 ? '' : 's'} consultado${n === 1 ? '' : 's'}` + (n < 10 ? ' · base pequeña' : '');
      case 'doc_prod': return `${num(k)} de ${num(n)} docentes`;
      case 'pub_alto': case 'pub_est': return `${num(k)} de ${num(n)} artículos`;
      case 'tut_cob': case 'beca_cob': return `${num(k)} de ${num(n)} matriculados`;
      case 'tut_ejec': return `${num(n)} tutorías agendadas`;
      case 'tut_int': return `${num(n)} estudiantes atendidos`;
      case 'vin_avance': return `${num(n)} proyecto${n === 1 ? '' : 's'} terminado${n === 1 ? '' : 's'}`;
      case 'vin_culm': return `${num(n)} participaciones cerradas`;
      default: return '';
    }
  }

  /* ------------------------------------------------------------ tooltip */
  const tip = document.getElementById('tip');
  function tipShow(html, x, y) {
    tip.innerHTML = html; tip.classList.add('on');
    const r = tip.getBoundingClientRect();
    let L = x + 14, T = y + 14;
    if (L + r.width > innerWidth - 8) L = x - r.width - 14;
    if (T + r.height > innerHeight - 8) T = y - r.height - 14;
    tip.style.left = Math.max(8, L) + 'px'; tip.style.top = Math.max(8, T) + 'px';
  }
  const tipHide = () => tip.classList.remove('on');
  function infoHTML(id) {
    const c = CAT[id];
    return `<div class="tt">${esc(c.nombre)}</div>${esc(c.definicion)}` +
      `<div class="nota">Fuente: ${esc(c.fuente)} · ${esc(c.frecuencia)} · Responsable: ${esc(c.responsable)}</div>`;
  }
  function onTipTarget(e) {
    const t = e.target.closest('[data-info],[data-tip]');
    if (!t) return;
    const html = t.dataset.info ? infoHTML(t.dataset.info) : esc(t.dataset.tip).replace(/\n/g, '<br>');
    const r = t.getBoundingClientRect();
    tipShow(html, e.clientX || r.right, e.clientY || r.bottom);
  }
  document.addEventListener('mouseover', onTipTarget);
  document.addEventListener('focusin', onTipTarget);
  document.addEventListener('mouseout', e => { if (e.target.closest('[data-info],[data-tip]')) tipHide(); });
  document.addEventListener('focusout', tipHide);
  // span y no button: también vive dentro de las tarjetas de la vista general, que ya son botones.
  const info = id => `<span class="info" tabindex="0" role="note" data-info="${id}" aria-label="Qué mide: ${esc(CAT[id].nombre)}">i</span>`;

  /* ------------------------------------------------------------ montaje diferido de gráficos */
  let pend = [];
  function slot(fn) { const k = 'c' + pend.length; pend.push([k, fn]); return `<div data-slot="${k}"></div>`; }
  function montar(root) {
    pend.forEach(([k, fn]) => { const el = root.querySelector(`[data-slot="${k}"]`); if (el) fn(el); });
    pend = [];
  }
  const svgEl = (w, h, inner) => `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img">${inner}</svg>`;
  function niceMax(v) {
    if (v <= 0) return 1;
    const e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
  }

  /* Series de comparación: la del alcance elegido manda; las demás dan contexto. */
  function seriesPara(id) {
    if (st.car === 'FACS') return [
      { car: 'FACS', name: 'Facultad', color: COL.FACS, w: 2.6, pts: hasta(id, 'FACS') },
      { car: 'ENF', name: 'Enfermería', color: COL.ENF, w: 1.7, pts: hasta(id, 'ENF') },
      { car: 'NUT', name: 'Nutrición', color: COL.NUT, w: 1.7, pts: hasta(id, 'NUT') }];
    return [
      { car: st.car, name: CORTO[st.car], color: COL[st.car], w: 2.6, pts: hasta(id, st.car) },
      { car: 'FACS', name: 'Facultad', color: GRIS, w: 1.5, dash: '5 4', pts: hasta(id, 'FACS') }];
  }
  function leyenda(ss) {
    return '<div class="legend">' + ss.map(s => `<span data-car="${s.car}" data-tip="Clic para ver solo ${esc(NOM[s.car].toLowerCase())}"><i class="${s.dash ? 'dash' : ''}" style="border-color:${s.color}"></i>${esc(s.name)}</span>`).join('') + '</div>';
  }

  /* ---------- gráfico de líneas con cruz de lectura ---------- */
  function lineChart(el, id, opt) {
    opt = opt || {};
    const ss = opt.series || seriesPara(id);
    const xsMap = new Map();
    ss.forEach(s => s.pts.forEach(p => { if (!xsMap.has(p.p)) xsMap.set(p.p, p); }));
    const xs = [...xsMap.values()].sort((a, b) => ordenP(a.p) - ordenP(b.p));
    if (!xs.length || ss.every(s => s.pts.every(p => p.v == null))) {
      el.innerHTML = `<div class="empty"><b>Sin medición ${esc(etiquetaCorte())}</b>Este indicador todavía no tiene resultados para el periodo elegido.</div>`; return;
    }
    const W = Math.max(300, el.clientWidth || 640), H = opt.h || 215, ml = 40, mr = W < 420 ? 84 : 98, mt = 14, mb = 26, iw = W - ml - mr, ih = H - mt - mb;
    const n = xs.length, step = n > 1 ? iw / (n - 1) : iw;
    const X = i => ml + (n === 1 ? iw / 2 : i * step);
    const pct = unidad(id) === '%';
    let vmax = 0; ss.forEach(s => s.pts.forEach(p => { if (p.v != null) vmax = Math.max(vmax, p.v); }));
    // Porcentajes bajos (becas ~15 %) se leerían aplastados en 0-100: la escala se ajusta, siempre desde 0.
    const ymax = pct && vmax > 60 ? 100 : niceMax(vmax * (pct ? 1.25 : 1.1));
    const Y = v => mt + ih - (v / ymax) * ih;
    let g = '';
    const tks = [0, ymax / 4, ymax / 2, ymax * 3 / 4, ymax];
    tks.forEach(t => {
      g += `<line x1="${ml}" x2="${W - mr + 10}" y1="${Y(t)}" y2="${Y(t)}" stroke="#e6ecf0" stroke-width="1"/>` +
        `<text x="${ml - 7}" y="${Y(t) + 3.5}" text-anchor="end" font-size="10.5" fill="#6f8596">${num(t, t % 1 ? 1 : 0)}${pct ? '%' : ''}</text>`;
    });
    const meta = metaDe(id, st.car);
    if (meta != null && !Array.isArray(meta) && meta <= ymax)
      g += `<line x1="${ml}" x2="${W - mr + 10}" y1="${Y(meta)}" y2="${Y(meta)}" stroke="#fc7e00" stroke-width="1.3" stroke-dasharray="3 3"/>` +
        `<text x="${W - mr + 12}" y="${Y(meta) + 3.5}" font-size="10.5" fill="#b86200" font-weight="700">Meta ${esc(fmt(id, meta))}</text>`;
    const cada = n > 8 ? 2 : 1;
    xs.forEach((x, i) => {
      const sel = esSel(x);
      if (sel) g += `<rect x="${X(i) - Math.min(step, 60) / 2}" y="${mt - 6}" width="${Math.min(step, 60)}" height="${ih + 6}" fill="#fde7cc" opacity=".55" rx="4"/>`;
      const vecinoSel = cada > 1 && !sel && ((xs[i - 1] && esSel(xs[i - 1])) || (xs[i + 1] && esSel(xs[i + 1])));
      if (sel || ((i % cada === 0 || i === n - 1) && !vecinoSel)) g += `<text x="${X(i)}" y="${H - 7}" text-anchor="middle" font-size="10.5" fill="${sel ? '#1c3247' : '#6f8596'}" font-weight="${sel ? 700 : 400}">${esc(tick(x.p))}</text>`;
    });
    const labels = [];
    ss.slice().reverse().forEach(s => {
      const idx = s.pts.map(p => [xs.findIndex(x => x.p === p.p), p]).filter(([, p]) => p.v != null);
      let d = '', prevI = -2;
      idx.forEach(([i, p]) => { d += (i === prevI + 1 && d ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.v).toFixed(1); prevI = i; });
      if (idx.length > 1) g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.w}" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''}/>`;
      idx.forEach(([i, p]) => {
        const hueco = p.glob || p.parcial || (p.n != null && p.n < 10 && id === 'sat_grad');
        const r = s.w > 2 ? 4.2 : 3.2;
        g += `<circle cx="${X(i)}" cy="${Y(p.v)}" r="${r}" fill="${hueco ? '#fff' : s.color}" stroke="${hueco ? s.color : '#fff'}" stroke-width="${hueco ? 1.8 : 1.5}"/>`;
      });
      if (idx.length) { const [i, p] = idx[idx.length - 1]; labels.push({ y: Y(p.v), x: X(i), s, p }); }
    });
    labels.sort((a, b) => a.y - b.y);
    for (let k = 1; k < labels.length; k++) if (labels[k].y - labels[k - 1].y < 26) labels[k].y = labels[k - 1].y + 26;
    const exceso = labels.length ? labels[labels.length - 1].y - (mt + ih - 8) : 0;  // que la última etiqueta no pise el eje
    if (exceso > 0) labels.forEach(L => { L.y -= exceso; });
    for (let k = labels.length - 2; k >= 0; k--) if (labels[k + 1].y - labels[k].y < 26) labels[k].y = labels[k + 1].y - 26;
    labels.forEach(L => {
      g += `<g class="lbl-car" data-car="${L.s.car}"><rect x="${L.x + 5}" y="${L.y - 13}" width="80" height="28" fill="transparent"/>` +
        `<text x="${L.x + 9}" y="${L.y - 1}" font-size="12.5" font-weight="700" fill="#1c3247">${esc(fmt(id, L.p.v))}</text>` +
        `<text x="${L.x + 9}" y="${L.y + 11}" font-size="10.5" fill="#6f8596">${esc(L.s.name)}</text></g>`;
    });
    g += `<line class="xh" x1="0" x2="0" y1="${mt - 4}" y2="${mt + ih}" stroke="#1c3247" stroke-width="1" opacity="0"/>` +
      `<rect class="hit" x="${ml - 20}" y="0" width="${iw + 40}" height="${H}" fill="transparent" style="cursor:pointer"/>`;
    el.innerHTML = (ss.length > 1 ? leyenda(ss) : '') + svgEl(W, H, g);
    const svg = el.querySelector('svg'), xh = svg.querySelector('.xh');
    svg.querySelector('.hit').addEventListener('pointermove', e => {
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
      const i = Math.max(0, Math.min(n - 1, Math.round(n === 1 ? 0 : (loc.x - ml) / step)));
      xh.setAttribute('x1', X(i)); xh.setAttribute('x2', X(i)); xh.setAttribute('opacity', .35);
      const x = xs[i]; let notas = [];
      let h = `<div class="tt">${esc(x.l)}</div>`;
      ss.forEach(s => {
        const p = s.pts.find(q => q.p === x.p); if (!p || p.v == null) return;
        h += `<div class="r"><i style="border-color:${s.color}"></i><b>${esc(fmt(id, p.v))}</b><span>${esc(s.name)}</span></div>`;
        if (s.car === st.car) {
          const b = baseTxt(id, p); if (b) notas.push(b);
          if (p.glob) notas.push('Medición general, sin detalle por aspecto');
          if (p.parcial) notas.push('Año en curso: aún puede crecer');
        }
      });
      notas.push('Clic: filtrar todo el tablero a ' + (esAnual(x.p) ? x.p : x.l));
      h += `<div class="nota">${notas.map(esc).join('<br>')}</div>`;
      tipShow(h, e.clientX, e.clientY);
    });
    svg.querySelector('.hit').addEventListener('click', e => {
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
      const i = Math.max(0, Math.min(n - 1, Math.round(n === 1 ? 0 : (loc.x - ml) / step)));
      filtrarPeriodo(xs[i].p);
    });
    svg.querySelectorAll('.lbl-car').forEach(gc => gc.addEventListener('click', ev => { ev.stopPropagation(); filtrarCarrera(gc.dataset.car); }));
    svg.querySelector('.hit').addEventListener('pointerleave', () => { xh.setAttribute('opacity', 0); tipHide(); });
  }

  /* ---------- columnas (simples o apiladas) por año ---------- */
  function columnChart(el, opt) {
    const xs = opt.xs; // [{p, l, a, parcial, segs:[{k, v, color}]}]
    if (!xs.length) { el.innerHTML = '<div class="empty"><b>Sin datos hasta ' + st.anio + '</b></div>'; return; }
    const W = Math.max(300, el.clientWidth || 640), H = opt.h || 225, ml = 40, mr = 14, mt = 22, mb = 26, iw = W - ml - mr, ih = H - mt - mb;
    const tot = xs.map(x => x.segs.reduce((s, q) => s + (q.v || 0), 0));
    const ymax = niceMax(Math.max(...tot, 1) * 1.08);
    const Y = v => mt + ih - (v / ymax) * ih;
    const bw = Math.min(54, iw / xs.length * 0.62), step = iw / xs.length;
    let g = '<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#fff"/><line x1="0" y1="0" x2="0" y2="6" stroke="#9aabb8" stroke-width="2.4"/></pattern></defs>';
    [0, ymax / 2, ymax].forEach(t => {
      g += `<line x1="${ml}" x2="${W - mr}" y1="${Y(t)}" y2="${Y(t)}" stroke="#e6ecf0"/>` +
        `<text x="${ml - 7}" y="${Y(t) + 3.5}" text-anchor="end" font-size="10.5" fill="#6f8596">${num(t, 0)}</text>`;
    });
    xs.forEach((x, i) => {
      const cx = ml + step * i + step / 2, sel = esSel(x);
      if (sel) g += `<rect x="${cx - Math.min(step, bw + 22) / 2}" y="${mt - 18}" width="${Math.min(step, bw + 22)}" height="${ih + 18}" fill="#fde7cc" opacity=".55" rx="4"/>`;
      let y0 = Y(0);
      const ultimo = x.segs.map(z => !!z.v).lastIndexOf(true);
      x.segs.forEach((q, j) => {
        if (!q.v) return;
        const h = (q.v / ymax) * ih, x0 = cx - bw / 2, top = j === ultimo;
        const hh = Math.max(h - (top ? 0 : 2), 0.5), y = y0 - h, r = top ? Math.min(4, hh) : 0;
        g += `<path class="seg" data-i="${i}" data-j="${j}" fill="${q.color}" d="M${x0} ${y + hh}V${y + r}Q${x0} ${y} ${x0 + r} ${y}H${x0 + bw - r}Q${x0 + bw} ${y} ${x0 + bw} ${y + r}V${y + hh}Z"/>`;
        y0 -= h;
      });
      if (x.parcial) g += `<rect x="${cx - bw / 2}" y="${Y(tot[i])}" width="${bw}" height="${Y(0) - Y(tot[i])}" fill="url(#hatch)" opacity=".28" pointer-events="none"/>`;
      g += `<text x="${cx}" y="${Y(tot[i]) - 6}" text-anchor="middle" font-size="12" font-weight="700" fill="#1c3247">${esc(opt.fmt ? opt.fmt(tot[i]) : num(tot[i]))}</text>` +
        `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="10.5" fill="${sel ? '#1c3247' : '#6f8596'}" font-weight="${sel ? 700 : 400}">${esc(tick(x.p))}${x.parcial ? '*' : ''}</text>`;
    });
    el.innerHTML = (opt.legend || '') + svgEl(W, H, g) + (xs.some(x => x.parcial) ? '<div class="ph-note" style="margin:4px 0 0">* Año en curso: la cifra todavía puede crecer.</div>' : '');
    el.querySelectorAll('path.seg').forEach(r => {
      r.addEventListener('pointermove', e => {
        const x = xs[+r.dataset.i], q = x.segs[+r.dataset.j];
        let h = `<div class="tt">${esc(x.l)}</div>`;
        x.segs.slice().reverse().forEach(z => { if (z.v != null) h += `<div class="r"><i style="border-color:${z.color}"></i><b>${esc(opt.fmt ? opt.fmt(z.v) : num(z.v))}</b><span>${esc(z.k)}</span></div>`; });
        if (x.segs.length > 1) h += `<div class="nota">Total: ${num(tot[+r.dataset.i])}</div>`;
        if (x.nota) h += `<div class="nota">${esc(x.nota)}</div>`;
        h += `<div class="nota">Clic: filtrar todo el tablero a ${esc(x.p)}</div>`;
        tipShow(h, e.clientX, e.clientY);
        r.style.filter = 'brightness(1.08)'; void q;
      });
      r.addEventListener('pointerleave', () => { tipHide(); r.style.filter = ''; });
      r.addEventListener('click', () => filtrarPeriodo(xs[+r.dataset.i].p));
    });
  }

  /* ---------- barras horizontales ---------- */
  function hbars(rows, o) {
    o = o || {};
    if (!rows || !rows.length) return '<div class="empty"><b>Sin detalle para este periodo</b></div>';
    const max = o.max || Math.max(...rows.map(r => r.v || 0), 1);
    return '<div class="hb">' + rows.map(r => {
      let d = '';
      if (o.prev && o.prev[r.a] != null && r.v != null) {
        const dd = r.v - o.prev[r.a];
        const cls = Math.abs(dd) < 1 ? 'neu' : dd > 0 ? 'fav' : 'desf';
        d = `<span class="trend d ${cls}" style="margin-left:6px">${Math.abs(dd) < 1 ? '→' : dd > 0 ? '↑' : '↓'} ${num(Math.abs(dd), 1)} pp</span>`;
      }
      let t = (o.tip ? o.tip(r) : '') || `${r.a}: ${o.fmt ? o.fmt(r.v) : num(r.v, 1) + ' %'}`;
      const pulsable = r.gse ? ` data-gse="${esc(r.gse)}"` : '';
      if (r.gse) t += st.gse === r.gse ? '\nClic: quitar este filtro' : '\nClic: filtrar el tablero a este nivel';
      const clase = 'hrow' + (r.gse && st.gse ? (st.gse === r.gse ? ' sel' : ' mut') : '');
      const valor = r.v == null ? (o.vacio || '—') : (o.fmt ? o.fmt(r.v) : num(r.v, 1) + ' %');
      return `<div class="${clase}"${pulsable} data-tip="${esc(t)}"><span class="hl">${esc(r.a)}</span>` +
        `<span class="hv">${esc(valor)}${d}</span>` +
        `<span class="ht"><span class="hf" style="width:${Math.max(0, Math.min(100, (r.v || 0) / max * 100))}%;background:${r.color || o.color || COL[st.car]}"></span>` +
        (o.ref != null ? `<span class="hg" style="left:${o.ref / max * 100}%"></span>` : '') + '</span></div>';
    }).join('') + '</div>';
  }

  /* ---------- tarjeta KPI ---------- */
  function spark(id) {
    const pts = medir(id, st.car).pts.slice(-8);
    if (pts.length < 2) return '';
    const vs = pts.map(p => p.v), mn = Math.min(...vs), mx = Math.max(...vs), rg = mx - mn || 1;
    const W = 84, H = 30, X = i => 3 + i * (W - 6) / (pts.length - 1), Y = v => H - 4 - (v - mn) / rg * (H - 8);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join('');
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${d}" fill="none" stroke="${COL[st.car]}" stroke-width="1.8" stroke-linejoin="round" opacity=".85"/>` +
      `<circle cx="${X(pts.length - 1)}" cy="${Y(pts[pts.length - 1].v)}" r="2.8" fill="${COL[st.car]}"/></svg>`;
  }
  function kpi(id, o) {
    o = o || {};
    const c = CAT[id], m = medir(id, st.car), cur = m.cur;
    const tag = o.link ? 'button type="button"' : 'div';
    const attrs = o.link ? ` data-go="${c.vista}" data-foco="${id}"` : '';
    const lbl = `<div class="top"><span class="lbl">${c.tipo ? `<span style="color:var(--acento)">${esc(c.tipo)} · </span>` : ''}${esc(c.nombre)}</span>${info(id)}</div>`;
    const sinGse = st.gse && !GSE_IND.has(id);
    const cls = 'kpi' + (sinGse ? ' nogse' : '');
    if (!cur) return `<${tag} class="${cls} na" id="k-${id}"${attrs}>${lbl}<div class="val">Sin medición</div><div class="per">No hay resultados ${esc(etiquetaCorte())}</div></${tag.split(' ')[0]}>`;
    const t = tendencia(id, cur, m.prev), e = estado(id, st.car, cur.v);
    const base = sinGse ? 'Sin desglose por nivel socioeconómico: muestra a toda la población' : baseTxt(id, cur);
    return `<${tag} class="${cls}" id="k-${id}"${attrs}>${lbl}` +
      `<div class="mid"><div><div class="val">${valHTML(id, cur.v)}</div><div class="per">${esc(cur.l)}${m.prev ? ' · antes ' + esc(fmt(id, m.prev.v)) : ''}</div></div>${spark(id)}</div>` +
      `<div class="base">${esc(base)}</div>` +
      `<div class="foot">${hayMeta(id) ? `<span class="meta">Meta: <b>${esc(metaTxt(id, st.car))}</b></span>` : `<span class="meta">vs. anterior</span>`}${t.html}${hayMeta(id) ? e.html : ''}</div></${tag.split(' ')[0]}>`;
  }

  /* ---------- tabla de resultados (Meta | Resultado | Anterior | Tendencia | Estado) ---------- */
  function tabla(ids) {
    const conBase = ids.some(id => CAT[id].lineaBase != null), conMeta = ids.some(hayMeta);
    const filas = ids.map(id => {
      const c = CAT[id], m = medir(id, st.car), cur = m.cur, prev = m.prev;
      const t = tendencia(id, cur, prev), e = estado(id, st.car, cur && cur.v);
      return `<tr class="${st.foco === id ? 'hl' : ''}"><td><div class="ind">${esc(c.nombre)}</div>${c.tipo ? `<div class="tipo">${esc(c.tipo)}</div>` : ''}</td>` +
        `<td class="per">${cur ? esc(cur.l) : '—'}</td>` +
        (conBase ? `<td class="n">${c.lineaBase == null ? '—' : esc(fmt(id, c.lineaBase))}</td>` : '') +
        (conMeta ? `<td class="n">${hayMeta(id) ? esc(metaTxt(id, st.car)) : '—'}</td>` : '') +
        `<td class="n"><b>${cur ? esc(fmt(id, cur.v)) : '—'}</b></td>` +
        `<td class="n">${prev ? esc(fmt(id, prev.v)) + ` <span class="per">(${esc(prev.l)})</span>` : '—'}</td>` +
        `<td>${cur ? t.html : '—'}</td>${conMeta ? `<td>${hayMeta(id) ? e.html : '—'}</td>` : ''}</tr>`;
    }).join('');
    return `<div class="panel"><div class="ph"><h3>Resultados del periodo</h3></div>` +
      `<p class="ph-note">Cada indicador en su última medición ${esc(etiquetaCorte())}, frente a la medición anterior.</p>` +
      `<div class="tbl-wrap"><table class="res"><thead><tr><th>Indicador</th><th>Periodo</th>${conBase ? '<th class="n">Línea base</th>' : ''}${conMeta ? '<th class="n">Meta</th>' : ''}<th class="n">Resultado</th><th class="n">Anterior</th><th>Tendencia</th>${conMeta ? '<th>Estado</th>' : ''}</tr></thead><tbody>${filas}</tbody></table></div></div>`;
  }

  function lectura(items, titulo) {
    items = items.filter(Boolean);
    if (!items.length) return '';
    return `<div class="lectura"><h3><svg viewBox="0 0 24 24">${IC.idea}</svg>${esc(titulo || 'Lo que dicen los datos')}</h3><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul></div>`;
  }
  const B = s => `<b>${esc(s)}</b>`;
  const deGrupo = () => st.gse ? ` de nivel socioeconómico ${GSE_NOM[st.gse].toLowerCase()}` : '';
  const q = s => `«${esc(s)}»`;
  function panel(titulo, id, cuerpo, nota) {
    return `<div class="panel"><div class="ph"><h3>${esc(titulo)}</h3>${id ? info(id) : ''}</div>${nota ? `<p class="ph-note">${nota}</p>` : '<div style="height:8px"></div>'}${cuerpo}</div>`;
  }
  const ultimoDet = (obj, filtro) => { // detalle de la última medición <= año
    if (!obj) return null;
    const ks = Object.keys(obj).filter(k => dentroP(k) && (!filtro || filtro(k))).sort((a, b) => ordenP(a) - ordenP(b));
    return ks.length ? { k: ks[ks.length - 1], prevK: ks[ks.length - 2], rows: obj[ks[ks.length - 1]], prev: ks.length > 1 ? obj[ks[ks.length - 2]] : null } : null;
  };
  const lblDe = p => { const x = D.periodos.find(z => z.p === p); return x ? x.l : p; };
  const mapa = rows => { const m = {}; (rows || []).forEach(r => { m[r.a] = r.v; }); return m; };

  /* ================================================================ VISTAS */
  function vInicio() {
    const secs = [
      ['grupos', 'Grupos de interés', ['sat_est', 'sat_grad', 'sat_doc']],
      ['investigacion', 'Investigación y actividad académica', ['pub_total', 'doc_prod', 'pub_alto']],
      ['vinculacion', 'Vinculación e impacto', ['vin_proy', 'vin_benef', 'vin_avance']],
      ['apoyo', 'Servicios de apoyo', ['tut_cob', 'beca_cob', 'sat_serv']]
    ];
    const destacados = [insGrupos()[0], insInvest()[0], insVinc()[0], insApoyo()[0]];
    return lectura(destacados, 'Lo más destacado') + secs.map(([v, t, ids]) =>
      `<div class="sec"><h3>${esc(t)}</h3><a href="#${v}" data-go="${v}">Ver detalle →</a></div>` +
      `<div class="kpis">${ids.map(id => kpi(id, { link: true })).join('')}</div>`).join('');
  }

  /* ---------------- Vista 3 ---------------- */
  function insGrupos() {
    const out = [], c = st.car;
    const se = medir('sat_est', c);
    if (se.cur) {
      let s = `La satisfacción de los estudiantes${deGrupo()} es ${B(fmt('sat_est', se.cur.v))} en ${esc(se.cur.l)}`;
      if (se.prev) {
        const t = tendencia('sat_est', se.cur, se.prev);
        s += t.dir ? `, ${t.dir > 0 ? 'sube' : 'baja'} ${B(num(Math.abs(t.d), 1) + ' pp')} frente a ${esc(se.prev.l)}` : `, estable frente a ${esc(se.prev.l)}`;
      }
      if (se.prev && se.prev.glob) s += ' (esa medición fue general, con otro cuestionario, así que la comparación es solo referencial)';
      out.push(s + '.');
      const det = ultimoDet(detDe('sat_est', c));
      if (det && det.rows.length > 1) {
        const lo = det.rows[det.rows.length - 1], hi = det.rows[0];
        out.push(`Lo mejor valorado por los estudiantes: ${q(hi.a)} (${num(hi.v, 1)} %). Lo que más pide atención: ${q(lo.a)} (${num(lo.v, 1)} %).`);
      }
    }
    const sg = medir('sat_grad', c);
    if (sg.cur) out.push(`${B(fmt('sat_grad', sg.cur.v))} de los graduados consultados en ${esc(sg.cur.l)} se declara satisfecho con los estudios realizados` +
      (sg.cur.n < 10 ? ` (solo ${num(sg.cur.n)} respuestas: conviene leerlo con cautela)` : '') + '.');
    const sd = medir('sat_doc', c), dd = ultimoDet(D.det.sat_doc[c]);
    if (sd.cur && dd && dd.rows.length > 1) {
      const lo = dd.rows[dd.rows.length - 1];
      out.push(`Los docentes muestran ${B(fmt('sat_doc', sd.cur.v))} de satisfacción; el punto más bajo es ${q(lo.a)} (${num(lo.v, 1)} %).`);
    }
    return out;
  }
  let grupoDet = 'est';
  function vGrupos() {
    const c = st.car, ids = ['sat_est', 'sat_grad', 'sat_doc'];
    let det = '';
    if (grupoDet === 'est') {
      const d = ultimoDet(detDe('sat_est', c)), cur = medir('sat_est', c).cur;
      det = d ? `<p class="ph-note">${esc(lblDe(d.k))}${d.prevK ? ' · la flecha compara con ' + esc(lblDe(d.prevK)) : ''}. La línea vertical marca el resultado global.</p>` +
        hbars(d.rows, { max: 100, prev: d.prev && mapa(d.prev), ref: cur && cur.v, tip: r => `${r.a}\n${num(r.v, 1)} % de valoraciones de 4 o 5 · promedio ${num(r.media, 2)} de 5\n${num(r.n)} respuestas` }) : '<div class="empty"><b>Sin detalle por aspecto hasta ' + st.anio + '</b>La primera medición por aspecto es de agosto – diciembre 2025.</div>';
    } else if (grupoDet === 'grad') {
      const d = ultimoDet(D.det.sat_grad[c]);
      det = d ? `<p class="ph-note">Graduados consultados en ${esc(d.k)} · ${num(d.rows[0].n)} respuestas${d.rows[0].n < 10 ? ' (base pequeña)' : ''}. Escala de 1 a 7: se cuenta como satisfecho de 5 a 7.</p>` +
        '<div class="hsub">La formación</div>' + hbars(d.rows.filter(r => r.g === 'formacion'), { max: 100, tip: r => `${r.a}\n${num(r.v, 1)} % satisfechos · promedio ${num(r.media, 2)} de 7` }) +
        '<div class="hsub">El personal y los recursos de la universidad</div>' + hbars(d.rows.filter(r => r.g === 'recursos'), { max: 100, tip: r => `${r.a}\n${num(r.v, 1)} % satisfechos · promedio ${num(r.media, 2)} de 7` }) : '<div class="empty"><b>Sin encuestas a graduados hasta ' + st.anio + '</b></div>';
    } else {
      const d = ultimoDet(D.det.sat_doc[c]), cur = medir('sat_doc', c).cur;
      det = d ? `<p class="ph-note">${esc(lblDe(d.k))} · ${num(cur.n)} docentes. La línea vertical marca el resultado global.</p>` +
        hbars(d.rows, { max: 100, ref: cur && cur.v, tip: r => `${r.a}\n${num(r.v, 1)} % de valoraciones de 4 o 5 · promedio ${num(r.media, 2)} de 5` }) : '<div class="empty"><b>Sin encuesta docente hasta ' + st.anio + '</b>La primera medición es de abril – julio 2026.</div>';
    }
    const seg = [['est', 'Estudiantes'], ['grad', 'Graduados'], ['doc', 'Docentes']].map(([k, l]) => `<button type="button" class="segbtn ${grupoDet === k ? 'on' : ''}" data-grupo="${k}">${l}</button>`).join('');
    const notaEst = serie('sat_est', c).some(p => p.glob && p.a <= st.anio) ? 'El primer punto (abril – julio 2025) es una medición general, sin detalle por aspecto.' : '';
    return `<div class="kpis">${ids.map(id => kpi(id)).join('')}</div>` + lectura(insGrupos()) +
      `<div class="grid3">` +
      panel('Estudiantes', 'sat_est', slot(el => lineChart(el, 'sat_est', { h: 230 })), notaEst || 'Valoraciones de 4 o 5, por semestre') +
      panel('Graduados', 'sat_grad', slot(el => lineChart(el, 'sat_grad', { h: 230 })), 'Satisfechos con sus estudios, por año de encuesta. Punto hueco: menos de 10 respuestas') +
      panel('Docentes', 'sat_doc', slot(el => lineChart(el, 'sat_doc', { h: 230 })), 'Valoraciones de 4 o 5. Hasta hoy existe una sola medición') +
      `</div><div class="grid2 wl arriba"><div class="panel"><div class="ph"><h3>¿Qué se valora y qué no?</h3><span style="flex:1"></span><div class="segbtns">${seg}</div></div>${det}</div>` +
      panelGse() + `</div>` + tabla(ids);
  }

  function panelGse() {
    const cur = medir('sat_est', st.car).cur, d = cur && (D.det.sat_gse[st.car] || {})[cur.p];
    const rows = d ? GSE_ORD.filter(g => d[g]).map(g => ({ a: GSE_NOM[g], gse: g, v: d[g].v, n: d[g].n })) : [];
    return panel('Satisfacción estudiantil por nivel socioeconómico', 'sat_est',
      hbars(rows, { max: 100, color: COL[st.car], tip: r => `Nivel ${r.a.toLowerCase()}: ${num(r.v, 1)} % de valoraciones de 4 o 5\n${num(r.n)} estudiantes encuestados` }),
      cur ? `${esc(cur.l)} · pulsa un nivel para filtrar el tablero` : '');
  }

  /* ---------------- Vista 6 ---------------- */
  function insInvest() {
    const out = [], c = st.car, s = serie('pub_total', c).filter(p => p.a <= st.anio);
    const full = s.filter(p => !p.parcial), ref = full[full.length - 1];
    if (ref) {
      const base = full.find(p => p.a === ref.a - 2);
      if (base && base.v > 0 && ref.v / base.v >= 1.5) out.push(`En ${ref.a} se publicaron ${B(num(ref.v) + ' artículos')}, ${B(num(ref.v / base.v, 1).replace(',0', '') + ' veces')} los de ${base.a} (${num(base.v)}).`);
      else out.push(`En ${ref.a} se publicaron ${B(num(ref.v) + ' artículos')}${base ? ` (${num(base.v)} en ${base.a})` : ''}.`);
    }
    const dp = medir('doc_prod', c).cur;
    if (dp) out.push(`${B(num(dp.v / 10, 1).replace(',0', '') + ' de cada 10')} docentes de la carrera publicaron al menos un artículo en ${esc(dp.l.replace(' (parcial)', ''))}${dp.parcial ? ', con el año todavía en curso' : ''}.`);
    const pa = medir('pub_alto', c).cur;
    if (pa) out.push(pa.v < 50 ? `Solo ${B(fmt('pub_alto', pa.v))} de los artículos llega a revistas de impacto mundial (Scopus o Web of Science); el resto se publica en revistas regionales.`
      : `${B(fmt('pub_alto', pa.v))} de los artículos se publica en revistas de impacto mundial (Scopus o Web of Science).`);
    const pe = medir('pub_est', c);
    if (pe.cur && pe.prev) out.push(`La coautoría con estudiantes ${pe.cur.v >= pe.prev.v ? 'crece' : 'cae'} a ${B(fmt('pub_est', pe.cur.v))} de los artículos (${fmt('pub_est', pe.prev.v)} en ${esc(pe.prev.l.replace(' (parcial)', ''))}).`);
    return out;
  }
  function vInvest() {
    const c = st.car, ids = ['pub_total', 'doc_prod', 'pub_alto', 'pub_q12', 'pub_est'];
    const NIV = [['Científico (Scopus / WoS)', '#1c3247'], ['Regional (Latindex)', '#4597bf'], ['Divulgativo y memorias', '#f7964d']];
    const xs = serie('pub_total', c).filter(p => p.a <= st.anio).map(p => ({ p: p.p, l: p.l, a: p.a, parcial: p.parcial,
      segs: NIV.map(([k, col]) => ({ k, v: (D.det.pub_nivel[c][p.p] || {})[k] || 0, color: col })) }));
    const leg = '<div class="legend">' + NIV.map(([k, col]) => `<span><i class="box" style="background:${col}"></i>${esc(k)}</span>`).join('') + '</div>';
    const cu = ultimoDet(D.det.pub_cuartil[c]);
    const cuRows = cu ? ['Q1', 'Q2', 'Q3', 'Q4'].map((k, i) => ({ a: k + (i === 0 ? ' · mayor impacto' : i === 3 ? ' · menor impacto' : ''), v: cu.rows[k], color: ['#1c3247', '#335f7f', '#3c7aa0', '#4597bf'][i] })) : [];
    const proy = medir('pub_proy', c).cur;
    return `<div class="kpis">${ids.map(id => kpi(id)).join('')}</div>` + lectura(insInvest()) +
      `<div class="grid2 wl">` +
      panel('Artículos publicados por año y nivel de la revista', 'pub_total', slot(el => columnChart(el, { xs, legend: leg })), 'Artículos únicos, aprobados por la universidad') +
      panel('Docentes que publican', 'doc_prod', slot(el => lineChart(el, 'doc_prod', { h: 235 })), 'Porcentaje de la planta docente del año con al menos un artículo') +
      `</div><div class="grid3">` +
      panel('Revistas de impacto mundial', 'pub_alto', slot(el => lineChart(el, 'pub_alto', { h: 200 })), 'Porcentaje de artículos en Scopus o Web of Science') +
      panel('Coautoría con estudiantes', 'pub_est', slot(el => lineChart(el, 'pub_est', { h: 200 })), 'Porcentaje de artículos con al menos un estudiante coautor') +
      panel('Cuartil de las revistas indexadas', 'pub_q12', cu ? hbars(cuRows, { fmt: v => num(v) + ' art.', tip: r => `${r.a}: ${num(r.v)} artículos en ${cu.k}` }) +
        `<p class="ph-note" style="margin:12px 0 0">Año ${esc(cu.k)}${cu.k == D.anioActual ? ' (en curso)' : ''}. ${proy ? `${B(num(proy.v))} artículos del año provienen de proyectos de investigación.` : ''}</p>` : '', 'Solo los artículos con cuartil asignado') +
      `</div>` + tabla(ids.concat('pub_proy'));
  }

  /* ---------------- Vista 7 ---------------- */
  function insVinc() {
    const out = [], c = st.car;
    const p = medir('vin_proy', c).cur, b = medir('vin_benef', c).cur, a = medir('vin_avance', c).cur, u = medir('vin_culm', c).cur;
    if (p) out.push(`En ${esc(p.l.replace(' (parcial)', ''))}${p.parcial ? ', con el año todavía en curso,' : ''} iniciaron ${B(num(p.v) + ' proyectos')} de vinculación` + (b ? `, que se propusieron atender a ${B(num(b.v) + ' personas')} de forma directa.` : '.'));
    if (a) out.push(`Los proyectos que terminaron reportan, en promedio, ${B(fmt('vin_avance', a.v))} de cumplimiento de lo planificado (${esc(baseTxt('vin_avance', a))}, iniciados en ${esc(a.l)}).`);
    if (u) out.push(`${B(fmt('vin_culm', u.v))} de los estudiantes que cerraron su participación la culminó.`);
    return out;
  }
  let vinTodos = true;
  function vVinc() {
    const c = st.car, ids = ['vin_proy', 'vin_benef', 'vin_avance', 'vin_culm'];
    const xsP = serie('vin_proy', c).filter(p => p.a <= st.anio && p.a >= 2021).map(p => ({ p: p.p, l: p.l, a: p.a, segs: [{ k: 'Proyectos', v: p.v, color: COL[c] }] }));
    const xsB = serie('vin_benef', c).filter(p => p.a <= st.anio && p.a >= 2021).map(p => ({ p: p.p, l: p.l, a: p.a, segs: [{ k: 'Beneficiarios previstos', v: p.v, color: COL[c] }] }));
    const filas = (D.det.vin_proyectos[c] || []).filter(f => f.a <= st.anio && (vinTodos || f.a === st.anio));
    const carN = { ENF: 'Enfermería', NUT: 'Nutrición', 'ENF+NUT': 'Ambas' };
    const tablaP = filas.length ? `<div class="tbl-wrap" style="max-height:420px;overflow-y:auto"><table class="res"><thead><tr><th>Proyecto</th>${c === 'FACS' ? '<th>Carrera</th>' : ''}<th class="n">Inicio</th><th>Estado</th><th>Cumplimiento reportado</th><th class="n">Beneficiarios previstos</th><th class="n">Estudiantes</th></tr></thead><tbody>` +
      filas.map(f => `<tr class="${f.a === st.anio ? 'hl' : ''}"><td style="min-width:260px">${esc(f.nom)}</td>${c === 'FACS' ? `<td class="per">${esc(carN[f.car])}</td>` : ''}<td class="n">${f.a}</td>` +
        `<td><span class="pill ${/ejecuci/i.test(f.estado) ? 'ej' : 'fin'}">${/ejecuci/i.test(f.estado) ? 'En ejecución' : esc(f.estado)}</span></td>` +
        `<td>${f.av == null ? '<span class="per">Sin informe aprobado</span>' : `<span class="mini-bar"><i style="width:${f.av}%"></i></span>${num(f.av, 0)} %`}</td>` +
        `<td class="n">${num(f.ben)}</td><td class="n">${num(f.est)}</td></tr>`).join('') + '</tbody></table></div>'
      : `<div class="empty"><b>No hay proyectos iniciados en ${st.anio}</b></div>`;
    const seg = `<div class="segbtns"><button type="button" class="segbtn ${vinTodos ? 'on' : ''}" data-vin="1">Hasta ${st.anio}</button><button type="button" class="segbtn ${!vinTodos ? 'on' : ''}" data-vin="0">Solo ${st.anio}</button></div>`;
    return `<div class="kpis">${ids.map(id => kpi(id)).join('')}</div>` + lectura(insVinc()) +
      `<div class="grid2">` +
      panel('Proyectos ejecutados por año de inicio', 'vin_proy', slot(el => columnChart(el, { xs: xsP, h: 205 }))) +
      panel('Beneficiarios directos previstos', 'vin_benef', slot(el => columnChart(el, { xs: xsB, h: 205 }))) +
      `</div><div class="panel"><div class="ph"><h3>Proyectos de vinculación</h3><span style="flex:1"></span>${seg}</div>` +
      `<p class="ph-note">${num(filas.length)} proyectos aprobados. El cumplimiento es el avance que el propio proyecto reporta en sus informes aprobados.</p>${tablaP}</div>` +
      tabla(ids.concat('vin_est'));
  }

  /* ---------------- Vista 8 ---------------- */
  function insApoyo() {
    const out = [], c = st.car;
    const bc = medir('beca_cob', c).cur, g = ultimoDet(D.det.beca_gse[c], k => bc && k === bc.p);
    if (bc && g && g.rows.BAJO && !st.gse) {
      const v = g.rows.BAJO.v;
      out.push(`Las becas llegan al ${B(num(v, 1) + ' %')} de los estudiantes de nivel socioeconómico bajo: ${B(num(Math.round(10 - v / 10)) + ' de cada 10')} no recibe ayuda (${esc(bc.l)}).`);
    } else if (bc) out.push(`${B(fmt('beca_cob', bc.v))} de los estudiantes${deGrupo()} recibe una beca o ayuda en ${esc(bc.l)}.`);
    const tc = medir('tut_cob', c);
    if (tc.cur) out.push(`${B(fmt('tut_cob', tc.cur.v))} de los matriculados${deGrupo()} asistió al menos a una tutoría en ${esc(tc.cur.l)}` +
      (tc.prev ? ` (${fmt('tut_cob', tc.prev.v)} el semestre anterior).` : '.'));
    if (c === 'FACS') {
      const e = medir('tut_cob', 'ENF').cur, n = medir('tut_cob', 'NUT').cur;
      if (e && n && Math.abs(e.v - n.v) >= 10) out.push(`La cobertura de tutorías es desigual entre carreras: ${B('Enfermería ' + fmt('tut_cob', e.v))} frente a ${B('Nutrición ' + fmt('tut_cob', n.v))}.`);
    }
    const te = medir('tut_ejec', c);
    if (te.cur && te.pts.length > 2) {
      const mx = te.pts.reduce((a, b) => b.v > a.v ? b : a);
      if (mx.v - te.cur.v >= 8) out.push(`Se realiza el ${B(fmt('tut_ejec', te.cur.v))} de las tutorías agendadas, frente al ${fmt('tut_ejec', mx.v)} de ${esc(mx.l)}: las cancelaciones van en aumento.`);
    }
    const ss = ultimoDet(detDe('sat_serv', c));
    if (ss && ss.rows.length) { const lo = ss.rows[ss.rows.length - 1]; out.push(`El servicio peor valorado por los estudiantes es ${q(lo.a)} (${num(lo.v, 1)} %).`); }
    return out;
  }
  function vApoyo() {
    const c = st.car, ids = ['sat_serv', 'tut_cob', 'tut_ejec', 'beca_cob', 'tut_int'];
    const bc = medir('beca_cob', c).cur;
    const g = bc ? ultimoDet(D.det.beca_gse[c], k => k === bc.p) : null;
    const ORD = ['BAJO', 'MEDIO BAJO', 'MEDIO TÍPICO', 'MEDIO ALTO', 'ALTO'];
    const gRows = g ? ORD.filter(k => g.rows[k]).map(k => ({ a: GSE_NOM[k], gse: k, v: g.rows[k].v, n: g.rows[k].n })) : [];
    const tp = bc ? (detDe('beca_tipo', c) || {})[bc.p] : null;
    const tRows = tp ? Object.entries(tp).map(([k, v]) => ({ a: k[0] + k.slice(1).toLowerCase().replace(/\s*\(desde 2do nivel\)/, ' (desde 2.º nivel)'), v })).sort((a, b) => (b.v || 0) - (a.v || 0)) : [];
    const ss = ultimoDet(detDe('sat_serv', c)), sc = medir('sat_serv', c).cur;
    return `<div class="kpis">${ids.map(id => kpi(id)).join('')}</div>` + lectura(insApoyo()) +
      `<div class="grid2">` +
      panel('Cobertura de tutorías académicas', 'tut_cob', slot(el => lineChart(el, 'tut_cob'))) +
      panel('Estudiantes con beca o ayuda', 'beca_cob', slot(el => lineChart(el, 'beca_cob'))) +
      `</div><div class="grid3">` +
      panel('¿A quién llegan las becas?', 'beca_cob', hbars(gRows, { max: Math.max(25, ...gRows.map(r => r.v)), color: COL[c], tip: r => `Nivel ${r.a.toLowerCase()}: ${num(r.v, 1)} % con beca\n${num(r.n)} matriculados en el grupo` }),
        bc ? `Porcentaje con beca dentro de cada nivel · ${esc(bc.l)} · pulsa un nivel para filtrar` : '') +
      panel('Tipo de beca', 'beca_cob', hbars(tRows, { fmt: v => num(v) + ' est.', vacio: 'Menos de 5', color: '#4597bf', tip: r => r.v == null ? `${r.a}: menos de 5 estudiantes` : `${r.a}: ${num(r.v)} estudiantes` }), bc ? `Estudiantes beneficiarios · ${esc(bc.l)}` : '') +
      panel('Satisfacción con cada servicio', 'sat_serv', ss ? hbars(ss.rows, { max: 100, prev: ss.prev && mapa(ss.prev), ref: sc && sc.v, tip: r => `${r.a}\n${num(r.v, 1)} % de valoraciones de 4 o 5 · promedio ${num(r.media, 2)} de 5` }) : '',
        ss ? `${esc(lblDe(ss.k))}${ss.prevK ? ' · la flecha compara con ' + esc(lblDe(ss.prevK)) : ''}` : `Sin medición hasta ${st.anio}`) +
      `</div>` + tabla(ids);
  }

  /* ================================================================ render */
  const RENDER = { inicio: vInicio, grupos: vGrupos, investigacion: vInvest, vinculacion: vVinc, apoyo: vApoyo };
  const root = document.getElementById('vista');

  function nav() {
    document.getElementById('nav').innerHTML = VISTAS.map(v => v.sep ? '<li class="nav-sep" role="separator"></li>' :
      `<li><button type="button" class="${st.vista === v.id ? 'on' : ''}" ${v.off ? 'disabled title="Vista en preparación"' : `data-go="${v.id}"`} ${st.vista === v.id ? 'aria-current="page"' : ''}>` +
      `<svg viewBox="0 0 24 24">${IC[v.id]}</svg>${v.num ? `<span class="num">${v.num}.</span>` : ''}<span>${esc(v.nom)}</span></button></li>`).join('');
  }
  function render(scroll) {
    tipHide(); nav();
    const v = VISTAS.find(x => x.id === st.vista);
    const chips = [];
    if (st.sem) chips.push(`<button type="button" class="chip" data-quitar="sem">Periodo: ${esc(lblDe(st.sem))}<span class="x" aria-label="Quitar">×</span></button>`);
    if (st.gse) chips.push(`<button type="button" class="chip" data-quitar="gse">Nivel socioeconómico: ${esc(GSE_NOM[st.gse])}<span class="x" aria-label="Quitar">×</span></button>`);
    const head = `<div class="vhead"><div class="ic"><svg viewBox="0 0 24 24">${IC[v.id]}</svg></div><div><h2>${v.num ? v.num + '. ' : ''}${esc(v.nom)}</h2><p>${esc(v.obj)} · ${esc(NOM[st.car])}, ${esc(etiquetaCorte())}</p></div>` +
      `<div class="chips">${chips.join('')}${chips.length ? '<button type="button" class="chip-limpiar" data-quitar="todo">Quitar filtros</button>' : '<span class="chip-ayuda">Pulsa un punto, una barra o una carrera en los gráficos para filtrar todo el tablero</span>'}</div></div>`;
    pend = [];
    root.innerHTML = head + RENDER[st.vista]();
    montar(root);
    if (st.foco) {
      const k = document.getElementById('k-' + st.foco);
      if (k) { k.classList.add('flash'); if (scroll) k.scrollIntoView({ block: 'center' }); }
    } else if (scroll) window.scrollTo(0, 0);
    const h = '#' + st.vista + (st.foco ? '/' + st.foco : '') + `?c=${st.car}&a=${st.anio}` +
      (st.sem ? '&s=' + st.sem : '') + (st.gse ? '&g=' + encodeURIComponent(st.gse) : '');
    if (location.hash !== h) history.replaceState(null, '', h);
  }
  function leerHash() {
    const m = location.hash.match(/^#([a-z]+)(?:\/([a-z_]+))?(?:\?(.*))?$/);
    if (!m) return;
    if (RENDER[m[1]]) st.vista = m[1];
    st.foco = m[2] && CAT[m[2]] ? m[2] : null;
    const qs = new URLSearchParams(m[3] || '');
    if (NOM[qs.get('c')]) st.car = qs.get('c');
    if (anios.includes(+qs.get('a'))) st.anio = +qs.get('a');
    st.sem = D.periodos.some(x => x.p === qs.get('s')) ? qs.get('s') : null;
    if (st.sem) st.anio = +st.sem.slice(-4);
    st.gse = GSE_NOM[qs.get('g')] ? qs.get('g') : null;
  }

  /* ---------- filtro cruzado ---------- */
  function filtrarPeriodo(p) {
    if (esAnual(p)) { st.sem = null; st.anio = +p; }
    else if (st.sem === p) st.sem = null;          // segundo clic: quita el filtro
    else { st.sem = p; st.anio = +p.slice(-4); }
    fA.value = st.anio; render(false);
  }
  function filtrarCarrera(c) { st.car = st.car === c && c !== 'FACS' ? 'FACS' : c; fC.value = st.car; render(false); }
  function filtrarGse(g) { st.gse = st.gse === g ? null : g; render(false); }

  /* filtros */
  const fC = document.getElementById('fCarrera'), fA = document.getElementById('fAnio');
  fA.innerHTML = anios.slice().reverse().map(a => `<option value="${a}">${a}</option>`).join('');
  leerHash();
  fC.value = st.car; fA.value = st.anio;
  fC.addEventListener('change', () => { st.car = fC.value; render(false); });
  fA.addEventListener('change', () => { st.anio = +fA.value; st.sem = null; render(false); });

  document.addEventListener('click', e => {
    const go = e.target.closest('[data-go]');
    if (go) { e.preventDefault(); st.vista = go.dataset.go; st.foco = go.dataset.foco || null; render(true); return; }
    const gr = e.target.closest('[data-grupo]');
    if (gr) { grupoDet = gr.dataset.grupo; render(false); return; }
    const vi = e.target.closest('[data-vin]');
    if (vi) { vinTodos = vi.dataset.vin === '1'; render(false); return; }
    const ca = e.target.closest('.legend [data-car]');
    if (ca) { filtrarCarrera(ca.dataset.car); return; }
    const gs = e.target.closest('[data-gse]');
    if (gs) { filtrarGse(gs.dataset.gse); return; }
    const qu = e.target.closest('[data-quitar]');
    if (qu) {
      const k = qu.dataset.quitar;
      if (k === 'sem' || k === 'todo') st.sem = null;
      if (k === 'gse' || k === 'todo') st.gse = null;
      render(false);
    }
  });
  let rz; let anchoPrevio = innerWidth;
  window.addEventListener('resize', () => {  // los gráficos se dibujan al ancho real de su panel
    clearTimeout(rz); rz = setTimeout(() => { if (Math.abs(innerWidth - anchoPrevio) > 40) { anchoPrevio = innerWidth; render(false); } }, 200);
  });
  window.addEventListener('hashchange', () => { leerHash(); fC.value = st.car; fA.value = st.anio; render(true); });
  render(false);
})();
