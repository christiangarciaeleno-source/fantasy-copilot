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
Object.assign(STATE, { engine: 'gemini', geminiKey: 'k', image: { mime: 'image/jpeg', b64: 'x' } });
const reply = (obj) => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }) });
let calls = 0;
globalThis.fetch = async () => reply(++calls === 1 ? { ...DEMO, once: [] } : DEMO);
assert.equal((await analyze()).once.length, 11);
assert.equal(calls, 2);
calls = 0;
globalThis.fetch = async () => (calls++, { ok: false, status: 429, json: async () => ({}) });
await assert.rejects(analyze(), /Cuota de Gemini/);
assert.equal(calls, 1);
console.log('OK');
