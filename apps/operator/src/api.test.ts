import assert from 'node:assert/strict';
import {
  Pc,
  PostConditionMode,
  bufferCV,
  deserializeTransaction,
  getAddressFromPrivateKey,
  makeContractCall,
  noneCV,
  randomPrivateKey,
  standardPrincipalCV,
  uintCV,
} from '@stacks/transactions';
import { OssrRelayApi } from './api.js';
import { OssrOperator } from './operator.js';
import { MemoryQuoteStore } from './quote-store.js';

async function assertRelayRejection(promise: Promise<unknown>, status: number, code: string, message: RegExp): Promise<void> {
  try {
    await promise;
    assert.fail(`Expected relay rejection ${code}.`);
  } catch (error) {
    assert.equal((error as { status?: number }).status, status);
    assert.equal((error as { code?: string }).code, code);
    assert.match(error instanceof Error ? error.message : String(error), message);
  }
}

const originKey = randomPrivateKey();
const sponsorKey = randomPrivateKey();
const recipientKey = randomPrivateKey();
const origin = getAddressFromPrivateKey(originKey, 'testnet');
const recipient = getAddressFromPrivateKey(recipientKey, 'testnet');
const adapterAddress = getAddressFromPrivateKey(randomPrivateKey(), 'testnet');
const sbtcAddress = getAddressFromPrivateKey(randomPrivateKey(), 'testnet');
let stacksHeight = 100;

const originalFetch = globalThis.fetch;
globalThis.fetch = async input => {
  const url = String(input);
  if (url.endsWith('/v2/info')) return new Response(JSON.stringify({ stacks_tip_height: stacksHeight }), { status: 200 });
  if (url.includes('/extended/v1/address/') && url.endsWith('/stx')) return new Response(JSON.stringify({ balance: '1000000', locked: '0' }), { status: 200 });
  if (url.endsWith('/v2/fees/transfer')) return new Response('1', { status: 200 });
  throw new Error(`Unexpected fetch in relay policy test: ${url}`);
};

try {
  const operator = new OssrOperator({ network: 'testnet', sponsorPrivateKey: sponsorKey, logger: () => undefined });
  const quoteStore = new MemoryQuoteStore();
  let simulationCalls = 0;
  const relay = new OssrRelayApi({
    operator,
    quotePrivateKey: randomPrivateKey(),
    adapterContractAddress: adapterAddress,
    adapterContractName: 'sbtc-sponsored-transfer-v1',
    sbtcContractAddress: sbtcAddress,
    sbtcContractName: 'sbtc-token',
    sponsorFeeSats: 10n,
    simulateTransaction: async () => {
      simulationCalls += 1;
      throw new Error('simulated contract failure');
    },
    quoteStore,
  });

  await assert.rejects(
    relay.sponsor({ transaction: '0x00', user: origin }),
    /relay-issued quoteId is required/,
  );

  const quoteResponse = await relay.quote({
    origin,
    recipient,
    amountSats: '100',
    maxSponsorFeeSats: '20',
  });
  const quote = quoteResponse.quote;

  await assertRelayRejection(
    relay.sponsor({ quoteId: quote.quoteId, transaction: '0x00', user: origin }),
    400,
    'INVALID_TRANSACTION',
    /transaction could not be decoded/,
  );
  await assertRelayRejection(
    relay.sponsor({ quoteId: quote.quoteId, transaction: 'not-hex', user: origin }),
    400,
    'INVALID_TRANSACTION',
    /even-length 0x-prefixed hexadecimal/,
  );

  async function transaction(
    postConditions: Parameters<typeof makeContractCall>[0]['postConditions'],
    mutation: { amount?: bigint; recipient?: string; sponsorFee?: bigint; quoteId?: string; expiry?: bigint } = {},
  ) {
    return makeContractCall({
      contractAddress: adapterAddress,
      contractName: 'sbtc-sponsored-transfer-v1',
      functionName: 'sponsored-transfer',
      functionArgs: [
        uintCV(mutation.amount ?? 100n),
        standardPrincipalCV(mutation.recipient ?? recipient),
        uintCV(mutation.sponsorFee ?? 10n),
        bufferCV(Buffer.from((mutation.quoteId ?? quote.quoteId).slice(2), 'hex')),
        uintCV(mutation.expiry ?? BigInt(quote.expiresAtBlock)),
        noneCV(),
      ],
      senderKey: originKey,
      nonce: 0n,
      fee: 0n,
      sponsored: true,
      network: 'testnet',
      postConditionMode: PostConditionMode.Deny,
      postConditions,
    });
  }

  const missing = await transaction([]);
  await assertRelayRejection(
    relay.sponsor({ quoteId: quote.quoteId, transaction: `0x${missing.serialize()}`, user: origin }),
    422,
    'INVALID_POST_CONDITIONS',
    /Exactly one sBTC fungible-token post-condition is required/,
  );

  const excessive = await transaction([
    Pc.principal(origin).willSendEq(111n).ft(`${sbtcAddress}.sbtc-token`, 'sbtc-token'),
  ]);
  await assertRelayRejection(
    relay.sponsor({ quoteId: quote.quoteId, transaction: `0x${excessive.serialize()}`, user: origin }),
    422,
    'INVALID_POST_CONDITIONS',
    /must equal the transfer amount plus sponsor fee/,
  );

  const wrongAsset = await transaction([
    Pc.principal(origin).willSendEq(110n).ft(`${getAddressFromPrivateKey(randomPrivateKey(), 'testnet')}.sbtc-token`, 'sbtc-token'),
  ]);
  await assertRelayRejection(
    relay.sponsor({ quoteId: quote.quoteId, transaction: `0x${wrongAsset.serialize()}`, user: origin }),
    422,
    'INVALID_POST_CONDITIONS',
    /must reference the configured sBTC asset/,
  );

  const wrongPrincipal = await transaction([
    Pc.principal(recipient).willSendEq(110n).ft(`${sbtcAddress}.sbtc-token`, 'sbtc-token'),
  ]);
  await assertRelayRejection(
    relay.sponsor({ quoteId: quote.quoteId, transaction: `0x${wrongPrincipal.serialize()}`, user: origin }),
    422,
    'INVALID_POST_CONDITIONS',
    /principal must be the quote origin/,
  );

  const condition = Pc.principal(origin).willSendEq(110n).ft(`${sbtcAddress}.sbtc-token`, 'sbtc-token');
  const extra = await transaction([condition, condition]);
  await assertRelayRejection(
    relay.sponsor({ quoteId: quote.quoteId, transaction: `0x${extra.serialize()}`, user: origin }),
    422,
    'INVALID_POST_CONDITIONS',
    /Exactly one sBTC fungible-token post-condition is required/,
  );
  assert.equal(simulationCalls, 0, 'invalid post-conditions must be rejected before simulation');
  assert.deepEqual(await operator.nonceReservations(), [], 'invalid post-conditions must not reserve a sponsor nonce');

  const valid = await transaction([
    Pc.principal(origin).willSendEq(110n).ft(`${sbtcAddress}.sbtc-token`, 'sbtc-token'),
  ]);

  const feeLimitRelay = new OssrRelayApi({
    operator,
    quotePrivateKey: randomPrivateKey(),
    adapterContractAddress: adapterAddress,
    adapterContractName: 'sbtc-sponsored-transfer-v1',
    sbtcContractAddress: sbtcAddress,
    sbtcContractName: 'sbtc-token',
    maximumFeeMicroStx: 1n,
    quoteStore,
    simulateTransaction: async () => { throw new Error('fee-limit request reached simulation'); },
  });
  await assertRelayRejection(
    feeLimitRelay.sponsor({ quoteId: quote.quoteId, transaction: `0x${valid.serialize()}`, user: origin }),
    422,
    'FEE_OUT_OF_POLICY',
    /outside relay policy/,
  );

  const originalBalance = operator.balance.bind(operator);
  Object.assign(operator, {
    balance: async () => ({ address: operator.address, availableMicroStx: 0n, lockedMicroStx: 0n }),
  });
  await assert.rejects(
    relay.sponsor({ quoteId: quote.quoteId, transaction: `0x${valid.serialize()}`, user: origin }),
    /insufficient STX/,
  );
  Object.assign(operator, { balance: originalBalance });
  assert.equal((await quoteStore.get(quote.quoteId))?.state, 'ISSUED', 'insufficient STX must release the quote reservation');
  assert.deepEqual(await operator.nonceReservations(), [], 'insufficient STX must not reserve a sponsor nonce');

  stacksHeight = Number(quote.expiresAtBlock) + 1;
  await assertRelayRejection(
    relay.sponsor({ quoteId: quote.quoteId, transaction: `0x${valid.serialize()}`, user: origin }),
    422,
    'QUOTE_EXPIRED',
    /Quote has expired/,
  );
  stacksHeight = 100;

  const exactPostCondition = [
    Pc.principal(origin).willSendEq(110n).ft(`${sbtcAddress}.sbtc-token`, 'sbtc-token'),
  ];
  const mutations = [
    { transaction: await transaction(exactPostCondition, { amount: 101n }) },
    { transaction: await transaction(exactPostCondition, { recipient: getAddressFromPrivateKey(randomPrivateKey(), 'testnet') }) },
    { transaction: await transaction(exactPostCondition, { sponsorFee: 11n }) },
    { transaction: await transaction(exactPostCondition, { quoteId: `0x${'f'.repeat(64)}` }) },
    { transaction: await transaction(exactPostCondition, { expiry: BigInt(quote.expiresAtBlock) + 1n }) },
  ];
  for (const mutation of mutations) {
    await assertRelayRejection(
      relay.sponsor({ quoteId: quote.quoteId, transaction: `0x${mutation.transaction.serialize()}`, user: origin }),
      422,
      'QUOTE_TRANSACTION_MISMATCH',
      /Transaction arguments do not match the quote/,
    );
  }
  assert.equal(simulationCalls, 0, 'mutated quote fields must be rejected before simulation');
  assert.deepEqual(await operator.nonceReservations(), [], 'mutated quote fields must not reserve a sponsor nonce');

  const claimedOrigin = getAddressFromPrivateKey(randomPrivateKey(), 'testnet');
  const claimedQuote = (await relay.quote({
    origin: claimedOrigin,
    recipient,
    amountSats: '100',
    maxSponsorFeeSats: '20',
  })).quote;
  await assertRelayRejection(
    relay.sponsor({ quoteId: claimedQuote.quoteId, transaction: `0x${valid.serialize()}`, user: claimedOrigin }),
    422,
    'ORIGIN_MISMATCH',
    /user does not match the transaction origin/,
  );
  assert.equal(simulationCalls, 0);
  assert.deepEqual(await operator.nonceReservations(), []);

  let broadcasts = 0;
  Object.assign(operator, {
    nextSponsorNonce: 0n,
    broadcast: async () => {
      broadcasts += 1;
      return { txid: '0'.repeat(64) };
    },
  });
  await assert.rejects(
    relay.sponsor({ quoteId: quote.quoteId, transaction: `0x${valid.serialize()}`, user: origin }),
    /simulated contract failure/,
  );
  assert.equal(simulationCalls, 1);
  assert.equal(broadcasts, 0);
  assert.equal((operator as unknown as { nextSponsorNonce: bigint }).nextSponsorNonce, 0n);

  const lifecycleOperator = new OssrOperator({ network: 'testnet', sponsorPrivateKey: randomPrivateKey(), logger: () => undefined });
  let lifecycleBroadcasts = 0;
  let releaseSimulation!: () => void;
  let simulationStarted!: () => void;
  const simulationHasStarted = new Promise<void>(resolve => { simulationStarted = resolve; });
  const simulationCanFinish = new Promise<void>(resolve => { releaseSimulation = resolve; });
  Object.assign(lifecycleOperator, {
    nextSponsorNonce: 0n,
    broadcast: async (bytes: Uint8Array) => {
      lifecycleBroadcasts += 1;
      return { txid: deserializeTransaction(bytes).txid() };
    },
  });
  const lifecycleRelay = new OssrRelayApi({
    operator: lifecycleOperator,
    quotePrivateKey: randomPrivateKey(),
    adapterContractAddress: adapterAddress,
    adapterContractName: 'sbtc-sponsored-transfer-v1',
    sbtcContractAddress: sbtcAddress,
    sbtcContractName: 'sbtc-token',
    sponsorFeeSats: 10n,
    simulateTransaction: async () => {
      simulationStarted();
      await simulationCanFinish;
    },
  });
  const lifecycleQuote = (await lifecycleRelay.quote({ origin, recipient, amountSats: '100', maxSponsorFeeSats: '20' })).quote;
  const lifecycleTransaction = await makeContractCall({
    contractAddress: adapterAddress,
    contractName: 'sbtc-sponsored-transfer-v1',
    functionName: 'sponsored-transfer',
    functionArgs: [
      uintCV(100n), standardPrincipalCV(recipient), uintCV(10n),
      bufferCV(Buffer.from(lifecycleQuote.quoteId.slice(2), 'hex')),
      uintCV(BigInt(lifecycleQuote.expiresAtBlock)), noneCV(),
    ],
    senderKey: originKey,
    nonce: 1n,
    fee: 0n,
    sponsored: true,
    network: 'testnet',
    postConditionMode: PostConditionMode.Deny,
    postConditions: [Pc.principal(origin).willSendEq(110n).ft(`${sbtcAddress}.sbtc-token`, 'sbtc-token')],
  });
  const lifecycleRequest = { quoteId: lifecycleQuote.quoteId, transaction: `0x${lifecycleTransaction.serialize()}`, user: origin };
  const firstSubmission = lifecycleRelay.sponsor(lifecycleRequest);
  await simulationHasStarted;
  await assertRelayRejection(
    lifecycleRelay.sponsor(lifecycleRequest),
    409,
    'SPONSORSHIP_IN_PROGRESS',
    /already being processed/,
  );
  releaseSimulation();
  const completed = await firstSubmission;
  const replayed = await lifecycleRelay.sponsor(lifecycleRequest);
  assert.deepEqual(replayed, completed);
  assert.equal(lifecycleBroadcasts, 1, 'concurrent duplicate and replay must not create another broadcast');

  const failedBroadcastOperator = new OssrOperator({ network: 'testnet', sponsorPrivateKey: randomPrivateKey(), logger: () => undefined });
  let failedBroadcastAttempts = 0;
  Object.assign(failedBroadcastOperator, {
    nextSponsorNonce: 0n,
    broadcast: async () => {
      failedBroadcastAttempts += 1;
      throw new Error('Broadcast rejected: test failure');
    },
  });
  const failedBroadcastRelay = new OssrRelayApi({
    operator: failedBroadcastOperator,
    quotePrivateKey: randomPrivateKey(),
    adapterContractAddress: adapterAddress,
    adapterContractName: 'sbtc-sponsored-transfer-v1',
    sbtcContractAddress: sbtcAddress,
    sbtcContractName: 'sbtc-token',
    sponsorFeeSats: 10n,
    simulateTransaction: async () => undefined,
  });
  const failedQuote = (await failedBroadcastRelay.quote({ origin, recipient, amountSats: '100', maxSponsorFeeSats: '20' })).quote;
  const failedTransaction = await makeContractCall({
    contractAddress: adapterAddress,
    contractName: 'sbtc-sponsored-transfer-v1',
    functionName: 'sponsored-transfer',
    functionArgs: [
      uintCV(100n), standardPrincipalCV(recipient), uintCV(10n),
      bufferCV(Buffer.from(failedQuote.quoteId.slice(2), 'hex')),
      uintCV(BigInt(failedQuote.expiresAtBlock)), noneCV(),
    ],
    senderKey: originKey,
    nonce: 2n,
    fee: 0n,
    sponsored: true,
    network: 'testnet',
    postConditionMode: PostConditionMode.Deny,
    postConditions: [Pc.principal(origin).willSendEq(110n).ft(`${sbtcAddress}.sbtc-token`, 'sbtc-token')],
  });
  const failedRequest = { quoteId: failedQuote.quoteId, transaction: `0x${failedTransaction.serialize()}`, user: origin };
  await assert.rejects(failedBroadcastRelay.sponsor(failedRequest), /Broadcast rejected: test failure/);
  assert.equal(failedBroadcastAttempts, 1);
  const failedReservations = await failedBroadcastOperator.nonceReservations();
  assert.equal(failedReservations.length, 1);
  assert.equal(failedReservations[0].status, 'AMBIGUOUS');
  await assertRelayRejection(
    failedBroadcastRelay.sponsor(failedRequest),
    409,
    'SPONSORSHIP_IN_PROGRESS',
    /already being processed/,
  );
  assert.equal(failedBroadcastAttempts, 1, 'ambiguous broadcast must not be retried automatically');
} finally {
  globalThis.fetch = originalFetch;
}
