import assert from 'node:assert/strict';
import { validateSimulationResponse } from './api.js';

const txid = 'a'.repeat(64);
const valid = {
  txid,
  tip_block_id: 'b'.repeat(64),
  consensus_hash: 'c'.repeat(40),
  block_height: 101,
  result_hex: '0x0703', // (ok true)
  stx_burned: 0,
  execution_cost: { read_count: 1 },
  execution_limit: { read_count: 1000 },
  events: [],
  post_condition_aborted: false,
  vm_error: null,
};

assert.doesNotThrow(() => validateSimulationResponse(valid, txid, 101));

assert.throws(
  () => validateSimulationResponse({ ...valid, post_condition_aborted: true }, txid, 101),
  /did not return \(ok true\)/,
);
assert.throws(
  () => validateSimulationResponse({ ...valid, vm_error: 'runtime failure' }, txid, 101),
  /did not return \(ok true\)/,
);
assert.throws(
  () => validateSimulationResponse({ ...valid, result_hex: '0x0801' }, txid, 101),
  /did not return \(ok true\)/,
);

// A syntactically valid but non-response result is ambiguous and must fail closed.
assert.throws(
  () => validateSimulationResponse({ ...valid, result_hex: '0x03' }, txid, 101),
  /did not return \(ok true\)/,
);

assert.throws(
  () => validateSimulationResponse({ ...valid, block_height: 100 }, txid, 101),
  /below required height 101/,
);

for (const malformed of [
  null,
  {},
  { ...valid, txid: 'not-a-txid' },
  { ...valid, tip_block_id: undefined },
  { ...valid, consensus_hash: '00' },
  { ...valid, block_height: 101.5 },
  { ...valid, result_hex: '0x0' },
  { ...valid, execution_cost: null },
  { ...valid, events: {} },
  { ...valid, vm_error: undefined },
]) {
  assert.throws(
    () => validateSimulationResponse(malformed, txid, 101),
    /incomplete or malformed/,
  );
}

assert.throws(
  () => validateSimulationResponse(valid, 'd'.repeat(64), 101),
  /mismatched transaction ID/,
);
