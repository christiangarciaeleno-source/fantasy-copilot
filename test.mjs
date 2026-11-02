// Ejecutar: node test.mjs
import assert from 'node:assert/strict';
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { extractJson, validate, apiError, analyze } = await import('./js/ai.js');
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
assert.match(apiError(503, null, 'Claude').message, /no responde/);
assert.equal(apiError(400, 'bad request', 'Gemini').message, 'bad request');
// analyze(): un once inválido se reintenta una vez; un 429 no se reintenta.
Object.assign(STATE, { research: false, engine: 'gemini', geminiKey: 'k', image: { mime: 'image/jpeg', b64: 'x' } });
const reply = (obj) => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }) });
let calls = 0;
globalThis.fetch = async () => reply(++calls === 1 ? { ...DEMO, once: [] } : DEMO);
assert.equal((await analyze()).once.length, 11);
assert.equal(calls, 2);
calls = 0;
globalThis.fetch = async () => (calls++, { ok: false, status: 429, json: async () => ({}) });
await assert.rejects(analyze(), /Cuota de Gemini/);
assert.equal(calls, 1);
// Con búsqueda activa: 1 llamada de informe + 1 de análisis, y el informe llega al prompt; si el informe falla, se analiza igual.
STATE.research = true;
const bodies = [];
globalThis.fetch = async (_, o) => { bodies.push(JSON.parse(o.body)); return reply(bodies.length === 1 ? {} : DEMO); };
assert.equal((await analyze()).once.length, 11);
assert.equal(bodies.length, 2);
assert.ok(bodies[0].tools?.[0].googleSearch && !bodies[1].tools);
globalThis.fetch = async (_, o) => (JSON.parse(o.body).tools ? { ok: false, status: 500, json: async () => ({}) } : reply(DEMO));
assert.equal((await analyze()).once.length, 11);
// Claude: tool_use forzado, y con búsqueda el informe llega delimitado al prompt del análisis.
Object.assign(STATE, { engine: 'claude', claudeKey: 'k', research: true });
const sent = [];
globalThis.fetch = async (_, o) => {
  const b = JSON.parse(o.body); sent.push(b);
  const content = b.tool_choice ? [{ type: 'tool_use', input: DEMO }] : [{ type: 'text', text: 'Lamine Yamal duda (Sofascore)' }];
  return { ok: true, json: async () => ({ content }) };
};
const res = await analyze();
assert.equal(res.once.length, 11);
assert.equal(res.sinInforme, false);
assert.equal(sent[0].tools[0].type, 'web_search_20250305');
assert.equal(sent[1].tool_choice.name, 'registrar_analisis');
assert.match(sent[1].messages[0].content[1].text, /<informe>\nLamine Yamal duda/);
// Si la búsqueda falla se avisa con sinInforme.
globalThis.fetch = async (_, o) => JSON.parse(o.body).tool_choice
  ? { ok: true, json: async () => ({ content: [{ type: 'tool_use', input: DEMO }] }) }
  : { ok: false, status: 500, json: async () => ({}) };
assert.equal((await analyze()).sinInforme, true);
console.log('OK');
