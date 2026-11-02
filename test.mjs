// Ejecutar: node test.mjs
import assert from 'node:assert/strict';
globalThis.localStorage = { getItem: () => null, setItem() {} };
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
assert.match(apiError(429, 'long google text', 'Gemini').message, /Cuota de Gemini agotada/);
assert.match(apiError(503, null, 'Gemini').message, /no responde/);
assert.equal(apiError(400, 'bad request', 'Gemini').message, 'bad request');
// --- analyze(): transporte resistente ---
pace.wait = 0;
Object.assign(STATE, { research: false, geminiKey: 'k', model: 'gemini-2.5-flash', images: [{ mime: 'image/jpeg', b64: 'x' }, { mime: 'image/jpeg', b64: 'y' }] });
const ok = (obj) => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }) });
const fail = (status) => ({ ok: false, status, json: async () => ({}) });
let urls = [], bodies = [];
const mock = (fn) => { urls = []; bodies = []; globalThis.fetch = async (url, o) => { urls.push(url); bodies.push(JSON.parse(o.body)); return fn(urls.length); }; };

// Todas las capturas viajan en una sola llamada, y 2.5 Flash va sin "thinking".
mock(() => ok(DEMO));
assert.equal((await analyze()).once.length, 11);
assert.equal(urls.length, 1);
assert.equal(bodies[0].contents[0].parts.filter((p) => p.inlineData).length, 2);
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

// Con búsqueda activa: 1 llamada de informe + 1 de análisis, y si el informe falla se analiza igual y se avisa.
STATE.research = true;
mock((n) => (n === 1 ? ok({}) : ok(DEMO)));
assert.equal((await analyze()).sinInforme, false);
assert.ok(bodies[0].tools?.[0].googleSearch && !bodies[1].tools);
mock((n) => (bodies[n - 1].tools ? fail(500) : ok(DEMO)));
assert.equal((await analyze()).sinInforme, true);

// Modo manual: el prompt pide JSON y se importa tal cual lo devuelve un chat (con ```json y texto alrededor).
assert.match(manualPrompt(), /Responde SOLO con un JSON/);
assert.equal(importManual('Aquí tienes:\n```json\n' + JSON.stringify(DEMO) + '\n```').once.length, 11);
assert.throws(() => importManual('no es json'), /JSON/);
console.log('OK');
