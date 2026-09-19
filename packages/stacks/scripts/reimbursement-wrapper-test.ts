#!/usr/bin/env tsx
/*
 * Test scaffold for reimbursement-wrapper contract.
 *
 * Usage (example):
 *   CONTRACT_ADDRESS=ST1... CONTRACT_NAME=reimbursement-wrapper \
 *   TARGET_CONTRACT=ST2.../target CONTRACT_NAME_TARGET=target \
 *   OPERATOR=ST... OPERATOR_AMOUNT=10 \
 *   PAYLOAD_HEX=010203 npx tsx packages/stacks/scripts/reimbursement-wrapper-test.ts
 */

import {
  makeContractCall,
  contractPrincipalCV,
  uintCV,
  bufferCV,
} from '@stacks/transactions';
import * as dotenv from 'dotenv';

dotenv.config();

const network = 'testnet' as const;

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS || '';
  const contractName = process.env.CONTRACT_NAME || 'reimbursement-wrapper';
  const targetContractAddress = process.env.TARGET_CONTRACT || '';
  const targetContractName = process.env.TARGET_CONTRACT_NAME || 'target';
  const operator = process.env.OPERATOR || '';
  const operatorAmount = Number(process.env.OPERATOR_AMOUNT || '10');
  const payloadHex = process.env.PAYLOAD_HEX || '';

  if (!contractAddress || !targetContractAddress || !operator) {
    console.error('Please set CONTRACT_ADDRESS, TARGET_CONTRACT, OPERATOR in env');
    process.exit(1);
  }

  const args = [
    contractPrincipalCV(targetContractAddress, targetContractName),
    contractPrincipalCV(operator.split('/')[0] || operator, operator.split('/')[1] || ''),
    uintCV(operatorAmount),
    bufferCV(Buffer.from(payloadHex, 'hex'))
  ];

  const txOptions = {
    contractAddress,
    contractName,
    functionName: 'process-and-reimburse',
    functionArgs: args,
    senderKey: process.env.PRIVATE_KEY || undefined,
    network,
  } as any;

  console.log('TX OPTIONS (preview):', {
    contractAddress,
    contractName,
    functionName: 'process-and-reimburse',
    operator,
    operatorAmount,
  });

  // NOTE: this is a scaffold — it assumes you have `PRIVATE_KEY` set to the origin tx signer.
  // For sponsored flows, build the unsigned tx, then have the sponsor sign and broadcast.
  try {
    const tx = await makeContractCall(txOptions);
    console.log('Unsigned/signed tx ready. Raw hex preview:');
    console.log(`0x${tx.serialize()}`);
  } catch (err) {
    console.error('Failed to build tx:', err);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
