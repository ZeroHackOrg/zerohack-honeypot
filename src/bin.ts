#!/usr/bin/env node
/** zh-honeypot — lab-safe pseudo-honeypot that records every connection as JSONL telemetry. */

import { Command } from "commander";
import fs from "node:fs";
import { table } from "@zerohack/shared";
import { makeBanner } from "./banner.ts";
import { readEventLog, summarize, type Protocol } from "./events.ts";
import { createListener } from "./listener.ts";

const PROTOCOLS: readonly Protocol[] = ["ssh", "http", "plain"];

function parseProtocol(value: string): Protocol {
  const p = String(value ?? "").toLowerCase();
  if ((PROTOCOLS as readonly string[]).includes(p)) return p as Protocol;
  throw new Error(`Unsupported protocol "${value}" (choose ssh, http or plain)`);
}

const program = new Command();

program
  .name("zh-honeypot")
  .description("Run a banner honeypot, sample banners, or summarize JSONL connection logs.")
  .version("0.1.0", "-v, --version")
  .showHelpAfterError();

program
  .command("serve")
  .description("Run a banner honeypot and emit a JSONL stream of connection events")
  .requiredOption("-p, --port <n>", "port to listen on")
  .requiredOption("--protocol <p>", "ssh | http | plain")
  .option("--log <file>", "append JSONL events to this file as well")
  .action((options) => {
    let protocol: Protocol;
    try {
      protocol = parseProtocol(options.protocol);
    } catch (err) {
      console.error(`zh-honeypot: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
    const port = Number(options.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      console.error(`zh-honeypot: invalid port "${options.port}"`);
      process.exit(1);
    }
    const logStream = options.log ? fs.createWriteStream(options.log, { flags: "a" }) : null;
    const { server, close } = createListener(protocol, port, (event) => {
      const line = JSON.stringify(event);
      console.log(line);
      logStream?.write(`${line}\n`);
    });
    server.listen(port, () => {
      console.error(`zh-honeypot: listening on :${port} (${protocol})${options.log ? `, logging to ${options.log}` : ""}`);
    });
    const shutdown = (): void => {
      console.error("zh-honeypot: shutting down");
      close();
      logStream?.end();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });

program
  .command("report")
  .description("Summarize a JSONL honeypot log")
  .argument("<logfile>")
  .option("-j, --json", "print raw JSON summary")
  .action((logfile, options) => {
    let events;
    try {
      events = readEventLog(fs.readFileSync(logfile, "utf8"));
    } catch (err) {
      console.error(`zh-honeypot: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
    const summary = summarize(events);
    if (options.json) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }
    console.log(
      table({
        headers: ["Metric", "Value"],
        rows: [
          ["Total connections", summary.total],
          ["Unique source IPs", summary.uniqIps],
          ["ssh", summary.byProtocol.ssh],
          ["http", summary.byProtocol.http],
          ["plain", summary.byProtocol.plain],
        ],
      })
    );
    console.log(
      table({
        headers: ["#", "Source IP", "Connections"],
        rows: summary.topSourceIps.map((s, i) => [i + 1, s.ip, s.count]),
      })
    );
  });

program
  .command("sample")
  .description("Print a sample banner for each protocol (escapes shown)")
  .action(() => {
    for (const protocol of PROTOCOLS) {
      const escaped = JSON.stringify(makeBanner(protocol, 2222));
      console.log(`${protocol.padEnd(5)}  ${escaped}`);
    }
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(`zh-honeypot: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});