"use strict";
/* ¿Qué vemos? v3 — Oswaldo, Ana y Ángela.
   - Descubrir: tarjetas para deslizar; aprende los gustos de cada uno (géneros de lo que guarda,
     ve o descarta) y mezcla recomendaciones de TMDB, lo que les apetece a los demás y el top semanal.
   - Chat con IA (Claude) a través de una función de Supabase que guarda la clave.
   - Mi lista, lista de Todos con comentarios.
   Datos compartidos en Supabase con PIN; sin Supabase guarda en el propio móvil. */

const CFG = window.QV_CONFIG || {};
const REMOTE = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
const TMDB = !!CFG.tmdbKey;
const IMG = "https://image.tmdb.org/t/p/";

const PROFILES = [
  { id: "oswaldo", name: "Oswaldo", color: "#16a39a" },
  { id: "ana", name: "Ana", color: "#ff5436" },
  { id: "angela", name: "Ángela", color: "#4a6bff" },
];
const PROF = Object.fromEntries(PROFILES.map(p => [p.id, p]));
const PLATFORMS = [
  { id: "Netflix", re: /^netflix$/i, c: "#e50914" },
  { id: "Prime Video", re: /^(amazon )?prime video$/i, c: "#1399ff" },
  { id: "HBO Max", re: /^(hbo max|max)$/i, c: "#5a2de5" },
  { id: "Disney+", re: /^disney (plus|\+)$/i, c: "#113ccf" },
  { id: "Movistar Plus+", re: /^movistar/i, c: "#0b8fd6" },
  { id: "Atresplayer", re: /^atres ?player/i, c: "#ff6b00" },
  { id: "Filmin", re: /^filmin$/i, c: "#111216" },
  { id: "Apple TV", re: /^apple tv/i, c: "#111216" },
  { id: "SkyShowtime", re: /^skyshowtime$/i, c: "#2f1e6e" },
  { id: "RTVE Play", re: /^rtve/i, c: "#e2001a" },
];
const PCOL = Object.fromEntries(PLATFORMS.map(p => [p.id, p.c]));
PCOL.Otras = "#111216";
const DEFAULT_PLATS = ["Netflix", "Prime Video", "HBO Max", "Disney+", "Movistar Plus+", "Atresplayer"];
const OTHER_GROUP = ["Apple TV", "SkyShowtime", "Filmin"];
const GENRE = { 28: "acción", 12: "aventuras", 16: "animación", 35: "comedia", 80: "crimen", 99: "documentales", 18: "drama", 10751: "familia", 14: "fantasía", 36: "historia", 27: "terror", 10402: "música", 9648: "misterio", 10749: "romance", 878: "ciencia ficción", 53: "suspense", 10752: "bélicas", 37: "western", 10759: "acción", 10762: "infantil", 10764: "realities", 10765: "ciencia ficción", 10766: "telenovelas", 10768: "política y guerra" };
// equivalencias entre géneros de series y de películas para aprender gustos
const GEQ = { 10759: [28, 12], 10765: [878, 14], 10768: [10752], 10762: [10751], 28: [10759], 12: [10759], 878: [10765], 14: [10765], 10752: [10768], 10751: [10762] };
const MOVIE_G = new Set([28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 53, 10752, 37]);
const TV_G = new Set([10759, 16, 35, 80, 99, 18, 10751, 10762, 9648, 10764, 10765, 10766, 10768, 37]);

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
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(3)) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}
const P = {
  heart: "M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z",
  x: "M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z",
  eye: "M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z",
  group: "M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3.3 2.7-6 6-6s6 2.7 6 6zm13 0c0-1.9-.6-3.6-1.7-5 .5-.1 1.1-.2 1.7-.2 3 0 5.5 2.3 5.5 5.2z",
  undo: "M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z",
  info: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2zm0-8h-2V7h2z",
  check: "M9 16.2l-4.2-4.2-1.4 1.4L9 19 21 7l-1.4-1.4z",
  bookmark: "M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z",
  star: "M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z",
  chat: "M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4V5a1 1 0 0 1 1-1z",
  spark: "M12 2l1.8 5.6L19 9.5l-5.2 1.9L12 17l-1.8-5.6L5 9.5l5.2-1.9zM19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9zM5 15l.7 1.8 1.8.7-1.8.7L5 20l-.7-1.8-1.8-.7 1.8-.7z",
  send: "M3 20.5 21 12 3 3.5l.01 6.6L15 12 3.01 13.9z",
  play: "M8 5v14l11-7z",
};
function svg(name) { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", P[name] || name); s.append(p); return s; }
const hash = s => { let x = 0; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) | 0; return Math.abs(x); };
const PH = [["#2a2c33", "#111216"], ["#ff5436", "#8a1d0f"], ["#4a6bff", "#1b2a7a"], ["#16a39a", "#0b4b47"], ["#f5b21b", "#8a5a00"], ["#7a4dff", "#2c1a6b"]];
function ago(iso) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "ahora";
  if (d < 3600) return `hace ${Math.floor(d / 60)} min`;
  if (d < 86400) return `hace ${Math.floor(d / 3600)} h`;
  if (d < 604800) return `hace ${Math.floor(d / 86400)} d`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}
let toastT;
function toast(msg, cls) { const t = $("toast"); t.textContent = msg; t.className = "toast" + (cls ? " " + cls : ""); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), cls ? 3600 : 2200); }
function avatar(id, size) { const p = PROF[id]; if (!p) return null; return h("span", { class: "avatar" + (size ? " " + size : ""), style: `--c:${p.color}`, title: p.name }, p.name[0]); }
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const others = () => PROFILES.map(p => p.id).filter(id => id !== S.profile);
const typeLabel = t => t === "tv" ? "Serie" : "Película";

/* ---------- estado ---------- */
const S = {
  profile: store.get("qv_profile", null),
  pin: store.get("qv_pin", null),
  plats: store.get("qv_plats", DEFAULT_PLATS),
  data: { lists: [], seen: [], nopes: [], comments: [] },
  view: "discover",
  deck: [], deckType: "all", deckBusy: false, deckRound: 0, swiped: new Set(), history: [],
  topPlat: null, mineOf: null, mineTab: "todo", allTab: "todo",
  trends: null, chat: [], openKey: null, inflight: 0,
};

/* ---------- datos compartidos ---------- */
async function rpc(fn, args) {
  const base = CFG.supabaseUrl.replace(/\/+$/, "");
  const headers = { apikey: CFG.supabaseAnonKey, "Content-Type": "application/json" };
  if (CFG.supabaseAnonKey.startsWith("eyJ")) headers.Authorization = "Bearer " + CFG.supabaseAnonKey;
  const r = await fetch(`${base}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(args) });
  const txt = await r.text();
  if (!r.ok) { let e = {}; try { e = JSON.parse(txt); } catch (_) {} const err = new Error(e.message || "Error " + r.status); err.code = e.code; throw err; }
  return txt ? JSON.parse(txt) : null;
}
const slim = it => ({ id: it.id || null, type: it.type, title: it.title, year: it.year || "", poster: it.poster || null, backdrop: it.backdrop || null, g: it.g || [] });
const now = () => new Date().toISOString();
const saveLocal = () => { if (!REMOTE) store.set("qv_localdb3", S.data); };
// Cada cambio se aplica al momento en pantalla y después se guarda.
const M = {
  listAdd(owner, it) {
    const d = S.data;
    if (!d.lists.some(x => x.owner === owner && x.key === it.key)) d.lists.unshift({ owner, key: it.key, item: slim(it), by: S.profile, at: now() });
    if (owner !== "comun") d.nopes = d.nopes.filter(x => !(x.owner === owner && x.key === it.key));
    return REMOTE ? rpc("qv_list_add", { p_pin: S.pin, p_owner: owner, p_key: it.key, p_item: slim(it), p_by: S.profile }) : null;
  },
  listRemove(owner, key) {
    S.data.lists = S.data.lists.filter(x => !(x.owner === owner && x.key === key));
    return REMOTE ? rpc("qv_list_remove", { p_pin: S.pin, p_owner: owner, p_key: key }) : null;
  },
  seenToggle(it) {
    const d = S.data, me = S.profile;
    const was = d.seen.some(x => x.owner === me && x.key === it.key);
    if (was) d.seen = d.seen.filter(x => !(x.owner === me && x.key === it.key));
    else {
      d.seen.unshift({ owner: me, key: it.key, item: slim(it), at: now() });
      d.lists = d.lists.filter(x => !(x.owner === me && x.key === it.key));
      d.nopes = d.nopes.filter(x => !(x.owner === me && x.key === it.key));
    }
    return REMOTE ? rpc("qv_seen_toggle", { p_pin: S.pin, p_owner: me, p_key: it.key, p_item: slim(it) }) : null;
  },
  nope(it) {
    if (!S.data.nopes.some(x => x.owner === S.profile && x.key === it.key)) S.data.nopes.push({ owner: S.profile, key: it.key, item: slim(it) });
    return REMOTE ? rpc("qv_nope", { p_pin: S.pin, p_owner: S.profile, p_key: it.key, p_item: slim(it) }) : null;
  },
  unnope(key) {
    S.data.nopes = S.data.nopes.filter(x => !(x.owner === S.profile && x.key === key));
    return REMOTE ? rpc("qv_unnope", { p_pin: S.pin, p_owner: S.profile, p_key: key }) : null;
  },
  commentAdd(it, body) {
    S.data.comments.push({ id: "tmp" + Date.now(), key: it.key, item: slim(it), author: S.profile, body, at: now() });
    return REMOTE ? rpc("qv_comment_add", { p_pin: S.pin, p_key: it.key, p_item: slim(it), p_author: S.profile, p_body: body }) : null;
  },
  commentDelete(id) {
    S.data.comments = S.data.comments.filter(c => c.id !== id);
    return REMOTE ? rpc("qv_comment_delete", { p_pin: S.pin, p_id: id, p_author: S.profile }) : null;
  },
};
async function act(name, ...args) {
  let p;
  try { p = M[name](...args); } catch (e) { return; }
  saveLocal(); paintBadge();
  if (!p) return;
  S.inflight++;
  try { await p; }
  catch (e) {
    if (e.code === "28000") { toast("El PIN ha cambiado. Vuelve a entrar."); logout(true); return; }
    toast("No se ha podido guardar. Revisa la conexión.");
  } finally { S.inflight--; if (!S.inflight) refresh(true); }
}
async function refresh(silent) {
  if (!REMOTE) { S.data = Object.assign({ lists: [], seen: [], nopes: [], comments: [] }, store.get("qv_localdb3", {})); paintBadge(); if (!silent) rerender(); return; }
  if (S.inflight) return;
  try {
    const d = await rpc("qv_state", { p_pin: S.pin });
    if (S.inflight) return;
    S.data = { lists: d.lists || [], seen: d.seen || [], nopes: d.nopes || [], comments: d.comments || [] };
    paintBadge();
    rerender(silent);
  } catch (e) {
    if (e.code === "28000") { logout(true); return; }
    if (!silent) toast("Sin conexión con la base de datos.");
  }
}
const inList = (owner, key) => S.data.lists.some(x => x.owner === owner && x.key === key);
const wantedBy = key => S.data.lists.filter(x => x.owner !== "comun" && x.key === key).map(x => x.owner);
const seenBy = key => S.data.seen.filter(x => x.key === key).map(x => x.owner);
const isSeen = key => S.data.seen.some(x => x.owner === S.profile && x.key === key);
const isNope = key => S.data.nopes.some(x => x.owner === S.profile && x.key === key);
const commentsOf = key => S.data.comments.filter(c => c.key === key);

/* ---------- TMDB ---------- */
const mem = new Map();
async function tmdb(path, params = {}, ttlH = 24) {
  const u = new URL("https://api.themoviedb.org/3" + path);
  if (!("language" in params)) params.language = "es-ES";
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, v);
  const ck = u.toString();
  if (mem.has(ck)) return mem.get(ck);
  const lk = "qv_tm:" + ck.slice(29);
  const c = store.get(lk, null);
  if (c && Date.now() - c.t < ttlH * 36e5) { mem.set(ck, Promise.resolve(c.v)); return c.v; }
  const headers = { accept: "application/json" };
  if (CFG.tmdbKey.startsWith("eyJ")) headers.Authorization = "Bearer " + CFG.tmdbKey; else u.searchParams.set("api_key", CFG.tmdbKey);
  const p = fetch(u, { headers }).then(r => { if (!r.ok) throw new Error("TMDB " + r.status); return r.json(); });
  mem.set(ck, p);
  try { const v = await p; if (ttlH > 0) { const s = JSON.stringify(v); if (s.length < 50000) store.set(lk, { t: Date.now(), v }); } return v; }
  catch (e) { mem.delete(ck); throw e; }
}
let qA = 0; const qL = [];
function limit(fn) { return new Promise((res, rej) => { qL.push([fn, res, rej]); pump(); }); }
function pump() { while (qA < 6 && qL.length) { const [fn, res, rej] = qL.shift(); qA++; fn().then(res, rej).finally(() => { qA--; pump(); }); } }
const keyOf = it => it.id ? `${it.type}:${it.id}` : `x:${it.type}:${norm(it.title)}`;
function fromTmdb(r, type) {
  const t = type || r.media_type;
  return { id: r.id, type: t, title: r.title || r.name, otitle: r.original_title || r.original_name, year: (r.release_date || r.first_air_date || "").slice(0, 4), poster: r.poster_path, backdrop: r.backdrop_path, vote: r.vote_average, votes: r.vote_count, overview: r.overview, g: r.genre_ids || [], lang: r.original_language, key: `${t}:${r.id}` };
}
const RES = store.get("qv_res3", {});
async function resolve(it, alt) {
  if (it.id || !TMDB) return it;
  const rk = it.type + "|" + norm(it.title) + "|" + (it.year || "");
  if (RES[rk] === undefined) {
    try {
      const yp = it.type === "movie" ? "year" : "first_air_date_year";
      const yr = /^\d{4}$/.test(String(it.year)) ? it.year : undefined;
      let r = await limit(() => tmdb(`/search/${it.type}`, { query: it.title, [yp]: yr }, 168));
      if (!r.results.length && alt) r = await limit(() => tmdb(`/search/${it.type}`, { query: alt, [yp]: yr }, 168));
      if (!r.results.length && yr) r = await limit(() => tmdb(`/search/${it.type}`, { query: it.title }, 168));
      const b = r.results[0];
      RES[rk] = b ? fromTmdb(b, it.type) : null;
      store.set("qv_res3", RES);
    } catch (e) { return it; }
  }
  const b = RES[rk];
  if (b) Object.assign(it, { id: b.id, poster: b.poster, backdrop: b.backdrop, vote: b.vote, g: b.g, otitle: b.otitle, year: it.year || b.year, overview: it.overview || b.overview, key: b.key });
  return it;
}
let PROV = store.get("qv_prov3", null);
async function loadProviders() {
  if (!TMDB || (PROV && Date.now() - PROV.t < 7 * 864e5)) return;
  try {
    const [m, t] = await Promise.all([tmdb("/watch/providers/movie", { watch_region: "ES" }, 0), tmdb("/watch/providers/tv", { watch_region: "ES" }, 0)]);
    const map = {}, logos = {};
    for (const p of [...m.results, ...t.results]) {
      const name = p.provider_name.trim();
      if (/channel|amazon video|with ads|kids/i.test(name)) continue;
      const pl = PLATFORMS.find(x => x.re.test(name)); if (!pl) continue;
      map[p.provider_id] = pl.id; if (!logos[pl.id]) logos[pl.id] = p.logo_path;
    }
    PROV = { t: Date.now(), map, logos }; store.set("qv_prov3", PROV);
  } catch (e) { PROV = null; }
}
const providerIds = plats => PROV ? Object.entries(PROV.map).filter(([, p]) => plats.includes(p)).map(([id]) => id) : [];
async function providersOf(it) {
  if (!TMDB || !it.id) return null;
  if (it.prov) return it.prov;
  try {
    const r = await limit(() => tmdb(`/${it.type}/${it.id}/watch/providers`, {}, 12));
    const es = r.results && r.results.ES; const seen = new Set(), list = [];
    for (const p of es ? [...(es.flatrate || []), ...(es.ads || []), ...(es.free || [])] : []) {
      const plat = (PROV && PROV.map[p.provider_id]) || (PLATFORMS.find(x => x.re.test(p.provider_name.trim())) || {}).id;
      const name = plat || p.provider_name; if (seen.has(name) || /channel/i.test(p.provider_name)) continue;
      seen.add(name); list.push({ name, logo: p.logo_path, plat });
    }
    it.prov = { list, link: es ? es.link : null, own: list.filter(p => p.plat && S.plats.includes(p.plat)) };
    return it.prov;
  } catch (e) { return null; }
}

/* ---------- gustos ---------- */
function tasteOf(user) {
  const w = {};
  const add = (g, v) => { for (const id of g || []) { w[id] = (w[id] || 0) + v; for (const e of GEQ[id] || []) w[e] = (w[e] || 0) + v * .6; } };
  S.data.lists.filter(x => x.owner === user).forEach(x => add(x.item.g, 2));
  S.data.lists.filter(x => x.owner === "comun" && x.by === user).forEach(x => add(x.item.g, 1));
  S.data.seen.filter(x => x.owner === user).forEach(x => add(x.item.g, 1));
  S.data.nopes.filter(x => x.owner === user).forEach(x => add(x.item.g, -1.2));
  const n = S.data.lists.filter(x => x.owner === user).length + S.data.seen.filter(x => x.owner === user).length + S.data.nopes.filter(x => x.owner === user).length;
  return { w, n };
}
function affinity(g, taste) {
  if (!g || !g.length || !taste.n) return 0;
  const max = Math.max(1, ...Object.values(taste.w).map(Math.abs));
  return g.reduce((s, id) => s + (taste.w[id] || 0), 0) / (max * Math.min(3, g.length));
}
function topGenres(taste, type, k = 2) {
  const valid = type === "tv" ? TV_G : MOVIE_G;
  return Object.entries(taste.w).filter(([id, v]) => v > 0 && valid.has(+id)).sort((a, b) => b[1] - a[1]).slice(0, k).map(([id]) => +id);
}

/* ---------- mazo de Descubrir ---------- */
async function buildDeck(reset) {
  if (S.deckBusy) return;
  S.deckBusy = true;
  if (reset) { S.deck = []; S.deckRound = 0; }
  if (S.view === "discover" && !S.deck.length) paintDeck();
  try { await fillDeck(); } catch (e) { /* sin red */ }
  S.deckBusy = false;
  if (S.view === "discover") paintDeck();
}
async function fillDeck() {
  const me = S.profile, taste = tasteOf(me), round = S.deckRound++;
  const known = new Set([...S.data.lists.filter(x => x.owner === me).map(x => x.key), ...S.data.seen.filter(x => x.owner === me).map(x => x.key), ...S.data.nopes.filter(x => x.owner === me).map(x => x.key), ...S.swiped, ...S.deck.map(c => c.it.key)]);
  const types = S.deckType === "all" ? ["tv", "movie"] : [S.deckType];
  const cands = new Map();
  const add = (it, why, boost, verified) => {
    if (!it || !it.title) return; it.key = it.key || keyOf(it);
    if (known.has(it.key) || (S.deckType !== "all" && it.type !== S.deckType)) return;
    const c = cands.get(it.key);
    if (c) { c.boost += boost * .5; if (boost > c.mainBoost) { c.why = why; c.mainBoost = boost; } c.verified = c.verified || verified; return; }
    cands.set(it.key, { it, why, boost, mainBoost: boost, verified });
  };
  const jobs = [];
  const ids = providerIds(S.plats).join("|");

  // 1) Lo que les apetece a los demás
  for (const o of others()) for (const x of S.data.lists.filter(l => l.owner === o)) {
    const it = { ...x.item, key: x.key };
    const both = wantedBy(x.key).filter(u => u !== me);
    add(it, both.length > 1 ? "A los dos les apetece: ¿hacéis match?" : `A ${PROF[o].name} le apetece`, 2.2 * both.length, false);
  }
  S.data.lists.filter(x => x.owner === "comun").forEach(x => add({ ...x.item, key: x.key }, "Está en la lista de todos", 1.6, false));

  if (TMDB && ids) {
    // 2) Parecidas a lo que te gustó
    const liked = shuffle([...S.data.lists.filter(x => x.owner === me), ...S.data.seen.filter(x => x.owner === me)].filter(x => x.item.id)).slice(0, 3);
    for (const x of liked) jobs.push(limit(() => tmdb(`/${x.item.type}/${x.item.id}/recommendations`, { page: 1 + (round % 2) }, 48)).then(r =>
      r.results.filter(z => z.media_type === "movie" || z.media_type === "tv").slice(0, 10).forEach(z => add(fromTmdb(z), `Porque te gustó ${x.item.title}`, 1.8, false))).catch(() => {}));
    // 3) Catálogo real de vuestras plataformas, orientado a tus géneros
    for (const type of types) {
      const tg = taste.n >= 3 ? topGenres(taste, type, 2) : [];
      const base = { watch_region: "ES", with_watch_providers: ids, with_watch_monetization_types: "flatrate|free|ads", "vote_count.gte": type === "movie" ? 300 : 150 };
      if (type === "tv") base.without_genres = "10763,10767" + (taste.w[10764] > 0 ? "" : ",10764");
      const pg = 1 + ((round + hash(me)) % 4);
      jobs.push(tmdb(`/discover/${type}`, { ...base, sort_by: "popularity.desc", page: pg, with_genres: tg.join("|") || undefined }, 12).then(r =>
        r.results.forEach(z => { const it = fromTmdb(z, type); const a = affinity(it.g, taste); const g = it.g.find(id => tg.includes(id));
          add(it, g && a > .15 ? `Te van las de ${GENRE[g]}` : "Lo más visto en tus plataformas", .6, true); })).catch(() => {}));
      jobs.push(tmdb(`/discover/${type}`, { ...base, sort_by: "vote_average.desc", "vote_count.gte": type === "movie" ? 1500 : 600, page: 1 + ((round * 3 + hash(me)) % 6), with_genres: tg.slice(0, 1).join("|") || undefined }, 24).then(r =>
        r.results.forEach(z => add(fromTmdb(z, type), "Joya muy bien valorada", .8, true))).catch(() => {}));
    }
  }
  // 4) Top de la semana
  if (S.trends) for (const p of ownedTrendPlats()) {
    for (const kind of ["tv", "movie"]) trendItems(p, kind).slice(0, 4).forEach(it => add(it, it.trend.n ? `Nº ${it.trend.n} en ${p === "Otras" ? "su plataforma" : p} esta semana` : `Novedad en ${p}`, 1.2 - (it.trend.n || 5) * .1, true));
  }
  await Promise.all(jobs);

  let list = [...cands.values()];
  // resolver lo que no viene de TMDB y comprobar disponibilidad de lo no verificado
  await Promise.all(list.map(c => resolve(c.it)));
  const re = new Map(); for (const c of list) { c.it.key = keyOf(c.it); if (!known.has(c.it.key) && !re.has(c.it.key)) re.set(c.it.key, c); }
  list = [...re.values()].filter(c => !c.it.g || !c.it.g.includes(10763));
  for (const c of list) c.score = (c.it.vote || 6.6) * .45 + affinity(c.it.g, taste) * 2.2 + c.boost + Math.random() * 1.1 - (c.it.votes != null && c.it.votes < 50 ? 1 : 0);
  list.sort((a, b) => b.score - a.score);
  const picked = [];
  for (const c of list) {
    if (picked.length >= 18) break;
    if (!c.verified && TMDB && c.it.id) {
      const pv = await providersOf(c.it);
      if (pv && !pv.own.length && c.mainBoost < 2) continue;
    }
    picked.push(c);
  }
  S.deck.push(...picked);
}

/* ---------- carátulas ---------- */
function posterEl(it, flags = true) {
  const [a, b] = PH[hash(it.title) % PH.length];
  const box = h("div", { class: "poster", style: `--a:${a};--b:${b}` });
  const ph = h("div", { class: "ph" }, it.title);
  box.append(ph);
  const paint = () => { if (it.poster && !box.querySelector("img")) { const img = h("img", { src: IMG + "w500" + it.poster, alt: "", loading: "lazy", decoding: "async" }); img.onload = () => ph.remove(); box.prepend(img); } };
  if (it.poster) paint(); else if (TMDB && !it.id) resolve(it).then(paint);
  if (flags) {
    const k = it.key || keyOf(it);
    if (isSeen(k)) box.append(h("span", { class: "flag seen", title: "Ya la viste" }, svg("check")));
    else if (inList(S.profile, k)) box.append(h("span", { class: "flag saved", title: "En tu lista" }, svg("bookmark")));
  }
  return box;
}
function tile(it, sub, rank) {
  it.key = it.key || keyOf(it);
  if (rank) return h("button", { class: "tile ranked", onclick: () => openItem(it) }, h("span", { class: "bignum", "aria-label": "Puesto " + rank }, rank),
    h("span", { class: "rk" }, posterEl(it), h("span", { class: "t" }, it.title)));
  return h("button", { class: "tile", onclick: () => openItem(it) }, posterEl(it), h("span", { class: "t" }, it.title),
    sub !== null ? h("span", { class: "s" }, sub !== undefined ? sub : [typeLabel(it.type), it.year].filter(Boolean).join(" · ")) : null);
}
const empty = (title, text, btn) => h("div", { class: "empty" }, h("div", { class: "mark", "aria-hidden": "true" }, h("i"), h("i"), h("i")), h("b", null, title), h("p", null, text), btn || null);

/* ---------- navegación ---------- */
function rerender(silent) {
  if (S.view === "discover") { if (!silent) paintDiscover(); }
  else if (S.view === "top") renderTop();
  else if (S.view === "mine") renderMine();
  else if (S.view === "all") renderAll();
  if (S.openKey && !$("sheet").hidden && $("dSocial")) paintSocial();
}
function go(view) {
  S.view = view;
  for (const v of ["discover", "top", "mine", "all"]) $("v-" + v).hidden = v !== view;
  document.querySelectorAll(".tabbar button").forEach(b => { if (b.dataset.v === view) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  rerender();
  window.scrollTo(0, 0);
}
function paintBadge() {
  const n = S.data.lists.filter(x => x.owner === "comun" && !seenBy(x.key).includes(S.profile)).length;
  const b = $("allBadge"); if (b) { b.hidden = !n; b.textContent = n; }
}

/* ---------- Descubrir ---------- */
function paintDiscover() {
  const v = $("v-discover"); v.replaceChildren();
  v.append(h("button", { class: "ask", onclick: openChat }, h("span", { class: "spark" }, svg("spark")),
    h("span", null, h("b", null, "Pregúntale a la IA"), h("span", null, "«Algo de risa para esta noche, nada largo»"))));
  v.append(h("button", { class: "searchbar", onclick: () => openSearch() }, svg("M10.5 3a7.5 7.5 0 0 1 5.9 12.1l4.8 4.8-1.4 1.4-4.8-4.8A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z"), "Busca un título o un tema: lesbianas, navidad…"));
  v.append(h("div", { class: "chips" }, [["all", "Todo"], ["tv", "Series"], ["movie", "Películas"]].map(([k, l]) =>
    h("button", { class: "chip", "aria-pressed": S.deckType === k ? "true" : "false", onclick: () => { if (S.deckType === k) return; S.deckType = k; paintDiscover(); buildDeck(true); } }, l))));
  v.append(h("div", { class: "deck-wrap" },
    h("div", { class: "deck", id: "deck" }),
    h("div", { class: "actions" },
      h("button", { class: "act md seen", "aria-label": "Deshacer", onclick: undo, id: "undoBtn" }, svg("undo")),
      h("button", { class: "act lg no", "aria-label": "No me apetece", onclick: () => swipeTop("no") }, svg("x")),
      h("button", { class: "act md seen", "aria-label": "Ya la vi", onclick: () => swipeTop("seen") }, svg("eye")),
      h("button", { class: "act md all", "aria-label": "Proponer a todos", onclick: () => swipeTop("all") }, svg("group")),
      h("button", { class: "act lg yes", "aria-label": "Me apetece", onclick: () => swipeTop("yes") }, svg("heart"))),
    h("div", { class: "act-labels", "aria-hidden": "true" }, h("span", { class: "md" }, "Atrás"), h("span", { class: "lg" }, "Paso"), h("span", { class: "md" }, "Vista"), h("span", { class: "md" }, "A todos"), h("span", { class: "lg" }, "Me apetece"))));
  v.append(h("p", { class: "foot" }, "Desliza a la derecha lo que te apetezca y a la izquierda lo que no. Cuanto más uses, mejor te conoce."));
  paintDeck();
  if (S.deck.length < 4 && !S.deckBusy) buildDeck(false);
}
function paintDeck() {
  const d = $("deck"); if (!d) return;
  d.replaceChildren();
  const u = $("undoBtn"); if (u) u.disabled = !S.history.length, u.style.opacity = S.history.length ? 1 : .4;
  if (!S.deck.length) {
    d.append(S.deckBusy ? h("div", { class: "deck-empty skel" }, h("b", null, "Buscando para ti…"))
      : h("div", { class: "deck-empty" }, h("b", null, "No quedan propuestas"), h("p", { class: "note" }, TMDB ? "Prueba con más plataformas en tu perfil o cambia entre series y películas." : "Falta la clave de TMDB para buscar en el catálogo."), h("button", { class: "btn dark", onclick: () => buildDeck(true) }, "Buscar más")));
    return;
  }
  const show = S.deck.slice(0, 3).reverse();
  show.forEach((c, i) => {
    const depth = show.length - 1 - i;
    const el = cardEl(c, depth);
    d.append(el);
    if (depth === 0) bindSwipe(el, c);
  });
  if (S.deck.length < 6 && !S.deckBusy) buildDeck(false);
}
function cardEl(c, depth) {
  const it = c.it;
  const provBox = h("span", { class: "provs-mini" });
  const meta = h("div", { class: "card-meta" }, it.vote ? h("span", { class: "rate" }, svg("star"), Number(it.vote).toFixed(1)) : null, h("span", null, [typeLabel(it.type), it.year].filter(Boolean).join(" · ")), provBox);
  const el = h("div", { class: "card" + (depth === 1 ? " behind" : depth === 2 ? " behind2" : ""), "data-key": it.key },
    posterEl(it, false),
    h("span", { class: "stamp yes" }, "Me apetece"), h("span", { class: "stamp no" }, "Paso"), h("span", { class: "stamp all" }, "A todos"),
    depth === 0 ? h("button", { class: "card-tap", "aria-label": "Ver ficha", onclick: e => { e.stopPropagation(); openItem(it); } }, svg("info")) : null,
    h("div", { class: "card-info" }, c.why ? h("span", { class: "why" }, c.why) : null, h("h3", null, it.title), meta));
  if (depth === 0) providersOf(it).then(pv => { if (pv && pv.own.length) provBox.replaceChildren(...pv.own.slice(0, 3).map(p => p.logo ? h("img", { src: IMG + "w92" + p.logo, alt: p.name, title: p.name }) : null)); });
  if (depth <= 1 && it.poster) { const pre = new Image(); pre.src = IMG + "w500" + it.poster; }
  return el;
}
function bindSwipe(el, c) {
  let sx = 0, sy = 0, dx = 0, dy = 0, drag = false, moved = false;
  const stamps = { yes: el.querySelector(".stamp.yes"), no: el.querySelector(".stamp.no"), all: el.querySelector(".stamp.all") };
  const setStamps = () => { stamps.yes.style.opacity = Math.max(0, Math.min(1, dx / 90)); stamps.no.style.opacity = Math.max(0, Math.min(1, -dx / 90)); stamps.all.style.opacity = Math.abs(dx) < 60 ? Math.max(0, Math.min(1, -dy / 110)) : 0; };
  el.addEventListener("pointerdown", e => { if (e.target.closest(".card-tap")) return; drag = true; moved = false; sx = e.clientX; sy = e.clientY; dx = dy = 0; el.style.transition = "none"; el.setPointerCapture(e.pointerId); });
  el.addEventListener("pointermove", e => { if (!drag) return; dx = e.clientX - sx; dy = e.clientY - sy; if (Math.abs(dx) + Math.abs(dy) > 6) moved = true; el.style.transform = `translate(${dx}px,${dy}px) rotate(${dx / 18}deg)`; setStamps(); });
  const end = () => {
    if (!drag) return; drag = false;
    if (!moved) { el.style.transform = ""; openItem(c.it); return; }
    if (dx > 110) fly(el, "yes"); else if (dx < -110) fly(el, "no"); else if (dy < -130 && Math.abs(dx) < 80) fly(el, "all");
    else { el.style.transition = "transform .25s cubic-bezier(.2,.8,.2,1)"; el.style.transform = ""; dx = dy = 0; setStamps(); }
  };
  el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
}
function swipeTop(kind) {
  const el = document.querySelector("#deck .card:not(.behind):not(.behind2)");
  if (!el || !S.deck.length) return;
  if (kind === "seen") { el.style.transition = "transform .3s, opacity .3s"; el.style.transform = "translateY(60px) scale(.9)"; el.style.opacity = "0"; setTimeout(() => decide("seen"), 220); return; }
  el.querySelector(".stamp." + kind).style.opacity = 1;
  fly(el, kind);
}
function fly(el, kind) {
  const W = window.innerWidth;
  el.style.transition = "transform .3s ease-in, opacity .3s";
  el.style.transform = kind === "yes" ? `translate(${W}px,-40px) rotate(24deg)` : kind === "no" ? `translate(${-W}px,-40px) rotate(-24deg)` : `translate(0,${-window.innerHeight}px)`;
  el.style.opacity = ".6";
  setTimeout(() => decide(kind), 220);
}
function decide(kind) {
  const c = S.deck.shift(); if (!c) return;
  const it = c.it; S.swiped.add(it.key);
  S.history.push({ kind, it, c });
  if (S.history.length > 20) S.history.shift();
  if (kind === "yes" || kind === "all") {
    act("listAdd", S.profile, it);
    if (kind === "all") { act("listAdd", "comun", it); toast("Propuesta a todos"); }
    const w = wantedBy(it.key);
    if (PROFILES.every(p => w.includes(p.id))) {
      if (!inList("comun", it.key)) act("listAdd", "comun", it);
      toast(`¡Match! A los tres os apetece ${it.title}`, "match");
    } else if (kind === "yes" && w.length === 2) toast(`¡A ${PROF[w.find(u => u !== S.profile)].name} también le apetece!`, "match");
  } else if (kind === "no") act("nope", it);
  else if (kind === "seen") { if (!isSeen(it.key)) act("seenToggle", it); toast("Marcada como vista"); }
  paintDeck();
}
function undo() {
  const last = S.history.pop(); if (!last) return;
  const it = last.it;
  if (last.kind === "yes" || last.kind === "all") { act("listRemove", S.profile, it.key); if (last.kind === "all") act("listRemove", "comun", it.key); }
  else if (last.kind === "no") act("unnope", it.key);
  else if (last.kind === "seen" && isSeen(it.key)) act("seenToggle", it);
  S.swiped.delete(it.key);
  S.deck.unshift(last.c);
  paintDeck();
}

/* ---------- Top ---------- */
const ownedTrendPlats = () => Object.keys((S.trends || {}).platforms || {}).filter(p => p === "Otras" ? OTHER_GROUP.some(o => S.plats.includes(o)) : S.plats.includes(p));
function trendItems(plat, kind) {
  const d = S.trends && S.trends.platforms[plat]; if (!d) return [];
  return (kind === "tv" ? d.series : d.movies).map((r, i) => ({ title: r.title, type: r.type, year: r.year, overview: r.syn, trend: { plat, n: d.ranked ? i + 1 : null } }));
}
function renderTop() {
  const v = $("v-top"); v.replaceChildren();
  v.append(h("div", { class: "head" }, h("div", null, h("h1", null, "Lo más ", h("em", null, "visto")), h("p", null, S.trends ? `En España · ${S.trends.label}` : ""))));
  const plats = ownedTrendPlats();
  if (!plats.length) { v.append(empty("Elige vuestras plataformas", "Toca tu inicial arriba a la derecha y marca las que tenéis.", h("button", { class: "btn dark", onclick: openSettings }, "Elegir plataformas"))); return; }
  if (!plats.includes(S.topPlat)) S.topPlat = plats[0];
  v.append(h("div", { class: "chips" }, plats.map(p => h("button", { class: "chip", "aria-pressed": p === S.topPlat ? "true" : "false", onclick: () => { S.topPlat = p; renderTop(); } },
    h("span", { class: "dot", style: `background:${PCOL[p] || "#111216"}` }), p === "Otras" ? "Apple TV y otras" : p))));
  const d = S.trends.platforms[S.topPlat];
  const series = trendItems(S.topPlat, "tv"), movies = trendItems(S.topPlat, "movie");
  const top = series[0] || movies[0];
  if (top) {
    const bg = h("div", { class: "feature-bg" });
    v.append(h("button", { class: "feature", onclick: () => openItem(top) }, bg, h("div", { class: "feature-in" },
      h("span", { class: "feature-tag" }, d.ranked ? `Nº 1 en ${S.topPlat === "Otras" ? "su plataforma" : S.topPlat}` : "Novedad"), h("b", null, top.title), top.overview ? h("span", { class: "feature-syn" }, top.overview) : null)));
    resolve(top).then(() => { const img = top.backdrop || top.poster; if (img) bg.style.backgroundImage = `url(${IMG}w780${img})`; });
  }
  for (const [items, lab] of [[series[0] === top ? series.slice(1) : series, "Series"], [movies[0] === top ? movies.slice(1) : movies, "Películas"]]) {
    if (!items.length) continue;
    v.append(h("div", { class: "sec" }, h("h2", null, lab), h("small", null, d.ranked ? "Top 10" : "Destacadas")));
    v.append(h("div", { class: "rail" }, items.map(it => tile(it, undefined, d.ranked ? it.trend.n : null))));
  }
  v.append(h("p", { class: "foot" }, "Fuente: " + d.source + ". " + attributionText()));
}
const attributionText = () => TMDB ? "Carátulas y datos de TMDB (esta app usa la API de TMDB pero no está avalada por TMDB). Disponibilidad: JustWatch." : "";

/* ---------- Mi lista ---------- */
function renderMine() {
  const v = $("v-mine"); v.replaceChildren();
  const who = S.mineOf || S.profile, mine = who === S.profile;
  v.append(h("div", { class: "head" }, h("h1", null, mine ? h("span", null, "Mi ", h("em", null, "lista")) : h("span", null, "Lista de ", h("em", null, PROF[who].name)))));
  v.append(h("div", { class: "chips wrap" }, PROFILES.map(p => h("button", { class: "chip", "aria-pressed": p.id === who ? "true" : "false", onclick: () => { S.mineOf = p.id; renderMine(); } }, avatar(p.id, "xs"), p.id === S.profile ? "Yo" : p.name))));
  const todo = S.data.lists.filter(x => x.owner === who), done = S.data.seen.filter(x => x.owner === who);
  v.append(h("div", { class: "seg" },
    h("button", { "aria-pressed": S.mineTab === "todo" ? "true" : "false", onclick: () => { S.mineTab = "todo"; renderMine(); } }, `Quiero ver · ${todo.length}`),
    h("button", { "aria-pressed": S.mineTab === "done" ? "true" : "false", onclick: () => { S.mineTab = "done"; renderMine(); } }, `Vistas · ${done.length}`)));
  const arr = S.mineTab === "todo" ? todo : done;
  if (!arr.length) {
    v.append(S.mineTab === "todo"
      ? empty(mine ? "Tu lista está vacía" : `${PROF[who].name} aún no ha guardado nada`, mine ? "En Descubrir, desliza a la derecha lo que te apetezca y aparecerá aquí." : "Cuando guarde algo, lo verás aquí.", mine ? h("button", { class: "btn accent", onclick: () => go("discover") }, "Ir a Descubrir") : null)
      : empty("Nada visto todavía", "Marca «Vista» en lo que ya hayas visto. Así no te lo vuelvo a proponer y aprendo lo que te gusta."));
    return;
  }
  v.append(h("div", { class: "grid" }, arr.map(x => {
    const it = { ...x.item, key: x.key };
    const others2 = wantedBy(x.key).filter(u => u !== who);
    return tile(it, others2.length ? `También ${others2.map(u => PROF[u].name).join(" y ")}` : undefined);
  })));
}

/* ---------- Todos ---------- */
function renderAll() {
  const v = $("v-all"); v.replaceChildren();
  v.append(h("div", { class: "head" }, h("div", null, h("h1", null, "Para ", h("em", null, "todos")), h("p", null, "Lo que proponemos ver juntos. Toca un título para comentar."))));
  const all = S.data.lists.filter(x => x.owner === "comun");
  const everyone = k => PROFILES.every(p => seenBy(k).includes(p.id));
  const todo = all.filter(x => !everyone(x.key)), done = all.filter(x => everyone(x.key));
  v.append(h("div", { class: "seg" },
    h("button", { "aria-pressed": S.allTab === "todo" ? "true" : "false", onclick: () => { S.allTab = "todo"; renderAll(); } }, `Pendientes · ${todo.length}`),
    h("button", { "aria-pressed": S.allTab === "done" ? "true" : "false", onclick: () => { S.allTab = "done"; renderAll(); } }, `Vistas por los tres · ${done.length}`)));
  let arr = S.allTab === "todo" ? todo : done;
  if (!arr.length) {
    v.append(S.allTab === "todo"
      ? empty("Nada propuesto todavía", "En Descubrir, pulsa el botón azul de «A todos» o desliza una carátula hacia arriba. También se añade sola cuando a los tres os apetece lo mismo.", h("button", { class: "btn blue", onclick: () => go("discover") }, "Ir a Descubrir"))
      : empty("Aún no habéis visto ninguna juntos", "Cuando los tres marquéis una como vista, aparecerá aquí."));
    return;
  }
  const lastAt = k => { const c = commentsOf(k); return c.length ? c[c.length - 1].at : ""; };
  arr = [...arr].sort((a, b) => (wantedBy(b.key).length - wantedBy(a.key).length) || String(lastAt(b.key) || b.at).localeCompare(String(lastAt(a.key) || a.at)));
  v.append(h("div", { class: "rows" }, arr.map(x => {
    const it = { ...x.item, key: x.key }, w = wantedBy(x.key), cm = commentsOf(x.key), sb = seenBy(x.key), last = cm[cm.length - 1];
    return h("button", { class: "row", onclick: () => openItem(it) }, posterEl(it, false),
      h("div", null,
        h("h3", null, it.title),
        h("div", { class: "meta" }, [typeLabel(it.type), it.year, PROF[x.by] ? `propuesta por ${PROF[x.by].name}` : ""].filter(Boolean).join(" · ")),
        h("div", { class: "who-wants" },
          w.length ? [h("span", { class: "stack" }, w.map(u => avatar(u, "xs"))), w.length === 3 ? "¡Match de los tres!" : "Le apetece"] : "Nadie la ha marcado aún",
          h("span", { class: "ccount" }, svg("chat"), cm.length),
          sb.length ? h("span", { class: "ccount" }, svg("eye"), sb.length) : null),
        last ? h("div", { class: "bubble-last" }, h("b", null, PROF[last.author].name + ": "), last.body) : null));
  })));
}

/* ---------- hoja ---------- */
function openSheet(node) {
  $("sheetBody").replaceChildren(node);
  $("sheet").hidden = false; $("scrim").hidden = false; $("sheet").scrollTop = 0;
  document.body.style.overflow = "hidden";
}
function closeSheet() { $("sheet").hidden = true; $("scrim").hidden = true; S.openKey = null; document.body.style.overflow = ""; if (S.view !== "discover") rerender(); else paintDeck(); }

/* ---------- ficha ---------- */
let cur = null, tok = 0;
async function openItem(it) {
  it.key = it.key || keyOf(it);
  const my = ++tok; cur = it; S.openKey = it.key;
  const wrap = h("div", { class: "sheet-body", style: "padding:0" });
  openSheet(wrap);
  const draw = (det, pv) => {
    wrap.replaceChildren();
    const back = (det && det.backdrop_path) || it.backdrop;
    if (back) wrap.append(h("div", { class: "hero", style: `background-image:url(${IMG}w780${back})` }));
    const year = it.year || (det && (det.release_date || det.first_air_date || "").slice(0, 4));
    const dur = det && (det.runtime ? `${Math.floor(det.runtime / 60)} h ${det.runtime % 60} min` : det.number_of_seasons ? `${det.number_of_seasons} temporada${det.number_of_seasons > 1 ? "s" : ""}` : "");
    const vote = (det && det.vote_average) || it.vote;
    wrap.append(h("div", { class: "dhead" + (back ? "" : " noimg") }, posterEl(it, false),
      h("div", null, h("h2", null, it.title), h("div", { class: "meta" }, [typeLabel(it.type), year, dur, vote ? "★ " + Number(vote).toFixed(1) : ""].filter(Boolean).join(" · ")))));
    if (det && det.genres && det.genres.length) wrap.append(h("div", { class: "tags" }, det.genres.map(g => h("span", { class: "tag" }, g.name))));
    const ov = (det && det.overview) || it.overview;
    if (ov) wrap.append(h("p", { class: "overview" }, ov));
    wrap.append(h("div", { id: "dSocial", style: "display:flex;flex-direction:column;gap:16px" }));
    const where = h("div", { class: "box" }, h("h4", null, "Dónde verla en España"));
    if (pv && pv.list.length) where.append(h("div", { class: "provs" }, pv.list.map(p => h("span", { class: "prov" + (p.plat && S.plats.includes(p.plat) ? " own" : "") }, p.logo ? h("img", { src: IMG + "w92" + p.logo, alt: "" }) : null, p.name))));
    else if (pv) where.append(h("p", { class: "note" }, "Ahora no está en ninguna plataforma de suscripción en España."));
    else where.append(h("p", { class: "note" }, it.trend ? `En ${it.trend.plat === "Otras" ? "Apple TV, SkyShowtime o Filmin" : it.trend.plat}.` : "Comprobando…"));
    const trailer = det && det.videos && (det.videos.results.find(x => x.site === "YouTube" && x.type === "Trailer" && x.iso_639_1 === "es") || det.videos.results.find(x => x.site === "YouTube" && /Trailer|Teaser/.test(x.type)));
    where.append(h("div", { class: "links" },
      trailer ? h("a", { href: "https://www.youtube.com/watch?v=" + trailer.key, target: "_blank", rel: "noopener" }, "▶ Tráiler") : null,
      h("a", { href: (pv && pv.link) || "https://www.justwatch.com/es/buscar?q=" + encodeURIComponent(it.title), target: "_blank", rel: "noopener" }, "JustWatch ↗"),
      h("a", { href: "https://www.filmaffinity.com/es/search.php?stext=" + encodeURIComponent(it.title), target: "_blank", rel: "noopener" }, "FilmAffinity ↗")));
    wrap.append(where);
    wrap.append(h("p", { class: "foot" }, attributionText()));
    paintSocial();
  };
  draw(null, it.prov || null);
  if (!TMDB) return;
  await resolve(it);
  if (!it.id) { if (my === tok) draw(null, { list: [] }); return; }
  try {
    const det = await tmdb(`/${it.type}/${it.id}`, { append_to_response: "videos", include_video_language: "es,en" }, 24);
    const pv = await providersOf(it);
    if (my === tok && !$("sheet").hidden) { S.openKey = it.key; draw(det, pv || { list: [] }); }
  } catch (e) { /* queda la versión básica */ }
}
function paintSocial() {
  const box = $("dSocial"); const it = cur; if (!box || !it) return;
  const k = it.key, mine = inList(S.profile, k), all = inList("comun", k), seen = isSeen(k);
  const w = wantedBy(k), sb = seenBy(k), cms = commentsOf(k);
  const ta = box.querySelector("textarea"), draft = ta ? ta.value : "", focus = ta && document.activeElement === ta;
  const input = h("textarea", { id: "cmtInput", rows: "1", maxlength: "1000", placeholder: "Escribe un comentario…" });
  input.value = draft;
  input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = Math.min(140, input.scrollHeight) + "px"; });
  const send = () => { const t = input.value.trim(); if (!t) return; input.value = ""; if (!all) act("listAdd", "comun", it); act("commentAdd", it, t); paintSocial(); };
  box.replaceChildren(
    h("div", { class: "dacts" },
      h("button", { class: "btn" + (mine ? " on-yes" : ""), onclick: () => { act(mine ? "listRemove" : "listAdd", S.profile, mine ? k : it); toast(mine ? "Quitada de tu lista" : "Guardada en tu lista"); paintSocial(); } }, svg(mine ? "check" : "heart"), mine ? "En mi lista" : "Me apetece"),
      h("button", { class: "btn" + (all ? " on-blue" : ""), onclick: () => { act(all ? "listRemove" : "listAdd", "comun", all ? k : it); toast(all ? "Quitada de Todos" : "Propuesta a todos"); paintSocial(); } }, svg(all ? "check" : "group"), all ? "En Todos" : "A todos"),
      h("button", { class: "btn" + (seen ? " on-dark" : ""), onclick: () => { act("seenToggle", it); toast(seen ? "Desmarcada" : "Marcada como vista"); paintSocial(); } }, svg(seen ? "check" : "eye"), seen ? "Vista" : "Ya la vi")),
    (w.length || sb.length) ? h("div", { class: "box" },
      w.length ? h("div", { class: "wants" }, h("span", { class: "stack" }, w.map(u => avatar(u, "sm"))), w.length === 3 ? "¡A los tres os apetece!" : `Le apetece a ${w.map(u => u === S.profile ? "ti" : PROF[u].name).join(" y ")}`) : null,
      sb.length ? h("div", { class: "wants" }, svg("eye"), `Ya la ha visto ${sb.map(u => u === S.profile ? "tú" : PROF[u].name).join(", ")}`) : null) : null,
    h("div", { class: "box" }, h("h4", null, cms.length ? `Comentarios · ${cms.length}` : "Comentarios"),
      cms.length ? cms.map(c => h("div", { class: "cmt" + (c.author === S.profile ? " mine" : "") }, avatar(c.author, "sm"),
        h("div", { class: "bub" }, h("b", null, PROF[c.author].name), h("time", null, ago(c.at)), h("p", null, c.body),
          c.author === S.profile && !String(c.id).startsWith("tmp") ? h("button", { class: "del", onclick: () => { act("commentDelete", c.id); paintSocial(); } }, "Borrar") : null)))
        : h("p", { class: "note" }, all ? "Nadie ha comentado aún. ¿Qué os parece?" : "Al comentar, se propone a todos automáticamente."),
      h("div", { class: "cbox" }, input, h("button", { class: "btn blue", "aria-label": "Enviar", onclick: send }, svg("send")))));
  box.querySelectorAll(".wants svg").forEach(s => s.style.cssText = "width:20px;height:20px;color:var(--muted)");
  if (focus) input.focus();
}

/* ---------- búsqueda ---------- */
/* ---------- búsqueda por título y por tema ---------- */
// Temas en español → etiquetas (keywords) de TMDB, que están en inglés
const THEMES = [
  [["lesbiana", "lesbianas", "lesbico", "safic", "safica", "saficas", "saficos"], ["lesbian", "lesbian relationship"]],
  [["gay", "gays", "homosexual", "homosexuales"], ["gay", "gay relationship"]],
  [["lgtb", "lgbt", "lgtbi", "lgbtq", "lgtbiq", "queer"], ["lgbt", "queer"]],
  [["trans", "transexual", "transgenero"], ["transgender"]],
  [["bisexual"], ["bisexuality"]],
  [["navidad", "navideña", "navideñas", "navideno", "navidenas", "navidenos"], ["christmas"]],
  [["halloween"], ["halloween"]],
  [["zombi", "zombis", "zombie", "zombies"], ["zombie"]],
  [["vampiro", "vampiros"], ["vampire"]],
  [["hombre lobo", "hombres lobo"], ["werewolf"]],
  [["bruja", "brujas", "brujeria"], ["witch"]],
  [["fantasma", "fantasmas", "casa encantada"], ["ghost", "haunted house"]],
  [["posesion", "posesiones", "exorcismo"], ["possession", "exorcism"]],
  [["viajes en el tiempo", "viaje en el tiempo", "viajar en el tiempo"], ["time travel"]],
  [["hechos reales", "historia real", "basada en hechos", "basado en hechos", "caso real", "verídica", "veridica"], ["based on true story"]],
  [["true crime", "crimen real", "crimenes reales"], ["true crime"]],
  [["asesino en serie", "asesinos en serie"], ["serial killer"]],
  [["atraco", "atracos", "robo", "robos", "golpe"], ["heist"]],
  [["espia", "espias", "espionaje"], ["spy", "espionage"]],
  [["mafia", "mafiosos"], ["mafia"]],
  [["narco", "narcos", "narcotrafico", "cartel"], ["drug cartel", "drug trafficking"]],
  [["carcel", "prision", "presos"], ["prison"]],
  [["secta", "sectas"], ["cult"]],
  [["detective", "detectives"], ["detective"]],
  [["psicopata", "psicopatas"], ["psychopath"]],
  [["juicio", "juicios", "abogado", "abogados", "tribunal"], ["courtroom", "lawyer"]],
  [["medicos", "medico", "hospital", "hospitales"], ["hospital", "doctor"]],
  [["policia", "policias", "policiaca", "policiacas"], ["police"]],
  [["distopia", "distopica", "distopicas", "distopico"], ["dystopia"]],
  [["apocalipsis", "postapocaliptica", "postapocaliptico", "fin del mundo"], ["post-apocalyptic future", "apocalypse"]],
  [["extraterrestre", "extraterrestres", "alien", "aliens", "ovni"], ["alien"]],
  [["espacio", "espacial", "astronauta", "astronautas"], ["space", "astronaut"]],
  [["inteligencia artificial", "robots", "robot"], ["artificial intelligence (a.i.)", "robot"]],
  [["superheroe", "superheroes"], ["superhero"]],
  [["dinosaurio", "dinosaurios"], ["dinosaur"]],
  [["tiburon", "tiburones"], ["shark"]],
  [["supervivencia", "sobrevivir"], ["survival"]],
  [["venganza"], ["revenge"]],
  [["isla", "isla desierta"], ["island", "deserted island"]],
  [["segunda guerra mundial"], ["world war ii"]],
  [["primera guerra mundial"], ["world war i"]],
  [["guerra civil"], ["spanish civil war"]],
  [["nazi", "nazis", "holocausto"], ["nazi", "holocaust"]],
  [["guerra", "guerras", "belica", "belicas"], ["war"]],
  [["cocina", "cocinero", "chef", "comida"], ["chef", "cooking"]],
  [["musical", "musicales"], ["musical"]],
  [["baile", "bailar", "danza"], ["dance"]],
  [["futbol"], ["football (soccer)"]],
  [["boxeo"], ["boxing"]],
  [["deporte", "deportes", "deportiva", "deportivas"], ["sports"]],
  [["perro", "perros"], ["dog"]],
  [["gato", "gatos"], ["cat"]],
  [["caballo", "caballos"], ["horse"]],
  [["adolescente", "adolescentes", "instituto"], ["high school", "coming of age"]],
  [["universidad", "universitarios"], ["college"]],
  [["madurar", "hacerse mayor", "coming of age"], ["coming of age"]],
  [["primer amor"], ["first love"]],
  [["amor de verano", "verano"], ["summer"]],
  [["boda", "bodas"], ["wedding"]],
  [["divorcio"], ["divorce"]],
  [["embarazo", "embarazada"], ["pregnancy"]],
  [["maternidad", "madre e hija", "madres"], ["mother daughter relationship", "motherhood"]],
  [["padre e hijo", "paternidad"], ["father son relationship"]],
  [["hermanas", "hermanos"], ["sister sister relationship", "brother brother relationship"]],
  [["amistad", "amigas", "amigos"], ["friendship"]],
  [["familia disfuncional"], ["dysfunctional family"]],
  [["feminismo", "feminista", "feministas"], ["feminism"]],
  [["racismo"], ["racism"]],
  [["inmigracion", "inmigrantes", "migrantes"], ["immigration"]],
  [["enfermedad", "cancer"], ["cancer", "illness"]],
  [["salud mental", "depresion", "ansiedad"], ["mental illness", "depression"]],
  [["viaje por carretera", "road movie"], ["road trip"]],
  [["viajes", "viajar"], ["travel"]],
  [["videojuego", "videojuegos"], ["video game"]],
  [["arte", "pintor", "pintora", "pintura"], ["painter", "art"]],
  [["moda"], ["fashion"]],
  [["periodismo", "periodista", "periodistas"], ["journalism"]],
  [["politica", "politicos", "elecciones"], ["politics", "election"]],
  [["religion", "monjas", "iglesia"], ["religion", "nun"]],
  [["galicia", "gallega", "gallego"], ["galicia"]],
  [["madrid"], ["madrid, spain"]],
  [["barcelona"], ["barcelona, spain"]],
  [["japon", "japonesa"], ["japan"]],
  [["corea", "coreana", "coreanas"], ["south korea"]],
  [["nueva york"], ["new york city"]],
  [["paris"], ["paris, france"]],
  [["epoca victoriana", "victoriana"], ["victorian era"]],
  [["medieval", "edad media"], ["middle ages"]],
  [["vikingos", "vikingo"], ["vikings (norsemen)"]],
  [["romanos", "antigua roma"], ["ancient rome"]],
];
const STOP = new Set(["de", "del", "la", "las", "el", "los", "un", "una", "unas", "unos", "con", "sin", "sobre", "que", "y", "o", "en", "para", "trama", "tema", "temas", "peli", "pelis", "pelicula", "peliculas", "serie", "series", "documental", "documentales", "algo", "alguna", "algun", "quiero", "busco", "ver", "historia", "historias", "buena", "buenas", "buen", "buenos"]);
function themeTerms(q) {
  const n = " " + norm(q) + " ", terms = new Set(), hits = [];
  for (const [es, en] of THEMES) if (es.some(w => n.includes(" " + norm(w) + " "))) { en.forEach(t => terms.add(t)); hits.push(es[0]); }
  const rest = norm(q).split(" ").filter(w => w.length > 2 && !STOP.has(w) && !/^(comedi|drama|terror|miedo|romant|romance|accion|animac|documental|thriller|suspense|intriga|fantasia|familiar)/.test(w) && !THEMES.some(([es]) => es.some(x => norm(x).split(" ").includes(w))));
  if (!terms.size && rest.length) terms.add(rest.join(" "));
  return { terms: [...terms], hits };
}
const GWORDS = [[/comedi/, { movie: 35, tv: 35 }], [/\bdrama|dramon/, { movie: 18, tv: 18 }], [/terror|miedo/, { movie: 27, tv: 9648 }], [/romant|romance/, { movie: 10749, tv: 18 }],
  [/accion/, { movie: 28, tv: 10759 }], [/animacion|animada|dibujos|anime/, { movie: 16, tv: 16 }], [/documental/, { movie: 99, tv: 99 }], [/thriller|suspense|intriga/, { movie: 53, tv: 80 }],
  [/ciencia ficcion|scifi/, { movie: 878, tv: 10765 }], [/fantasia/, { movie: 14, tv: 10765 }], [/familiar|para ninos/, { movie: 10751, tv: 10751 }]];
async function themeSearch(q, type, onlyMine) {
  const { terms } = themeTerms(q);
  if (!terms.length) return [];
  const nq = norm(q), gw = GWORDS.filter(([re]) => re.test(nq)).map(([, g]) => g);
  const kwIds = new Set();
  await Promise.all(terms.map(async t => {
    try {
      const r = await tmdb("/search/keyword", { query: t, language: undefined }, 168);
      const nt = norm(t);
      const good = r.results.filter(k => norm(k.name) === nt).concat(r.results.filter(k => norm(k.name).startsWith(nt + " ") || norm(k.name).endsWith(" " + nt))).slice(0, 3);
      (good.length ? good : r.results.slice(0, 1)).forEach(k => kwIds.add(k.id));
    } catch (e) {}
  }));
  if (!kwIds.size) return [];
  const types = type === "all" ? ["movie", "tv"] : [type];
  const ids = onlyMine ? providerIds(S.plats).join("|") : "";
  const lists = await Promise.all(types.map(t => tmdb(`/discover/${t}`, {
    with_keywords: [...kwIds].join("|"), with_genres: gw.map(g => g[t]).join(",") || undefined, sort_by: "popularity.desc", "vote_count.gte": 15,
    watch_region: ids ? "ES" : undefined, with_watch_providers: ids || undefined, with_watch_monetization_types: ids ? "flatrate|free|ads" : undefined,
  }, 24).then(r => r.results.map(z => fromTmdb(z, t))).catch(() => [])));
  const out = []; for (let i = 0; i < 20; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out.slice(0, 24);
}
function openSearch(initial) {
  const inp = h("input", { class: "field", type: "search", placeholder: "Un título o un tema: «lesbianas», «navidad»…", enterkeyhint: "search", autocomplete: "off" });
  if (initial) inp.value = initial;
  let type = "all", onlyMine = true, t, seq = 0;
  const typeChips = h("div", { class: "chips wrap" });
  const paintChips = () => typeChips.replaceChildren(
    ...[["all", "Todo"], ["movie", "Películas"], ["tv", "Series"]].map(([k, l]) => h("button", { class: "chip", "aria-pressed": type === k ? "true" : "false", onclick: () => { type = k; paintChips(); run(); } }, l)),
    h("button", { class: "chip", "aria-pressed": onlyMine ? "true" : "false", onclick: () => { onlyMine = !onlyMine; paintChips(); run(); } }, "Solo nuestras plataformas"));
  paintChips();
  const res = h("div", { style: "display:flex;flex-direction:column;gap:14px" });
  const sugs = h("div", { class: "chips wrap" }, ["Lesbianas", "Navidad", "Hechos reales", "Atracos", "Viajes en el tiempo", "Zombis", "Galicia", "Coming of age"].map(x => h("button", { class: "chip", onclick: () => { inp.value = x; run(); } }, x)));
  const run = async () => {
    const q = inp.value.trim(), my = ++seq;
    sugs.hidden = q.length >= 2;
    if (q.length < 2) { res.replaceChildren(); return; }
    if (!TMDB) { res.replaceChildren(h("p", { class: "note" }, "Falta la clave de TMDB para buscar.")); return; }
    res.replaceChildren(h("div", { class: "grid" }, Array.from({ length: 6 }, () => h("div", { class: "tile" }, h("div", { class: "poster skel" })))));
    const { hits } = themeTerms(q);
    const [themed, byTitle] = await Promise.all([
      themeSearch(q, type, onlyMine),
      tmdb("/search/multi", { query: q }, 6).then(r => r.results.filter(x => (x.media_type === "movie" || x.media_type === "tv") && (type === "all" || x.media_type === type) && (x.poster_path || x.vote_count > 20)).slice(0, 12).map(x => fromTmdb(x))).catch(() => []),
    ]);
    if (my !== seq) return;
    const seenK = new Set(themed.map(x => x.key));
    const titles = byTitle.filter(x => !seenK.has(x.key));
    const blocks = [];
    if (themed.length) blocks.push(h("div", { class: "sec" }, h("h2", null, `Sobre «${q}»`), h("small", null, onlyMine ? "En vuestras plataformas" : "En cualquier plataforma")), h("div", { class: "grid" }, themed.map(it => tile(it))));
    else if (hits.length) blocks.push(h("p", { class: "note" }, onlyMine ? `No encuentro títulos sobre «${q}» en vuestras plataformas. Desmarca «Solo nuestras plataformas» para ver todos.` : `No encuentro títulos sobre «${q}».`));
    if (titles.length) blocks.push(h("div", { class: "sec" }, h("h2", null, "Por título"), h("small", null, "")), h("div", { class: "grid" }, titles.map(it => tile(it))));
    if (!blocks.length) blocks.push(h("p", { class: "note" }, "No encuentro nada. Prueba con otra palabra o con el título."));
    res.replaceChildren(...blocks);
  };
  inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(run, 400); });
  openSheet(h("div", { class: "settings" }, h("h2", null, "Buscar"), inp, typeChips, sugs, res));
  if (initial) run(); else setTimeout(() => inp.focus(), 60);
}

/* ---------- chat con IA ---------- */
function aiContext() {
  const me = S.profile, L = (arr, n) => arr.slice(0, n).map(x => `${x.item.title}${x.item.year ? " (" + x.item.year + ")" : ""}`).join("; ") || "nada";
  const lines = [`Fecha: ${new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.`,
    `Pregunta: ${PROF[me].name}.`, `Plataformas que tienen en España: ${S.plats.join(", ")}.`];
  for (const p of PROFILES) {
    lines.push(`\n${p.name}${p.id === me ? " (quien pregunta)" : ""}:`,
      `- Quiere ver: ${L(S.data.lists.filter(x => x.owner === p.id), 40)}`,
      `- Ya ha visto: ${L(S.data.seen.filter(x => x.owner === p.id), 60)}`,
      `- Ha descartado: ${L(S.data.nopes.filter(x => x.owner === p.id), 40)}`);
  }
  const all = S.data.lists.filter(x => x.owner === "comun").slice(0, 30);
  lines.push("\nLista de todos:" + (all.length ? "" : " vacía"));
  for (const x of all) { const cm = commentsOf(x.key).slice(-4).map(c => `${PROF[c.author].name}: "${c.body.slice(0, 140)}"`).join(" | "); lines.push(`- ${x.item.title}${cm ? " · comentarios: " + cm : ""}`); }
  if (S.trends) { lines.push(`\nLo más visto en España (${S.trends.label}):`); for (const p of ownedTrendPlats()) lines.push(`- ${p}: ${[...trendItems(p, "tv").slice(0, 4), ...trendItems(p, "movie").slice(0, 3)].map(i => i.title).join(", ")}`); }
  return lines.join("\n");
}
function openChat() {
  const body = h("div", { class: "settings", style: "gap:14px" });
  const list = h("div", { class: "chat" });
  const inp = h("input", { class: "field", type: "text", placeholder: "¿Qué os apetece ver?", enterkeyhint: "send", autocomplete: "off" });
  const sendBtn = h("button", { class: "btn dark", "aria-label": "Enviar" }, svg("send"));
  const form = h("form", { class: "chat-in", onsubmit: e => { e.preventDefault(); ask(inp.value); inp.value = ""; } }, inp, sendBtn);
  const paint = () => {
    list.replaceChildren();
    if (!S.chat.length) {
      list.append(h("div", { class: "msg ai" }, `Hola, ${PROF[S.profile].name}. Cuéntame qué os apetece, con quién lo vais a ver o algo que os gustó, y te propongo títulos de vuestras plataformas.`));
      list.append(h("div", { class: "sugs" }, ["Algo para reírnos esta noche", "Una serie corta que enganche", "Peli para ver los tres", "Algo como Fariña", "Un thriller español"].map(s => h("button", { class: "chip", onclick: () => ask(s) }, s))));
    }
    for (const m of S.chat) {
      if (m.role === "user") list.append(h("div", { class: "msg me" }, m.text));
      else {
        list.append(h("div", { class: "msg ai" + (m.typing ? " typing" : "") }, m.reply || m.text));
        if (m.picks && m.picks.length) list.append(h("div", { class: "picks" }, m.picks.map(p => pickEl(p))));
      }
    }
    const lastEl = list.lastElementChild; if (lastEl) setTimeout(() => lastEl.scrollIntoView({ block: "end", behavior: "smooth" }), 30);
  };
  const ask = async (text) => {
    text = String(text || "").trim(); if (!text) return;
    S.chat.push({ role: "user", text });
    const pending = { role: "assistant", typing: true, text: "Pensando…" };
    S.chat.push(pending); paint();
    if (!REMOTE) { Object.assign(pending, { typing: false, text: "La IA se activa cuando conectemos Supabase y la clave de Anthropic. De momento, usa Descubrir: desliza y aprende tus gustos." }); paint(); return; }
    try {
      const base = CFG.supabaseUrl.replace(/\/+$/, "");
      const headers = { apikey: CFG.supabaseAnonKey, "Content-Type": "application/json" };
      if (CFG.supabaseAnonKey.startsWith("eyJ")) headers.Authorization = "Bearer " + CFG.supabaseAnonKey;
      const msgs = S.chat.filter(m => !m.typing).slice(-10).map(m => ({ role: m.role, text: m.role === "user" ? m.text : (m.reply || m.text) + (m.picks ? " Propuse: " + m.picks.map(p => p.title).join(", ") : "") }));
      const r = await fetch(`${base}/functions/v1/recomendar`, { method: "POST", headers, body: JSON.stringify({ pin: S.pin, messages: msgs, context: aiContext() }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const why = r.status === 404 ? "La función de IA aún no está creada en Supabase." : d.error === "nokey" ? "Falta guardar la clave de Anthropic en Supabase." : d.error === "pin" ? "El PIN no es correcto." : d.error === "claude" ? "Claude ha dado un error: " + (d.detail || "") : "No he podido contestar. Prueba otra vez.";
        Object.assign(pending, { typing: false, text: why }); paint(); return;
      }
      const picks = (d.picks || []).map(p => ({ title: String(p.title || ""), alt: p.original_title, year: p.year ? String(p.year) : "", type: p.type === "tv" ? "tv" : "movie", why: String(p.why || "") })).filter(p => p.title);
      Object.assign(pending, { typing: false, reply: d.reply || "Aquí tienes:", text: d.reply, picks });
      paint();
      await Promise.all(picks.map(async p => { await resolve(p, p.alt); await providersOf(p); }));
      paint();
    } catch (e) { Object.assign(pending, { typing: false, text: "Sin conexión. Prueba otra vez." }); paint(); }
  };
  body.append(h("div", { class: "chat-head" }, h("span", { class: "spark" }, svg("spark")), h("div", null, h("h2", null, "Pregúntale a la IA"), h("p", { class: "note" }, "Conoce lo que habéis visto y lo que os apetece"))), list, form);
  openSheet(body);
  paint();
}
function pickEl(p) {
  p.key = p.key || keyOf(p);
  const own = p.prov ? p.prov.own : [];
  return h("button", { class: "pick", onclick: () => openItem(p) }, posterEl(p),
    h("div", null, h("b", null, p.title), h("div", { class: "m" }, [typeLabel(p.type), p.year, p.vote ? "★ " + Number(p.vote).toFixed(1) : ""].filter(Boolean).join(" · ")),
      h("div", { class: "w" }, p.why),
      own.length ? h("div", { class: "pp" }, own.slice(0, 3).map(x => x.logo ? h("img", { src: IMG + "w92" + x.logo, alt: x.name, title: x.name }) : null))
        : p.prov ? h("div", { class: "m" }, "No está en vuestras plataformas ahora") : null));
}

/* ---------- ajustes ---------- */
function openSettings() {
  const me = PROF[S.profile];
  openSheet(h("div", { class: "settings" },
    h("div", { style: "display:flex;align-items:center;gap:12px" }, avatar(S.profile), h("div", null, h("h2", null, me.name), h("p", { class: "note" }, REMOTE ? "Conectado: las listas se comparten entre los tres" : "Modo prueba: los datos se guardan solo en este móvil"))),
    h("div", { class: "box" }, h("h4", null, "Plataformas que tenéis"),
      h("div", { class: "chips wrap" }, PLATFORMS.map(p => h("button", { class: "chip", "aria-pressed": S.plats.includes(p.id) ? "true" : "false", onclick: e => {
        S.plats = S.plats.includes(p.id) ? S.plats.filter(x => x !== p.id) : [...S.plats, p.id]; store.set("qv_plats", S.plats);
        e.currentTarget.setAttribute("aria-pressed", S.plats.includes(p.id) ? "true" : "false"); S.deck = []; } },
        PROV && PROV.logos[p.id] ? h("img", { src: IMG + "w92" + PROV.logos[p.id], alt: "" }) : h("span", { class: "dot", style: `background:${p.c}` }), p.id)))),
    h("div", { style: "display:flex;gap:8px;flex-wrap:wrap" },
      h("button", { class: "btn", onclick: () => { closeSheet(); logout(false); } }, "Cambiar de perfil"),
      REMOTE ? h("button", { class: "btn", onclick: () => { closeSheet(); logout(true); } }, "Salir") : null),
    h("p", { class: "note" }, "Instálala como app: en iPhone, Compartir → «Añadir a pantalla de inicio». En Android, menú ⋮ → «Instalar aplicación»."),
    h("p", { class: "foot" }, attributionText())));
}

/* ---------- entrada ---------- */
let pinBuf = "", chosen = null;
function showLogin() {
  $("app").hidden = true; $("login").hidden = false;
  $("who").replaceChildren(...PROFILES.map(p => h("button", { "aria-pressed": chosen === p.id ? "true" : "false", onclick: () => pick(p.id) }, avatar(p.id), p.name)));
  const needPin = !!(chosen && REMOTE && !S.pin);
  $("pinbox").hidden = !needPin;
  $("loginSub").textContent = needPin ? `Hola, ${PROF[chosen].name}. Mete el PIN de casa` : "¿Quién eres?";
}
function pick(id) { chosen = id; if (REMOTE && !S.pin) { pinBuf = ""; showLogin(); paintPin(); return; } enter(id); }
function paintPin(err) { $("pindots").querySelectorAll("i").forEach((d, i) => d.classList.toggle("on", i < pinBuf.length)); $("pinerr").textContent = err || ""; }
function buildKeypad() {
  $("keypad").replaceChildren(...["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map(k => k === "" ? h("span") : h("button", { class: k === "⌫" ? "ghost" : "", "aria-label": k === "⌫" ? "Borrar" : k, onclick: () => key(k) }, k)));
}
async function key(k) {
  if (k === "⌫") { pinBuf = pinBuf.slice(0, -1); paintPin(); return; }
  if (pinBuf.length >= 4) return;
  pinBuf += k; paintPin();
  if (pinBuf.length < 4) return;
  try {
    const ok = await rpc("qv_login", { p_pin: pinBuf });
    if (!ok) { pinBuf = ""; paintPin("PIN incorrecto"); return; }
    S.pin = pinBuf; store.set("qv_pin", S.pin); pinBuf = ""; enter(chosen);
  } catch (e) { pinBuf = ""; paintPin("Sin conexión. Prueba otra vez."); }
}
async function enter(id) {
  S.profile = id; store.set("qv_profile", id); S.mineOf = null; S.deck = []; S.swiped = new Set(); S.history = []; S.chat = [];
  $("login").hidden = true; $("app").hidden = false;
  $("meBtn").replaceChildren(avatar(id, "sm"));
  go("discover");
  await refresh(true);
  buildDeck(true);
}
function logout(forgetPin) {
  if (forgetPin) { S.pin = null; store.del("qv_pin"); }
  S.profile = null; store.del("qv_profile"); chosen = null; pinBuf = "";
  showLogin();
}

/* ---------- arranque ---------- */
async function boot() {
  buildKeypad();
  document.querySelectorAll(".tabbar button").forEach(b => b.addEventListener("click", () => go(b.dataset.v)));
  $("meBtn").onclick = openSettings; $("searchBtn").onclick = openSearch;
  $("sheetClose").onclick = closeSheet; $("scrim").onclick = closeSheet;
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !$("sheet").hidden) closeSheet();
    if (S.view === "discover" && $("sheet").hidden && !$("app").hidden && !/INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || "")) {
      if (e.key === "ArrowRight") swipeTop("yes"); else if (e.key === "ArrowLeft") swipeTop("no"); else if (e.key === "ArrowUp") swipeTop("all");
    }
  });
  const day = new Date().toISOString().slice(0, 10);
  const [tr] = await Promise.all([fetch("data/trends.json?d=" + day).then(r => r.json()).catch(() => null), loadProviders()]);
  S.trends = tr;
  if (S.profile && PROF[S.profile] && (!REMOTE || S.pin)) enter(S.profile); else showLogin();
  setInterval(() => { if (S.profile && document.visibilityState === "visible") refresh(true); }, 20000);
  document.addEventListener("visibilitychange", () => { if (S.profile && document.visibilityState === "visible") refresh(true); });
}
boot();
