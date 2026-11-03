// Ejecutar: node test.mjs
import assert from 'node:assert/strict';
const saved = {};
globalThis.localStorage = { getItem: () => null, setItem: (k, v) => { saved[k] = v; } };
const { extractJson, validate, apiError, analyze, manualPrompt, importManual, pace } = await import('./js/ai.js');
const { STATE } = await import('./js/state.js');
const { buildSummary } = await import('./js/export.js');
const { money } = await import('./js/util.js');
const { DEMO } = await import('./js/demo.js');

assert.equal(validate(DEMO).once.length, 11);
assert.throws(() => validate({ ...DEMO, once: DEMO.once.slice(1) }), /11 jugadores/);
assert.throws(() => validate({ ...DEMO, once: DEMO.once.map((p) => ({ ...p, posicion: 'XX' })) }), /11 jugadores/);
assert.throws(() => validate({ once: DEMO.once }), /saldo/);
assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
assert.throws(() => extractJson('sin json'), /JSON/);
assert.equal(money(-1850000), '-1.85 M€');
assert.match(buildSummary(DEMO), /Esquema:\* 1-4-3-3/);
assert.ok(!/undefined|Capitán/.test(buildSummary(DEMO)));
assert.match(apiError(429, 'long google text', 'Gemini').message, /Cuota de Gemini agotada.*modo manual/);
assert.match(apiError(503, null, 'Gemini').message, /no responde/);
assert.equal(apiError(400, 'bad request', 'Gemini').message, 'bad request');
// --- analyze(): transporte resistente ---
pace.wait = 0;
Object.assign(STATE, { geminiKey: 'k', model: 'gemini-2.5-flash', inputs: [{ mime: 'image/jpeg', b64: 'x' }, { mime: 'image/jpeg', b64: 'y' }, { text: 'Plantilla: Lamine Yamal 9,4' }] });
const ok = (obj) => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }) });
const fail = (status) => ({ ok: false, status, json: async () => ({}) });
let urls = [], bodies = [], heads = [];
const mock = (fn) => { urls = []; bodies = []; heads = []; globalThis.fetch = async (url, o) => { heads.push(o?.headers); urls.push(url); bodies.push(o.body ? JSON.parse(o.body) : null); return fn(urls.length); }; };

// Todas las capturas viajan en una sola llamada, y 2.5 Flash va sin "thinking".
mock(() => ok(DEMO));
assert.equal((await analyze()).once.length, 11);
assert.equal(urls.length, 1);
assert.equal(bodies[0].contents[0].parts.filter((p) => p.inlineData).length, 2);
assert.ok(bodies[0].contents[0].parts.some((p) => /TEXTO COPIADO[\s\S]*Lamine Yamal/.test(p.text)));
assert.equal(bodies[0].generationConfig.thinkingConfig.thinkingBudget, 0);

// Un 503 puntual se reintenta; el 429 persistente pasa al modelo de reserva y, si también falla, avisa de la cuota.
mock((n) => (n === 1 ? fail(503) : ok(DEMO)));
assert.equal((await analyze()).once.length, 11);
assert.equal(urls.length, 2);
mock((n) => (/flash-lite/.test(urls[n - 1]) ? ok(DEMO) : fail(429)));
assert.equal((await analyze()).once.length, 11);
assert.match(urls.at(-1), /gemini-2\.5-flash-lite/);
mock(() => fail(429));
await assert.rejects(analyze(), /Cuota de Gemini/);
assert.equal(urls.length, 4);
mock(() => fail(400)); // error del usuario/clave: sin reintentos
await assert.rejects(analyze(), /HTTP 400/);
assert.equal(urls.length, 1);

// Timeout o red caída: se reintenta como un 5xx.
mock((n) => { if (n === 1) throw new DOMException('timeout', 'TimeoutError'); return ok(DEMO); });
assert.equal((await analyze()).once.length, 11);

// Si no responde a tiempo no se repite con el mismo modelo: un intento por modelo y el mensaje lo explica.
mock(() => { throw new DOMException('timeout', 'TimeoutError'); });
await assert.rejects(analyze(), (e) => e.name === 'TimeoutError' && /no respondió a tiempo \(2\.5-flash: sin respuesta.*2\.5-flash-lite/.test(e.message));
assert.equal(urls.length, 2);

// Un once inválido se reintenta una vez con pista; JSON cortado también.
mock((n) => ok(n === 1 ? { ...DEMO, once: [] } : DEMO));
assert.equal((await analyze()).once.length, 11);
assert.match(bodies[1].contents[0].parts[0].text, /ATENCIÓN/);
globalThis.fetch = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"saldo": 1, "once": [' }] } }] }) });
await assert.rejects(analyze(), /extraer el JSON/);

// La IA escribe "Delantero", "85%", "5,5": se normaliza en vez de fallar.
const sucio = { ...DEMO, once: DEMO.once.map((p) => ({ ...p, posicion: p.posicion === 'DEL' ? 'Delantero' : p.posicion, titularidad_pct: '85%', xp: '5,5' })) };
const limpio = validate(sucio);
assert.equal(limpio.once.at(-1).posicion, 'DEL');
assert.equal(limpio.once[0].titularidad_pct, 85);
assert.equal(limpio.once[0].xp, 5.5);

// Red caída (fetch lanza TypeError): mensaje claro y sin cuatro reintentos.
mock(() => { throw new TypeError('Failed to fetch'); });
await assert.rejects(analyze(), /Sin conexión con Google/);
assert.equal(urls.length, 2);

// Modelo retirado (404): se busca el Flash más nuevo, se guarda y el análisis sigue con reintentos.
mock((n) => {
  if (/models\?pageSize/.test(urls[n - 1])) return { ok: true, json: async () => ({ models: [{ name: 'models/gemini-2.9-flash', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-2.9-flash-lite', supportedGenerationMethods: ['generateContent'] }] }) };
  return /gemini-2\.5-flash:/.test(urls[n - 1]) ? fail(404) : ok(DEMO);
});
assert.equal((await analyze()).once.length, 11);
assert.equal(STATE.model, 'gemini-2.9-flash');
assert.equal(saved.fc_model, 'gemini-2.9-flash');
STATE.model = 'gemini-2.5-flash';

// titularidad como 0,9 en vez de 90: no se marca a todos como "en duda".
assert.equal(validate({ ...DEMO, once: DEMO.once.map((p) => ({ ...p, titularidad_pct: 0.9 })) }).once[0].titularidad_pct, 90);

// El texto pegado se limpia de emails antes de ir a Google.
const { cleanText } = await import('./js/image.js');
assert.equal(cleanText('  Hola pepe.perez+fantasy@gmail.com, tu plantilla '), 'Hola [email], tu plantilla');

// --- OpenRouter: segundo motor gratuito ---
Object.assign(STATE, { engine: 'openrouter', orKey: 'sk-or-k', inputs: [{ mime: 'image/jpeg', b64: 'x', url: 'data:image/jpeg;base64,x' }, { text: 'Plantilla: Lamine Yamal 9,4' }] });
const vl = (id, mods = ['text', 'image']) => ({ id, architecture: { input_modalities: mods } });
const catalog = { data: [vl('x/seguridad-safety:free'), vl('nvidia/nemotron-3.5-super-vl:free'), vl('foo/solo-texto:free', ['text']), vl('google/gemma-4-31b-it:free'), vl('foo/de-pago', ['image'])] };
const orOk = (obj) => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'Aquí va:\n```json\n' + JSON.stringify(obj) + '\n```' } }] }) });
const chat = (n) => /chat\/completions/.test(urls[n - 1]);
const route = (fn) => mock((n) => (chat(n) ? fn(n) : { ok: true, json: async () => catalog }));

route(() => orOk(DEMO));
assert.equal((await analyze()).once.length, 11);
const sent = bodies.find((b) => b?.messages);
assert.equal(sent.model, 'google/gemma-4-31b-it:free'); // Gemma primero; sin modelos de seguridad, de solo texto ni de pago
assert.equal(heads.at(-1).Authorization, 'Bearer sk-or-k');
assert.deepEqual(sent.messages[0].content.slice(1).map((p) => p.type), ['image_url', 'text']);
assert.equal(sent.messages[0].content[1].image_url.url, 'data:image/jpeg;base64,x');
assert.match(sent.messages[0].content[0].text, /Responde SOLO con un JSON/);

// Un modelo con cuota agotada o caído pasa al siguiente; una clave mala no.
let tries = [];
route((n) => { tries.push(bodies[n - 1].model); return tries.length === 1 ? fail(429) : orOk(DEMO); });
assert.equal((await analyze()).once.length, 11);
assert.deepEqual(tries, ['google/gemma-4-31b-it:free', 'nvidia/nemotron-3.5-super-vl:free']);
route(() => fail(401));
await assert.rejects(analyze(), /API Key de OpenRouter no válida/);
assert.equal(urls.filter((u) => /chat/.test(u)).length, 1);
route(() => ({ ok: false, status: 404, json: async () => ({ error: { message: 'No endpoints found matching your data policy' } }) }));
await assert.rejects(analyze(), /openrouter\.ai\/settings\/privacy/);
mock((n) => { if (chat(n)) throw new DOMException('timeout', 'TimeoutError'); return { ok: true, json: async () => catalog }; });
await assert.rejects(analyze(), (e) => e.name === 'TimeoutError' && /OpenRouter no respondió/.test(e.message));
globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); }; // sin lista de modelos: usa los de reserva
await assert.rejects(analyze(), /Sin conexión con OpenRouter/);
STATE.orKey = '';
await assert.rejects(analyze(), (e) => e.code === 'NOKEY');
Object.assign(STATE, { engine: 'gemini', orKey: 'sk-or-k' });

// Modo manual: el prompt pide JSON y se importa tal cual lo devuelve un chat (con ```json y texto alrededor).
assert.match(manualPrompt(), /Responde SOLO con un JSON/);
assert.equal(importManual('Aquí tienes:\n```json\n' + JSON.stringify(DEMO) + '\n```').once.length, 11);
assert.throws(() => importManual('no es json'), /JSON/);
// Favorito: es un javascript: autocontenido y sin llamadas de red.
const { BOOKMARKLET } = await import('./js/bookmarklet.js');
assert.ok(BOOKMARKLET.startsWith('javascript:'));
assert.doesNotThrow(() => new Function(BOOKMARKLET.slice('javascript:'.length)));
assert.ok(!/fetch|XMLHttpRequest|sendBeacon/.test(BOOKMARKLET));
// --- Skill, formato v2, seguimiento y recordatorio ---
const skill = (await import('node:fs')).readFileSync('./skills/fantasy-analista/SKILL.md', 'utf8');
const mp = manualPrompt(skill, DEMO);
assert.ok(!mp.startsWith('---') && /Analista de Movistar Fantasy MARCA/.test(mp)); // sin el frontmatter de la skill
assert.ok(mp.includes('"version": 2') && mp.includes('"consejos"')); // el formato que importa la app
assert.ok(mp.includes(JSON.stringify(DEMO))); // contexto del último análisis
assert.ok(manualPrompt('', null).includes('Responde SOLO con un JSON')); // sin skill: prompt básico

const v2 = validate({ ...DEMO, fecha: undefined, consejos: undefined });
assert.match(v2.fecha, /^\d{4}-\d{2}-\d{2}$/);
assert.deepEqual(v2.consejos, []);
assert.equal(validate({ ...DEMO, fecha: '2026-11-03 22:00' }).fecha, '2026-11-03');
// Lo que exporta la app lo reimporta la app (ida y vuelta), sin arrastrar el historial.
const { saveLast, STATE: ST } = await import('./js/state.js');
const { buildJson, buildIcs } = await import('./js/export.js');
ST.history = [];
saveLast({ ...DEMO, fecha: '2026-11-02', saldo: -2000000 });
saveLast({ ...DEMO, fecha: '2026-11-03' });
saveLast({ ...DEMO, fecha: '2026-11-03', saldo: 100 }); // mismo día: sustituye
assert.deepEqual(ST.history.map((h) => [h.fecha, h.data.saldo]), [['2026-11-02', -2000000], ['2026-11-03', 100]]);
const exported = buildJson(ST.data, ST.history);
assert.equal(JSON.parse(exported).historial.length, 2);
const back = importManual('Aquí va mi JSON:\n' + exported);
assert.equal(back.once.length, 11);
assert.ok(!('historial' in back));
for (let d = 0; d < 40; d++) saveLast({ ...DEMO, fecha: `2027-01-${String(d % 28 + 1).padStart(2, '0')}x`.slice(0, 10) });
assert.ok(ST.history.length <= 30);

const ics = buildIcs(new Date('2026-11-03T10:00:00Z'));
assert.ok(ics.includes('RRULE:FREQ=DAILY') && ics.includes('T220000') && ics.includes('BEGIN:VALARM'));
assert.match(ics, /DTSTART:2026110\dT220000/);
console.log('OK');
