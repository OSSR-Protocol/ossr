# Pre-grant prototype limitations and accepted risks

**Status:** Accepted for the Stacks testnet demonstration only
**Last reviewed:** September 18, 2026

## Scope of this acceptance

This document records the known gaps in the implementation being demonstrated
before a grant. It is not a mainnet security assessment and does not weaken the
release blockers in the [pre-grant roadmap](roadmaps/ROADMAP-PREGRANT.md#7-release-blockers).
The more comprehensive [threat model](specs/threat-model.md) describes the
intended funded system; this document describes the smaller TypeScript,
single-relay prototype that exists today.

The risks below are accepted only because the prototype uses isolated,
low-balance testnet accounts, supports one pinned adapter action, and is run for
a bounded public demonstration. They are not accepted for mainnet or custody of
assets with economic value.

## Known limitations

| Area | Current prototype limitation | Consequence | Required before production |
|---|---|---|---|
| Network | Testnet is hard-coded in the operator and client flow. | Testnet availability, resets, faucets, sBTC liquidity, and indexing may be unreliable. Testnet results do not establish mainnet safety. | Separate reviewed network configuration and a mainnet deployment process. |
| Contract | Only `sponsored-transfer` through the recorded adapter and canonical testnet sBTC contract is supported. The adapter has not received an external audit or formal verification. | No withdrawals, arbitrary calls, other tokens, or claim of audited safety. | Independent contract audit, deployment review, and explicit adapter governance. |
| Keys | Sponsor, user-demo, and quote private keys are loaded from local environment files into ordinary processes. There is no HSM, KMS, remote signer, rotation workflow, or automatic compromise response. | Host or process compromise can expose the low-balance testnet keys. | Isolated signer/KMS, least-privilege access, rotation, incident response, and withdrawal limits. |
| Relay topology | One relay process and one sponsor account are used. There is no high availability, multi-region failover, load balancer health orchestration, or independent operator quorum. | A process, host, RPC, or sponsor-nonce failure stops service. | Redundant relays with safe ownership and coordination of sponsor accounts. |
| Persistence | Quotes and nonce reservations use owner-only local JSON files designed for one process. There is no cross-host transaction isolation, replication, point-in-time recovery, or schema migration framework. | Running multiple relay instances against the same sponsor can race or diverge; disk loss removes local reconciliation history. | PostgreSQL or equivalent transactional storage, migrations, locking, replication, and tested recovery. |
| Broadcast ambiguity | A transport failure after submission is preserved as ambiguous and is not automatically retried. Reconciliation is operator-driven. | A nonce can remain unavailable until the operator checks chain state and reconciles it. | Automated mempool/chain reconciliation with bounded retry and alerting. |
| Simulation | The fully signed transaction is simulated against a local Stacks Core tip immediately before broadcast, but simulation cannot reserve chain state. | State, fee conditions, or chain tip can change between simulation and mining; the sponsor may pay STX for an aborted transaction and receive no sBTC. | Loss budgets, circuit breakers, stronger monitoring, tighter policy, and production dependency redundancy. This race cannot be eliminated entirely. |
| Finality | A status of `success` is counted when observed. The prototype does not wait for configurable confirmation depth or reverse metrics after a reorganization. | A shallow confirmation could later be reorganized while local evidence remains counted. | Confirmation-depth policy and reorg-aware state transitions. |
| Quote verification | The relay signs SIP-018 quote data, but the current CLI and browser helper do not independently verify the returned signature against a pre-trusted quote key before constructing the transaction. | TLS/relay trust currently supplies quote authenticity to the demo client. An untrusted endpoint could present misleading quote metadata, although the user signature and exact post-condition still constrain the submitted transaction. | Pin trusted relay keys and verify quote signatures, domains, arguments, expiry, and policy client-side. |
| HTTP perimeter | The prototype server has body-size and CORS controls but no built-in TLS, client authentication, rate limiting, request quotas, or denial-of-service protection. CORS is not authentication. | Direct public exposure permits request and simulation exhaustion and unencrypted traffic. | TLS reverse proxy, firewall, authentication where appropriate, per-route limits, abuse controls, and resource isolation. |
| Dependencies | Fee estimation, status, balances, and chain information depend on Stacks Core and/or a public Hiro API. There is no multi-provider consensus or automatic dependency failover. | Provider outage, lag, or inconsistent data can reject safe requests, delay status, or stop sponsorship. | Authenticated redundant RPC providers, freshness checks, failover, and dependency monitoring. |
| Metrics | Metrics are process-local and reset on restart. Confirmations and reimbursed sats are recorded only when the relay status endpoint observes success. There is no durable time-series backend. | The snapshot is demonstration evidence, not complete accounting or billing data. | Durable metrics/events, reconciliation from chain state, retention policy, and auditable accounting. |
| Privacy | Quote and transaction stores contain principals, transaction identifiers, amounts, and timestamps. There is no formal retention or deletion mechanism. | Operational files can reveal test activity if copied or published. | Data classification, retention/deletion controls, access auditing, and privacy review. |
| Registry | The optional JSON registry and heartbeat mutation endpoint are centralized and are not safe to expose without operator authentication. Listing fees and governance are not implemented. | Registry data can be stale or manipulated if deployed carelessly. | Authenticated registry administration and the separately reviewed funded registry design. |
| Testing | Automated policy, mutation, simulation-response, concurrency, nonce, and contract tests exist, but the repeated public acceptance run and independent second-developer run remain incomplete. | Current evidence does not yet prove repeatability under independent operation or sustained load. | Complete the roadmap acceptance evidence, load/recovery testing, and independent review. |

## Accepted operating constraints

The prototype may be demonstrated only when all of these constraints hold:

- Stacks testnet only; no mainnet keys, contracts, or funds.
- Isolated accounts with deliberately small balances and a documented loss cap.
- One relay instance owns one sponsor key at a time.
- The adapter and sBTC principals exactly match the immutable deployment record.
- Stacks Core simulation is synchronized and fails closed when unavailable,
  malformed, failed, ambiguous, or stale.
- The relay RPC is private; HTTPS, firewalling, and rate limiting are provided by
  an external perimeter if the relay is reachable from the internet.
- Quote, nonce, environment, and evidence files are owner-readable only and are
  reviewed before publication.
- An operator monitors sponsor balance, ambiguous nonces, broadcasts, and chain
  outcomes during the bounded run.

## Risks that are not accepted

The following are defects, not testnet risk acceptances, and block the demo:

- Sponsoring an unquoted, expired, mutated, wrong-origin, wrong-network, or
  non-allowlisted transaction.
- Broadcasting after failed or untrusted simulation.
- Permitting sBTC outflow other than the exact transfer amount plus quoted fee.
- Reimbursing a principal other than the actual transaction sponsor.
- Producing more than one distinct sponsor signature for a quote or nonce.
- Logging or committing a private key, seed phrase, auth token, or private
  serialized transaction material.
- Representing the prototype as production-ready, audited, mainnet-safe, or
  continuously available.

## Review trigger

This acceptance must be revisited before changing the network, supported
contract or asset, storage topology, signing system, public exposure, sponsor
loss limit, or relay deployment model. Any mainnet proposal requires a new
threat assessment and explicit removal—not merely re-acceptance—of the relevant
prototype limitations.
