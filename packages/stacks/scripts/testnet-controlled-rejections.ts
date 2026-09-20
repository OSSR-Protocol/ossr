#!/usr/bin/env tsx
import { config as loadEnv } from 'dotenv';
import {
  Pc,
  PostConditionMode,
  bufferCV,
  fetchNonce,
  getAddressFromPrivateKey,
  makeContractCall,
  noneCV,
  standardPrincipalCV,
  uintCV,
} from '@stacks/transactions';
import type { ContractIdString } from '@stacks/transactions';

loadEnv({ path: '.env.local', quiet: true });

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
};

const apiUrl = (process.env.OSSR_API_URL ?? 'http://127.0.0.1:3002').replace(/\/$/, '');
const stacksApiUrl = (process.env.STACKS_API_URL ?? 'https://api.testnet.hiro.so').replace(/\/$/, '');
const userKey = required('USER_PRIVATE_KEY');
const user = getAddressFromPrivateKey(userKey, 'testnet');
const recipient = required('RECIPIENT_ADDRESS');

type Quote = {
  quoteId: string;
  adapterContract: string;
  functionName: string;
  sponsorFee: string;
  expiresAtBlock: string;
  reimbursementAsset: { contract: string };
};

async function request(path: string, body: unknown): Promise<{ status: number; body: any }> {
  const response = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function quote(amountSats: bigint): Promise<Quote> {
  const response = await request('/v1/quotes', {
    origin: user,
    recipient,
    amountSats: amountSats.toString(),
    maxSponsorFeeSats: '10',
  });
  if (response.status !== 201 && response.status !== 200) throw new Error(`Quote failed: ${JSON.stringify(response)}`);
  return response.body.quote as Quote;
}

async function transaction(
  issued: Quote,
  amount: bigint,
  postConditions: Parameters<typeof makeContractCall>[0]['postConditions'],
) {
  const separator = issued.adapterContract.lastIndexOf('.');
  return makeContractCall({
    contractAddress: issued.adapterContract.slice(0, separator),
    contractName: issued.adapterContract.slice(separator + 1),
    functionName: issued.functionName,
    functionArgs: [
      uintCV(amount),
      standardPrincipalCV(recipient),
      uintCV(BigInt(issued.sponsorFee)),
      bufferCV(Buffer.from(issued.quoteId.slice(2), 'hex')),
      uintCV(BigInt(issued.expiresAtBlock)),
      noneCV(),
    ],
    senderKey: userKey,
    nonce: await fetchNonce({ address: user, network: 'testnet', client: { baseUrl: stacksApiUrl } }),
    fee: 0n,
    sponsored: true,
    network: 'testnet',
    postConditionMode: PostConditionMode.Deny,
    postConditions,
  });
}

function record(failureClass: string, expectedCode: string, response: { status: number; body: any }): void {
  if (response.body?.error !== expectedCode) throw new Error(`${failureClass}: expected ${expectedCode}, received ${JSON.stringify(response)}`);
  console.log(JSON.stringify({ failureClass, httpStatus: response.status, error: response.body.error, message: response.body.message }));
}

async function main(): Promise<void> {
  record('request-decoding', 'INVALID_TRANSACTION', await request('/v1/sponsorships', { transaction: 'not-hex', user }));

  const mismatchQuote = await quote(100n);
  const mismatch = await transaction(mismatchQuote, 101n, [
    Pc.principal(user).willSendEq(110n).ft(mismatchQuote.reimbursementAsset.contract as ContractIdString, 'sbtc-token'),
  ]);
  record('quote-intent-binding', 'QUOTE_TRANSACTION_MISMATCH', await request('/v1/sponsorships', {
    quoteId: mismatchQuote.quoteId,
    transaction: `0x${mismatch.serialize()}`,
    user,
  }));

  const policyQuote = await quote(100n);
  const missingPostCondition = await transaction(policyQuote, 100n, []);
  record('static-transaction-policy', 'INVALID_POST_CONDITIONS', await request('/v1/sponsorships', {
    quoteId: policyQuote.quoteId,
    transaction: `0x${missingPostCondition.serialize()}`,
    user,
  }));

  const simulationQuote = await quote(2_000n);
  const insufficientBalance = await transaction(simulationQuote, 2_000n, [
    Pc.principal(user).willSendEq(2_010n).ft(simulationQuote.reimbursementAsset.contract as ContractIdString, 'sbtc-token'),
  ]);
  record('execution-simulation', 'SIMULATION_FAILED', await request('/v1/sponsorships', {
    quoteId: simulationQuote.quoteId,
    transaction: `0x${insufficientBalance.serialize()}`,
    user,
  }));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
