import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { JsonNonceStore } from './nonce-store.js';

const directory = await mkdtemp(join(tmpdir(), 'ossr-nonce-store-'));
const path = join(directory, 'nonces.json');
const sponsor = 'ST000000000000000000002AMW42H';
const firstTxid = 'a'.repeat(64);

try {
  const store = new JsonNonceStore(path);
  assert.equal(await store.nextNonce(sponsor, 4n), 4n);
  await store.reserve(sponsor, 4n, firstTxid, 'SIMULATED');
  assert.equal(await store.nextNonce(sponsor, 4n), 5n);

  await assert.rejects(store.reserve(sponsor, 4n, 'b'.repeat(64), 'SIMULATED'), /already reserved/);
  await assert.rejects(store.reserve(sponsor, 5n, firstTxid, 'SIGNED'), /already has a nonce reservation/);

  await store.update(sponsor, firstTxid, { status: 'AMBIGUOUS', failureReason: 'broadcast connection closed' });

  const restarted = new JsonNonceStore(path);
  assert.equal(await restarted.nextNonce(sponsor, 0n), 5n);
  const ambiguous = await restarted.list(sponsor);
  assert.equal(ambiguous.length, 1);
  assert.equal(ambiguous[0].nonce, '4');
  assert.equal(ambiguous[0].txid, firstTxid);
  assert.equal(ambiguous[0].status, 'AMBIGUOUS');
  assert.equal(ambiguous[0].failureReason, 'broadcast connection closed');

  await restarted.update(sponsor, firstTxid, { status: 'CONFIRMED', chainStatus: 'success', failureReason: undefined });
  const reconciled = await new JsonNonceStore(path).list(sponsor);
  assert.equal(reconciled[0].status, 'CONFIRMED');
  assert.equal(reconciled[0].chainStatus, 'success');
  assert.equal((await stat(path)).mode & 0o777, 0o600);
} finally {
  await rm(directory, { recursive: true });
}
