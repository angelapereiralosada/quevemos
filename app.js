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
const PERSONAL = ["oswaldo", "ana", "angela"];
const SHARED = [
  { id: "casina", name: "Casiña", short: "Casiña", emo: "🏠", members: ["angela", "oswaldo"], c: "#00bfb3" },
  { id: "os3", name: "Cando estemos os 3", short: "Os 3", emo: "🍿", members: ["oswaldo", "ana", "angela"], c: "#ff2e88" },
  { id: "aitor", name: "Para ver co Aitor", short: "Co Aitor", emo: "💑", members: ["ana"], c: "#6c4cff" },
];
const LIST = Object.fromEntries(SHARED.map(l => [l.id, l]));
const canRead = (u, l) => PERSONAL.includes(l) || (LIST[l] ? LIST[l].members.includes(u) : false);
const myLists = () => [{ id: S.profile, name: "Mi lista", short: "Mi lista", emo: "❤️", members: [S.profile], c: "#ffd60a", personal: true }, ...SHARED.filter(l => l.members.includes(S.profile))];
const listName = id => PERSONAL.includes(id) ? (id === S.profile ? "Mi lista" : "la lista de " + PROF[id].name) : LIST[id] ? LIST[id].name : id;
const listEmo = id => PERSONAL.includes(id) ? "❤️" : LIST[id] ? LIST[id].emo : "📼";
const membersOf = id => PERSONAL.includes(id) ? [id] : LIST[id] ? LIST[id].members : [];
const PLATFORMS = [
  { id: "Netflix", re: /^netflix$/i, c: "#e50914" },
  { id: "Prime Video", re: /^(amazon )?prime video$/i, c: "#1399ff" },
  { id: "HBO Max", re: /^(hbo max|max)$/i, c: "#5a2de5" },
  { id: "Disney+", re: /^disney (plus|\+)$/i, c: "#113ccf" },
  { id: "Movistar Plus+", re: /^movistar/i, c: "#0b8fd6" },
  { id: "Atresplayer", re: /^atres ?player/i, c: "#ff6b00" },
  { id: "Mitele", re: /^mitele/i, c: "#00a1e4" },
  { id: "Filmin", re: /^filmin$/i, c: "#111216" },
  { id: "Apple TV", re: /^apple tv/i, c: "#111216" },
  { id: "SkyShowtime", re: /^skyshowtime$/i, c: "#2f1e6e" },
  { id: "RTVE Play", re: /^rtve/i, c: "#e2001a" },
];
const PCOL = Object.fromEntries(PLATFORMS.map(p => [p.id, p.c]));
PCOL.Otras = "#111216";
const DEFAULT_PLATS = ["Netflix", "Prime Video", "HBO Max", "Disney+", "Movistar Plus+", "Atresplayer", "Mitele"];
const LIVE_TOP = ["Atresplayer", "Mitele"];
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
// Inserta hijos ignorando los huecos (null/false)
const fill = (el, ...k) => el.replaceChildren(...k.flat(3).filter(x => x != null && x !== false));
function svg(name) { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", P[name] || name); s.append(p); return s; }
const hash = s => { let x = 0; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) | 0; return Math.abs(x); };
const PH = [["#2a2c33", "#111216"], ["#ff5436", "#8a1d0f"], ["#4a6bff", "#1b2a7a"], ["#16a39a", "#0b4b47"], ["#f5b21b", "#8a5a00"], ["#7a4dff", "#2c1a6b"]];
function ago(iso) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!isFinite(d)) return "";
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
  plats: (() => { let p = store.get("qv_plats", DEFAULT_PLATS); if (!store.get("qv_plats_v4", 0)) { for (const x of ["Atresplayer", "Mitele"]) if (!p.includes(x)) p.push(x); store.set("qv_plats", p); store.set("qv_plats_v4", 1); } return p; })(),
  data: { lists: [], seen: [], nopes: [], comments: [] },
  view: "discover", listSel: null, listTab: "todo",
  f: { type: "all", plat: null, short: false, mini: false, es: false, kids: false },
  deck: [], deckBusy: false, deckRound: 0, swiped: new Set(), history: [],
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
    if (PERSONAL.includes(owner)) d.nopes = d.nopes.filter(x => !(x.owner === owner && x.key === it.key));
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
  rate(it, rating) {
    const d = S.data, me = S.profile;
    const ex = d.seen.find(x => x.owner === me && x.key === it.key);
    if (ex) ex.rating = rating; else d.seen.unshift({ owner: me, key: it.key, item: slim(it), at: now(), rating });
    d.lists = d.lists.filter(x => !(x.owner === me && x.key === it.key));
    d.nopes = d.nopes.filter(x => !(x.owner === me && x.key === it.key));
    return REMOTE ? rpc("qv_rate", { p_pin: S.pin, p_owner: me, p_key: it.key, p_item: slim(it), p_rating: rating }) : null;
  },
  nope(it) {
    if (!S.data.nopes.some(x => x.owner === S.profile && x.key === it.key)) S.data.nopes.push({ owner: S.profile, key: it.key, item: slim(it) });
    return REMOTE ? rpc("qv_nope", { p_pin: S.pin, p_owner: S.profile, p_key: it.key, p_item: slim(it) }) : null;
  },
  unnope(key) {
    S.data.nopes = S.data.nopes.filter(x => !(x.owner === S.profile && x.key === key));
    return REMOTE ? rpc("qv_unnope", { p_pin: S.pin, p_owner: S.profile, p_key: key }) : null;
  },
  commentAdd(list, it, body) {
    S.data.comments.push({ id: "tmp" + Date.now() + Math.random(), list, key: it.key, item: slim(it), author: S.profile, body, at: now() });
    return REMOTE ? rpc("qv_comment_add", { p_pin: S.pin, p_list: list, p_key: it.key, p_item: slim(it), p_author: S.profile, p_body: body }) : null;
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
  if (!REMOTE) { S.data = Object.assign({ lists: [], seen: [], nopes: [], comments: [] }, store.get("qv_localdb3", {})); paintBadge(); computeNews(); if (!silent) rerender(); return; }
  if (S.inflight) return;
  try {
    const d = await rpc("qv_state", { p_pin: S.pin, p_user: S.profile });
    if (S.inflight) return;
    S.data = { lists: d.lists || [], seen: d.seen || [], nopes: d.nopes || [], comments: d.comments || [] };
    paintBadge(); computeNews();
    rerender(silent);
  } catch (e) {
    if (e.code === "28000") { logout(true); return; }
    if (!silent) toast("Sin conexión con la base de datos.");
  }
}
const inList = (owner, key) => S.data.lists.some(x => x.owner === owner && x.key === key);
const wantedBy = key => S.data.lists.filter(x => PERSONAL.includes(x.owner) && x.key === key).map(x => x.owner);
const visLists = () => S.data.lists.filter(x => canRead(S.profile, x.owner));
const listsOf = key => visLists().filter(x => x.key === key).map(x => x.owner);
const seenBy = key => S.data.seen.filter(x => x.key === key).map(x => x.owner);
const isSeen = key => S.data.seen.some(x => x.owner === S.profile && x.key === key);
const isNope = key => S.data.nopes.some(x => x.owner === S.profile && x.key === key);
const commentsOf = (key, list) => S.data.comments.filter(c => c.key === key && canRead(S.profile, c.list || "os3") && (!list || (c.list || "os3") === list));

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
  if (b) Object.assign(it, { id: b.id, poster: b.poster, backdrop: b.backdrop, vote: b.vote, g: b.g, lang: b.lang, otitle: b.otitle, year: it.year || b.year, overview: it.overview || b.overview, key: b.key });
  return it;
}
let PROV = store.get("qv_prov4", null);
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
    PROV = { t: Date.now(), map, logos }; store.set("qv_prov4", PROV);
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
  S.data.lists.filter(x => !PERSONAL.includes(x.owner) && x.by === user).forEach(x => add(x.item.g, 1));
  S.data.seen.filter(x => x.owner === user).forEach(x => add(x.item.g, x.rating ? (x.rating - 3) * 1.3 + (x.rating >= 4 ? 1 : 0) : 1));
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
  const F = S.f, strict = F.short || F.mini;
  const types = F.mini ? ["tv"] : F.type === "all" ? ["tv", "movie"] : [F.type];
  const KIDS = [10751, 16, 10762];
  const cands = new Map();
  const add = (it, why, boost, verified) => {
    if (!it || !it.title) return; it.key = it.key || keyOf(it);
    if (known.has(it.key) || !types.includes(it.type)) return;
    const c = cands.get(it.key);
    if (c) { c.boost += boost * .5; if (boost > c.mainBoost) { c.why = why; c.mainBoost = boost; } c.verified = c.verified || verified; return; }
    cands.set(it.key, { it, why, boost, mainBoost: boost, verified });
  };
  const jobs = [];
  const ids = providerIds(F.plat ? [F.plat] : S.plats).join("|");

  // 1) Lo que les apetece a los demás
  if (!strict) for (const o of others()) for (const x of S.data.lists.filter(l => l.owner === o)) {
    const it = { ...x.item, key: x.key };
    const both = wantedBy(x.key).filter(u => u !== me);
    add(it, both.length > 1 ? "A los dos les apetece: ¿hacéis match?" : `A ${PROF[o].name} le apetece`, 2.2 * both.length, false);
  }
  if (!strict) visLists().filter(x => !PERSONAL.includes(x.owner)).forEach(x => add({ ...x.item, key: x.key }, `Está en ${LIST[x.owner].short}`, 1.6, false));

  if (TMDB && ids) {
    // 2) Parecidas a lo que te gustó
    const liked = shuffle([...S.data.lists.filter(x => x.owner === me), ...S.data.seen.filter(x => x.owner === me && (!x.rating || x.rating >= 4))].filter(x => x.item.id)).slice(0, 3);
    if (!strict) for (const x of liked) jobs.push(limit(() => tmdb(`/${x.item.type}/${x.item.id}/recommendations`, { page: 1 + (round % 2) }, 48)).then(r =>
      r.results.filter(z => z.media_type === "movie" || z.media_type === "tv").slice(0, 10).forEach(z => add(fromTmdb(z), `Porque te gustó ${x.item.title}`, 1.8, false))).catch(() => {}));
    // 3) Catálogo real de vuestras plataformas, orientado a tus géneros
    for (const type of types) {
      const tg = F.kids ? [] : taste.n >= 3 ? topGenres(taste, type, 2) : [];
      const loose = F.es || F.kids || F.mini || F.plat;
      const base = { watch_region: "ES", with_watch_providers: ids, with_watch_monetization_types: "flatrate|free|ads", "vote_count.gte": loose ? 40 : type === "movie" ? 300 : 150 };
      if (type === "tv") base.without_genres = "10763,10767" + (taste.w[10764] > 0 ? "" : ",10764");
      if (F.kids) { base.with_genres = type === "movie" ? "10751|16" : "10762|10751|16"; base.without_genres = (base.without_genres ? base.without_genres + "," : "") + "27,53,80"; }
      if (F.es) base.with_original_language = "es";
      if (F.short) base["with_runtime.lte"] = type === "movie" ? 120 : 35;
      if (F.mini && type === "tv") base.with_type = "2";
      const pg = 1 + ((round + hash(me)) % 4);
      jobs.push(tmdb(`/discover/${type}`, { ...base, sort_by: "popularity.desc", page: loose ? 1 + (round % 3) : pg, with_genres: base.with_genres || tg.join("|") || undefined }, 12).then(r =>
        r.results.forEach(z => { const it = fromTmdb(z, type); const a = affinity(it.g, taste); const g = it.g.find(id => tg.includes(id));
          add(it, g && a > .15 ? `Te van las de ${GENRE[g]}` : "Lo más visto en tus plataformas", .6, true); })).catch(() => {}));
      jobs.push(tmdb(`/discover/${type}`, { ...base, sort_by: "vote_average.desc", "vote_count.gte": loose ? 150 : type === "movie" ? 1500 : 600, page: 1 + ((round * 3 + hash(me)) % (loose ? 2 : 6)), with_genres: base.with_genres || tg.slice(0, 1).join("|") || undefined }, 24).then(r =>
        r.results.forEach(z => add(fromTmdb(z, type), "Joya muy bien valorada", .8, true))).catch(() => {}));
    }
  }
  // 4) Top de la semana
  if (S.trends && !strict) for (const p of ownedTrendPlats().filter(p => !F.plat || p === F.plat)) {
    for (const kind of ["tv", "movie"]) trendItems(p, kind).slice(0, 4).forEach(it => add(it, it.trend.n ? `Nº ${it.trend.n} en ${p === "Otras" ? "su plataforma" : p} esta semana` : `Novedad en ${p}`, 1.2 - (it.trend.n || 5) * .1, true));
  }
  await Promise.all(jobs);

  let list = [...cands.values()];
  // resolver lo que no viene de TMDB y comprobar disponibilidad de lo no verificado
  await Promise.all(list.map(c => resolve(c.it)));
  const re = new Map(); for (const c of list) { c.it.key = keyOf(c.it); if (!known.has(c.it.key) && !re.has(c.it.key)) re.set(c.it.key, c); }
  list = [...re.values()].filter(c => !c.it.g || !c.it.g.includes(10763))
    .filter(c => (!F.es || c.it.lang === "es") && (!F.kids || (c.it.g || []).some(g => KIDS.includes(g))) && types.includes(c.it.type));
  for (const c of list) c.score = (c.it.vote || 6.6) * .45 + affinity(c.it.g, taste) * 2.2 + c.boost + Math.random() * 1.1 - (c.it.votes != null && c.it.votes < 50 ? 1 : 0);
  list.sort((a, b) => b.score - a.score);
  const picked = [];
  for (const c of list) {
    if (picked.length >= 18) break;
    if (!c.verified && TMDB && c.it.id) {
      const pv = await providersOf(c.it);
      if (pv && !pv.own.length && c.mainBoost < 2) continue;
      if (F.plat && pv && !pv.own.some(p => p.plat === F.plat)) continue;
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
const emo = (e, cls) => h("span", { class: "emo" + (cls ? " " + cls : ""), "aria-hidden": "true" }, e);
const empty = (title, text, btn, e) => h("div", { class: "empty" }, emo(e || "🍿"), h("b", null, title), h("p", null, text), btn || null);
const starsTxt = n => "★".repeat(n) + "☆".repeat(5 - n);
const ratingOf = (user, key) => { const x = S.data.seen.find(s => s.owner === user && s.key === key); return x ? x.rating || null : null; };

/* ---------- navegación ---------- */
function rerender(silent) {
  if (S.view === "discover") { if (!silent) paintDiscover(); }
  else if (S.view === "top") renderTop();
  else if (S.view === "lists") renderLists();
  if (S.openKey && !$("sheet").hidden && $("dSocial")) paintSocial();
}
function go(view) {
  S.view = view; document.body.dataset.view = view;
  for (const v of ["discover", "top", "lists"]) $("v-" + v).hidden = v !== view;
  document.querySelectorAll(".tabbar button").forEach(b => { if (b.dataset.v === view) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  rerender();
  window.scrollTo(0, 0);
}
function paintBadge() {}

/* ---------- Descubrir ---------- */
function paintDiscover() {
  const v = $("v-discover"); v.replaceChildren();
  v.append(h("button", { class: "searchbar", onclick: () => openSearch() }, svg("M10.5 3a7.5 7.5 0 0 1 5.9 12.1l4.8 4.8-1.4 1.4-4.8-4.8A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z"), "Busca título o tema: navidad, atracos…"));
  const F = S.f;
  const set = (patch) => { Object.assign(S.f, patch); paintDiscover(); buildDeck(true); };
  const chip = (label, on, fn, e) => h("button", { class: "chip", "aria-pressed": on ? "true" : "false", onclick: fn }, e ? emo(e) : null, label);
  v.append(h("div", { class: "chips" },
    chip("Todo", F.type === "all" && !F.mini, () => set({ type: "all", mini: false })),
    chip("Series", F.type === "tv" && !F.mini, () => set({ type: "tv", mini: false }), "📺"),
    chip("Pelis", F.type === "movie", () => set({ type: "movie", mini: false }), "🎬"),
    chip("Miniseries", F.mini, () => set({ mini: !F.mini, type: F.mini ? F.type : "tv" }), "⚡"),
    chip("Menos de 2 h", F.short, () => set({ short: !F.short }), "⏱️"),
    chip("Españolas", F.es, () => set({ es: !F.es }), "🇪🇸"),
    chip("Con niños", F.kids, () => set({ kids: !F.kids }), "🧸"),
    ...S.plats.map(p => h("button", { class: "chip", "aria-pressed": F.plat === p ? "true" : "false", onclick: () => set({ plat: F.plat === p ? null : p }) },
      PROV && PROV.logos[p] ? h("img", { src: IMG + "w92" + PROV.logos[p], alt: "" }) : h("span", { class: "dot", style: `background:${PCOL[p]}` }), p))));
  const A = (cls, e, label, fn, id) => h("button", { class: "act " + cls, "aria-label": label, onclick: fn, id }, emo(e), label);
  v.append(h("div", { class: "deck-wrap" },
    h("div", { class: "deck", id: "deck" }),
    h("div", { class: "vcr" },
      h("div", { class: "vcr-screen" }, h("span", { id: "vcrL" }, "▶ PLAY"), h("span", { id: "vcrR" }, "")),
      h("div", { class: "actions" },
        A("", "⏪", "Atrás", undo, "undoBtn"),
        A("no", "✖️", "Paso", () => swipeTop("no")),
        A("seen", "👀", "Vista", () => swipeTop("seen")),
        A("yes", "❤️", "Llevar", () => swipeTop("yes"))))));
  v.append(h("div", { class: "duo" },
    h("button", { class: "ask ai", onclick: openChat }, emo("🤖"), h("b", null, "El dependiente"), h("span", null, "Pídele algo: «risa, nada largo»")),
    h("button", { class: "ask night", onclick: openNight }, emo("🍿"), h("b", null, "Noche de peli"), h("span", null, "Lo que os apetece a todos y ruleta"))));
  v.append(h("p", { class: "foot" }, "Desliza la cinta: a la derecha la guardas (y eliges en qué lista), a la izquierda la devuelves."));
  paintDeck();
  if (S.deck.length < 4 && !S.deckBusy) buildDeck(false);
}
function paintDeck() {
  const d = $("deck"); if (!d) return;
  d.replaceChildren();
  const u = $("undoBtn"); if (u) u.disabled = !S.history.length;
  const vr = $("vcrR"); if (vr) vr.textContent = `CINTA ${String(S.history.length + 1).padStart(3, "0")}`;
  const vl = $("vcrL"); if (vl) vl.textContent = S.deckBusy && !S.deck.length ? "⏩ BUSCANDO" : "▶ PLAY";
  if (!S.deck.length) {
    const anyF = S.f.plat || S.f.short || S.f.mini || S.f.es || S.f.kids;
    d.append(S.deckBusy ? h("div", { class: "deck-empty noise" }, h("b", null, "Rebobinando…"), h("p", { class: "note" }, "Buscando cintas para ti"))
      : h("div", { class: "deck-empty" }, emo("🫠"), h("b", null, "No quedan propuestas"),
        h("p", { class: "note" }, !TMDB ? "Falta la clave de TMDB para buscar en el catálogo." : anyF ? "Con estos filtros no encuentro más. Quita alguno." : "Prueba a añadir plataformas en tu perfil."),
        anyF ? h("button", { class: "btn sun", onclick: () => { S.f = { type: "all", plat: null, short: false, mini: false, es: false, kids: false }; paintDiscover(); buildDeck(true); } }, "Quitar filtros")
          : h("button", { class: "btn dark", onclick: () => buildDeck(true) }, "Buscar más")));
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
const TAGC = ["", "mag", "teal", "vio", "ora"];
function whyTag(why) {
  if (!why) return null;
  return h("span", { class: "tag-price why-tag " + TAGC[hash(why) % TAGC.length] }, why);
}
function cardEl(c, depth) {
  const it = c.it;
  const provBox = h("span", { class: "provs-mini" });
  const meta = h("div", { class: "card-meta" }, it.vote ? h("span", { class: "rate" }, "★ " + Number(it.vote).toFixed(1)) : null, h("span", null, [typeLabel(it.type).toUpperCase(), it.year].filter(Boolean).join(" · ")), provBox);
  const el = h("div", { class: "card" + (depth === 1 ? " behind" : depth === 2 ? " behind2" : " enter"), "data-key": it.key },
    h("div", { class: "vhs-top" }, h("b", null, "VHS"), h("span", null, it.type === "tv" ? "SERIE · SP" : "HI-FI STEREO")),
    h("div", { class: "cover" }, posterEl(it, false)),
    depth === 0 ? whyTag(c.why) : null,
    h("span", { class: "stamp yes" }, "¡LA GUARDO!"), h("span", { class: "stamp no" }, "DEVUELTA"),
    depth === 0 ? h("button", { class: "card-tap", "aria-label": "Ver la contraportada", onclick: e => { e.stopPropagation(); openItem(it); } }, svg("info")) : null,
    h("div", { class: "vhs-label" }, h("h3", null, it.title), meta));
  if (depth === 0) providersOf(it).then(pv => { if (pv && pv.own.length) fill(provBox, ...pv.own.slice(0, 3).map(p => p.logo ? h("img", { src: IMG + "w92" + p.logo, alt: p.name, title: p.name }) : null)); });
  if (depth <= 1 && it.poster) { const pre = new Image(); pre.src = IMG + "w500" + it.poster; }
  return el;
}
function bindSwipe(el, c) {
  let sx = 0, sy = 0, dx = 0, dy = 0, drag = false, moved = false;
  const stamps = { yes: el.querySelector(".stamp.yes"), no: el.querySelector(".stamp.no") };
  const setStamps = () => { stamps.yes.style.opacity = Math.max(0, Math.min(1, dx / 90)); stamps.no.style.opacity = Math.max(0, Math.min(1, -dx / 90)); };
  el.addEventListener("pointerdown", e => { if (e.target.closest(".card-tap")) return; drag = true; moved = false; sx = e.clientX; sy = e.clientY; dx = dy = 0; el.style.transition = "none"; el.setPointerCapture(e.pointerId); });
  el.addEventListener("pointermove", e => { if (!drag) return; dx = e.clientX - sx; dy = e.clientY - sy; if (Math.abs(dx) + Math.abs(dy) > 6) moved = true; el.style.transform = `translate(${dx}px,${dy}px) rotate(${dx / 18}deg)`; setStamps(); });
  const end = () => {
    if (!drag) return; drag = false;
    if (!moved) { el.style.transform = ""; openItem(c.it); return; }
    if (dx > 110) fly(el, "yes"); else if (dx < -110) fly(el, "no");
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
  const hist = { kind, it, c, added: [] };
  S.history.push(hist);
  if (S.history.length > 20) S.history.shift();
  if (kind === "yes") {
    act("listAdd", S.profile, it);
    const w = wantedBy(it.key);
    let matched = false;
    if (PROFILES.every(p => w.includes(p.id))) {
      if (!inList("os3", it.key)) { act("listAdd", "os3", it); hist.added.push("os3"); }
      toast(`🎉 ¡Match! A los tres os apetece ${it.title}. Va a «Os 3»`, "match"); confetti(); matched = true;
    } else if (LIST.casina.members.includes(S.profile) && LIST.casina.members.every(u => w.includes(u))) {
      if (!inList("casina", it.key)) { act("listAdd", "casina", it); hist.added.push("casina"); }
      toast(`💘 ¡Match en Casiña! A los dos os apetece ${it.title}`, "match"); confetti(70); matched = true;
    } else if (w.length === 2) { toast(`💘 ¡A ${PROF[w.find(u => u !== S.profile)].name} también le apetece!`, "match"); confetti(50); matched = true; }
    paintDeck();
    setTimeout(() => openSave(it, hist), matched ? 900 : 120);
    return;
  } else if (kind === "no") act("nope", it);
  else if (kind === "seen") { if (!isSeen(it.key)) act("rate", it, null); openRate(it); }
  paintDeck();
}
function undo() {
  const last = S.history.pop(); if (!last) return;
  const it = last.it;
  if (last.kind === "yes") { act("listRemove", S.profile, it.key); for (const l of last.added) act("listRemove", l, it.key); }
  else if (last.kind === "no") act("unnope", it.key);
  else if (last.kind === "seen" && isSeen(it.key)) act("seenToggle", it);
  S.swiped.delete(it.key);
  S.deck.unshift(last.c);
  toast("⏪ REBOBINADO");
  paintDeck();
}

/* ---------- guardar: elegir listas y comentar ---------- */
const QUICK = ["🔥 ¡Tiene pintaza!", "🍿 ¿Esta noche?", "😂 Para reírnos", "😱 Para pasar miedo", "💬 Me la recomendaron"];
function openSave(it, hist) {
  it.key = it.key || keyOf(it);
  const lists = myLists();
  const sel = new Set(lists.filter(l => inList(l.id, it.key)).map(l => l.id));
  if (hist) sel.add(S.profile);
  const ta = h("textarea", { class: "field", id: "saveCmt", rows: "2", maxlength: "1000", placeholder: "Escribe algo para los demás (opcional)", style: "width:100%" });
  const listBox = h("div", { class: "save-lists" });
  const paintLists = () => fill(listBox, lists.map(l => h("button", { class: "save-list" + (sel.has(l.id) ? " on" : ""), style: `--lc:${l.c}`, "aria-pressed": sel.has(l.id) ? "true" : "false",
    onclick: () => { sel.has(l.id) ? sel.delete(l.id) : sel.add(l.id); paintLists(); } },
    h("span", { class: "sl-emo" }, emo(l.emo)), h("span", { class: "sl-txt" }, h("b", null, l.name), h("small", null, l.personal ? "Solo tuya" : l.members.length === 3 ? "La veis los tres" : l.members.length === 1 ? "Solo la ves tú" : "La veis " + l.members.map(u => u === S.profile ? "tú" : PROF[u].name).join(" y "))),
    h("span", { class: "sl-check" }, sel.has(l.id) ? "✓" : ""))));
  paintLists();
  const save = () => {
    const was = new Set(lists.filter(l => inList(l.id, it.key)).map(l => l.id));
    for (const l of lists) {
      if (sel.has(l.id) && !was.has(l.id)) { act("listAdd", l.id, it); if (hist && l.id !== S.profile) hist.added.push(l.id); }
      if (!sel.has(l.id) && was.has(l.id)) act("listRemove", l.id, it.key);
    }
    const t = ta.value.trim();
    if (t) { const targets = [...sel].filter(id => !PERSONAL.includes(id)); (targets.length ? targets : sel.size ? [...sel] : [S.profile]).forEach(id => act("commentAdd", id, it, t)); }
    const names = lists.filter(l => sel.has(l.id)).map(l => l.short);
    toast(names.length ? `💾 GUARDADA EN ${names.join(" + ").toUpperCase()}` : "QUITADA DE TUS LISTAS");
    closeSheet();
  };
  openSheet(h("div", { class: "settings" },
    h("div", { class: "save-head" }, h("div", { style: "width:64px" }, posterEl(it, false)), h("div", null, h("span", { class: "strip sun" }, hist ? "¡GUARDADA!" : "GUARDAR"), h("h2", null, it.title))),
    h("div", { class: "box" }, h("h4", null, "¿En qué listas?"), listBox),
    h("div", { class: "box" }, h("h4", null, "Comentario"), h("div", { class: "quick-reacts" }, QUICK.map(q => h("button", { onclick: () => { ta.value = q; } }, q))), ta),
    h("button", { class: "btn dark", style: "width:100%;font-size:17px", onclick: save }, "💾 Guardar")));
}

/* ---------- Top ---------- */
const ownedTrendPlats = () => Object.keys((S.trends || {}).platforms || {}).filter(p => p === "Otras" ? OTHER_GROUP.some(o => S.plats.includes(o)) : S.plats.includes(p));
function trendItems(plat, kind) {
  const d = S.trends && S.trends.platforms[plat]; if (!d) return [];
  return (kind === "tv" ? d.series : d.movies).map((r, i) => ({ title: r.title, type: r.type, year: r.year, overview: r.syn, trend: { plat, n: d.ranked ? i + 1 : null } }));
}
function renderTop() {
  const v = $("v-top"); v.replaceChildren();
  v.append(h("div", { class: "head" }, h("div", null, h("h1", null, "Lo más ", h("span", { class: "hl" }, "alquilado")), h("p", null, S.trends ? `Lo más visto en España · ${S.trends.label}` : ""))));
  const plats = [...ownedTrendPlats(), ...LIVE_TOP.filter(p => S.plats.includes(p))];
  if (!plats.length) { v.append(empty("Elige vuestras plataformas", "Toca tu inicial arriba a la derecha y marca las que tenéis.", h("button", { class: "btn dark", onclick: openSettings }, "Elegir plataformas"))); return; }
  if (!plats.includes(S.topPlat)) S.topPlat = plats[0];
  v.append(h("div", { class: "marquee", "aria-hidden": "true" }, Array.from({ length: 22 }, () => h("i"))));
  v.append(h("div", { class: "chips" }, plats.map(p => h("button", { class: "chip", "aria-pressed": p === S.topPlat ? "true" : "false", onclick: () => { S.topPlat = p; renderTop(); } },
    h("span", { class: "dot", style: `background:${PCOL[p] || "#111216"}` }), p === "Otras" ? "Apple TV y otras" : p === "Mitele" ? "Mitele (Mediaset)" : p))));
  if (LIVE_TOP.includes(S.topPlat)) { renderLiveTop(v, S.topPlat); return; }
  const d = S.trends.platforms[S.topPlat];
  const series = trendItems(S.topPlat, "tv"), movies = trendItems(S.topPlat, "movie");
  const top = series[0] || movies[0];
  if (top) {
    const bg = h("div", { class: "feature-bg" });
    v.append(h("button", { class: "feature", onclick: () => openItem(top) }, bg, h("span", { class: "tag-price mag" }, d.ranked ? `Nº 1 en ${S.topPlat === "Otras" ? "su plataforma" : S.topPlat}` : "¡Novedad!"), h("div", { class: "feature-in" },
      h("b", null, top.title), top.overview ? h("span", { class: "feature-syn" }, top.overview) : null)));
    resolve(top).then(() => { const img = top.backdrop || top.poster; if (img) bg.style.backgroundImage = `url(${IMG}w780${img})`; });
  }
  for (const [items, lab] of [[series, "Series"], [movies, "Películas"]]) {
    if (!items.length) continue;
    v.append(h("div", { class: "sec" }, h("h2", null, lab), h("small", null, d.ranked ? "Top 10" : "Destacadas")));
    v.append(h("div", { class: "rail" }, items.map(it => tile(it, undefined, d.ranked ? it.trend.n : null))));
  }
  v.append(h("p", { class: "foot" }, "Fuente: " + d.source + ". " + attributionText()));
}
// Atresplayer y Mitele no publican ranking: lo más popular ahora mismo en su catálogo según TMDB
async function renderLiveTop(v, p) {
  const box = h("div", { class: "view" }, h("div", { class: "rail" }, Array.from({ length: 4 }, () => h("div", { class: "tile" }, h("div", { class: "poster skel" })))));
  v.append(box);
  const ids = providerIds([p]).join("|");
  if (!TMDB || !ids) { fill(box, h("p", { class: "note" }, "No puedo consultar el catálogo de esta plataforma ahora mismo.")); return; }
  const base = { watch_region: "ES", with_watch_providers: ids, with_watch_monetization_types: "flatrate|free|ads", sort_by: "popularity.desc", "vote_count.gte": 5 };
  const [tv, mv] = await Promise.all(["tv", "movie"].map(t => tmdb(`/discover/${t}`, { ...base, without_genres: t === "tv" ? "10763,10767" : undefined }, 12).then(r => r.results.slice(0, 10).map(z => fromTmdb(z, t))).catch(() => [])));
  if (S.topPlat !== p || S.view !== "top") return;
  const top = tv[0] || mv[0];
  const kids = [];
  if (top) {
    const bg = h("div", { class: "feature-bg", style: top.backdrop || top.poster ? `background-image:url(${IMG}w780${top.backdrop || top.poster})` : "" });
    kids.push(h("button", { class: "feature", onclick: () => openItem(top) }, bg, h("span", { class: "tag-price mag" }, `Lo más popular en ${p}`), h("div", { class: "feature-in" }, h("b", null, top.title), top.overview ? h("span", { class: "feature-syn" }, top.overview) : null)));
  }
  for (const [items, lab] of [[tv, "Series"], [mv, "Películas"]]) if (items.length) kids.push(h("div", { class: "sec" }, h("h2", null, lab), h("small", null, "Populares ahora")), h("div", { class: "rail" }, items.map((it, i) => tile(it, undefined, i + 1))));
  if (!kids.length) kids.push(h("p", { class: "note" }, "No encuentro títulos ahora mismo."));
  kids.push(h("p", { class: "foot" }, `${p === "Mitele" ? "Mitele (Mediaset)" : p} no publica ranking: esto es lo más popular de su catálogo según TMDB. ` + attributionText()));
  fill(box, kids);
}
const attributionText = () => TMDB ? "Carátulas y datos de TMDB (esta app usa la API de TMDB pero no está avalada por TMDB). Disponibilidad: JustWatch." : "";

/* ---------- Listas ---------- */
function renderLists() {
  const v = $("v-lists"); v.replaceChildren();
  const lists = myLists();
  if (!lists.some(l => l.id === S.listSel)) S.listSel = S.profile;
  const L = lists.find(l => l.id === S.listSel);
  v.append(h("div", { class: "head" }, h("div", null, h("h1", null, "Las ", h("span", { class: "hl" }, "listas")), h("p", null, "Toca una lista para ver lo que hay y comentar."))));
  const count = id => visLists().filter(x => x.owner === id).length;
  v.append(h("div", { class: "list-picker" }, lists.map(l => h("button", { class: "lp" + (l.id === S.listSel ? " on" : ""), style: `--lc:${l.c}`, onclick: () => { S.listSel = l.id; renderLists(); } },
    h("span", { class: "lp-emo" }, emo(l.emo)), h("b", null, l.short), h("span", { class: "lp-n" }, `${count(l.id)} cinta${count(l.id) === 1 ? "" : "s"}`),
    h("span", { class: "stack" }, l.members.map(u => avatar(u, "xs")))))));
  const mem = L.members;
  const all = visLists().filter(x => x.owner === L.id);
  const doneByAll = k => mem.every(u => seenBy(k).includes(u));
  const todo = all.filter(x => !doneByAll(x.key));
  const done = L.personal ? S.data.seen.filter(x => x.owner === S.profile) : all.filter(x => doneByAll(x.key));
  v.append(h("div", { class: "seg" },
    h("button", { "aria-pressed": S.listTab === "todo" ? "true" : "false", onclick: () => { S.listTab = "todo"; renderLists(); } }, `Por ver · ${todo.length}`),
    h("button", { "aria-pressed": S.listTab === "done" ? "true" : "false", onclick: () => { S.listTab = "done"; renderLists(); } }, `Vistas · ${done.length}`)));
  const arr = S.listTab === "todo" ? todo : done;
  if (!arr.length) {
    v.append(S.listTab === "todo"
      ? empty(`«${L.name}» está vacía`, L.personal ? "En Descubrir, desliza a la derecha lo que te apetezca y elige esta lista." : `Cuando alguien guarde una cinta en «${L.name}», aparecerá aquí con sus comentarios.`, h("button", { class: "btn sun", onclick: () => go("discover") }, "Ir a Descubrir"), L.emo)
      : empty("Nada visto todavía", L.personal ? "Marca 👀 en lo que veas y ponle nota." : "Cuando todos la hayáis visto, aparecerá aquí con vuestras notas.", null, "👀"));
    return;
  }
  const lastAt = x => { const c = commentsOf(x.key, L.id); return c.length ? c[c.length - 1].at : x.at; };
  const sorted = [...arr].sort((a, b) => String(lastAt(b) || "").localeCompare(String(lastAt(a) || "")));
  v.append(h("div", { class: "rows" }, sorted.map(x => listRow({ ...x.item, key: x.key }, L, x))));
}
function listRow(it, L, x) {
  const cms = commentsOf(it.key, L.id), w = wantedBy(it.key).filter(u => L.members.includes(u) || L.personal), sb = seenBy(it.key).filter(u => L.members.includes(u));
  const inp = h("input", { class: "field", type: "text", maxlength: "1000", placeholder: "Comenta…", enterkeyhint: "send", "aria-label": "Comentario sobre " + it.title });
  const send = () => { const t = inp.value.trim(); if (!t) return; inp.value = ""; act("commentAdd", L.id, it, t); renderLists(); };
  inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); send(); } });
  return h("article", { class: "lrow" },
    h("div", { class: "lrow-top" },
      h("button", { class: "lrow-poster", onclick: () => openItem(it), "aria-label": "Ver ficha de " + it.title }, posterEl(it, false)),
      h("div", { class: "lrow-info" },
        h("button", { class: "lrow-title", onclick: () => openItem(it) }, it.title),
        h("div", { class: "meta" }, [typeLabel(it.type), it.year].filter(Boolean).join(" · ")),
        !L.personal && x && x.by ? h("div", { class: "who-wants" }, avatar(x.by, "xs"), x.by === S.profile ? "La guardaste tú" : `La guardó ${PROF[x.by].name}`) : null,
        !L.personal && w.length ? h("div", { class: "who-wants" }, h("span", { class: "stack" }, w.map(u => avatar(u, "xs"))), w.length === L.members.length && w.length > 1 ? "💯 ¡Os apetece a todos!" : "Le apetece") : null,
        sb.length ? h("div", { class: "who-wants" }, sb.map(u => h("span", { class: "seenby" }, avatar(u, "xs"), ratingOf(u, it.key) ? emo(FACES[ratingOf(u, it.key) - 1][0]) : emo("👀")))) : null,
        h("div", { class: "lrow-acts" },
          !isSeen(it.key) ? h("button", { class: "mini-btn", onclick: () => { act("rate", it, null); openRate(it); } }, "👀 Vista") : null,
          h("button", { class: "mini-btn", onclick: () => openSave(it) }, "📼 Listas"),
          S.listTab === "todo" ? h("button", { class: "mini-btn", onclick: () => { act("listRemove", L.id, it.key); toast("QUITADA"); renderLists(); } }, "✕ Quitar") : null))),
    !L.personal || cms.length ? h("div", { class: "lrow-cmts" },
      cms.map(c => h("div", { class: "cmt" + (c.author === S.profile ? " mine" : "") }, avatar(c.author, "sm"),
        h("div", { class: "bub" }, h("b", null, PROF[c.author].name), h("time", null, ago(c.at)), h("p", null, c.body),
          c.author === S.profile && !String(c.id).startsWith("tmp") ? h("button", { class: "del", onclick: () => { act("commentDelete", c.id); renderLists(); } }, "Borrar") : null))),
      h("div", { class: "cbox" }, inp, h("button", { class: "btn dark", "aria-label": "Enviar", onclick: send }, svg("send")))) : null);
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
  const k = it.key, seen = isSeen(k), r = ratingOf(S.profile, k);
  const inLists = myLists().filter(l => inList(l.id, k));
  const sb = seenBy(k);
  fill(box,
    h("div", { class: "dacts", style: "grid-template-columns:1fr 1fr" },
      h("button", { class: "btn " + (inLists.length ? "on-yes" : "dark"), onclick: () => openSave(it) }, emo(inLists.length ? "✅" : "💾"), inLists.length ? "En tus listas" : "Guardar en una lista"),
      h("button", { class: "btn" + (seen ? " sun" : ""), onclick: () => { if (seen) { act("seenToggle", it); toast("DESMARCADA"); paintSocial(); } else { act("rate", it, null); openRate(it, true); } } }, emo(seen ? (r ? FACES[r - 1][0] : "✅") : "👀"), seen ? "Vista · cambiar" : "Ya la vi")),
    inLists.length ? h("div", { class: "chips wrap" }, inLists.map(l => h("span", { class: "chip", style: `box-shadow:inset 0 0 0 2px ${l.c}` }, emo(l.emo), l.short))) : null,
    sb.length ? h("div", { class: "box" }, h("h4", null, "Ya la han visto"), sb.map(u => h("div", { class: "wants" }, avatar(u, "sm"), u === S.profile ? "Tú" : PROF[u].name, ratingOf(u, k) ? h("span", null, emo(FACES[ratingOf(u, k) - 1][0]), " ", FACES[ratingOf(u, k) - 1][1]) : null))) : null,
    ...inLists.filter(l => !l.personal || commentsOf(k, l.id).length).map(l => {
      const cms = commentsOf(k, l.id);
      const inp = h("input", { class: "field", type: "text", maxlength: "1000", placeholder: `Comenta en ${l.short}…`, enterkeyhint: "send" });
      const send = () => { const t = inp.value.trim(); if (!t) return; inp.value = ""; act("commentAdd", l.id, it, t); paintSocial(); };
      inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); send(); } });
      return h("div", { class: "box" }, h("h4", null, `${l.emo} Comentarios en ${l.short}`),
        cms.map(c => h("div", { class: "cmt" + (c.author === S.profile ? " mine" : "") }, avatar(c.author, "sm"), h("div", { class: "bub" }, h("b", null, PROF[c.author].name), h("time", null, ago(c.at)), h("p", null, c.body)))),
        h("div", { class: "cbox" }, inp, h("button", { class: "btn dark", "aria-label": "Enviar", onclick: send }, svg("send"))));
    }));
}

/* ---------- IA (función de Supabase con Gemini o Claude) ---------- */
const AI_SYSTEM = () => `Eres «el dependiente» del videoclub ¿Qué vemos?, la app con la que Oswaldo, Ana y Ángela (viven en España) deciden qué ver. Ahora hablas con ${PROF[S.profile].name}.
Personalidad: cinéfilo y seriéfilo de los de toda la vida, cercano y con gracia sin pasarte. Español de España, frases naturales, nada de listas largas ni tecnicismos.

Cómo conversas:
- Es una conversación: recuerda lo que se ha dicho y construye sobre ello. «Más corta», «otra», «la segunda», «algo parecido pero…» se refieren a lo anterior.
- Si la petición es vaga y te falta información, NO recomiendes todavía: haz una sola pregunta (dos como mucho) para afinar: con quién lo va a ver, de qué humor está, cuánto tiempo tiene, peli o serie, o algo que le gustara hace poco. Ofrece respuestas rápidas en "quick".
- Cuando recomiendes, elige poco: 1 título si lo tienes claro, 2 o 3 como máximo. Solo más (hasta 6) si te piden expresamente una lista.
- En "reply" explica de verdad por qué encaja cada uno con lo que te ha contado: tono, ritmo, de qué va sin destripar nada, duración o temporadas, y en qué plataforma está. Entre 2 y 6 frases en total; puedes usar saltos de línea.
- En cada pick, "why" resume en una frase (máximo 25 palabras) por qué esa y no otra.
- Usa el contexto: lo que cada uno quiere ver, lo que ha visto y su nota, lo descartado, las listas compartidas y sus comentarios. Nunca propongas lo que ${PROF[S.profile].name} ya ha visto o ha descartado. Si algo ya está en una de sus listas, dilo («¡la tenéis en Casiña!»).
- Propón solo cosas que estén con mucha probabilidad en SUS plataformas en España (vienen en el contexto). Si dudas de la plataforma, no lo afirmes.
- Si hablan de otra cosa (charla, un actor, qué tal es una peli concreta), contesta como lo haría un buen dependiente, sin forzar recomendaciones (picks vacío).
- "quick": de 2 a 4 respuestas cortas (máximo 5 palabras) para seguir la conversación con un toque, por ejemplo «Más corta», «Algo más ligero», «¿De qué va la primera?».

Responde SOLO con un objeto JSON válido, sin texto fuera:
{"reply":"…","picks":[{"title":"título como se conoce en España","original_title":"…","year":2021,"type":"movie","why":"…"}],"quick":["…"]}
"type" es "movie" (película) o "tv" (serie).`;
const SEARCH_SYSTEM = `Eres el buscador del videoclub ¿Qué vemos? (España). Te llega lo que alguien ha escrito en el buscador: interpreta lo que quiere decir (sinónimos, temas, tramas, títulos mal escritos, descripciones vagas como «la peli del barco que se hunde») y propón hasta 8 títulos que encajen, priorizando los que estén en sus plataformas (vienen en el contexto).
Responde SOLO con JSON: {"reply":"una frase corta","picks":[{"title":"título en España","original_title":"…","year":2021,"type":"movie","why":"por qué encaja, máximo 15 palabras"}],"quick":[]}`;
async function aiCall(messages, system) {
  if (!REMOTE || S.aiOff) return null;
  try {
    const base = CFG.supabaseUrl.replace(/\/+$/, "");
    const headers = { apikey: CFG.supabaseAnonKey, "Content-Type": "application/json" };
    if (CFG.supabaseAnonKey.startsWith("eyJ")) headers.Authorization = "Bearer " + CFG.supabaseAnonKey;
    const r = await fetch(`${base}/functions/v1/recomendar`, { method: "POST", headers, body: JSON.stringify({ pin: S.pin, messages, context: aiContext(), system: system || AI_SYSTEM() }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      S.aiErr = r.status === 404 ? "no encuentro la función «recomendar» en Supabase" : d.error === "nokey" ? "falta el secreto GEMINI_API_KEY en Supabase" : d.error === "pin" ? "la función no puede comprobar el PIN" : d.error === "ai" ? "la IA ha dado un error: " + (d.detail || "") : r.status === 401 ? "Supabase pide autorización: desactiva «Verify JWT» en la función" : `error ${r.status} ${d.msg || d.message || d.error || ""}`;
      if (r.status === 404 || r.status === 401 || d.error === "nokey") S.aiOff = true;
      return null;
    }
    S.aiErr = Array.isArray(d.quick) ? null : "la función de Supabase es la versión antigua: vuelve a pegar el código nuevo y pulsa Deploy";
    return d;
  } catch (e) { S.aiErr = "no consigo conectar con la función (¿«Verify JWT» activado o función sin desplegar?)"; S.aiOff = true; return null; }
}
async function aiPicks(d) {
  const picks = ((d && d.picks) || []).map(p => ({ title: String(p.title || ""), alt: p.original_title, year: p.year ? String(p.year) : "", type: p.type === "tv" ? "tv" : "movie", why: String(p.why || "") })).filter(p => p.title);
  await Promise.all(picks.map(async p => { await resolve(p, p.alt); p.key = keyOf(p); await providersOf(p); }));
  return picks;
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
  [["asesinato", "asesinatos", "asesino", "asesina", "asesinos", "homicidio", "crimen", "crimenes"], ["murder"]],
  [["secuestro", "secuestrada", "secuestrado", "rapto"], ["kidnapping"]],
  [["venganza", "vengarse"], ["revenge"]],
  [["infidelidad", "infiel", "amante", "cuernos"], ["infidelity", "adultery"]],
  [["triangulo amoroso"], ["love triangle"]],
  [["matrimonio", "casados"], ["marriage"]],
  [["droga", "drogas", "cocaina", "adiccion"], ["drugs", "drug addiction"]],
  [["corrupcion", "corrupto"], ["corruption"]],
  [["conspiracion", "complot"], ["conspiracy"]],
  [["estafa", "estafador", "timo", "fraude"], ["con artist", "fraud"]],
  [["hacker", "hackers", "ciberataque"], ["hacker"]],
  [["banco", "robo de banco"], ["bank robbery"]],
  [["fuga", "escapar de la carcel", "evasion"], ["prison escape"]],
  [["soldado", "soldados", "ejercito"], ["soldier"]],
  [["rey", "reina", "monarquia", "realeza", "princesa", "principe"], ["royalty", "monarchy"]],
  [["castillo"], ["castle"]],
  [["pirata", "piratas"], ["pirate"]],
  [["tesoro"], ["treasure"]],
  [["barco", "naufragio", "mar"], ["ship", "shipwreck"]],
  [["avion", "aviones", "piloto"], ["airplane", "pilot"]],
  [["tren"], ["train"]],
  [["carreras", "coches", "formula 1"], ["car race", "formula 1"]],
  [["banda", "grupo de musica", "rock"], ["rock band"]],
  [["cantante", "cantantes"], ["singer"]],
  [["restaurante"], ["restaurant"]],
  [["playa"], ["beach"]],
  [["montana", "escalada"], ["mountain", "mountain climbing"]],
  [["nieve", "invierno"], ["snow", "winter"]],
  [["pueblo", "aldea", "rural"], ["small town", "village"]],
  [["londres"], ["london, england"]],
  [["mexico"], ["mexico"]],
  [["demonio", "diablo", "satan"], ["demon", "devil"]],
  [["monstruo", "monstruos", "criatura"], ["monster", "creature"]],
  [["mutante", "mutantes"], ["mutant"]],
  [["pandemia", "virus", "epidemia"], ["pandemic", "virus"]],
  [["desastre", "catastrofe", "terremoto", "tsunami"], ["disaster", "natural disaster"]],
  [["muerte", "duelo", "luto"], ["death", "grief"]],
  [["psicologo", "terapia", "psiquiatra"], ["psychologist", "therapy"]],
  [["amnesia", "memoria", "olvido"], ["amnesia", "memory loss"]],
  [["bucle temporal", "dia de la marmota"], ["time loop"]],
  [["multiverso", "universo paralelo", "universos paralelos"], ["multiverse", "parallel world"]],
  [["realidad virtual"], ["virtual reality"]],
  [["comic", "comics", "novela grafica"], ["based on comic"]],
  [["novela", "libro", "basada en un libro"], ["based on novel or book"]],
  [["biografia", "biopic", "vida de"], ["biography"]],
  [["ajedrez"], ["chess"]],
  [["matematicas", "ciencia", "cientifico", "cientifica"], ["scientist", "mathematics"]],
  [["marte"], ["mars"]],
  [["luna"], ["moon"]],
  [["oceano", "submarino", "fondo del mar"], ["ocean", "submarine"]],
  [["selva", "jungla"], ["jungle"]],
  [["desierto"], ["desert"]],
  [["esclavitud", "esclavos"], ["slavery"]],
  [["pobreza", "pobre"], ["poverty"]],
  [["millonario", "ricos", "riqueza", "dinero"], ["millionaire", "wealth"]],
  [["herencia"], ["inheritance"]],
  [["identidad", "doble vida", "suplantacion"], ["double life", "identity"]],
  [["sueños", "suenos", "pesadilla", "pesadillas"], ["dream", "nightmare"]],
  [["colegio", "escuela", "profesor", "profesora"], ["school", "teacher"]],
  [["abogada", "fiscal"], ["lawyer", "prosecutor"]],
  [["bomberos"], ["firefighter"]],
  [["concurso", "competicion", "torneo"], ["competition", "tournament"]],
  [["superviviente", "naufrago"], ["survival"]],
];
const STOP = new Set(["de", "del", "la", "las", "el", "los", "un", "una", "unas", "unos", "con", "sin", "sobre", "que", "y", "o", "en", "para", "trama", "tema", "temas", "peli", "pelis", "pelicula", "peliculas", "serie", "series", "documental", "documentales", "algo", "alguna", "algun", "quiero", "busco", "ver", "historia", "historias", "buena", "buenas", "buen", "buenos"]);
/* ---------- sinónimos y palabras parecidas ---------- */
const SYN = [
  ["asesinato", "asesino", "asesina", "homicidio", "matar", "mata", "muerte", "muerto", "crimen", "criminal", "cadaver", "matanza"],
  ["miedo", "terror", "susto", "escalofrio", "horror", "aterrador", "espeluznante", "tenebroso"],
  ["risa", "reir", "comedia", "gracioso", "divertido", "humor", "comico", "carcajada", "chistes"],
  ["amor", "romance", "romantico", "enamorado", "enamorarse", "beso", "flechazo"],
  ["robo", "atraco", "ladron", "asalto", "botin", "golpe"],
  ["policia", "detective", "inspector", "investigacion", "investigador", "comisaria", "agente"],
  ["secuestro", "secuestrado", "rapto", "rehen", "desaparecido", "desaparicion"],
  ["venganza", "vengar", "revancha", "ajuste de cuentas"],
  ["guerra", "batalla", "soldado", "ejercito", "militar", "combate", "frente"],
  ["familia", "padre", "madre", "hijo", "hija", "hermano", "hermana", "abuelo", "abuela"],
  ["amigo", "amiga", "amistad", "colegas", "pandilla"],
  ["colegio", "instituto", "escuela", "adolescente", "juvenil", "estudiante", "universidad"],
  ["fantasma", "espiritu", "aparicion", "casa encantada", "espectro", "encantada"],
  ["demonio", "diablo", "posesion", "exorcismo", "satanico", "poseido"],
  ["extraterrestre", "alien", "ovni", "marciano", "invasion"],
  ["espacio", "astronauta", "nave espacial", "galaxia", "planeta", "cohete"],
  ["futuro", "futurista", "distopia", "robot", "androide", "inteligencia artificial"],
  ["magia", "mago", "bruja", "hechizo", "hechicero", "brujeria"],
  ["dragon", "fantasia", "reino", "elfo", "espada", "caballero"],
  ["mar", "oceano", "barco", "marinero", "isla", "naufragio", "pirata"],
  ["dinero", "millonario", "rico", "fortuna", "herencia", "lujo"],
  ["droga", "narco", "cartel", "narcotrafico", "cocaina", "traficante", "contrabando"],
  ["carcel", "prision", "preso", "recluso", "fuga", "presidiario"],
  ["juicio", "tribunal", "abogado", "abogada", "fiscal", "juez", "acusado"],
  ["hospital", "medico", "medica", "doctor", "enfermera", "cirujano", "urgencias"],
  ["deporte", "futbol", "baloncesto", "boxeo", "atleta", "entrenador", "partido"],
  ["musica", "cantante", "banda", "concierto", "musico", "rock"],
  ["cocina", "chef", "cocinero", "restaurante", "comida", "receta"],
  ["viaje", "viajar", "aventura", "expedicion", "carretera"],
  ["navidad", "navideno", "papa noel", "reyes magos", "nochebuena"],
  ["boda", "casarse", "matrimonio", "novia", "novio", "prometida"],
  ["infidelidad", "infiel", "amante", "engano", "cuernos", "traicion"],
  ["espia", "espionaje", "agente secreto", "inteligencia"],
  ["zombi", "zombie", "muertos vivientes", "infectados", "apocalipsis"],
  ["vampiro", "vampiros", "chupasangre"],
  ["pueblo", "aldea", "rural", "campo", "granja"],
  ["triste", "llorar", "drama", "emotivo", "conmovedor", "lagrimas"],
  ["perro", "perros", "mascota", "cachorro"],
  ["superheroe", "heroe", "superpoderes", "poderes", "mutante"],
  ["realeza", "rey", "reina", "principe", "princesa", "corona", "monarquia"],
  ["mafia", "mafioso", "gangster", "clan", "crimen organizado"],
  ["psicopata", "asesino en serie", "perturbado", "sociopata"],
  ["lesbiana", "lesbianas", "safica", "safico", "dos mujeres"],
  ["gay", "homosexual", "dos hombres"],
  ["estafa", "estafador", "timo", "fraude", "enganar"],
  ["accidente", "tragedia", "catastrofe", "desastre"],
  ["virus", "pandemia", "epidemia", "contagio", "plaga"],
];
const SYN_IDX = new Map();
SYN.forEach((g, i) => g.forEach(w => SYN_IDX.set(norm(w), i)));
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
// Para cada palabra de la búsqueda devuelve su grupo de sinónimos (o la palabra sola), tolerando erratas
function synGroups(text) {
  let nt = " " + norm(text) + " ";
  const groups = [];
  // primero las expresiones de varias palabras («dos mujeres», «casa encantada»…)
  for (const [k, i] of SYN_IDX) if (k.includes(" ") && nt.includes(" " + k + " ")) { groups.push([...new Set(SYN[i].map(norm))]); nt = nt.replace(" " + k + " ", " "); }
  const words = nt.trim().split(" ").filter(w => w.length > 2 && !STOP.has(w));
  for (const w of words) {
    let gi = SYN_IDX.has(w) ? SYN_IDX.get(w) : -1;
    if (gi < 0) for (const [k, i] of SYN_IDX) { if (k.length > 3 && (w.startsWith(k) || k.startsWith(w) && w.length > 4 || (w.length >= 6 && k.length >= 6 && w.slice(0, 6) === k.slice(0, 6)))) { gi = i; break; } }
    if (gi < 0 && w.length >= 7) { let best = 9; for (const [k, i] of SYN_IDX) { const dd = lev(w, k); if (dd < best && dd <= (w.length >= 10 ? 2 : 1)) { best = dd; gi = i; } } }
    groups.push(gi >= 0 ? [...new Set([w, ...SYN[gi].map(norm)])] : [w]);
  }
  return groups;
}
const expandText = text => synGroups(text).flat().join(" ");
const stemOf = w => w.split(" ").length > 1 ? w : w.slice(0, Math.max(5, w.length - 4));

function themeTerms(q) {
  q = q + " " + expandText(q);
  const n = " " + norm(q) + " ", terms = new Set(), hits = [];
  for (const [es, en] of THEMES) if (es.some(w => n.includes(" " + norm(w) + " "))) { en.forEach(t => terms.add(t)); hits.push(es[0]); }
  const rest = norm(q).split(" ").filter(w => w.length > 2 && !STOP.has(w) && !/^(comedi|drama|terror|miedo|romant|romance|accion|animac|documental|thriller|suspense|intriga|fantasia|familiar)/.test(w) && !THEMES.some(([es]) => es.some(x => norm(x).split(" ").includes(w))));
  if (!terms.size && rest.length) terms.add(rest.join(" "));
  return { terms: [...terms], hits };
}
const GWORDS = [[/comedi/, { movie: 35, tv: 35 }], [/\bdrama|dramon/, { movie: 18, tv: 18 }], [/terror|miedo/, { movie: 27, tv: 9648 }], [/romant|romance/, { movie: 10749, tv: 18 }],
  [/accion/, { movie: 28, tv: 10759 }], [/animacion|animada|dibujos|anime/, { movie: 16, tv: 16 }], [/documental/, { movie: 99, tv: 99 }], [/thriller|suspense|intriga/, { movie: 53, tv: 80 }],
  [/ciencia ficcion|scifi/, { movie: 878, tv: 10765 }], [/fantasia/, { movie: 14, tv: 10765 }], [/familiar|para ninos/, { movie: 10751, tv: 10751 }]];
// Lee las sinopsis (en español) de lo más visto de vuestras plataformas y busca las palabras
async function synopsisScan(q, type, onlyMine) {
  const groups = synGroups(q).filter(g => g.length > 1 || g[0].length > 3);
  if (!groups.length || !TMDB) return [];
  const stems = groups.map(g => g.map(stemOf));
  const ids = onlyMine ? providerIds(S.plats).join("|") : "";
  const types = type === "all" ? ["movie", "tv"] : [type];
  const lists = await Promise.all(types.flatMap(t => [1, 2, 3, 4, 5, 6].map(pg => limit(() => tmdb(`/discover/${t}`, {
    watch_region: ids ? "ES" : undefined, with_watch_providers: ids || undefined, with_watch_monetization_types: ids ? "flatrate|free|ads" : undefined,
    sort_by: "popularity.desc", "vote_count.gte": 25, page: pg, without_genres: t === "tv" ? "10763,10767" : undefined,
  }, 12)).then(r => r.results.map(z => fromTmdb(z, t))).catch(() => []))));
  const seen = new Set();
  return lists.flat().filter(it => {
    if (seen.has(it.key)) return false; seen.add(it.key);
    const txt = " " + norm((it.overview || "") + " " + it.title) + " ";
    return stems.every(alts => alts.some(st => txt.includes(st)));
  }).map(it => ({ ...it, inSyn: true }));
}
async function themeSearch(q, type, onlyMine) {
  const { terms } = themeTerms(q);
  if (!terms.length) return [];
  const nq = norm(q) + " " + expandText(q), gw = GWORDS.filter(([re]) => re.test(nq)).map(([, g]) => g);
  if (!gw.length) for (const [re, g] of MOOD_G) if (re.test(nq)) { gw.push({ movie: g.movie[0], tv: g.tv[0] }); break; }
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
    const aiBox = h("div", { class: "view" });
    if (REMOTE && !S.aiOff && q.length >= 4) {
      fill(aiBox, h("p", { class: "note" }, "🤖 Preguntando a la IA…"));
      aiCall([{ role: "user", text: "BÚSQUEDA: " + q }], SEARCH_SYSTEM).then(aiPicks).then(ps => {
        if (my !== seq) return;
        fill(aiBox, ps.length ? [h("div", { class: "sec" }, h("h2", null, "🤖 Lo que entiende la IA"), h("small", null, "")), h("div", { class: "picks" }, ps.map(p => pickEl(p)))] : null);
      }).catch(() => fill(aiBox, null));
    }
    const [themed0, syn, byTitle] = await Promise.all([
      themeSearch(q, type, onlyMine),
      synopsisScan(q, type, onlyMine),
      tmdb("/search/multi", { query: q }, 6).then(r => r.results.filter(x => (x.media_type === "movie" || x.media_type === "tv") && (type === "all" || x.media_type === type) && (x.poster_path || x.vote_count > 20)).slice(0, 12).map(x => fromTmdb(x))).catch(() => []),
    ]);
    if (my !== seq) return;
    // primero lo que cumple las dos cosas (tema y sinopsis), luego el resto
    const synK = new Set(syn.map(x => x.key)), themK = new Set(themed0.map(x => x.key));
    const themed = [...themed0.filter(x => synK.has(x.key)), ...syn.filter(x => !themK.has(x.key)), ...themed0.filter(x => !synK.has(x.key))].slice(0, 30);
    const seenK = new Set(themed.map(x => x.key));
    const titles = byTitle.filter(x => !seenK.has(x.key));
    const blocks = [];
    if (themed.length) blocks.push(h("div", { class: "sec" }, h("h2", null, `Sobre «${q}»`), h("small", null, onlyMine ? "En vuestras plataformas" : "En cualquier plataforma")), h("div", { class: "grid" }, themed.map(it => tile(it, it.inSyn ? "📝 En la sinopsis" : undefined))));
    else if (hits.length) blocks.push(h("p", { class: "note" }, onlyMine ? `No encuentro títulos sobre «${q}» en vuestras plataformas. Desmarca «Solo nuestras plataformas» para ver todos.` : `No encuentro títulos sobre «${q}».`));
    if (titles.length) blocks.push(h("div", { class: "sec" }, h("h2", null, "Por título"), h("small", null, "")), h("div", { class: "grid" }, titles.map(it => tile(it))));
    if (!blocks.length) blocks.push(h("p", { class: "note" }, "No encuentro nada. Prueba con otra palabra o con el título."));
    res.replaceChildren(aiBox, ...blocks);
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
      `- Su lista: ${L(S.data.lists.filter(x => x.owner === p.id), 40)}`,
      `- Ya ha visto: ${L(S.data.seen.filter(x => x.owner === p.id), 60)}`,
      `- Ha descartado: ${L(S.data.nopes.filter(x => x.owner === p.id), 40)}`);
  }
  for (const l of SHARED.filter(l => l.members.includes(me))) {
    const items = visLists().filter(x => x.owner === l.id).slice(0, 30);
    lines.push(`\nLista «${l.name}» (la ven ${l.members.map(u => PROF[u].name).join(", ")}):` + (items.length ? "" : " vacía"));
    for (const x of items) { const cm = commentsOf(x.key, l.id).slice(-4).map(c => `${PROF[c.author].name}: "${c.body.slice(0, 140)}"`).join(" | "); lines.push(`- ${x.item.title}${cm ? " · comentarios: " + cm : ""}`); }
  }
  if (S.trends) { lines.push(`\nLo más visto en España (${S.trends.label}):`); for (const p of ownedTrendPlats()) lines.push(`- ${p}: ${[...trendItems(p, "tv").slice(0, 4), ...trendItems(p, "movie").slice(0, 3)].map(i => i.title).join(", ")}`); }
  return lines.join("\n");
}
/* ---------- el dependiente sin IA: entiende la petición y busca en TMDB ---------- */
const MOOD_G = [
  [/comedi|reir|risa|gracios|divertid|humor|carcajad/, { movie: [35], tv: [35] }, "comedia"],
  [/terror|miedo|susto|halloween|zombi|fantasma|escalofr/, { movie: [27], tv: [9648, 10765] }, "terror"],
  [/thriller|suspense|tension|intriga|en vilo/, { movie: [53], tv: [80, 9648] }, "suspense"],
  [/polic|crimen|crimin|detective|asesin|narco|mafia/, { movie: [80], tv: [80] }, "crimen"],
  [/misterio|enigma/, { movie: [9648], tv: [9648] }, "misterio"],
  [/drama|llorar|emocion|conmov/, { movie: [18], tv: [18] }, "drama"],
  [/romant|romance|amor|enamor/, { movie: [10749], tv: [18] }, "romántica"],
  [/accion|tiros|peleas|adrenalina/, { movie: [28], tv: [10759] }, "acción"],
  [/aventura/, { movie: [12], tv: [10759] }, "aventuras"],
  [/ciencia ficcion|scifi|sci fi|futur|distopi/, { movie: [878], tv: [10765] }, "ciencia ficción"],
  [/fantasia|magia|dragon/, { movie: [14], tv: [10765] }, "fantasía"],
  [/animacion|animada|dibujos|anime/, { movie: [16], tv: [16] }, "animación"],
  [/documental|docuserie/, { movie: [99], tv: [99] }, "documental"],
  [/historic|de epoca|guerra/, { movie: [36, 10752], tv: [10768] }, "historia"],
  [/musical/, { movie: [10402], tv: [] }, "musical"],
  [/familia|ninos|peques|crios|infantil/, { movie: [10751], tv: [10751, 10762] }, "familiar"],
  [/western|vaquero/, { movie: [37], tv: [37] }, "western"],
  [/reality/, { movie: [], tv: [10764] }, "reality"],
];
const COUNTRIES = [
  [/espanol|espanola|de aqui|nacional|de espana/, "ES", "españolas"], [/turc/, "TR", "turcas"], [/corean/, "KR", "coreanas"], [/japon/, "JP", "japonesas"],
  [/frances|francia/, "FR", "francesas"], [/italian/, "IT", "italianas"], [/aleman/, "DE", "alemanas"], [/britanic|ingles|inglaterra|reino unido/, "GB", "británicas"],
  [/nordic|escandinav/, "SE|DK|NO|IS|FI", "nórdicas"], [/danes/, "DK", "danesas"], [/suec/, "SE", "suecas"], [/norueg/, "NO", "noruegas"], [/islandes/, "IS", "islandesas"],
  [/mexican/, "MX", "mexicanas"], [/argentin/, "AR", "argentinas"], [/colombian/, "CO", "colombianas"], [/chilen/, "CL", "chilenas"], [/brasilen|brasil/, "BR", "brasileñas"],
  [/latinoameric/, "MX|AR|CO|CL|BR|PE|UY|VE", "latinoamericanas"], [/\bindia\b|\bindio\b|bollywood/, "IN", "indias"], [/chin[ao]s?\b/, "CN", "chinas"], [/tailandes/, "TH", "tailandesas"],
  [/polac/, "PL", "polacas"], [/israel/, "IL", "israelíes"], [/american|estadounidense|hollywood/, "US", "americanas"], [/australian/, "AU", "australianas"], [/canadiense/, "CA", "canadienses"],
  [/portugues/, "PT", "portuguesas"], [/belga/, "BE", "belgas"], [/holandes/, "NL", "holandesas"], [/irlandes/, "IE", "irlandesas"], [/rus[ao]s?\b/, "RU", "rusas"], [/egipci|arabe/, "EG|SA|AE|MA|LB", "árabes"],
];
function parseAsk(text) {
  let n = " " + norm(text) + " ";
  const full = n;
  const q = { genres: [], labels: [], avoid: [], types: ["tv", "movie"], short: false, mini: false, lang: null, from: null, to: null, quality: false, recent: false, like: null, plat: null, themes: [], hits: [] };
  const NEG = /\b(?:sin|nada de|que no sea|que no tenga|no quiero|no me apetece|odio|evitar|ni)\s+(.+?)(?=\s+(?:en|pero|y|que|para|de los|con)\s|[,.;!?]|\s*$)/g;
  let m;
  while ((m = NEG.exec(n))) { for (const [re, g] of MOOD_G) if (re.test(m[1])) q.avoid.push(g); n = n.replace(m[0], " "); }
  const lk = n.match(/(?:como|parecid[ao]s? a|tipo|estilo|al estilo de|rollo)\s+(.+?)(?:\s+(?:pero|y que|que sea|para)\b|$)/);
  if (lk && lk[1].trim().length > 1) { q.like = lk[1].trim(); n = n.replace(lk[0], " "); }
  const nx = n + " " + expandText(n);
  for (const [re, g, label] of MOOD_G) if (re.test(label === "familiar" ? n : nx)) { q.genres.push(g); q.labels.push(label); }
  if (/\b(peli|pelis|pelicula|peliculas|film)\b/.test(n) && !/\bseries?\b/.test(n)) q.types = ["movie"];
  else if (/\b(serie|series|temporadas?|miniserie|miniseries)\b/.test(n)) q.types = ["tv"];
  if (/miniserie|pocos capitulos|de un tiron|en un finde/.test(n)) { q.mini = true; q.types = ["tv"]; }
  if (/corta|cortita|poco tiempo|rapida|hora y media|no muy larga|que no dure/.test(n)) q.short = true;
  q.countries = []; q.countryNames = [];
  for (const [re, cc, name] of COUNTRIES) if (re.test(n)) { q.countries.push(...cc.split("|")); q.countryNames.push(name); }
  if (/en espanol|en castellano/.test(n)) q.lang = "es";
  if (/\bcine\b/.test(n) && !/\bseries?\b/.test(n)) q.types = ["movie"];
  const dec = n.match(/de los (?:anos )?(\d0)\b/);
  if (dec) { const d = +dec[1]; const y = d >= 30 ? 1900 + d : 2000 + d; q.from = `${y}-01-01`; q.to = `${y + 9}-12-31`; }
  else if (/clasic|antigu/.test(n)) q.to = "2000-12-31";
  if (/nuev|reciente|estreno|de este ano|actual|ultimo/.test(n)) { q.recent = true; q.from = new Date(Date.now() - 2 * 365 * 864e5).toISOString().slice(0, 10); }
  if (/buena|buenisima|mejor|top|obra maestra|premiad|oscar|imprescindible/.test(n)) q.quality = true;
  for (const p of PLATFORMS) if (new RegExp("\\b" + norm(p.id).split(" ")[0]).test(full) || (p.id === "Prime Video" && /amazon|prime/.test(full)) || (p.id === "Mitele" && /mediaset|telecinco/.test(full))) { if (S.plats.includes(p.id)) q.plat = p.id; break; }
  const th = themeTerms(text); if (th.hits.length) { q.themes = th.terms; q.hits = th.hits; }
  q.understood = !!(q.genres.length || q.like || q.themes.length || q.types.length === 1 || q.short || q.mini || q.lang || q.from || q.to || q.quality || q.plat || q.avoid.length || q.countries.length);
  q.vague = /recomienda|sorprend|lo que sea|cualquier|algo bueno|que me guste|que ver|no se que/.test(n);
  return q;
}
async function kwIdsFor(terms) {
  const ids = new Set();
  await Promise.all(terms.map(async t => {
    try {
      const r = await tmdb("/search/keyword", { query: t, language: undefined }, 168), nt = norm(t);
      const good = r.results.filter(k => norm(k.name) === nt).concat(r.results.filter(k => norm(k.name).startsWith(nt + " "))).slice(0, 3);
      (good.length ? good : r.results.slice(0, 1)).forEach(k => ids.add(k.id));
    } catch (e) {}
  }));
  return [...ids];
}
async function localAsk(text, prev) {
  const more = /^(otras?|mas|dame mas|ninguna|siguiente|otra cosa)\b/.test(norm(text)) && prev;
  const q = more ? { ...prev.q, page: (prev.q.page || 1) + 1 } : { ...parseAsk(text), page: 1 };
  const shown = new Set(S.chat.flatMap(m => (m.picks || []).map(p => p.key || keyOf(p))));
  const me = S.profile, taste = tasteOf(me);
  const skip = k => shown.has(k) || isSeen(k) || isNope(k);
  if (!TMDB) return { reply: "Necesito la clave de TMDB para buscar en el catálogo.", picks: [], q };
  const ids = providerIds(q.plat ? [q.plat] : S.plats).join("|");
  let picks = [], relaxed = "";
  // 1) «algo como X»
  if (q.like) {
    try {
      const s = await tmdb("/search/multi", { query: q.like }, 24);
      const base = s.results.find(x => x.media_type === "movie" || x.media_type === "tv");
      if (base) {
        const bt = base.title || base.name;
        const [r1, r2] = await Promise.all([tmdb(`/${base.media_type}/${base.id}/recommendations`, { page: q.page }, 24).catch(() => ({ results: [] })), tmdb(`/${base.media_type}/${base.id}/similar`, { page: q.page }, 24).catch(() => ({ results: [] }))]);
        const cands = [...r1.results, ...r2.results].filter(z => (z.media_type || base.media_type) && z.vote_count > 20).map(z => fromTmdb(z, z.media_type || base.media_type))
          .filter((it, i, a) => a.findIndex(x => x.key === it.key) === i && q.types.includes(it.type) && !skip(it.key));
        for (const it of cands.slice(0, 24)) {
          if (picks.length >= 6) break;
          const pv = await providersOf(it); if (!pv || !pv.own.length) continue;
          picks.push({ ...it, why: `Parecida a ${bt} · en ${pv.own.map(p => p.plat).slice(0, 2).join(" y ")}` });
        }
        q.likeTitle = bt;
      }
    } catch (e) {}
    if (picks.length >= 3) return { reply: `Si te gustó ${q.likeTitle}, estas van en la misma línea y están en vuestras plataformas:`, picks, q };
  }
  // 2) catálogo de vuestras plataformas con los filtros entendidos
  const kws = q.themes.length ? await kwIdsFor(q.themes) : [];
  const run = async (opt) => {
    const out = [];
    await Promise.all(q.types.map(async type => {
      const g = opt.genres ? [...new Set(q.genres.flatMap(x => x[type]))] : [];
      const without = [...new Set(q.avoid.flatMap(x => x[type]))].filter(x => !g.includes(x));
      if (type === "tv") without.push(10763, 10767);
      if (q.genres.length && opt.genres && !g.length) return; // p. ej. «musical» en series
      const p = {
        watch_region: "ES", with_watch_providers: ids, with_watch_monetization_types: "flatrate|free|ads",
        sort_by: q.quality ? "vote_average.desc" : "popularity.desc",
        "vote_count.gte": q.quality ? (type === "movie" ? 800 : 300) : (q.lang || q.countries.length || kws.length ? 15 : type === "movie" ? 150 : 60),
        "vote_average.gte": q.quality ? 7.4 : 6.2, page: q.page,
        with_genres: g.length ? g.join(q.genres.length > 1 && opt.and ? "," : "|") : undefined,
        without_genres: without.join(",") || undefined,
        with_keywords: opt.kw && kws.length ? kws.join("|") : undefined,
        with_original_language: q.lang || undefined,
        with_origin_country: q.countries.length ? q.countries.join("|") : undefined,
      };
      if (opt.short && q.short) p["with_runtime.lte"] = type === "movie" ? 110 : 35;
      if (q.mini && type === "tv") p.with_type = "2";
      const dk = type === "movie" ? "primary_release_date" : "first_air_date";
      if (q.from) p[dk + ".gte"] = q.from; if (q.to) p[dk + ".lte"] = q.to;
      try { const r = await tmdb(`/discover/${type}`, p, 6); r.results.forEach((z, i) => out.push({ it: fromTmdb(z, type), rank: i })); } catch (e) {}
    }));
    return out;
  };
  if (ids) {
    const tries = [{ genres: true, and: true, kw: true, short: true }, { genres: true, and: false, kw: true, short: true }, { genres: true, kw: false, short: true }, { genres: true, kw: false, short: false }, { genres: false, kw: false, short: false }];
    let res = [];
    for (let i = 0; i < tries.length; i++) {
      const t = tries[i];
      if (i === 0 && q.genres.length < 2 && !kws.length) continue;
      if (!t.kw && kws.length && i > 0 && !relaxed) relaxed = "No había casi nada con ese tema exacto, así que he ampliado un poco. ";
      if (!t.genres && q.genres.length) relaxed = "Con todos los filtros salía muy poco; te pongo lo más cercano. ";
      res = (await run(t)).filter(x => !skip(x.it.key));
      if (res.length >= 4) break;
    }
    for (const x of res) x.score = (20 - x.rank) * .12 + (x.it.vote || 6) * .35 + affinity(x.it.g, taste) * 1.5 + Math.random() * .8;
    res.sort((a, b) => b.score - a.score);
    for (const x of res.slice(0, 6)) {
      const it = x.it, pv = await providersOf(it);
      const own = pv && pv.own.length ? pv.own.map(p => p.plat).slice(0, 2).join(" y ") : null;
      const gNames = (it.g || []).filter(id => q.genres.some(g => g[it.type].includes(id))).map(id => GENRE[id]).filter(Boolean);
      const parts = [];
      if (gNames.length) parts.push(gNames[0].charAt(0).toUpperCase() + gNames[0].slice(1));
      if (q.hits.length) parts.push("va de " + q.hits[0]);
      if (it.vote) parts.push("★ " + it.vote.toFixed(1));
      if (affinity(it.g, taste) > .3) parts.push("encaja con tus gustos");
      if (own) parts.push("en " + own);
      picks.push({ ...it, why: parts.join(" · ") });
    }
  }
  const what = [q.mini ? "miniseries" : q.types.length === 1 ? (q.types[0] === "tv" ? "series" : "pelis") : "pelis y series", q.labels.length ? "de " + q.labels.join(" y ") : "", q.hits.length ? "sobre " + q.hits.join(", ") : "", q.countryNames.length ? q.countryNames.join(" o ") : "", q.short ? "cortas" : "", q.quality ? "muy bien valoradas" : "", q.plat ? "en " + q.plat : ""].filter(Boolean).join(" ");
  if (!q.understood && !more) {
    const syn = (await synopsisScan(text, "all", true)).filter(it => !skip(it.key)).slice(0, 6);
    if (syn.length) {
      picks = [];
      for (const it of syn) { const pv = await providersOf(it); picks.push({ ...it, why: `Su sinopsis habla de «${text.trim()}»` + (pv && pv.own.length ? ` · en ${pv.own.map(p => p.plat).slice(0, 2).join(" y ")}` : "") }); }
      return { reply: `He buscado «${text.trim()}» en las sinopsis de lo que hay en vuestras plataformas:`, picks, q };
    }
  }
  let reply;
  if (!picks.length) reply = "No encuentro nada que encaje en vuestras plataformas. Prueba a pedírmelo de otra forma, por ejemplo «comedia corta», «serie española de misterio» o «algo como Dark».";
  else if (!q.understood && !q.vague) { reply = `No he entendido «${text.trim()}». Prueba con algo como «comedia corta», «serie turca romántica», «terror de los 80» o «algo como Fariña».`; picks = []; }
  else if (!q.understood) reply = "Te propongo según lo que te ha gustado hasta ahora:";
  else reply = `${relaxed}${more ? "Más " : "Aquí tienes "}${what}:`;
  return { reply, picks, q };
}

const chatKey = () => "qv_chat_" + S.profile;
const saveChat = () => store.set(chatKey(), S.chat.filter(m => !m.typing).slice(-30).map(m => ({ role: m.role, text: m.text, reply: m.reply, ai: m.ai, quick: m.quick,
  picks: (m.picks || []).map(p => ({ id: p.id, key: p.key, type: p.type, title: p.title, year: p.year, poster: p.poster, backdrop: p.backdrop, vote: p.vote, g: p.g, why: p.why })) })));
function openChat() {
  if (!S.chat.length) S.chat = store.get(chatKey(), []);
  const body = h("div", { class: "settings", style: "gap:14px" });
  const list = h("div", { class: "chat" });
  const inp = h("input", { class: "field", type: "text", placeholder: "¿Qué os apetece ver?", enterkeyhint: "send", autocomplete: "off" });
  const sendBtn = h("button", { class: "btn dark", "aria-label": "Enviar" }, svg("send"));
  const form = h("form", { class: "chat-in", onsubmit: e => { e.preventDefault(); ask(inp.value); inp.value = ""; } }, inp, sendBtn);
  const paint = () => {
    const st = $("aiStatus");
    if (st) st.textContent = !REMOTE ? "Modo sin IA" : S.aiErr ? "⚠️ Modo sin IA: " + S.aiErr : S.aiOff ? "Modo sin IA" : S.chat.some(m => m.ai) ? "🟢 IA conectada" : "La IA se comprueba con tu primer mensaje";
    list.replaceChildren();
    if (!S.chat.length) {
      list.append(h("div", { class: "msg ai" }, `¡Buenas, ${PROF[S.profile].name}! Cuéntame: ¿qué te apetece hoy? Puede ser algo concreto («una serie turca de amor») o algo tipo «quiero algo ligerito para desconectar». Si me falta algo, te pregunto.`));
      list.append(h("div", { class: "sugs" }, ["No sé qué ver hoy", "Algo ligerito, sin pensar", "Una serie que enganche", "Algo como Fariña", "Peli para ver los tres"].map(s => h("button", { class: "chip", onclick: () => ask(s) }, s))));
    }
    for (const m of S.chat) {
      if (m.role === "user") list.append(h("div", { class: "msg me" }, m.text));
      else {
        list.append(h("div", { class: "msg ai" + (m.typing ? " typing" : "") }, m.reply || m.text, m.typing ? null : h("span", { class: "msg-mode" }, m.ai ? "🤖 IA" : "📼 sin IA")));
        if (m.picks && m.picks.length) list.append(h("div", { class: "picks" }, m.picks.map(p => pickEl(p))));
        const lastOne = m === S.chat[S.chat.length - 1];
        if (lastOne && m.quick && m.quick.length) list.append(h("div", { class: "sugs" }, m.quick.map(q => h("button", { class: "chip", onclick: () => ask(q) }, q))));
        else if (lastOne && m.q && m.picks && m.picks.length) list.append(h("div", { class: "sugs" }, h("button", { class: "chip", onclick: () => ask("otras") }, "🔄 Otras ideas")));
      }
    }
    const lastEl = list.lastElementChild; if (lastEl) setTimeout(() => lastEl.scrollIntoView({ block: "end", behavior: "smooth" }), 30);
  };
  const ask = async (text) => {
    text = String(text || "").trim(); if (!text) return;
    S.chat.push({ role: "user", text });
    const pending = { role: "assistant", typing: true, text: "Pensando…" };
    S.chat.push(pending); paint();
    const local = async () => {
      try {
        const prev = [...S.chat].reverse().find(m => m.q);
        const r = await localAsk(text, prev);
        Object.assign(pending, { typing: false, reply: r.reply, text: r.reply, picks: r.picks, q: r.q });
      } catch (e) { Object.assign(pending, { typing: false, text: "Sin conexión. Prueba otra vez." }); }
      saveChat(); paint();
    };
    if (!REMOTE || S.aiOff) return local();
    const msgs = S.chat.filter(m => !m.typing).slice(-16).map(m => ({ role: m.role, text: m.role === "user" ? m.text
      : JSON.stringify({ reply: m.reply || m.text || "", picks: (m.picks || []).map(p => ({ title: p.title, year: p.year, type: p.type, why: p.why })) }) }));
    const d = await aiCall(msgs);
    if (!d) return local();
    const picks = ((d.picks) || []).map(p => ({ title: String(p.title || ""), alt: p.original_title, year: p.year ? String(p.year) : "", type: p.type === "tv" ? "tv" : "movie", why: String(p.why || "") })).filter(p => p.title);
    Object.assign(pending, { typing: false, reply: d.reply || "Aquí tienes:", text: d.reply, picks, ai: true, quick: d.quick || [] });
    paint();
    await Promise.all(picks.map(async p => { await resolve(p, p.alt); p.key = keyOf(p); await providersOf(p); }));
    saveChat(); paint();
  };
  const status = h("p", { class: "note", id: "aiStatus" });
  body.append(h("div", { class: "chat-head" }, emo("🤖"), h("div", null, h("h2", null, "El dependiente"), h("p", { class: "note" }, "Pídele lo que os apetece y busca en vuestras plataformas"), status),
    h("button", { class: "mini-btn", style: "margin-left:auto", onclick: () => { S.chat = []; store.del(chatKey()); paint(); } }, "🗑️ Nueva")), list, form);
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

/* ---------- puntuar ---------- */
const FACES = [["😖", "Horrible"], ["😕", "Floja"], ["😐", "Normal"], ["🙂", "Buena"], ["🤩", "¡Top!"]];
function openRate(it, back) {
  const cur0 = ratingOf(S.profile, it.key);
  const row = h("div", { class: "rate-row" }, FACES.map(([e, l], i) => h("button", { "aria-pressed": cur0 === i + 1 ? "true" : "false", onclick: () => {
    act("rate", it, i + 1); toast(`${e} Apuntado: ${l.toLowerCase()}`); if (back) openItem(it); else closeSheet(); } }, emo(e), l)));
  openSheet(h("div", { class: "settings", style: "text-align:center;align-items:center" },
    h("span", { class: "sticker mint" }, emo("👀"), "Vista"),
    h("h2", null, `¿Qué tal ${it.title}?`),
    h("p", { class: "note" }, "Tu nota ayuda a que las propuestas acierten más y los demás la verán."),
    row,
    h("button", { class: "btn", onclick: () => back ? openItem(it) : closeSheet() }, "Ahora no")));
}

/* ---------- confeti ---------- */
function confetti(n = 140) {
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = $("confetti"); if (!cv || !cv.getContext) return;
  const ctx = cv.getContext("2d"), W = cv.width = innerWidth, H = cv.height = innerHeight;
  cv.hidden = false;
  const cols = ["#ffd23f", "#ff5a5f", "#3ddc97", "#4361ee", "#9b5de5", "#1a1033"];
  const ps = Array.from({ length: n }, () => ({ x: W / 2 + (Math.random() - .5) * 80, y: H * .45, vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4, s: 6 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[Math.floor(Math.random() * cols.length)] }));
  let t = 0;
  const step = () => {
    ctx.clearRect(0, 0, W, H); t++;
    for (const p of ps) { p.vy += .35; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .66); ctx.restore(); }
    if (t < 110) requestAnimationFrame(step); else { ctx.clearRect(0, 0, W, H); cv.hidden = true; }
  };
  requestAnimationFrame(step);
}

/* ---------- noche de peli ---------- */
function openNight() {
  const lists = myLists();
  let lid = S.nightList && lists.some(l => l.id === S.nightList) ? S.nightList : (lists.find(l => l.id === "os3") || lists[lists.length - 1]).id;
  let type = "all", spinning = false;
  const body = h("div", { class: "settings" });
  const paint = () => {
    const L = lists.find(l => l.id === lid); S.nightList = lid;
    const mem = L.members;
    const pool = visLists().filter(x => x.owner === lid && !mem.some(u => seenBy(x.key).includes(u)) && (type === "all" || x.item.type === type))
      .map(x => ({ it: { ...x.item, key: x.key }, wants: wantedBy(x.key).filter(u => mem.includes(u)).length, cm: commentsOf(x.key, lid).length }))
      .sort((a, b) => (b.wants - a.wants) || (b.cm - a.cm));
    fill(body,
      h("div", { class: "chat-head" }, emo("🍿"), h("div", null, h("h2", null, "Noche de peli"), h("p", { class: "note" }, "¿De qué lista elegimos?"))),
      h("div", { class: "list-picker" }, lists.map(l => h("button", { class: "lp" + (l.id === lid ? " on" : ""), style: `--lc:${l.c}`, onclick: () => { lid = l.id; paint(); } }, h("span", { class: "lp-emo" }, emo(l.emo)), h("b", null, l.short), h("span", { class: "stack" }, l.members.map(u => avatar(u, "xs")))))),
      h("div", { class: "chips wrap", style: "justify-content:center" }, [["all", "Lo que sea"], ["movie", "Peli"], ["tv", "Serie"]].map(([k, l]) => h("button", { class: "chip", "aria-pressed": type === k ? "true" : "false", onclick: () => { type = k; paint(); } }, l))),
      pool.length ? h("div", { class: "wheel", id: "wheel" }, h("div", { class: "reels", "aria-hidden": "true" }, h("i"), h("i")), h("span", { class: "lcd" }, "¿NO OS DECIDÍS?"), h("p", { class: "note" }, `La ruleta elige entre ${pool.length} cinta${pool.length > 1 ? "s" : ""} de «${L.short}» que nadie ha visto`),
        h("button", { class: "btn sun", onclick: () => spin(pool, L) }, "⏩ ¡Girar la ruleta!"))
        : empty(`No hay nada pendiente en «${L.short}»`, "Guardad cintas en esta lista desde Descubrir y aquí podréis elegir o tirar de ruleta.", h("button", { class: "btn sun", onclick: () => { closeSheet(); go("discover"); } }, "Ir a Descubrir"), "🫣"),
      pool.length ? h("div", { class: "sec" }, h("h2", null, "Lo que hay"), h("small", null, mem.length > 1 ? "Primero lo que más os apetece" : "")) : null,
      pool.length ? h("div", { class: "grid" }, pool.slice(0, 12).map(c => tile(c.it, mem.length > 1 && c.wants === mem.length ? "💯 Os apetece a todos" : c.wants ? `❤️ ${c.wants} de ${mem.length}` : undefined))) : null);
  };
  const spin = (pool, L) => {
    if (spinning) return; spinning = true;
    const w = $("wheel"); if (!w) return;
    const weighted = pool.flatMap(c => Array(1 + c.wants).fill(c));
    const final = weighted[Math.floor(Math.random() * weighted.length)];
    let i = 0, delay = 60;
    const slot = h("div", { style: "width:140px" });
    fill(w, h("div", { class: "reels spin", "aria-hidden": "true" }, h("i"), h("i")), h("span", { class: "lcd" }, "⏩ BUSCANDO CINTA…"), slot);
    const tick = () => {
      const c = i < 14 ? pool[i % pool.length] : final;
      fill(slot, posterEl(c.it, false)); i++;
      if (i <= 14) { delay *= 1.15; setTimeout(tick, delay); return; }
      spinning = false; confetti(90);
      const d = new Date();
      fill(w, h("div", { class: "ticket" },
          h("div", null, "VIDEOCLUB ¿QUÉ VEMOS?"), h("div", null, `${d.toLocaleDateString("es-ES")}  ${d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`), h("hr"),
          h("div", null, "ESTA NOCHE TOCA:"), h("div", { class: "ttl" }, final.it.title), h("div", null, [typeLabel(final.it.type).toUpperCase(), final.it.year].filter(Boolean).join(" · ")), h("hr"),
          h("div", null, `LISTA: ${L.short.toUpperCase()}`), h("div", null, `SOCIOS: ${L.members.map(u => PROF[u].name.toUpperCase()).join(", ")}`), h("div", null, "PALOMITAS ....... OBLIGATORIAS"), h("div", null, "DEVOLVER REBOBINADA")),
        slot,
        h("div", { style: "display:flex;gap:8px;flex-wrap:wrap;justify-content:center" },
          h("button", { class: "btn sun", onclick: () => openItem(final.it) }, "Ver ficha"),
          h("button", { class: "btn", onclick: () => spin(pool, L) }, "Otra vez")));
    };
    tick();
  };
  openSheet(body); paint();
}

/* ---------- avisos ---------- */
const lastSeenKey = () => "qv_lastseen_" + S.profile;
let NEWS = [];
async function computeNews() {
  const me = S.profile, since = store.get(lastSeenKey(), new Date(Date.now() - 7 * 864e5).toISOString());
  const items = [];
  for (const c of S.data.comments) if (c.author !== me && canRead(me, c.list || "os3")) items.push({ at: c.at, it: { ...c.item, key: c.key }, e: "💬", txt: `${PROF[c.author].name} en ${listEmo(c.list || "os3")} ${PERSONAL.includes(c.list) ? listName(c.list) : LIST[c.list || "os3"].short}: «${c.body.slice(0, 80)}» (${c.item.title})` });
  for (const x of visLists()) if (!PERSONAL.includes(x.owner) && x.by !== me) items.push({ at: x.at, it: { ...x.item, key: x.key }, e: LIST[x.owner].emo, txt: `${PROF[x.by].name} ha guardado ${x.item.title} en ${LIST[x.owner].short}` });
  for (const x of S.data.lists) if (PERSONAL.includes(x.owner) && x.owner !== me && inList(me, x.key)) items.push({ at: x.at, it: { ...x.item, key: x.key }, e: "💘", txt: `A ${PROF[x.owner].name} también le apetece ${x.item.title}` });
  const shared = new Set(visLists().filter(x => !PERSONAL.includes(x.owner)).map(x => x.key));
  for (const x of S.data.seen) if (x.owner !== me && x.rating && shared.has(x.key)) items.push({ at: x.at, it: { ...x.item, key: x.key }, e: FACES[x.rating - 1][0], txt: `${PROF[x.owner].name} ha visto ${x.item.title}: ${FACES[x.rating - 1][1].toLowerCase()}` });
  if (TMDB) {
    const tv = new Map();
    for (const x of [...visLists(), ...S.data.seen.filter(s => s.owner === me)]) if (x.item.type === "tv" && x.item.id) tv.set(x.key, x.item);
    await Promise.all([...tv.values()].slice(0, 25).map(async t => {
      try {
        const d = await limit(() => tmdb(`/tv/${t.id}`, {}, 24));
        const nx = d.next_episode_to_air, ls = d.last_episode_to_air, today = Date.now();
        if (nx && nx.episode_number === 1 && new Date(nx.air_date) - today < 21 * 864e5) items.push({ at: new Date(Math.min(today, new Date(nx.air_date).getTime() - 864e5 * 14)).toISOString(), it: { ...t, key: `tv:${t.id}` }, e: "🔜", txt: `La temporada ${nx.season_number} de ${t.title} se estrena el ${new Date(nx.air_date).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}` });
        else if (ls && ls.episode_number === 1 && today - new Date(ls.air_date) < 30 * 864e5) items.push({ at: new Date(ls.air_date).toISOString(), it: { ...t, key: `tv:${t.id}` }, e: "🆕", txt: `¡Ya está la temporada ${ls.season_number} de ${t.title}!` });
      } catch (e) {}
    }));
  }
  items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  NEWS = items.slice(0, 40).map(n => ({ ...n, fresh: String(n.at) > since }));
  const nNew = NEWS.filter(n => n.fresh).length;
  const b = $("bellN"); if (b) { b.hidden = !nNew; b.textContent = nNew > 9 ? "9+" : nNew; }
}
function openNews() {
  const body = h("div", { class: "settings" }, h("div", { class: "chat-head" }, emo("🔔"), h("div", null, h("h2", null, "Novedades"), h("p", { class: "note" }, "Comentarios, propuestas, matches y nuevas temporadas"))),
    NEWS.length ? h("div", { class: "feed" }, NEWS.map(n => h("button", { class: "fitem" + (n.fresh ? " new" : ""), onclick: () => openItem(n.it) }, posterEl(n.it, false),
      h("div", null, h("p", null, emo(n.e), " ", n.txt), h("small", null, ago(n.at))))))
      : empty("Todo tranquilo", "Aquí verás cuando alguien comente, proponga algo o salga una nueva temporada de vuestras series.", null, "😌"));
  openSheet(body);
  store.set(lastSeenKey(), new Date().toISOString());
  NEWS.forEach(n => n.fresh = false);
  const b = $("bellN"); if (b) b.hidden = true;
}

/* ---------- tutorial ---------- */
function demoCard(title, cls) {
  return h("div", { class: "demo-card " + (cls || "") }, posterEl({ title, type: "movie" }, false), h("div", { class: "lbl" }, title));
}
const TOUR = [
  { osd: "▶ PLAY", vis: () => h("div", { style: "display:flex;flex-direction:column;align-items:center;gap:14px" }, h("span", { class: "sign-box sign", style: "font-size:22px" }, "VIDEOCLUB"), h("span", { class: "emo pulse", style: "font-size:56px" }, "📼")),
    t: () => `¡Hola, ${PROF[S.profile].name}!`, p: "Esto es vuestro videoclub: aquí decidís qué ver Oswaldo, Ana y Ángela. Te lo enseño todo en un minuto." },
  { osd: "▶ DESLIZA", vis: () => h("div", { style: "position:relative;width:100%;height:100%;display:grid;place-items:center" }, h("div", { class: "demo-swipe" }, demoCard("Tu próxima peli")), h("div", { class: "demo-hint" }, h("span", null, "← DEVOLVER"), h("span", null, "GUARDAR →"))),
    t: () => "Desliza las cintas", list: [["❤️", "A la derecha: la guardas. Se abre una ventanita para elegir la lista y dejar un comentario."], ["✖️", "A la izquierda: paso, no te la vuelvo a enseñar."], ["🧠", "Con cada cinta aprendo lo que te gusta y afino las siguientes."]] },
  { osd: "📼 LISTAS", vis: () => h("div", { class: "list-picker", style: "padding:0 14px;pointer-events:none" }, myLists().map(l => h("span", { class: "lp on", style: `--lc:${l.c}` }, h("span", { class: "lp-emo" }, emo(l.emo)), h("b", null, l.short), h("span", { class: "stack" }, l.members.map(u => avatar(u, "xs")))))),
    t: () => "Tus listas", list: () => myLists().map(l => [l.emo, l.personal ? "Mi lista: la tuya." : `${l.name}: la veis ${l.members.length === 3 ? "los tres" : l.members.length === 1 ? "solo tú" : l.members.map(u => u === S.profile ? "tú" : PROF[u].name).join(" y ")}.`]) },
  { osd: "⏸ BOTONES", vis: () => h("div", { class: "demo-btns" }, h("span", { class: "act" }, emo("⏪"), "Atrás"), h("span", { class: "act seen" }, emo("👀"), "Vista"), h("span", { class: "act yes" }, emo("❤️"), "Guardar")),
    t: () => "La botonera", list: [["⏪", "Atrás: deshace la última cinta."], ["👀", "Vista: ya la has visto. Le pones nota de 😖 a 🤩."], ["ℹ️", "El botón redondo de la cinta abre la contraportada: sinopsis, tráiler y dónde verla."]] },
  { osd: "🔍 BUSCAR", vis: () => h("div", { style: "display:flex;flex-direction:column;gap:10px;align-items:center;padding:0 16px" }, h("div", { class: "searchbar", style: "pointer-events:none" }, "🔍 lesbianas, navidad, atracos…"), h("div", { class: "chips wrap", style: "justify-content:center" }, ["⚡ Miniseries", "⏱️ < 2 h", "🇪🇸 Españolas", "🧸 Con niños"].map(x => h("span", { class: "chip" }, x)))),
    t: () => "Busca y filtra", list: [["🔍", "Busca por título o por tema, aunque la palabra no esté en el título."], ["🎛️", "Filtra las cintas: miniseries, menos de 2 h, españolas, con niños o una sola plataforma."]] },
  { osd: "🍿 SESIÓN", vis: () => h("div", { style: "display:flex;gap:16px;align-items:center" }, h("span", { class: "emo", style: "font-size:56px" }, "🤖"), h("div", { class: "reels spin" }, h("i"), h("i")), h("span", { class: "emo", style: "font-size:56px" }, "🍿")),
    t: () => "El dependiente y la noche de peli", list: [["🤖", "El dependiente: pídele lo que os apetece con tus palabras y te recomienda."], ["🍿", "Noche de peli: elige una lista, mira lo que os apetece a todos o deja que decida la ruleta."]] },
  { osd: "🏆 TOP 10", vis: () => h("div", { class: "demo-row" }, h("span", { class: "bignum", style: "font-size:70px;padding-bottom:20px" }, "1"), demoCard("Lo más visto"), h("span", { class: "bignum", style: "font-size:70px;padding-bottom:20px" }, "2"), demoCard("Semana")),
    t: () => "Lo más alquilado", p: "En «Top 10» tienes lo más visto esta semana en España, plataforma a plataforma. Se actualiza cada lunes." },
  { osd: "💬 COMENTAR", vis: () => h("div", { class: "demo-row" }, demoCard("Por ver"), demoCard("Vista 🤩"), demoCard("💬 ¿Hoy?")),
    t: () => "Comentar es facilísimo", list: [["📚", "En «Listas» tocas una lista y ves sus cintas, por ver y vistas, con las notas de cada uno."], ["💬", "Debajo de cada cinta están los comentarios y una casilla para escribir el tuyo."], ["🎉", "Si a todos os apetece la misma, hay match y se añade sola a la lista del grupo."]] },
  { osd: "🔔 AVISOS", vis: () => h("div", { style: "display:flex;flex-direction:column;gap:8px;padding:0 18px;width:100%" }, ["💬 Ana ha comentado: «¿El viernes?»", "💘 A Oswaldo también le apetece", "🆕 ¡Nueva temporada!"].map(x => h("div", { class: "fitem", style: "grid-template-columns:1fr;pointer-events:none;padding:8px 12px" }, h("p", null, x)))),
    t: () => "La campana", p: "Arriba a la derecha te aviso de comentarios, propuestas, coincidencias y nuevas temporadas de vuestras series." },
  { osd: "⏏ FIN", vis: () => h("div", { style: "display:flex;flex-direction:column;align-items:center;gap:10px" }, h("span", { class: "emo", style: "font-size:56px" }, "📲"), h("span", { class: "sign", style: "color:var(--sun);font-size:18px" }, "¡A VER PELIS!")),
    t: () => "Llévala en el móvil", list: [["🍎", "iPhone: Compartir → «Añadir a pantalla de inicio»."], ["🤖", "Android: menú ⋮ → «Instalar aplicación»."], ["📼", "Puedes volver a ver este tutorial desde tu carnet, arriba a la derecha."]] },
];
function openTour() {
  let i = 0;
  const box = $("tour");
  const close = () => { box.hidden = true; box.replaceChildren(); store.set("qv_tour_" + S.profile, 2); document.removeEventListener("keydown", onKey); };
  const go2 = n => { i = Math.max(0, Math.min(TOUR.length - 1, n)); paint(); };
  const onKey = e => { if (e.key === "ArrowRight") go2(i + 1); else if (e.key === "ArrowLeft") go2(i - 1); else if (e.key === "Escape") close(); };
  const paint = () => {
    const sl = TOUR[i], last = i === TOUR.length - 1;
    fill(box, h("div", { class: "tour-card" },
      h("div", { class: "tour-tv" }, h("span", { class: "osd" }, sl.osd), h("span", { class: "osd osd-r" }, `CH ${String(i + 1).padStart(2, "0")}`), sl.vis()),
      h("div", { class: "tour-body" }, h("h2", null, sl.t()), sl.p ? h("p", null, sl.p) : null,
        sl.list ? h("ul", null, (typeof sl.list === "function" ? sl.list() : sl.list).map(([e, t]) => h("li", null, emo(e), h("span", null, t)))) : null),
      h("div", { class: "tour-nav" },
        i === 0 ? h("button", { class: "tour-skip", onclick: close }, "Saltar") : h("button", { class: "tour-skip", onclick: () => go2(i - 1) }, "← Atrás"),
        h("div", { class: "tour-dots", "aria-label": `Paso ${i + 1} de ${TOUR.length}` }, TOUR.map((_, k) => h("i", { class: k === i ? "on" : "" }))),
        h("button", { class: "btn " + (last ? "mag" : "dark"), onclick: () => last ? close() : go2(i + 1) }, last ? "¡A ver pelis!" : "Siguiente"))));
  };
  box.hidden = false;
  document.addEventListener("keydown", onKey);
  let sx = null;
  box.onpointerdown = e => { sx = e.clientX; };
  box.onpointerup = e => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 60) go2(i + (dx < 0 ? 1 : -1)); };
  paint();
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
      h("button", { class: "btn sun", onclick: () => { closeSheet(); openTour(); } }, "📼 Ver el tutorial"),
      h("button", { class: "btn", onclick: () => { closeSheet(); logout(false); } }, "Cambiar de socio"),
      REMOTE ? h("button", { class: "btn", onclick: () => { closeSheet(); logout(true); } }, "Salir") : null),
    h("p", { class: "note" }, "Instálala como app: en iPhone, Compartir → «Añadir a pantalla de inicio». En Android, menú ⋮ → «Instalar aplicación»."),
    h("p", { class: "foot" }, attributionText())));
}

/* ---------- entrada ---------- */
let pinBuf = "", chosen = null;
function showLogin() {
  $("app").hidden = true; $("login").hidden = false;
  $("who").replaceChildren(...PROFILES.map((p, i) => h("button", { class: "card-socio", style: `--c:${p.color}`, "aria-pressed": chosen === p.id ? "true" : "false", onclick: () => pick(p.id) },
    avatar(p.id), h("span", null, h("span", { class: "who-n" }, p.name), h("span", { class: "who-s", style: "display:block" }, `SOCIO Nº 000${i + 1}`)), h("span", { class: "barcode", "aria-hidden": "true" }))));
  const needPin = !!(chosen && REMOTE && !S.pin);
  $("pinbox").hidden = !needPin;
  $("loginSub").textContent = needPin ? `Hola, ${PROF[chosen].name}. Teclea el PIN de casa` : "Enseña tu carnet de socio";
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
  if (store.get("qv_tour_" + id, 0) < 2) openTour();
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
  $("meBtn").onclick = openSettings; $("searchBtn").onclick = () => openSearch(); $("bellBtn").onclick = openNews;
  $("sheetClose").onclick = closeSheet; $("scrim").onclick = closeSheet;
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !$("sheet").hidden) closeSheet();
    if (S.view === "discover" && $("sheet").hidden && !$("app").hidden && !/INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || "")) {
      if (e.key === "ArrowRight") swipeTop("yes"); else if (e.key === "ArrowLeft") swipeTop("no");
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
