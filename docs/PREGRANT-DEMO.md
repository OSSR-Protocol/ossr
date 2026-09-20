# Pre-grant testnet setup and demo

This is the canonical end-to-end procedure for the OSSR pre-grant prototype.
It starts one local relay, uses the deployed testnet adapter and canonical sBTC
contract, and proves that a user with sBTC and zero STX can make an atomic
sponsored transfer. The commands are intended to be run from the repository
root on Linux or macOS.

The testnet transaction is real and irreversible. Use only isolated,
low-balance testnet keys. Never paste private keys into a terminal command,
commit them, or use a mainnet key.

Read and accept the bounded testnet risks in
[PREGRANT-LIMITATIONS.md](PREGRANT-LIMITATIONS.md) before operating the relay.

## 1. Prerequisites

- Git, Node.js 22 or newer, npm, Docker, `curl`, `jq`, and `openssl`.
- Three distinct testnet identities: user, recipient, and sponsor.
- The user holds testnet sBTC and **zero STX**.
- The sponsor holds enough testnet STX for network fees.
- TCP port `20444` can accept the Stacks testnet follower's peer traffic.

The acceptance accounts and deployed contracts used by the project are
recorded in [TESTNET-DEPLOYMENT.md](TESTNET-DEPLOYMENT.md). Do not reuse those
private keys unless they were handed to you through a separate secure channel.

## 2. Install and verify the checkout

From a fresh checkout:

```sh
npm ci
npm run typecheck
npm run clarinet:check
npm run test:contracts
npm run test:relay-policy
```

All commands must finish successfully before using testnet funds.

## 3. Configure the isolated accounts

Create the ignored, owner-only environment file:

```sh
cp .env.example .env.local
chmod 600 .env.local
```

Edit `.env.local` and set at least these values:

```dotenv
USER_PRIVATE_KEY=<zero-STX user key holding testnet sBTC>
SPONSOR_PRIVATE_KEY=<isolated sponsor key holding testnet STX>
RECIPIENT_ADDRESS=<different testnet recipient address>
QUOTE_PRIVATE_KEY=<a third testnet-format private key used only to sign quotes>

STACKS_API_URL=https://api.testnet.hiro.so
STACKS_SIMULATION_API_URL=http://127.0.0.1:20443
STACKS_SIMULATION_AUTH_TOKEN=<random local RPC token>

ADAPTER_CONTRACT_ADDRESS=ST2SY3PZHMVQMYN1W4SBJ9MPHW4P8J01ST7TVQ68X
ADAPTER_CONTRACT_NAME=sbtc-sponsored-transfer-v1
SBTC_CONTRACT_ADDRESS=SN3VMHXEN64ZZF71JQ5VESXDWTR301XTTXGF4J8F1
SBTC_CONTRACT_NAME=sbtc-token

OSSR_API_URL=http://127.0.0.1:3002
OPERATOR_HOST=127.0.0.1
OPERATOR_PORT=3002
SBTC_TRANSFER_AMOUNT_SATS=100
SBTC_SPONSOR_FEE_SATS=10
SBTC_MAX_SPONSOR_FEE_SATS=10
```

Generate the local RPC token with `openssl rand -hex 32`. A quote key can be
generated without funding it:

```sh
node --input-type=module -e "import { randomPrivateKey } from '@stacks/transactions'; console.log(randomPrivateKey())"
```

Put the outputs directly into `.env.local`. The user, sponsor, recipient, and
quote signer must remain distinct.

## 4. Start and synchronize the testnet follower

Stacks Core simulation is not exposed by the public indexer, so the relay needs
a synchronized local follower. Load the environment without printing it, then
create the pinned Stacks Core container:

```sh
set -a
. ./.env.local
set +a

docker volume create ossr-stacks-testnet-data
printf '%s\n' "$STACKS_SIMULATION_AUTH_TOKEN" | docker run -i -d \
  --name ossr-stacks-testnet \
  --restart unless-stopped \
  --entrypoint sh \
  -p 127.0.0.1:20443:20443 \
  -p 20444:20444 \
  -p 127.0.0.1:9153:9153 \
  -v "$PWD/ops/stacks-testnet-follower.toml.template:/etc/stacks-node/template.toml:ro" \
  -v ossr-stacks-testnet-data:/stacks-data \
  ghcr.io/stacks-network/stacks-core:4.0.3-alpine \
  -c 'if test ! -s /stacks-data/testnet-runtime.toml; then IFS= read -r AUTH_TOKEN; test -n "$AUTH_TOKEN"; sed "s|__AUTH_TOKEN__|$AUTH_TOKEN|" /etc/stacks-node/template.toml > /stacks-data/testnet-runtime.toml; unset AUTH_TOKEN; fi; exec stacks-node start --config /stacks-data/testnet-runtime.toml'
```

For later runs, use `docker start ossr-stacks-testnet`. Watch initial sync with:

```sh
docker logs -f --tail 50 ossr-stacks-testnet
```

In another terminal, compare the local and public tips:

```sh
curl -fsS http://127.0.0.1:20443/v2/info | jq '{stacks_tip_height, burn_block_height}'
curl -fsS https://api.testnet.hiro.so/v2/info | jq '{stacks_tip_height, burn_block_height}'
```

Do not continue until the local follower is at the public tip. Initial sync can
take hours; restarting the container preserves progress in the Docker volume.

If the container name already exists, inspect and reuse it rather than creating
a second node. If its stored auth token differs from `.env.local`, create a new
container and a new explicitly named data volume; do not overwrite an unknown
volume.

## 5. Verify balances before the demo

Check that the sponsor relay is healthy:

```sh
npm run operator:health
```

Derive the two local addresses without exposing their keys:

```sh
set -a
. ./.env.local
set +a
USER_ADDRESS=$(node --input-type=module -e "import { getAddressFromPrivateKey } from '@stacks/transactions'; console.log(getAddressFromPrivateKey(process.env.USER_PRIVATE_KEY, 'testnet'))")
SPONSOR_ADDRESS=$(node --input-type=module -e "import { getAddressFromPrivateKey } from '@stacks/transactions'; console.log(getAddressFromPrivateKey(process.env.SPONSOR_PRIVATE_KEY, 'testnet'))")
SBTC_ASSET="${SBTC_CONTRACT_ADDRESS:-SN3VMHXEN64ZZF71JQ5VESXDWTR301XTTXGF4J8F1}.${SBTC_CONTRACT_NAME:-sbtc-token}::sbtc-token"
```

Capture the initial user, recipient, and sponsor balances:

```sh
for ADDRESS in "$USER_ADDRESS" "$RECIPIENT_ADDRESS" "$SPONSOR_ADDRESS"; do
  curl -fsS "$STACKS_API_URL/extended/v1/address/$ADDRESS/balances" |
    jq --arg address "$ADDRESS" --arg asset "$SBTC_ASSET" \
      '{address: $address, stx_microstx: .stx.balance, sbtc_sats: (.fungible_tokens[$asset].balance // "0")}'
done | tee /tmp/ossr-balances-before.jsonl
```

Stop if the user has nonzero STX, lacks at least `amount + sponsor fee` sats, or
the sponsor is below `OPERATOR_MINIMUM_BALANCE_MICROSTX`.

## 6. Run the relay and sponsored transfer

Start the relay in its own terminal:

```sh
npm run operator:serve
```

Verify its public metadata, health, and initial metrics:

```sh
curl -fsS http://127.0.0.1:3002/v1/info | jq
curl -fsS http://127.0.0.1:3002/health/ready | jq
curl -fsS http://127.0.0.1:3002/v1/metrics | jq
```

In another terminal, request a signed quote, build and origin-sign the exact
adapter call, submit it to the relay, and wait for confirmation:

```sh
npm run operator:client -- --wait | tee /tmp/ossr-transfer.json
```

The command must print `client.submitted` followed by `client.confirmed` with
status `success`. Copy the transaction ID and open:

```text
https://explorer.hiro.so/txid/0x<transaction-id>?chain=testnet
```

## 7. Verify settlement and metrics

Run the balance loop from step 5 again, changing the output file to
`/tmp/ossr-balances-after.jsonl`. Verify:

- user STX is still zero;
- recipient sBTC increased by `SBTC_TRANSFER_AMOUNT_SATS`;
- sponsor sBTC increased by `SBTC_SPONSOR_FEE_SATS`; and
- sponsor STX decreased by the transaction's network fee.

Capture the operator snapshot after confirmation:

```sh
curl -fsS http://127.0.0.1:3002/v1/metrics |
  tee /tmp/ossr-metrics.json | jq
```

It should show one additional broadcast and confirmation, nonzero STX paid and
sats reimbursed, and samples for all three lifecycle latencies.

For a controlled pre-sign rejection, submit a malformed request:

```sh
curl -sS -o /tmp/ossr-rejection.json -w 'HTTP %{http_code}\n' \
  -H 'Content-Type: application/json' \
  -d "{\"transaction\":\"not-hex\",\"user\":\"$USER_ADDRESS\"}" \
  http://127.0.0.1:3002/v1/sponsorships
jq . /tmp/ossr-rejection.json
```

Expect HTTP `400` and `INVALID_TRANSACTION`. The metrics rejection count should
increase, while broadcast and STX-paid totals remain unchanged.

## 8. Repeat and preserve evidence

Repeat step 6 for each intended acceptance transfer. Every run obtains a fresh
quote and current origin nonce. For the pre-grant acceptance run, complete at
least ten confirmed transfers and retain:

- every explorer URL;
- `/tmp/ossr-balances-before.jsonl` and the final balance snapshot;
- `/tmp/ossr-metrics.json`;
- the controlled rejection response; and
- relay output with no private keys or serialized origin transactions.

The durable `.ossr/quotes.json` and `.ossr/nonces.json` files prevent accidental
quote reuse and preserve nonce reconciliation state. They contain operational
transaction data and should not be published without review.

## 9. Stop safely

Stop the relay with `Ctrl-C`. Stop the follower without deleting its sync data:

```sh
docker stop ossr-stacks-testnet
```

Keep `.env.local` and the Docker volume private. Neither is required in grant
evidence, and neither should be committed.
