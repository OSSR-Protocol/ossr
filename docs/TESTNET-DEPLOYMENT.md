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
