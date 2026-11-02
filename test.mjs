// Ejecutar: node test.mjs
import assert from 'node:assert/strict';
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { extractJson, validate, apiError } = await import('./js/ai.js');
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
console.log('OK');
