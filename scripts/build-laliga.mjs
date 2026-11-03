// Genera data/laliga.json: equipos y plantillas de Primera (ESPN) + fotos libres (Wikidata / Wikimedia Commons).
// Uso: node scripts/build-laliga.mjs   (hace unas 60 peticiones; repetir cuando cambien los fichajes)
import { writeFileSync } from 'node:fs';

const UA = { 'User-Agent': 'FantasyCopilot/1.0 (proyecto personal; https://github.com/christiangarciaeleno-source/fantasy-copilot)' };
const get = async (url) => { const r = await fetch(url, { headers: UA }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); };
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const POS = { G: 'POR', D: 'DEF', M: 'MED', F: 'DEL' };
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/teams';

// Fotos: jugadores actuales (sin fecha de fin en "miembro de") de cada club, con imagen (P18).
const ALIAS = { 'Alavés': 'Deportivo Alavés', 'Atlético Madrid': 'Atlético de Madrid', 'Barcelona': 'FC Barcelona', 'Celta Vigo': 'RC Celta de Vigo', Deportivo: 'Deportivo de La Coruña', Espanyol: 'RCD Espanyol', Osasuna: 'CA Osasuna', 'Racing Santander': 'Real Racing Club de Santander', Valencia: 'Valencia CF', Málaga: 'Málaga CF', Elche: 'Elche CF', Getafe: 'Getafe CF', Levante: 'Levante UD', Sevilla: 'Sevilla FC', Villarreal: 'Villarreal CF', 'Rayo Vallecano': 'Rayo Vallecano' };

async function photos(teamName) {
  const search = await get(`https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=es&type=item&limit=8&search=${encodeURIComponent(ALIAS[teamName] ?? teamName)}`);
  for (const club of search.search ?? []) {
    const q = `SELECT ?l ?img WHERE { wd:${club.id} wdt:P31/wdt:P279* wd:Q476028. ?p wdt:P31 wd:Q5; wdt:P106 wd:Q937857; p:P54 ?st; wdt:P18 ?img; rdfs:label ?l.
      ?st ps:P54 wd:${club.id}. FILTER NOT EXISTS { ?st pq:P582 ?end } FILTER(LANG(?l) IN ("es","en")) }`;
    const rows = (await get(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`)).results.bindings;
    if (rows.length > 5) return rows.map((r) => [r.l.value, decodeURIComponent(r.img.value.split('/Special:FilePath/')[1])]); // el club bueno tiene plantilla
  }
  return [];
}

const equipos = [];
const teams = (await get(ESPN)).sports[0].leagues[0].teams.map((t) => t.team);
for (const t of teams) {
  const roster = (await get(`${ESPN}/${t.id}/roster`)).athletes;
  const ph = await photos(t.displayName).catch(() => []);
  const byName = new Map(ph.map(([n, f]) => [norm(n), f]));
  const jugadores = roster.map((a) => {
    const n = norm(a.displayName), last = n.split(' ').at(-1);
    const all = n.split(' ');
    // 1) nombre igual, 2) todas las palabras del nombre dentro de la etiqueta, 3) mismo apellido e inicial: nunca solo el apellido.
    const f = byName.get(n)
      ?? [...byName].find(([k]) => all.length > 1 && all.every((w) => k.split(' ').includes(w)))?.[1]
      ?? [...byName].find(([k]) => k.endsWith(` ${last}`) && k.startsWith(n[0]))?.[1];
    return { n: a.displayName, p: POS[a.position?.abbreviation] ?? 'MED', d: Number(a.jersey) || 0, ...(f && { f }) };
  }).sort((a, b) => 'PORDEFMEDDEL'.indexOf(a.p) - 'PORDEFMEDDEL'.indexOf(b.p) || a.d - b.d);
  equipos.push({ id: t.id, nombre: t.displayName, abrev: t.abbreviation, escudo: t.logos?.[0]?.href, jugadores });
  console.log(t.displayName.padEnd(18), `${jugadores.length} jugadores, ${jugadores.filter((j) => j.f).length} con foto (${ph.length} fotos en Wikidata)`);
}
writeFileSync(new URL('../data/laliga.json', import.meta.url), JSON.stringify({ actualizado: new Date().toLocaleDateString('sv-SE'), equipos }));
