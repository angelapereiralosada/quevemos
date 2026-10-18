"use strict";
/* ¿Qué vemos? — app para decidir qué ver entre Oswaldo, Ana y Ángela.
   Datos compartidos en Supabase (funciones protegidas con PIN), carátulas y
   disponibilidad en España desde TMDB (datos de JustWatch). Sin Supabase o sin
   TMDB funciona en modo prueba: guarda en el propio móvil y sin carátulas. */

const CFG = window.QV_CONFIG || {};
const REMOTE = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
const TMDB = !!CFG.tmdbKey;
const IMG = "https://image.tmdb.org/t/p/";

const PROFILES = [
  { id: "oswaldo", name: "Oswaldo", color: "#12b3a8" },
  { id: "ana", name: "Ana", color: "#ff5a5f" },
  { id: "angela", name: "Ángela", color: "#7b5cff" },
];
const PROF = Object.fromEntries(PROFILES.map(p => [p.id, p]));

const PLATFORMS = [
  { id: "Netflix", re: /^netflix/i },
  { id: "Prime Video", re: /^(amazon )?prime video/i },
  { id: "HBO Max", re: /^(hbo max|max)$/i },
  { id: "Disney+", re: /^disney (plus|\+)/i },
  { id: "Movistar Plus+", re: /^movistar/i },
  { id: "Atresplayer", re: /^atres ?player/i },
  { id: "Filmin", re: /^filmin/i },
  { id: "Apple TV", re: /^apple tv/i },
  { id: "SkyShowtime", re: /^skyshowtime/i },
  { id: "RTVE Play", re: /^rtve/i },
];
const DEFAULT_PLATS = ["Netflix", "Prime Video", "HBO Max", "Disney+", "Movistar Plus+", "Atresplayer"];
const OTHER_GROUP = ["Apple TV", "SkyShowtime", "Filmin"];
const PLAT_COL = { "Netflix": "#e50914", "Prime Video": "#1399ff", "HBO Max": "#5a2de5", "Disney+": "#113ccf", "Movistar Plus+": "#0b8fd6", "Atresplayer": "#ff6b00", "Filmin": "#1d1640", "Apple TV": "#1d1640", "SkyShowtime": "#2f1e6e", "RTVE Play": "#e2001a", "Otras": "#1d1640" };

const MOODS = {
  risa:       { label: "Reírnos",       c: "var(--sun)",    s: "var(--sun-soft)",    tag: "risa",       re: /(re[ií]r|risa|comedi|gracios|divertid|humor|carcajad)/, g: { movie: [35], tv: [35] }, icon: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM8.5 8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM6.8 13.5h10.4A5.4 5.4 0 0 1 12 18a5.4 5.4 0 0 1-5.2-4.5z" },
  enganche:   { label: "Engancharnos",  c: "var(--coral)",  s: "var(--coral-soft)",  tag: "enganche",   re: /(engan|adictiv|marat[oó]n|del tir[oó]n|vicio|no poder parar)/, g: { movie: [53, 9648], tv: [80, 9648, 18] }, icon: "M7 4l12 8-12 8z" },
  tension:    { label: "Tensión",       c: "var(--sky)",    s: "var(--sky-soft)",    tag: "tension",    re: /(tensi[oó]n|thriller|suspens|intriga|nervios|en vilo|polic|crimen|detective|asesin)/, g: { movie: [53, 80], tv: [80, 9648] }, icon: "M2 13h4l3-7 4 13 3-8 2 2h4v2h-5l-1-1-3 8-4-13-2 6H2z" },
  miedo:      { label: "Miedo",         c: "#3b2f6b",       s: "var(--violet-soft)", tag: "miedo",      re: /(miedo|terror|susto|halloween|asust|escalofr|zombi|fantasma)/, g: { movie: [27], tv: [9648, 10765] }, icon: "M12 2a8 8 0 0 0-8 8v12l3-2 2.5 2 2.5-2 2.5 2L17 20l3 2V10a8 8 0 0 0-8-8zm-3 7a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" },
  emocion:    { label: "Emocionarnos",  c: "var(--pink)",   s: "var(--pink-soft)",   tag: "emocion",    re: /(llorar|emoci|drama|conmov|tocar la fibra)/, g: { movie: [18], tv: [18] }, icon: "M12 2s7 7.6 7 12.5A7 7 0 0 1 5 14.5C5 9.6 12 2 12 2z" },
  desconectar:{ label: "Desconectar",   c: "var(--teal)",   s: "var(--teal-soft)",   tag: "desconectar",re: /(desconect|ligera|ligero|sin pensar|tranquil|relaj|cansad|manta|buen rollo|feel ?good)/, g: { movie: [35, 10751, 12], tv: [35, 10764] }, icon: "M3 13a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v5h-2v-2H5v2H3zM6 6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v2H6z" },
  pensar:     { label: "Pensar",        c: "var(--violet)", s: "var(--violet-soft)", tag: "pensar",     re: /(pensar|reflexi|cerebr|inteligente|original|giros|comerme la cabeza|ciencia ficci|futur|viajes en el tiempo)/, g: { movie: [878, 9648], tv: [10765, 9648] }, icon: "M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2zM9 19h6v1.5a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 20.5z" },
  amor:       { label: "Amor",          c: "#e0457b",       s: "var(--pink-soft)",   tag: "romance",    re: /(rom[aá]nt|romance|amor|enamor|pasteleo)/, g: { movie: [10749], tv: [18, 35] }, icon: "M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z" },
  accion:     { label: "Acción",        c: "#ff7a1a",       s: "#ffe9d6",            tag: "accion",     re: /(acci[oó]n|tiros|peleas|adrenalina|explosion)/, g: { movie: [28, 12], tv: [10759] }, icon: "M13 2L4 14h6l-1 8 9-12h-6z" },
  real:       { label: "Hechos reales", c: "var(--green)",  s: "var(--green-soft)",  tag: "real",       re: /(hechos reales|historia real|basad[ao] en|ver[ií]dic|true crime|caso real|document)/, g: { movie: [36, 99], tv: [99, 10768] }, icon: "M5 3h11l3 3v15H5zm3 6v2h8V9zm0 4v2h8v-2zm0 4v2h5v-2z" },
};
const AVOIDS = {
  miedo:   { label: "Miedo",        tag: "miedo",     g: { movie: [27], tv: [] },       re: /miedo|terror|sustos?/ },
  drama:   { label: "Dramones",     tag: "emocion",   g: { movie: [18], tv: [] },       re: /drama|llorar/ },
  super:   { label: "Superhéroes",  tag: "super",     kw: "9715",                         re: /superh[eé]roe|marvel|\bdc\b/ },
  anim:    { label: "Animación",    tag: "animacion", g: { movie: [16], tv: [16] },     re: /animaci|dibujos|anime/ },
  violencia:{label: "Violencia",    tag: "adulto",    g: { movie: [27, 10752], tv: [10768] }, re: /violen|sangre|gore/ },
};
const WHO = {
  solo:    { label: "Solo",       sub: "A mi aire" },
  pareja:  { label: "En pareja",  sub: "Los dos" },
  amigos:  { label: "Amigos",     sub: "En grupo" },
  familia: { label: "Con niños",  sub: "Apto para todos" },
};
const TIMES = {
  corto: { label: "Poco rato",  sub: "Peli de <1h45 o capítulos de media hora" },
  mini:  { label: "Miniserie",  sub: "Se acaba en un finde" },
  any:   { label: "Da igual",   sub: "Tenemos tiempo" },
};
const TYPES = { movie: "Película", tv: "Serie", any: "Lo que sea" };

/* ---------- utilidades ---------- */
const $ = id => document.getElementById(id);
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ").trim();
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}
const svg = (d, cls) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); if (cls) s.setAttribute("class", cls); const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", d); s.append(p); return s; };
const ICON = {
  plus: "M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z",
  check: "M9 16.2l-4.2-4.2-1.4 1.4L9 19 21 7l-1.4-1.4z",
  group: "M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3.3 2.7-6 6-6s6 2.7 6 6zm13 0c0-1.9-.6-3.6-1.7-5 .5-.1 1.1-.2 1.7-.2 3 0 5.5 2.3 5.5 5.2z",
  bookmark: "M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z",
  eye: "M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z",
  chat: "M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8l-5 4V5a1 1 0 0 1 1-1z",
  heart: "M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z",
};
const PH_COLORS = ["#ff5a5f", "#7b5cff", "#12b3a8", "#2f8cff", "#ff7a1a", "#e0457b", "#1d1640"];
const hash = s => { let x = 0; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) | 0; return Math.abs(x); };
function ago(iso) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "ahora";
  if (d < 3600) return `hace ${Math.floor(d / 60)} min`;
  if (d < 86400) return `hace ${Math.floor(d / 3600)} h`;
  if (d < 86400 * 7) return `hace ${Math.floor(d / 86400)} d`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}
let toastT;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2400); }
function avatar(id, size) { const p = PROF[id]; if (!p) return h("span"); return h("span", { class: "avatar" + (size ? " " + size : ""), style: `--c:${p.color};background:${p.color}`, title: p.name, "aria-label": p.name }, p.name[0]); }
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* ---------- estado ---------- */
const S = {
  profile: store.get("qv_profile", null),
  pin: store.get("qv_pin", null),
  plats: store.get("qv_plats", DEFAULT_PLATS),
  data: { lists: [], seen: [], comments: [], likes: [] },
  view: "home",
  homePlat: null,
  find: { type: "any", who: null, moods: [], time: "any", avoid: [], text: "" },
  results: null, page: 1, shownKeys: new Set(), shownTitles: new Set(),
  mineOf: null, mineTab: "todo", commonSort: "recent",
  trends: null, catalog: [], openKey: null,
};

/* ---------- datos compartidos ---------- */
async function rpc(fn, args) {
  const base = CFG.supabaseUrl.replace(/\/+$/, "");
  const r = await fetch(`${base}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: CFG.supabaseAnonKey, Authorization: "Bearer " + CFG.supabaseAnonKey, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const txt = await r.text();
  if (!r.ok) { let e = {}; try { e = JSON.parse(txt); } catch (_) {} const err = new Error(e.message || "Error " + r.status); err.code = e.code; throw err; }
  return txt ? JSON.parse(txt) : null;
}
const LOCAL = {
  get() { return store.get("qv_localdb", { lists: [], seen: [], comments: [], likes: [] }); },
  put(d) { store.set("qv_localdb", d); },
};
const slim = it => ({ id: it.id || null, type: it.type, title: it.title, year: it.year || "", poster: it.poster || null });
const api = {
  async login(pin) { return REMOTE ? rpc("qv_login", { p_pin: pin }) : true; },
  async state() { return REMOTE ? rpc("qv_state", { p_pin: S.pin }) : LOCAL.get(); },
  async listAdd(owner, it) {
    if (REMOTE) return rpc("qv_list_add", { p_pin: S.pin, p_owner: owner, p_key: it.key, p_item: slim(it), p_by: S.profile });
    const d = LOCAL.get(); if (!d.lists.some(x => x.owner === owner && x.key === it.key)) d.lists.unshift({ owner, key: it.key, item: slim(it), by: S.profile, at: new Date().toISOString() }); LOCAL.put(d);
  },
  async listRemove(owner, key) {
    if (REMOTE) return rpc("qv_list_remove", { p_pin: S.pin, p_owner: owner, p_key: key });
    const d = LOCAL.get(); d.lists = d.lists.filter(x => !(x.owner === owner && x.key === key)); LOCAL.put(d);
  },
  async seenToggle(it) {
    if (REMOTE) return rpc("qv_seen_toggle", { p_pin: S.pin, p_owner: S.profile, p_key: it.key, p_item: slim(it) });
    const d = LOCAL.get(); const i = d.seen.findIndex(x => x.owner === S.profile && x.key === it.key);
    if (i >= 0) { d.seen.splice(i, 1); LOCAL.put(d); return false; }
    d.seen.unshift({ owner: S.profile, key: it.key, item: slim(it), at: new Date().toISOString() });
    d.lists = d.lists.filter(x => !(x.owner === S.profile && x.key === it.key)); LOCAL.put(d); return true;
  },
  async commentAdd(it, body) {
    if (REMOTE) return rpc("qv_comment_add", { p_pin: S.pin, p_key: it.key, p_item: slim(it), p_author: S.profile, p_body: body });
    const d = LOCAL.get(); d.comments.push({ id: Date.now(), key: it.key, item: slim(it), author: S.profile, body, at: new Date().toISOString() }); LOCAL.put(d);
  },
  async commentDelete(id) {
    if (REMOTE) return rpc("qv_comment_delete", { p_pin: S.pin, p_id: id, p_author: S.profile });
    const d = LOCAL.get(); d.comments = d.comments.filter(c => c.id !== id); LOCAL.put(d);
  },
  async likeToggle(key) {
    if (REMOTE) return rpc("qv_like_toggle", { p_pin: S.pin, p_key: key, p_author: S.profile });
    const d = LOCAL.get(); const i = d.likes.findIndex(l => l.key === key && l.author === S.profile);
    if (i >= 0) d.likes.splice(i, 1); else d.likes.push({ key, author: S.profile }); LOCAL.put(d);
  },
};
async function refresh(silent) {
  try {
    const d = await api.state();
    S.data = { lists: d.lists || [], seen: d.seen || [], comments: d.comments || [], likes: d.likes || [] };
    paintBadge();
    if (!silent) rerender();
    else { if (S.view !== "find") rerender(); else if (S.openKey && !$("sheet").hidden) paintSocial(); }
  } catch (e) {
    if (e.code === "28000") { logout(true); return; }
    if (!silent) toast("No hay conexión con la base de datos. Reintento en un momento.");
  }
}
async function mutate(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); await refresh(); }
  catch (e) { toast(e.code === "28000" ? "El PIN ha cambiado. Vuelve a entrar." : "No se ha podido guardar. Revisa la conexión."); if (e.code === "28000") logout(true); }
}
const inList = (owner, key) => S.data.lists.some(x => x.owner === owner && x.key === key);
const seenBy = key => S.data.seen.filter(x => x.key === key).map(x => x.owner);
const isSeen = key => S.data.seen.some(x => x.owner === S.profile && x.key === key);
const likesOf = key => S.data.likes.filter(l => l.key === key).map(l => l.author);
const commentsOf = key => S.data.comments.filter(c => c.key === key);

/* ---------- TMDB ---------- */
const mem = new Map();
async function tmdb(path, params = {}, ttlH = 24) {
  const u = new URL("https://api.themoviedb.org/3" + path);
  if (!("language" in params)) params.language = "es-ES";
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, v);
  const ck = u.toString();
  if (mem.has(ck)) return mem.get(ck);
  const lsKey = "qv_tm:" + ck.slice(29);
  const cached = store.get(lsKey, null);
  if (cached && Date.now() - cached.t < ttlH * 3600e3) { mem.set(ck, Promise.resolve(cached.v)); return cached.v; }
  const headers = { accept: "application/json" };
  if (CFG.tmdbKey.startsWith("eyJ")) headers.Authorization = "Bearer " + CFG.tmdbKey; else u.searchParams.set("api_key", CFG.tmdbKey);
  const p = fetch(u, { headers }).then(r => { if (!r.ok) throw new Error("TMDB " + r.status); return r.json(); });
  mem.set(ck, p);
  try { const v = await p; if (ttlH > 0 && JSON.stringify(v).length < 60000) store.set(lsKey, { t: Date.now(), v }); return v; }
  catch (e) { mem.delete(ck); throw e; }
}
let qActive = 0; const qList = [];
function limit(fn) { return new Promise((res, rej) => { qList.push([fn, res, rej]); pump(); }); }
function pump() { while (qActive < 6 && qList.length) { const [fn, res, rej] = qList.shift(); qActive++; fn().then(res, rej).finally(() => { qActive--; pump(); }); } }

const RES = store.get("qv_res", {});
function keyOf(it) { return it.id ? `${it.type}:${it.id}` : `x:${it.type}:${norm(it.title)}`; }
function fromTmdb(r, type) {
  const t = type || r.media_type;
  return { id: r.id, type: t, title: r.title || r.name, year: (r.release_date || r.first_air_date || "").slice(0, 4), poster: r.poster_path, backdrop: r.backdrop_path, vote: r.vote_average, overview: r.overview, key: `${t}:${r.id}` };
}
async function resolve(it) {
  if (it.id || !TMDB) return it;
  const rk = it.type + "|" + norm(it.title);
  if (RES[rk] !== undefined) { if (RES[rk]) Object.assign(it, RES[rk], { key: `${it.type}:${RES[rk].id}` }); return it; }
  try {
    const yearParam = it.type === "movie" ? "year" : "first_air_date_year";
    let r = await limit(() => tmdb(`/search/${it.type}`, { query: it.title, [yearParam]: /^\d{4}$/.test(it.year) && +it.year < 2026 ? it.year : undefined }, 24 * 7));
    if (!r.results.length && it.year) r = await limit(() => tmdb(`/search/${it.type}`, { query: it.title }, 24 * 7));
    const best = r.results[0];
    RES[rk] = best ? { id: best.id, poster: best.poster_path, backdrop: best.backdrop_path, vote: best.vote_average, year: (best.release_date || best.first_air_date || it.year || "").slice(0, 4) } : null;
    store.set("qv_res", RES);
    if (best) Object.assign(it, RES[rk], { key: `${it.type}:${best.id}` });
  } catch (e) { /* sin red: se queda sin carátula */ }
  return it;
}
let PROV = store.get("qv_prov", null);
async function loadProviders() {
  if (!TMDB) return;
  if (PROV && Date.now() - PROV.t < 7 * 864e5) return;
  try {
    const [m, t] = await Promise.all([tmdb("/watch/providers/movie", { watch_region: "ES" }, 0), tmdb("/watch/providers/tv", { watch_region: "ES" }, 0)]);
    const map = {}, logos = {};
    for (const p of [...m.results, ...t.results]) {
      if (/channel/i.test(p.provider_name)) continue;
      const pl = PLATFORMS.find(x => x.re.test(p.provider_name.trim()));
      if (!pl) continue;
      map[p.provider_id] = pl.id;
      if (!logos[pl.id]) logos[pl.id] = p.logo_path;
    }
    PROV = { t: Date.now(), map, logos };
    store.set("qv_prov", PROV);
  } catch (e) { PROV = null; }
}
const providerIds = plats => PROV ? Object.entries(PROV.map).filter(([, p]) => plats.includes(p)).map(([id]) => id) : [];
async function itemProviders(it) {
  if (!TMDB || !it.id) return null;
  try {
    const r = await limit(() => tmdb(`/${it.type}/${it.id}/watch/providers`, {}, 12));
    const es = r.results && r.results.ES; if (!es) return { list: [], link: null };
    const seen = new Set(), list = [];
    for (const p of [...(es.flatrate || []), ...(es.ads || []), ...(es.free || [])]) {
      const plat = PROV && PROV.map[p.provider_id] || (PLATFORMS.find(x => x.re.test(p.provider_name)) || {}).id;
      const name = plat || p.provider_name;
      if (seen.has(name) || /channel/i.test(p.provider_name)) continue; seen.add(name);
      list.push({ name, logo: p.logo_path, plat });
    }
    return { list, link: es.link };
  } catch (e) { return null; }
}

/* ---------- tarjetas ---------- */
function posterEl(it, opts = {}) {
  const hv = hash(it.title), col = PH_COLORS[hv % PH_COLORS.length], col2 = PH_COLORS[(hv + 3) % PH_COLORS.length];
  const box = h("div", { class: "poster", style: `--a:${col};--b:${col2}` });
  const ph = h("div", { class: "ph" }, h("span", { class: "ph-type" }, it.type === "tv" ? "Serie" : "Película"), h("span", { class: "ph-t" }, it.title));
  box.append(ph);
  const paint = () => { if (it.poster) { const img = h("img", { src: IMG + "w342" + it.poster, alt: "", loading: "lazy" }); img.onload = () => ph.remove(); box.prepend(img); } };
  if (it.poster) paint(); else if (TMDB && !it.id) resolve(it).then(paint);
  if (opts.rank) box.append(h("span", { class: "rank" + (opts.rank <= 3 ? " hot" : "") }, opts.rank));
  const k = it.key || keyOf(it);
  if (isSeen(k)) box.append(h("span", { class: "flag seen", title: "Ya la viste" }, svg(ICON.check)));
  else if (inList(S.profile, k) || inList("comun", k)) box.append(h("span", { class: "flag saved", title: "En una lista" }, svg(ICON.bookmark)));
  box.querySelectorAll(".flag svg").forEach(s => { s.style.cssText = "width:14px;height:14px;fill:#fff"; });
  return box;
}
function tile(it, opts = {}) {
  it.key = it.key || keyOf(it);
  const sub = opts.sub !== undefined ? opts.sub : [it.type === "tv" ? "Serie" : "Película", it.year].filter(Boolean).join(" · ");
  if (opts.rank) {
    return h("button", { class: "tile ranked", onclick: () => openItem(it) },
      h("span", { class: "bignum", "aria-label": "Puesto " + opts.rank }, opts.rank),
      h("span", { class: "rk-body" }, posterEl(it, { ...opts, rank: null }), h("span", { class: "t" }, it.title)));
  }
  const b = h("button", { class: "tile", onclick: () => openItem(it) },
    posterEl(it, opts),
    h("span", { class: "t" }, it.title),
    sub ? h("span", { class: "s" }, sub) : null,
    opts.reason ? h("span", { class: "reason" }, opts.reason) : null);
  return b;
}

/* ---------- vistas ---------- */
const emptyBox = (...kids) => emptyBox( h("div", { class: "empty-art", "aria-hidden": "true" }, h("i"), h("i"), h("i")), ...kids);
function featureCard(it, label) {
  const hv = hash(it.title);
  const bg = h("div", { class: "feature-bg", style: `--a:${PH_COLORS[hv % PH_COLORS.length]};--b:${PH_COLORS[(hv + 3) % PH_COLORS.length]}` });
  const el = h("button", { class: "feature", onclick: () => openItem(it) }, bg,
    h("div", { class: "feature-in" },
      h("span", { class: "feature-tag" }, label),
      h("b", null, it.title),
      it.syn ? h("span", { class: "feature-syn" }, it.syn) : null,
      h("span", { class: "feature-cta" }, "Ver ficha")));
  const paint = () => { const img = it.backdrop || it.poster; if (img) { bg.style.backgroundImage = `url(${IMG}${it.backdrop ? "w780" : "w500"}${img})`; bg.classList.add("img"); } };
  if (it.backdrop || it.poster) paint(); else if (TMDB) resolve(it).then(paint);
  return el;
}
function rerender() {
  if (S.view === "home") renderHome();
  else if (S.view === "find") renderFind(true);
  else if (S.view === "common") renderCommon();
  else if (S.view === "mine") renderMine();
  if (S.openKey && !$("sheet").hidden) paintSocial();
}
function go(view) {
  S.view = view;
  for (const v of ["home", "find", "common", "mine"]) $("v-" + v).hidden = v !== view;
  document.querySelectorAll(".tabbar button").forEach(b => { if (b.dataset.v === view) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  rerender();
  window.scrollTo(0, 0);
}
function paintBadge() {
  const n = S.data.lists.filter(x => x.owner === "comun" && !seenBy(x.key).includes(S.profile)).length;
  const b = $("commonBadge"); b.hidden = !n; b.textContent = n;
}
const ownedTrendPlats = () => Object.keys((S.trends || {}).platforms || {}).filter(p => p === "Otras" ? OTHER_GROUP.some(o => S.plats.includes(o)) : S.plats.includes(p));

function trendItems(plat, kind) {
  const d = S.trends.platforms[plat]; if (!d) return [];
  return (kind === "tv" ? d.series : d.movies).map((r, i) => ({ title: r.title, type: r.type, year: r.year, syn: r.syn, tags: r.tags, trend: { plat, n: d.ranked ? i + 1 : null }, origin: r.origin }));
}

function renderHome() {
  const v = $("v-home"); v.replaceChildren();
  const me = PROF[S.profile];
  v.append(h("div", { class: "hello" }, h("h1", null, `Hola, ${me.name}`)));
  v.append(h("button", { class: "cta", onclick: () => go("find") },
    h("div", null, h("b", null, "¿Qué vemos hoy?"), h("span", null, "Dime el plan y te propongo títulos")), h("span", { class: "arrow", "aria-hidden": "true" }, "→")));

  const common = S.data.lists.filter(x => x.owner === "comun" && !seenBy(x.key).includes(S.profile));
  if (common.length) {
    v.append(h("div", { class: "sec-h" }, h("h2", null, "En la lista común"), h("small", null, `${common.length} pendiente${common.length > 1 ? "s" : ""}`)));
    v.append(h("div", { class: "rail" }, common.slice(0, 15).map(x => tile({ ...x.item, key: x.key }, { sub: `Añadida por ${PROF[x.by] ? PROF[x.by].name : ""}` }))));
  }

  if (S.trends) {
    const plats = ownedTrendPlats();
    if (!plats.length) {
      v.append(emptyBox( h("b", null, "Elige vuestras plataformas"), h("p", null, "Toca tu foto arriba a la derecha y marca las plataformas que tenéis."), h("button", { class: "btn solid", onclick: openSettings }, "Elegir plataformas")));
    } else {
      if (!plats.includes(S.homePlat)) S.homePlat = plats[0];
      const d = S.trends.platforms[S.homePlat];
      v.append(h("div", { class: "sec-h" }, h("h2", null, "Lo más visto esta semana")));
      v.append(h("div", { class: "pill-row" }, plats.map(p => h("button", { class: "pill", style: `--pc:${PLAT_COL[p] || "#1d1640"}`, "aria-pressed": p === S.homePlat ? "true" : "false", onclick: () => { S.homePlat = p; renderHome(); } }, h("span", { class: "dot", style: `background:${PLAT_COL[p] || "#1d1640"}` }), p === "Otras" ? "Apple TV y otras" : p))));
      const series = trendItems(S.homePlat, "tv"), movies = trendItems(S.homePlat, "movie");
      const top = series[0] || movies[0];
      if (top) v.append(featureCard(top, d.ranked ? `Nº 1 en ${S.homePlat === "Otras" ? "su plataforma" : S.homePlat}` : `Nuevo en ${S.homePlat}`));
      for (const [items, lab] of [[series[0] === top ? series.slice(1) : series, "Series"], [movies[0] === top ? movies.slice(1) : movies, "Películas"]]) {
        if (!items.length) continue;
        v.append(h("div", { class: "sec-h" }, h("h2", { class: "h3" }, lab), h("small", null, d.ranked ? "Top 10 en España" : "Estrenos destacados")));
        v.append(h("div", { class: "rail" }, items.map(it => d.ranked ? tile(it, { rank: it.trend.n }) : tile(it))));
      }
      v.append(h("p", { class: "foot" }, "Fuente: " + d.source + "."));
    }
  }

  if (TMDB && PROV) {
    const box = h("div", { class: "rail" }, Array.from({ length: 5 }, () => h("div", { class: "tile" }, h("div", { class: "poster skel" }))));
    v.append(h("div", { class: "sec-h" }, h("h2", null, "Recién estrenadas"), h("small", null, "en vuestras plataformas")), box);
    recentReleases().then(items => {
      box.replaceChildren(...(items.length ? items.map(it => tile(it, { sub: [it.type === "tv" ? "Serie" : "Película", it.vote ? "★ " + it.vote.toFixed(1) : ""].filter(Boolean).join(" · ") })) : [h("p", { class: "note" }, "No he encontrado estrenos recientes.")]));
    });
  }
  v.append(attribution());
}
async function recentReleases() {
  const ids = providerIds(S.plats).join("|"); if (!ids) return [];
  const from = new Date(Date.now() - 75 * 864e5).toISOString().slice(0, 10);
  try {
    const base = { watch_region: "ES", with_watch_providers: ids, with_watch_monetization_types: "flatrate|free|ads", sort_by: "popularity.desc" };
    const [m, t] = await Promise.all([
      tmdb("/discover/movie", { ...base, "primary_release_date.gte": from, "vote_count.gte": 15 }, 6),
      tmdb("/discover/tv", { ...base, "first_air_date.gte": from, "vote_count.gte": 5 }, 6),
    ]);
    const a = m.results.slice(0, 10).map(r => fromTmdb(r, "movie")), b = t.results.slice(0, 10).map(r => fromTmdb(r, "tv"));
    const out = []; for (let i = 0; i < 10; i++) { if (b[i]) out.push(b[i]); if (a[i]) out.push(a[i]); }
    return out.filter(it => !isSeen(it.key)).slice(0, 16);
  } catch (e) { return []; }
}
function attribution() {
  return h("p", { class: "foot" }, TMDB ? "Carátulas y datos: TMDB. Esta app usa la API de TMDB pero no está avalada ni certificada por TMDB. Dónde ver: JustWatch." : "Modo sin carátulas: añade la clave de TMDB para ver imágenes y dónde está cada título.");
}

/* ---------- Elegir ---------- */
function parseText(text) {
  const t = norm(text);
  const f = S.find = { type: "any", who: null, moods: [], time: "any", avoid: [], text };
  let pos = t;
  const NEG = /\b(?:sin|nada de|que no sea|que no tenga|no quiero|no me apetece|odio|evitar|ni)\s+([^,.;!?]+)/g;
  let m; const avoid = new Set();
  while ((m = NEG.exec(t))) { for (const [k, a] of Object.entries(AVOIDS)) if (a.re.test(m[1])) avoid.add(k); pos = pos.replace(m[0], " "); }
  const moods = Object.entries(MOODS).filter(([, x]) => x.re.test(pos)).map(([k]) => k);
  let type = /\b(peli|pelis|pelicula|peliculas|film)\b/.test(pos) ? "movie" : /\b(serie|series|temporadas?|miniserie)\b/.test(pos) ? "tv" : null;
  let who = /(ninos|ninas|peques|hijos|hijas|familia|crios)/.test(pos) ? "familia" : /(pareja|novi[oa]|mi mujer|mi marido|los dos|las dos)/.test(pos) ? "pareja" : /(amig|colegas|grupo)/.test(pos) ? "amigos" : /\b(solo|sola)\b/.test(pos) ? "solo" : null;
  let time = /(miniserie|pocos capitulos|de un tiron|en un finde|serie corta|series cortas)/.test(pos) ? "mini" : /(corta|cortita|poco tiempo|rapida|hora y media|que no dure)/.test(pos) ? "corto" : null;
  const lang = /(espanol|espanola|espanolas|de aqui|nacional)/.test(pos) ? "es" : /(corean|japon|asiatic|anime)/.test(pos) ? "asia" : null;
  const like = (() => { const mm = pos.match(/(?:como|parecid[ao]s? a|tipo|estilo|al estilo de)\s+(.+)/); return mm ? mm[1].trim() : null; })();
  const fresh = /(nuev|reciente|estreno|tendencia|de moda|mas vist|esta semana)/.test(pos);
  const recognized = moods.length || type || who || time || avoid.size || lang || like || fresh;
  if (moods.length) f.moods = moods; if (type) f.type = type; if (who) f.who = who; if (time) { f.time = time; if (time === "mini") f.type = "tv"; }
  if (avoid.size) f.avoid = [...avoid];
  f.lang = lang; f.like = like; f.fresh = fresh;
  return { recognized, raw: text.trim() };
}
function renderFind(keepResults) {
  const v = $("v-find"); v.replaceChildren();
  const f = S.find;
  v.append(h("div", { class: "hello" }, h("h1", null, "¿Qué os apetece?")));
  const inp = h("input", { id: "askInput", type: "text", autocomplete: "off", enterkeyhint: "search", placeholder: "Ej.: algo de risa y corto, o «como Fariña»", value: f.text || "" });
  v.append(h("form", { class: "askbox", onsubmit: e => { e.preventDefault(); f.text = inp.value; const p = parseText(inp.value); renderFind(); run(p); } }, inp, h("button", { type: "submit" }, "Buscar")));

  const step = (title, cls, entries, isOn, onTap) => h("div", { class: "step" }, h("h3", null, title),
    h("div", { class: "choices " + cls }, entries.map(([k, x]) => h("button", { class: "choice", style: x.c ? `--c:${x.c};--c2:${x.s}` : "", "aria-pressed": isOn(k) ? "true" : "false", onclick: () => { onTap(k); renderFind(true); } },
      x.icon ? h("span", { class: "ic" }, svg(x.icon)) : null, x.label, x.sub ? h("small", null, x.sub) : null))));

  v.append(step("El plan · elige uno o varios", "moods", Object.entries(MOODS), k => f.moods.includes(k), k => { f.moods = f.moods.includes(k) ? f.moods.filter(x => x !== k) : [...f.moods, k]; }));
  const seg = (title, entries, isOn, onTap) => h("div", { class: "step" }, h("h3", null, title), h("div", { class: "seg-pills" }, entries.map(([k, l]) =>
    h("button", { class: "pill", "aria-pressed": isOn(k) ? "true" : "false", onclick: () => { onTap(k); renderFind(true); } }, l))));
  v.append(seg("Qué", Object.entries(TYPES), k => f.type === k, k => { f.type = k; if (k === "movie" && f.time === "mini") f.time = "any"; }));
  v.append(seg("Con quién", Object.entries(WHO).map(([k, x]) => [k, x.label]), k => f.who === k, k => { f.who = f.who === k ? null : k; }));
  v.append(seg("Tiempo", Object.entries(TIMES).map(([k, x]) => [k, x.label]), k => f.time === k, k => { f.time = k; if (k === "mini") f.type = "tv"; }));
  v.append(h("div", { class: "step" }, h("h3", null, "Nada de"), h("div", { class: "filters" }, Object.entries(AVOIDS).map(([k, a]) =>
    h("button", { class: "pill", "aria-pressed": f.avoid.includes(k) ? "true" : "false", onclick: () => { f.avoid = f.avoid.includes(k) ? f.avoid.filter(x => x !== k) : [...f.avoid, k]; renderFind(true); } }, a.label)))));
  v.append(h("button", { class: "go", id: "goBtn", onclick: () => { f.text = ""; f.like = null; run({ recognized: true }); } }, "Ver propuestas"));
  const res = h("div", { id: "results", class: "view" });
  v.append(res);
  if (keepResults && S.results) paintResults();
}
function summaryText() {
  const f = S.find, bits = [];
  bits.push(f.type === "movie" ? "películas" : f.type === "tv" ? (f.time === "mini" ? "miniseries" : "series") : "pelis y series");
  if (f.moods.length) bits.push("para " + f.moods.map(m => MOODS[m].label.toLowerCase()).join(", "));
  if (f.who) bits.push({ solo: "para ver solo", pareja: "para ver en pareja", amigos: "para ver con amigos", familia: "aptas para niños" }[f.who]);
  if (f.time === "corto") bits.push("cortas");
  if (f.lang === "es") bits.push("españolas");
  if (f.avoid.length) bits.push("sin " + f.avoid.map(a => AVOIDS[a].label.toLowerCase()).join(" ni "));
  if (f.like) bits.push(`parecidas a «${f.like}»`);
  return bits.join(", ");
}
async function run(p, more) {
  const f = S.find;
  if (!more) { S.page = 1; S.shownKeys = new Set(); S.shownTitles = new Set(); }
  const btn = $("goBtn"); if (btn) { btn.disabled = true; btn.textContent = "Buscando…"; }
  S.results = { loading: true, items: [], title: null };
  paintResults();
  $("results").scrollIntoView({ behavior: "smooth", block: "start" });
  let items = [];
  try {
    if (p && p.raw && !p.recognized && TMDB) {
      const r = await tmdb("/search/multi", { query: p.raw }, 6);
      items = r.results.filter(x => x.media_type === "movie" || x.media_type === "tv").slice(0, 12).map(x => fromTmdb(x));
      S.results = { items: items.map(it => ({ it })), title: `Resultados para «${p.raw}»`, search: true };
    } else {
      items = await recommend(more);
      S.results = { items, title: summaryText() };
    }
  } catch (e) {
    S.results = { items: [], title: summaryText(), error: true };
  }
  if (btn) { btn.disabled = false; btn.textContent = "Ver propuestas"; }
  await Promise.all(S.results.items.map(async r => { r.prov = await itemProviders(r.it); }));
  S.results.items.forEach(r => { S.shownKeys.add(r.it.key); S.shownTitles.add(r.it.type + norm(r.it.title)); });
  paintResults();
}
function catScore(c, f) {
  const plats = PLATFORMS.map(p => p.id).filter(p => c.platforms.includes(p));
  if (!plats.some(p => S.plats.includes(p))) return -1;
  if (f.type !== "any" && c.type !== f.type) return -1;
  if (f.time === "mini" && !c.tags.includes("mini")) return -1;
  if (f.who === "familia" && !c.tags.includes("familia")) return -1;
  for (const a of f.avoid) if (c.tags.includes(AVOIDS[a].tag)) return -1;
  if (f.lang === "es" && c.origin !== "es") return -1;
  const hits = f.moods.filter(m => c.tags.includes(MOODS[m].tag)).length;
  if (f.moods.length && !hits) return -1;
  let s = c.q + hits * 2;
  if (f.who === "pareja" && c.tags.some(t => ["romance", "risa", "enganche", "tension"].includes(t))) s += .5;
  if (f.who !== "familia" && c.tags.includes("familia")) s -= 2;
  if (f.time === "corto" && c.type === "movie" && parseInt(c.dur) > 115) s -= 2;
  return s + Math.random() * 1.2;
}
function whyFor(c, f) {
  const parts = f.moods.filter(m => c.tags && c.tags.includes(MOODS[m].tag)).map(m => MOODS[m].label);
  if (c.tags && c.tags.includes("mini")) parts.push("Miniserie");
  if (c.tags && c.tags.includes("galicia")) parts.push("Rodada en Galicia");
  return parts.length ? parts.join(" · ") : null;
}
async function recommend(more) {
  const f = S.find, out = [], used = new Set(S.shownKeys);
  const push = (it, reason, extra) => { it.key = it.key || keyOf(it); if (used.has(it.key) || isSeen(it.key) || S.shownTitles.has(it.type + norm(it.title))) return; used.add(it.key); out.push({ it, reason, ...extra }); };

  // 1) "Como X": títulos parecidos según TMDB
  if (f.like && TMDB) {
    const s = await tmdb("/search/multi", { query: f.like }, 24);
    const base = s.results.find(x => x.media_type === "movie" || x.media_type === "tv");
    if (base) {
      const rec = await tmdb(`/${base.media_type}/${base.id}/recommendations`, { page: S.page }, 24);
      const items = rec.results.filter(x => x.media_type === "movie" || x.media_type === "tv").map(x => fromTmdb(x));
      const withProv = await Promise.all(items.slice(0, 20).map(async it => ({ it, prov: await itemProviders(it) })));
      withProv.filter(x => x.prov && x.prov.list.some(p => S.plats.includes(p.plat))).slice(0, 10).forEach(x => push(x.it, `Parecida a ${base.title || base.name}`));
      if (out.length >= 4) return out;
    }
  }

  // 2) Tendencias de esta semana que encajan
  if (S.trends) {
    const tr = [];
    for (const p of ownedTrendPlats()) for (const kind of ["tv", "movie"]) trendItems(p, kind).forEach(it => tr.push(it));
    tr.filter(it => (f.type === "any" || it.type === f.type) && (!f.moods.length || f.moods.some(m => it.tags.includes(MOODS[m].tag))) && !f.avoid.some(a => it.tags.includes(AVOIDS[a].tag)) && (f.lang !== "es" || it.origin === "es") && (f.who === "familia" ? it.tags.includes("familia") : !it.tags.includes("familia") || f.moods.length === 0) && (f.time !== "mini" || it.tags.includes("mini")))
      .sort((a, b) => (a.trend.n || 9) - (b.trend.n || 9)).slice(0, f.fresh ? 6 : 2)
      .forEach(it => push(it, it.trend.n ? `Nº ${it.trend.n} en ${it.trend.plat === "Otras" ? "su plataforma" : it.trend.plat} esta semana` : `Estreno en ${it.trend.plat}`, { trend: true }));
  }

  // 3) Selección de la casa (títulos fiables de cada plataforma)
  const cat = S.catalog.map(c => [c, catScore(c, f)]).filter(x => x[1] >= 0).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  cat.filter(c => !S.shownTitles.has(c.type + norm(c.title))).slice(0, TMDB ? 3 : 10).forEach(c => push({ title: c.title, type: c.type, year: String(c.year), syn: c.syn, tags: c.tags }, whyFor(c, f) || "Imprescindible de la plataforma"));

  if (out.length < 4) {
    const f2 = { ...f, time: "any" };
    S.catalog.map(c => [c, catScore(c, f2)]).filter(x => x[1] >= 0).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .forEach(([c]) => push({ title: c.title, type: c.type, year: String(c.year), syn: c.syn, tags: c.tags }, whyFor(c, f2) || "Imprescindible de la plataforma"));
  }

  // 4) Catálogo real de vuestras plataformas en España (TMDB)
  if (TMDB && PROV) {
    const ids = providerIds(S.plats).join("|");
    const types = f.type === "any" ? ["tv", "movie"] : [f.type];
    const lists = await Promise.all(types.map(type => discover(type, ids)));
    const merged = []; for (let i = 0; i < 20; i++) for (const l of lists) if (l[i]) merged.push(l[i]);
    merged.forEach(it => push(it, it.vote ? `★ ${it.vote.toFixed(1)} en TMDB` : null));
  }
  await Promise.all(out.map(r => resolve(r.it)));
  // la resolución puede descubrir duplicados
  const seenK = new Set(); return out.filter(r => { r.it.key = r.it.key || keyOf(r.it); if (seenK.has(r.it.key) || isSeen(r.it.key)) return false; seenK.add(r.it.key); return true; }).slice(0, 12);
}
async function discover(type, ids) {
  const f = S.find; if (!ids) return [];
  const genres = new Set(), without = new Set(); let kw;
  f.moods.forEach(m => MOODS[m].g[type].forEach(g => genres.add(g)));
  f.avoid.forEach(a => { const x = AVOIDS[a]; if (x.g) (x.g[type] || []).forEach(g => without.add(g)); if (x.kw) kw = x.kw; });
  const params = { watch_region: "ES", with_watch_providers: ids, with_watch_monetization_types: "flatrate|free|ads", sort_by: "popularity.desc", page: S.page,
    "vote_count.gte": type === "movie" ? 250 : 120, "vote_average.gte": 6.6 };
  if (f.who === "familia") { (type === "movie" ? [10751, 16] : [10762, 10751, 16]).forEach(g => genres.add(g)); [27, 53, 80].forEach(g => without.add(g)); }
  genres.forEach(g => without.delete(g));
  if (genres.size) params.with_genres = [...genres].join("|");
  if (without.size) params.without_genres = [...without].join(",");
  if (kw) params.without_keywords = kw;
  if (f.time === "corto") params["with_runtime.lte"] = type === "movie" ? 105 : 35;
  if (f.time === "mini" && type === "tv") params.with_type = 2;
  if (f.lang === "es") params.with_original_language = "es";
  if (f.lang === "asia") params.with_original_language = "ko|ja";
  if (f.fresh) { params.sort_by = "popularity.desc"; params[type === "movie" ? "primary_release_date.gte" : "first_air_date.gte"] = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10); params["vote_count.gte"] = 30; }
  try { const r = await tmdb(`/discover/${type}`, params, 6); return shuffle(r.results.slice(0, 14)).map(x => fromTmdb(x, type)); }
  catch (e) { return []; }
}
function paintResults() {
  const box = $("results"); if (!box || !S.results) return;
  box.replaceChildren();
  const r = S.results;
  if (r.loading) { box.append(h("div", { class: "grid" }, Array.from({ length: 6 }, () => h("div", { class: "tile" }, h("div", { class: "poster skel" }))))); return; }
  box.append(h("div", { class: "result-head" },
    h("p", null, r.search ? r.title : h("span", null, "Te propongo ", h("b", null, r.title || "algo variado"), ` en ${S.plats.length === 1 ? S.plats[0] : "vuestras plataformas"}.`)),
    r.items.length ? h("div", { class: "result-actions" },
      r.search ? null : h("button", { class: "btn violet", onclick: () => { S.page++; run(null, true); } }, "Otras ideas"),
      h("button", { class: "btn", onclick: () => window.scrollTo({ top: 0, behavior: "smooth" }) }, "Cambiar el plan")) : null));
  if (!r.items.length) {
    box.append(emptyBox( h("b", null, r.error ? "No he podido buscar" : "Nada encaja del todo"),
      h("p", null, r.error ? "Revisa la conexión y vuelve a probar." : "Quita algún filtro o añade plataformas en tu perfil.")));
    return;
  }
  box.append(h("div", { class: "grid" }, r.items.map(x => {
    const own = x.prov && x.prov.list.filter(p => S.plats.includes(p.plat)).map(p => p.plat);
    const where = own && own.length ? own.slice(0, 2).join(" · ") : null;
    return tile(x.it, { sub: [where || (x.it.type === "tv" ? "Serie" : "Película"), x.it.year].filter(Boolean).join(" · "), reason: x.reason });
  })));
}

/* ---------- Común ---------- */
function renderCommon() {
  const v = $("v-common"); v.replaceChildren();
  v.append(h("div", { class: "hello" }, h("h1", null, "Lista común")));
  let items = S.data.lists.filter(x => x.owner === "comun");
  v.append(h("div", { class: "filters" }, [["recent", "Recientes"], ["votes", "Más apetecibles"], ["seen", "Ya vistas"]].map(([k, l]) =>
    h("button", { class: "pill", "aria-pressed": S.commonSort === k ? "true" : "false", onclick: () => { S.commonSort = k; renderCommon(); } }, l))));
  const allSeen = k => PROFILES.every(p => seenBy(k).includes(p.id));
  if (S.commonSort === "seen") items = items.filter(x => seenBy(x.key).length);
  else items = items.filter(x => !allSeen(x.key));
  if (S.commonSort === "votes") items = [...items].sort((a, b) => likesOf(b.key).length - likesOf(a.key).length || commentsOf(b.key).length - commentsOf(a.key).length);
  if (!items.length) {
    v.append(emptyBox( h("b", null, S.commonSort === "seen" ? "Aún no habéis visto ninguna" : "La lista común está vacía"),
      h("p", null, "Abre cualquier título y pulsa «Común» para añadirlo. Así los tres podéis votar y comentar."),
      h("button", { class: "btn coral", onclick: () => go("find") }, "Buscar algo")));
    return;
  }
  v.append(h("div", { class: "rows" }, items.map(x => {
    const it = { ...x.item, key: x.key }, lk = likesOf(x.key), cm = commentsOf(x.key), sb = seenBy(x.key);
    const last = cm[cm.length - 1];
    return h("button", { class: "row", onclick: () => openItem(it) },
      posterEl(it),
      h("div", null,
        h("h3", null, it.title),
        h("div", { class: "meta" }, [it.type === "tv" ? "Serie" : "Película", it.year, PROF[x.by] ? `añadida por ${PROF[x.by].name}` : ""].filter(Boolean).join(" · ")),
        h("div", { class: "bottom" },
          lk.length ? h("span", { class: "mini-stat" }, h("span", { class: "stack" }, lk.map(a => avatar(a, "xs"))), `le apetece`) : h("span", { class: "mini-stat" }, svg(ICON.heart), "Nadie ha votado"),
          h("span", { class: "mini-stat" }, svg(ICON.chat), cm.length),
          sb.length ? h("span", { class: "mini-stat" }, svg(ICON.eye), h("span", { class: "stack" }, sb.map(a => avatar(a, "xs")))) : null),
        last ? h("div", { class: "last-comment" }, h("b", null, (PROF[last.author] || {}).name + ": "), last.body) : null));
  })));
}

/* ---------- Mi lista ---------- */
function renderMine() {
  const v = $("v-mine"); v.replaceChildren();
  const who = S.mineOf || S.profile, p = PROF[who], mine = who === S.profile;
  v.append(h("div", { class: "hello" }, h("h1", null, mine ? "Mi lista" : `Lista de ${p.name}`)));
  v.append(h("div", { class: "filters" }, PROFILES.map(x => h("button", { class: "pill", "aria-pressed": x.id === who ? "true" : "false", onclick: () => { S.mineOf = x.id; renderMine(); } }, avatar(x.id, "xs"), x.id === S.profile ? "Yo" : x.name))));
  const todo = S.data.lists.filter(x => x.owner === who);
  const done = S.data.seen.filter(x => x.owner === who);
  v.append(h("div", { class: "seg" },
    h("button", { "aria-pressed": S.mineTab === "todo" ? "true" : "false", onclick: () => { S.mineTab = "todo"; renderMine(); } }, `Pendientes (${todo.length})`),
    h("button", { "aria-pressed": S.mineTab === "done" ? "true" : "false", onclick: () => { S.mineTab = "done"; renderMine(); } }, `Vistas (${done.length})`)));
  const arr = S.mineTab === "todo" ? todo : done;
  if (!arr.length) {
    v.append(emptyBox( h("b", null, S.mineTab === "todo" ? "Nada pendiente" : "Nada visto todavía"),
      h("p", null, S.mineTab === "todo" ? "Abre un título y pulsa «Mi lista» para guardarlo aquí." : "Cuando marques algo como visto aparecerá aquí y no te lo volveré a proponer."),
      mine && S.mineTab === "todo" ? h("button", { class: "btn coral", onclick: () => go("find") }, "Buscar algo") : null));
    return;
  }
  v.append(h("div", { class: "grid" }, arr.map(x => tile({ ...x.item, key: x.key }))));
}

/* ---------- Detalle ---------- */
function openSheet(node) {
  $("sheetBody").replaceChildren(node);
  $("sheet").hidden = false; $("scrim").hidden = false;
  $("sheet").scrollTop = 0;
  document.body.style.overflow = "hidden";
}
function closeSheet() { $("sheet").hidden = true; $("scrim").hidden = true; S.openKey = null; document.body.style.overflow = ""; }
let currentItem = null, openTok = 0;
async function openItem(it) {
  it.key = it.key || keyOf(it);
  const tok = ++openTok;
  currentItem = it; S.openKey = it.key;
  const wrap = h("div", { class: "sheet-body", style: "padding:0;gap:16px;display:flex;flex-direction:column" });
  openSheet(wrap);
  const draw = (det, prov) => {
    wrap.replaceChildren();
    const back = det && det.backdrop_path || it.backdrop;
    if (back) wrap.append(h("div", { class: "hero", style: `background-image:url(${IMG}w780${back})` }));
    const year = it.year || (det && (det.release_date || det.first_air_date || "").slice(0, 4));
    const runtime = det && (det.runtime ? `${Math.floor(det.runtime / 60)} h ${det.runtime % 60} min` : det.number_of_seasons ? `${det.number_of_seasons} temporada${det.number_of_seasons > 1 ? "s" : ""}` : "");
    const vote = (det && det.vote_average) || it.vote;
    wrap.append(h("div", { class: "dhead" + (back ? "" : " noimg") }, posterEl(it),
      h("div", null, h("h2", null, it.title), h("div", { class: "meta" }, [it.type === "tv" ? "Serie" : "Película", year, runtime, vote ? "★ " + Number(vote).toFixed(1) : ""].filter(Boolean).join(" · ")))));
    if (det && det.genres && det.genres.length) wrap.append(h("div", { class: "tags" }, det.genres.map(g => h("span", { class: "tag" }, g.name))));
    const ov = (det && det.overview) || it.syn || it.overview;
    if (ov) wrap.append(h("p", { class: "overview" }, ov));
    // acciones
    const acts = h("div", { class: "actions", id: "acts" });
    wrap.append(acts);
    // dónde verla
    const where = h("div", { class: "where" }, h("h4", null, "Dónde verla en España"));
    if (prov && prov.list.length) where.append(h("div", { class: "provs" }, prov.list.map(p => h("span", { class: "prov" + (S.plats.includes(p.plat) ? " own" : "") }, p.logo ? h("img", { src: IMG + "w92" + p.logo, alt: "" }) : null, p.name))),
      h("p", { class: "note" }, "En verde, las que tenéis. Datos de JustWatch vía TMDB."));
    else if (prov) where.append(h("p", { class: "note" }, "Ahora mismo no está en ninguna plataforma de suscripción en España."));
    else if (it.trend) where.append(h("p", { class: "note" }, `Está en ${it.trend.plat === "Otras" ? "Apple TV, SkyShowtime o Filmin" : it.trend.plat}.`));
    wrap.append(where);
    const trailer = det && det.videos && det.videos.results.find(v => v.site === "YouTube" && /Trailer|Teaser/i.test(v.type));
    wrap.append(h("div", { class: "links" },
      trailer ? h("a", { href: "https://www.youtube.com/watch?v=" + trailer.key, target: "_blank", rel: "noopener" }, "▶ Ver tráiler") : null,
      h("a", { href: (prov && prov.link) || "https://www.justwatch.com/es/buscar?q=" + encodeURIComponent(it.title), target: "_blank", rel: "noopener" }, "JustWatch ↗"),
      h("a", { href: "https://www.filmaffinity.com/es/search.php?stext=" + encodeURIComponent(it.title), target: "_blank", rel: "noopener" }, "FilmAffinity ↗")));
    wrap.append(h("div", { class: "likes", id: "likesBox" }));
    wrap.append(h("div", { class: "comments", id: "cmtBox" }));
    paintSocial();
  };
  draw(null, null);
  if (TMDB) {
    await resolve(it);
    if (it.id) {
      try {
        const det = await tmdb(`/${it.type}/${it.id}`, { append_to_response: "videos,watch/providers", include_video_language: "es,en" }, 12);
        const es = det["watch/providers"] && det["watch/providers"].results && det["watch/providers"].results.ES;
        const prov = await itemProviders(it);
        if (tok === openTok && !$("sheet").hidden) { S.openKey = it.key; draw(det, prov || (es ? { list: [], link: es.link } : { list: [] })); }
      } catch (e) { /* se queda la versión básica */ }
    }
  }
}
function paintSocial() {
  const it = currentItem; if (!it) return;
  const acts = $("acts"), lb = $("likesBox"), cb = $("cmtBox"); if (!acts) return;
  const k = it.key, mineOn = inList(S.profile, k), comOn = inList("comun", k), seenOn = isSeen(k);
  acts.replaceChildren(
    h("button", { class: "btn" + (mineOn ? " on" : ""), onclick: () => mutate(() => mineOn ? api.listRemove(S.profile, k) : api.listAdd(S.profile, it), mineOn ? "Quitada de tu lista" : "Guardada en tu lista") }, svg(mineOn ? ICON.check : ICON.bookmark), mineOn ? "En mi lista" : "Mi lista"),
    h("button", { class: "btn" + (comOn ? " on" : ""), onclick: () => mutate(() => comOn ? api.listRemove("comun", k) : api.listAdd("comun", it), comOn ? "Quitada de la común" : "Añadida a la lista común") }, svg(comOn ? ICON.check : ICON.group), comOn ? "En la común" : "Común"),
    h("button", { class: "btn" + (seenOn ? " on" : ""), onclick: () => mutate(() => api.seenToggle(it), seenOn ? "Desmarcada" : "Marcada como vista") }, svg(seenOn ? ICON.check : ICON.eye), seenOn ? "Vista" : "Ya la vi"));
  const lk = likesOf(k), iLike = lk.includes(S.profile), sb = seenBy(k);
  lb.replaceChildren(...[
    h("button", { class: "btn" + (iLike ? " coral" : ""), onclick: () => mutate(() => api.likeToggle(k)) }, svg(ICON.heart), iLike ? "Me apetece" : "¿Te apetece?"),
    lk.length ? h("span", { class: "mini-stat" }, h("span", { class: "stack" }, lk.map(a => avatar(a, "xs"))), lk.length === 1 ? `a ${PROF[lk[0]].name}` : "") : null,
    sb.length ? h("span", { class: "mini-stat" }, svg(ICON.eye), "Vista por ", sb.map(a => PROF[a].name).join(", ")) : null].filter(Boolean));
  lb.querySelectorAll(".btn svg").forEach(s => { s.style.cssText = "width:18px;height:18px;fill:currentColor"; });
  const cms = commentsOf(k);
  const ta = cb.querySelector("textarea"); const draft = ta ? ta.value : "";
  const focus = ta && document.activeElement === ta;
  const box = h("textarea", { id: "cmtInput", rows: "1", maxlength: "1000", placeholder: `Escribe un comentario como ${PROF[S.profile].name}…` });
  box.value = draft;
  box.addEventListener("input", () => { box.style.height = "auto"; box.style.height = Math.min(140, box.scrollHeight) + "px"; });
  const send = async () => { const t = box.value.trim(); if (!t) return; box.value = ""; await mutate(() => api.commentAdd(it, t)); };
  cb.replaceChildren(h("h4", null, `Comentarios${cms.length ? " (" + cms.length + ")" : ""}`),
    ...(cms.length ? cms.map(c => h("div", { class: "cmt" }, avatar(c.author, "sm"), h("div", { class: "bub" }, h("b", null, PROF[c.author].name), h("time", null, ago(c.at)), h("p", null, c.body),
      c.author === S.profile ? h("button", { class: "del", onclick: () => mutate(() => api.commentDelete(c.id), "Comentario borrado") }, "Borrar") : null))) : [h("p", { class: "note" }, "Nadie ha comentado aún. ¿Qué os parece?")]),
    h("div", { class: "cbox" }, box, h("button", { onclick: send }, "Enviar")));
  if (focus) box.focus();
}

/* ---------- Ajustes ---------- */
function openSettings() {
  const me = PROF[S.profile];
  const body = h("div", { class: "settings" },
    h("div", { style: "display:flex;align-items:center;gap:12px" }, avatar(S.profile), h("div", null, h("h2", null, me.name), h("p", { class: "note" }, REMOTE ? "Conectado a la base de datos de casa" : "Modo prueba: los datos se guardan solo en este móvil"))),
    h("div", { class: "step" }, h("h3", null, "Plataformas que tenéis"),
      h("div", { class: "plats" }, PLATFORMS.map(p => h("button", { class: "pill", "aria-pressed": S.plats.includes(p.id) ? "true" : "false", onclick: e => {
        S.plats = S.plats.includes(p.id) ? S.plats.filter(x => x !== p.id) : [...S.plats, p.id]; store.set("qv_plats", S.plats);
        e.currentTarget.setAttribute("aria-pressed", S.plats.includes(p.id) ? "true" : "false"); rerender(); } },
        PROV && PROV.logos[p.id] ? h("img", { src: IMG + "w45" + PROV.logos[p.id], alt: "", style: "width:20px;height:20px;border-radius:5px" }) : null, p.id))),
      h("p", { class: "note" }, "Se guarda en este móvil. Las propuestas solo incluyen estas plataformas.")),
    h("div", { class: "result-actions" },
      h("button", { class: "btn", onclick: () => { closeSheet(); logout(false); } }, "Cambiar de perfil"),
      REMOTE ? h("button", { class: "btn", onclick: () => { closeSheet(); logout(true); } }, "Salir") : null),
    h("p", { class: "note" }, "Para instalarla como app: en el iPhone, Compartir → «Añadir a pantalla de inicio»; en Android, menú ⋮ → «Instalar aplicación»."),
    attribution());
  openSheet(body);
}

/* ---------- Entrada ---------- */
let pinBuf = "", chosen = null;
function showLogin(needPin) {
  $("app").hidden = true; $("login").hidden = false;
  const who = $("who"); who.replaceChildren(...PROFILES.map(p => h("button", { style: `--c:${p.color}`, "aria-pressed": chosen === p.id ? "true" : "false", onclick: () => pick(p.id) }, avatar(p.id), p.name)));
  $("pinbox").hidden = !(chosen && needPin);
}
function pick(id) {
  chosen = id;
  if (REMOTE && !S.pin) { showLogin(true); paintPin(); return; }
  enter(id);
}
function paintPin(err) {
  $("pindots").querySelectorAll("i").forEach((d, i) => d.classList.toggle("on", i < pinBuf.length));
  $("pinerr").textContent = err || "";
}
function buildKeypad() {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
  $("keypad").replaceChildren(...keys.map(k => k === "" ? h("span") : h("button", { class: k === "⌫" ? "ghost" : "", "aria-label": k === "⌫" ? "Borrar" : k, onclick: () => key(k) }, k)));
}
async function key(k) {
  if (k === "⌫") { pinBuf = pinBuf.slice(0, -1); paintPin(); return; }
  if (pinBuf.length >= 4) return;
  pinBuf += k; paintPin();
  if (pinBuf.length === 4) {
    try {
      const ok = await api.login(pinBuf);
      if (!ok) { pinBuf = ""; paintPin("PIN incorrecto"); return; }
      S.pin = pinBuf; store.set("qv_pin", S.pin); pinBuf = ""; enter(chosen);
    } catch (e) { pinBuf = ""; paintPin("No hay conexión. Prueba otra vez."); }
  }
}
function enter(id) {
  S.profile = id; store.set("qv_profile", id); S.mineOf = null;
  $("login").hidden = true; $("app").hidden = false;
  $("meBtn").replaceChildren(avatar(id, "sm"));
  go("home");
  refresh();
}
function logout(forgetPin) {
  if (forgetPin) { S.pin = null; store.del("qv_pin"); }
  S.profile = null; store.del("qv_profile"); chosen = null; pinBuf = "";
  showLogin(false);
}

/* ---------- arranque ---------- */
async function boot() {
  buildKeypad();
  document.querySelectorAll(".tabbar button").forEach(b => b.addEventListener("click", () => go(b.dataset.v)));
  $("goHome").onclick = () => go("home");
  $("meBtn").onclick = openSettings;
  $("sheetClose").onclick = closeSheet; $("scrim").onclick = closeSheet;
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("sheet").hidden) closeSheet(); });
  const day = new Date().toISOString().slice(0, 10);
  const [tr, cat] = await Promise.all([
    fetch("data/trends.json?d=" + day).then(r => r.json()).catch(() => null),
    fetch("data/catalog.json?d=" + day).then(r => r.json()).catch(() => []),
    loadProviders(),
  ]);
  S.trends = tr; S.catalog = cat;
  if (S.profile && (!REMOTE || S.pin)) enter(S.profile); else showLogin(false);
  setInterval(() => { if (S.profile && document.visibilityState === "visible") refresh(true); }, 25000);
  document.addEventListener("visibilitychange", () => { if (S.profile && document.visibilityState === "visible") refresh(true); });
}
boot();
