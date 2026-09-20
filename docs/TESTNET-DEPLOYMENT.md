# Testnet deployment record

Verified against the live Stacks testnet API on September 18, 2026.

## Sponsored-transfer adapter v1

| Field | Verified value |
|---|---|
| Contract principal | `ST2SY3PZHMVQMYN1W4SBJ9MPHW4P8J01ST7TVQ68X.sbtc-sponsored-transfer-v1` |
| Deployment transaction | `0x255acce3ab68c06d9516ecac4a952f00cbfcc7c79a0ae6b704ea4ed4638c0ca9` |
| Transaction status | `success` |
| Stacks block height | `106723` |
| Stacks block hash | `0xa9a1d17414a00713608568929c6b851d60b1117eaca1abf50f28d59f0fd04f78` |
| Bitcoin burn block height | `6929` |
| Block timestamp | `2026-08-18T14:50:39.000Z` |
| Deployer | `ST2SY3PZHMVQMYN1W4SBJ9MPHW4P8J01ST7TVQ68X` |
| Deployer nonce | `10` |
| Clarity version | `4` |
| On-chain source SHA-256 | `3bf4b5ae525b72389f2b20047f92e1f19b02690d9158db92562dba20a6382d5b` |
| Pinned sBTC principal | `SN3VMHXEN64ZZF71JQ5VESXDWTR301XTTXGF4J8F1.sbtc-token` |

The source returned by the testnet API is byte-for-byte identical to
[`contracts/sbtc-sponsored-transfer-v1.clar`](../contracts/sbtc-sponsored-transfer-v1.clar).
The contract and its deployment transaction are both reported as canonical.

Verification links:

- [Deployment transaction in Hiro Explorer](https://explorer.hiro.so/txid/0x255acce3ab68c06d9516ecac4a952f00cbfcc7c79a0ae6b704ea4ed4638c0ca9?chain=testnet)
- [Contract record from the testnet API](https://api.testnet.hiro.so/extended/v1/contract/ST2SY3PZHMVQMYN1W4SBJ9MPHW4P8J01ST7TVQ68X.sbtc-sponsored-transfer-v1)
- [Deployment transaction from the testnet API](https://api.testnet.hiro.so/extended/v1/tx/0x255acce3ab68c06d9516ecac4a952f00cbfcc7c79a0ae6b704ea4ed4638c0ca9)

This record identifies the immutable deployed artifact. Any future adapter
revision must use a new contract name or deployer principal and receive a
separate deployment record; this entry must not be repointed.

## Acceptance sponsor account

The isolated low-balance sponsor account is derived locally from the
`OPERATOR_PRIVATE_KEY` environment variable. The private key is not recorded in
this repository.

| Field | Verified value |
|---|---|
| Sponsor address | `ST2QKEV89ZB3PCW1KC8206FDFJ7F6QANMR22ZG7F5` |
| Funded balance | `2,000,000` microSTX (`2 STX`) |
| Funding transaction | `0xfc07d2c5bfeed45d95fc3d2d8f61c21d1ac722c184216e2d694066b40158d376` |
| Funding status | `success` |
| Funding block height | `75672` |
| Activity at verification | One transaction: the funding transfer |
| Verified | September 18, 2026 |

[View the funding transaction in Hiro Explorer](https://explorer.hiro.so/txid/0xfc07d2c5bfeed45d95fc3d2d8f61c21d1ac722c184216e2d694066b40158d376?chain=testnet).

This account is intentionally kept separate from the adapter deployer and the
test user. Before the acceptance relay starts, its sponsor-key configuration
must resolve to this same address.

## Zero-STX acceptance user

The acceptance user is derived locally from the `QUOTE_PRIVATE_KEY` environment
variable for this test run. The private key is not recorded in this repository.
At relay startup, quote signing must be assigned a different environment key so
the test user and quote signer remain separate runtime roles.

| Field | Verified value |
|---|---|
| User address | `ST14MZ2VA0731Q6TEPK82FDQNHWKY8NPEMND33NE4` |
| STX balance after setup | `0` microSTX |
| sBTC setup amount | `2,000` sats |
| sBTC funding transaction | `0x6219cf3a354993ea10f25ac821590d22c95037042a3cda6b58d6908957d6c7d4` |
| Funding status | `success` |
| Intended acceptance spend | `1,100` sats: ten transfers of `100` sats plus ten sponsor reimbursements of `10` sats |
| Verified | September 18, 2026 |

[View the sBTC funding transaction in Hiro Explorer](https://explorer.hiro.so/txid/0x6219cf3a354993ea10f25ac821590d22c95037042a3cda6b58d6908957d6c7d4?chain=testnet).

## Sponsored-transfer acceptance run

On September 19, 2026, nine consecutive transfers from the zero-STX
acceptance user confirmed successfully through the deployed adapter. Together
with the adapter's earlier successful proof transaction, this brought its
on-chain successful `sponsored-transfer` count to ten.

Each acceptance transaction transferred `100` sats to the recipient and
atomically reimbursed the sponsor `10` sats. The nine transactions paid a
combined `125,664` microSTX in network fees and reimbursed exactly `90` sats.

| Balance | Before | After | Change |
|---|---:|---:|---:|
| User STX | 0 microSTX | 0 microSTX | 0 |
| User sBTC | 2,000 sats | 1,010 sats | -990 sats |
| Recipient sBTC | 100 sats | 1,000 sats | +900 sats |
| Sponsor sBTC | 0 sats | 90 sats | +90 sats |
| Sponsor STX | 2,000,000 microSTX | 1,874,336 microSTX | -125,664 microSTX |

Confirmed acceptance transactions:

- [`0x41d62e8305f6f644ef29b0dc3b025a1848841e9c4093b1fcfd30f67471ce10f1`](https://explorer.hiro.so/txid/0x41d62e8305f6f644ef29b0dc3b025a1848841e9c4093b1fcfd30f67471ce10f1?chain=testnet)
- [`0x40d9994a11e496aa14912a19a6686ef6737ed3a6823bce6c6cc253b300ef83fc`](https://explorer.hiro.so/txid/0x40d9994a11e496aa14912a19a6686ef6737ed3a6823bce6c6cc253b300ef83fc?chain=testnet)
- [`0x5d821239991e4c5b9fb55188910bc647dd3442024997c6973821a52c877b9e69`](https://explorer.hiro.so/txid/0x5d821239991e4c5b9fb55188910bc647dd3442024997c6973821a52c877b9e69?chain=testnet)
- [`0x0dd16c153fc6341b9edf3d084b52356a27632a106d46be9aaa0fc5b258fc8495`](https://explorer.hiro.so/txid/0x0dd16c153fc6341b9edf3d084b52356a27632a106d46be9aaa0fc5b258fc8495?chain=testnet)
- [`0x271d8e1831145b610a68a87213e14ed8f357d8d7c91cbdb48f0409939b93e8a9`](https://explorer.hiro.so/txid/0x271d8e1831145b610a68a87213e14ed8f357d8d7c91cbdb48f0409939b93e8a9?chain=testnet)
- [`0x1ac038e4cc45929334634bef6da1ae184dc7c3c888c2ca30fc52951ac6e138a2`](https://explorer.hiro.so/txid/0x1ac038e4cc45929334634bef6da1ae184dc7c3c888c2ca30fc52951ac6e138a2?chain=testnet)
- [`0xbd6e10bfa2fd9927b998f7ff2bb930197097b82f6a24c9a8c721772b38e6980f`](https://explorer.hiro.so/txid/0xbd6e10bfa2fd9927b998f7ff2bb930197097b82f6a24c9a8c721772b38e6980f?chain=testnet)
- [`0x355f17fa2ed374e44f16ae3c2d552ded2144b2ac69c3b3b8a0a388edfeb1a801`](https://explorer.hiro.so/txid/0x355f17fa2ed374e44f16ae3c2d552ded2144b2ac69c3b3b8a0a388edfeb1a801?chain=testnet)
- [`0xd49d26cf03d4f9401ba006c6618814c3f4b3bc68e5766dfe1037cf55c88bba2d`](https://explorer.hiro.so/txid/0xd49d26cf03d4f9401ba006c6618814c3f4b3bc68e5766dfe1037cf55c88bba2d?chain=testnet)

### Sponsor payment proof

The live testnet transaction records identify
`ST2QKEV89ZB3PCW1KC8206FDFJ7F6QANMR22ZG7F5` as `sponsor_address` and set
`sponsored: true` on every acceptance transaction. Each record charges the
sponsor the listed STX network fee and contains one canonical sBTC transfer
event from the user to the sponsor for exactly the quoted `10` sats.

| Transaction | STX paid by sponsor | sBTC received by sponsor |
|---|---:|---:|
| [`0x41d62e…10f1`](https://explorer.hiro.so/txid/0x41d62e8305f6f644ef29b0dc3b025a1848841e9c4093b1fcfd30f67471ce10f1?chain=testnet) | 17,136 microSTX | 10 sats |
| [`0x40d999…83fc`](https://explorer.hiro.so/txid/0x40d9994a11e496aa14912a19a6686ef6737ed3a6823bce6c6cc253b300ef83fc?chain=testnet) | 15,232 microSTX | 10 sats |
| [`0x5d8212…9e69`](https://explorer.hiro.so/txid/0x5d821239991e4c5b9fb55188910bc647dd3442024997c6973821a52c877b9e69?chain=testnet) | 10,948 microSTX | 10 sats |
| [`0x0dd16c…8495`](https://explorer.hiro.so/txid/0x0dd16c153fc6341b9edf3d084b52356a27632a106d46be9aaa0fc5b258fc8495?chain=testnet) | 19,516 microSTX | 10 sats |
| [`0x271d8e…e8a9`](https://explorer.hiro.so/txid/0x271d8e1831145b610a68a87213e14ed8f357d8d7c91cbdb48f0409939b93e8a9?chain=testnet) | 8,568 microSTX | 10 sats |
| [`0x1ac038…38a2`](https://explorer.hiro.so/txid/0x1ac038e4cc45929334634bef6da1ae184dc7c3c888c2ca30fc52951ac6e138a2?chain=testnet) | 10,948 microSTX | 10 sats |
| [`0xbd6e10…980f`](https://explorer.hiro.so/txid/0xbd6e10bfa2fd9927b998f7ff2bb930197097b82f6a24c9a8c721772b38e6980f?chain=testnet) | 5,236 microSTX | 10 sats |
| [`0x355f17…a801`](https://explorer.hiro.so/txid/0x355f17fa2ed374e44f16ae3c2d552ded2144b2ac69c3b3b8a0a388edfeb1a801?chain=testnet) | 21,420 microSTX | 10 sats |
| [`0xd49d26…ba2d`](https://explorer.hiro.so/txid/0xd49d26cf03d4f9401ba006c6618814c3f4b3bc68e5766dfe1037cf55c88bba2d?chain=testnet) | 16,660 microSTX | 10 sats |
| **Total** | **125,664 microSTX** | **90 sats** |

The aggregate transaction fees equal the sponsor's balance decrease from
`2,000,000` to `1,874,336` microSTX. The aggregate reimbursements equal its
sBTC balance increase from zero to `90` sats. The user's STX balance remained
zero throughout, so the sponsor—not the user—paid every network fee.

## Controlled rejection run

On September 19, 2026, the testnet relay exercised each primary pre-signing
failure class with `npm run testnet:controlled-rejections`. The run used the
same zero-STX acceptance user and isolated sponsor as the successful acceptance
run.

| Failure class | Controlled mutation | HTTP | Stable error code |
|---|---|---:|---|
| Request decoding | Non-hex serialized transaction | 400 | `INVALID_TRANSACTION` |
| Quote/intent binding | Amount differed from the signed quote | 422 | `QUOTE_TRANSACTION_MISMATCH` |
| Static transaction policy | Required sBTC post-condition omitted | 422 | `INVALID_POST_CONDITIONS` |
| Execution simulation | Validly formed transfer exceeded the user's sBTC balance | 422 | `SIMULATION_FAILED` |

The relay metrics after the run reported four rejections, zero broadcasts,
zero confirmations, zero microSTX paid, and zero sats reimbursed. The user and
sponsor retained on-chain nonces `9` and `9`; their balances remained unchanged
at zero STX and `1,010` sats for the user, and `1,874,336` microSTX and `90`
sats for the sponsor. The adapter's successful transfer count remained ten.

The acceptance run also observed the retryable dependency-freshness rejection
`SIMULATION_STALE` when the follower was one block behind. It likewise produced
no broadcast, fee spend, token movement, or nonce consumption; submission
resumed only after exact tip parity.
