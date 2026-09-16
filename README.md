<div align="center">

```
  ███████╗███████╗███╗   ███╗██╗   ██╗██╗  ██╗
  ╚══██╔══╝██╔════╝████╗ ████║██║   ██║██║ ██╔╝
     ██║   █████╗  ██╔████╔██║██║   ██║█████╔╝
     ██║   ██╔══╝  ██║╚██╔╝██║╚██╗ ██╔╝██╔═██╗
     ██║   ███████╗██║ ╚═╝ ██║ ╚████╔╝ ██║  ██╗
     ╚═╝   ╚══════╝╚═╝     ╚═╝  ╚═══╝  ╚═╝  ╚═╝
```

# @zerohack/honeypot · `zh-honeypot`

**Lab-safe SSH/HTTP honeypot with telemetry and analytics**

[![License](https://img.shields.io/badge/license-Apache--2.0-00B0BD?style=for-the-badge)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](tsconfig.json)
[![Zero Budget](https://img.shields.io/badge/cost-%240-00b894?style=for-the-badge)](https://zerohack.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-00B0BD?style=for-the-badge)](CONTRIBUTING.md)

**Part of the [ZeroHack](https://zerohack.org) Geek Tools ecosystem**
Category: `network` · `honeypot` · `security` · `telemetry`

</div>

---

> **⚡ Zero Budget. Zero Cloud Dependencies. Pure Local Power.**

---

## What It Does

Runs realistic SSH/HTTP/plain banners, records every connection as JSONL
telemetry, rate-limits abusive source IPs, and summarizes captured logs —
all without requiring any network access to build or test.

---

## Quick Start

```bash
# From the monorepo root
git clone https://github.com/ZeroHackOrg/zerohack-geek-tools.git
cd zerohack-geek-tools && npm install
npm run geek:honeypot -- serve --port 2222 --protocol ssh
```

**Standalone:**

```bash
git clone https://github.com/ZeroHackOrg/zerohack-honeypot.git
cd zerohack-honeypot && npm install
npx tsx src/bin.ts serve --port 2222 --protocol ssh
```

### Standalone Resolution

```bash
git clone https://github.com/ZeroHackOrg/zerohack-shared.git
cd zerohack-shared && npm install && npm link
cd ../zerohack-honeypot && npm link @zerohack/shared
```

---

## Commands

| Command | Description |
|---|---|
| `zh-honeypot serve --port 2222 --protocol ssh` | Start SSH honeypot listener |
| `zh-honeypot serve --port 8080 --protocol http --log hits.jsonl` | HTTP honeypot with JSONL logging |
| `zh-honeypot serve --port 23 --protocol plain --log hits.txt` | Plain TCP honeypot |
| `zh-honeypot report hits.jsonl` | Summarize captured connections |
| `zh-honeypot sample` | Print exact banner bytes the listener writes |

**Flags:** `--log <file>` appends a JSON object per connection.
`--port` sets the listener port. `--protocol` selects the banner type.

---

## Behavior

- **Banner generation** (`makeBanner`) is deterministic:
  - `ssh`: `SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.6`
  - `http`: minimal `HTTP/1.1 200 OK` response
  - `plain`: `220 honeypot ready`
- **Rate limiting**: 10 connections per source IP per 60s window; excess
  connections are destroyed and marked `[rate-limited]`.
- **Telemetry**: each connection emits a `HoneypotEvent` with
  `{ ts, srcIp, srcPort, dstPort, protocol, banner?, data?, bytes }`.
- **Reporting**: `report` prints totals, unique IPs, top sources, per-protocol
  counts — all deterministic.

---

## Env

None — all tools are zero-dependency, zero-config, and run offline.

---

## Tests

```bash
npm run typecheck --workspace @zerohack/honeypot
npm run test    --workspace @zerohack/honeypot
```

Rate-limiter window logic (`pruneStale`, `isThrottled`) is exported as
pure functions for unit testing without opening sockets.

---

## Architecture

```
zerohack-honeypot/
├── src/
│   ├── bin.ts          # CLI entrypoint (commander)
│   ├── index.ts        # Re-exports
│   ├── banner.ts       # Deterministic banner generation
│   ├── listener.ts     # node:net / node:http server
│   └── events.ts       # JSONL event log + summarize
├── test/
│   └── honeypot.test.ts  # Unit tests (vitest)
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE             # Apache-2.0
├── SECURITY.md
├── CONTRIBUTING.md
└── CODE_OF_CONDUCT.md
```

**Design principles:**
- Pure core: banner + rate-limiter + summarizer are all I/O-free.
- Server lives only in `bin.ts` / `listener.ts`.
- Deterministic: same input → same banner, same report.
- No environment variables used.

---

## Security

Lab-safe by design. Listens only on localhost by default. Rate-limits
abusive sources. Does not execute commands received over the network —
only records bytes for analysis.

For vulnerability reports, see [SECURITY.md](SECURITY.md).

---

## Related Packages

| Package | Binary | What It Does |
|---|---|---|
| [@zerohack/shared](../zerohack-shared) | — | Types, schemas, catalog |
| [@zerohack/cli](../zerohack-cli) | `zh` | Unified CLI |
| [@zerohack/supalite-api](../zerohack-supalite-api) | `zh-api` | PostgREST API |
| [@zerohack/pal](../zerohack-pal) | `zh-pal` | Local AI assistant |
| [@zerohack/osint-cli](../zerohack-osint-cli) | `zh-osint` | OSINT tools |
| [@zerohack/ssh-hardener](../zerohack-ssh-hardener) | `zh-ssh` | SSH auditor |
| [@zerohack/secret-scanner](../zerohack-secret-scanner) | `zh-secret` | Secret scanner |
| [@zerohack/recon-bot](../zerohack-recon-bot) | `zh-recon` | Recon automation |
| [@zerohack/log-analyzer](../zerohack-log-analyzer) | `zh-log` | Log forensics |
| [@zerohack/ctf-lab](../zerohack-ctf-lab) | `zh-lab` | CTF lab runner |
| [@zerohack/ctf-automation](../zerohack-ctf-automation) | `zh-ctf` | CTF solver |

---

## Community

- **Issues:** [GitHub Issues](https://github.com/ZeroHackOrg/zerohack-honeypot/issues)
- **PRs:** [Pull Requests](https://github.com/ZeroHackOrg/zerohack-honeypot/pulls)
- **Security:** [SECURITY.md](SECURITY.md)
- **Platform:** [zerohack.org](https://zerohack.org)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Read our [Code of Conduct](CODE_OF_CONDUCT.md) first.

## License

[Apache-2.0](LICENSE) — Copyright 2026 ZeroHack Security
