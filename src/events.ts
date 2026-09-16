/** Event model, JSONL serialization and summarization for honeypot telemetry. */

export type Protocol = "ssh" | "http" | "plain";

export interface HoneypotEvent {
  ts: string;
  srcIp: string;
  srcPort: number;
  dstPort: number;
  protocol: Protocol;
  banner?: string;
  data?: string;
  bytes: number;
}

export interface SourceCount {
  ip: string;
  count: number;
}

export interface EventSummary {
  total: number;
  uniqIps: number;
  topSourceIps: SourceCount[];
  byProtocol: Record<Protocol, number>;
}

const PROTOCOLS: readonly Protocol[] = ["ssh", "http", "plain"];

const TOP_SOURCES = 10;

function isProtocol(v: unknown): v is Protocol {
  return typeof v === "string" && (PROTOCOLS as readonly string[]).includes(v);
}

function toEvent(raw: unknown): HoneypotEvent {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid honeypot log line: not an object");
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.ts !== "string" || typeof r.srcIp !== "string") {
    throw new Error("Invalid honeypot log line: missing ts/srcIp");
  }
  if (typeof r.srcPort !== "number" || typeof r.dstPort !== "number" || typeof r.bytes !== "number") {
    throw new Error("Invalid honeypot log line: missing numeric fields");
  }
  if (!isProtocol(r.protocol)) {
    throw new Error(`Invalid honeypot log line: unknown protocol "${String(r.protocol)}"`);
  }
  const event: HoneypotEvent = {
    ts: r.ts,
    srcIp: r.srcIp,
    srcPort: r.srcPort,
    dstPort: r.dstPort,
    protocol: r.protocol,
    bytes: r.bytes,
  };
  if (typeof r.banner === "string" && r.banner) event.banner = r.banner;
  if (typeof r.data === "string" && r.data) event.data = r.data;
  return event;
}

/** Encode events as one JSON object per line (newline-terminated). */
export function renderEventLog(events: readonly HoneypotEvent[]): string {
  if (!events.length) return "";
  return `${events.map((e) => JSON.stringify(e)).join("\n")}\n`;
}

/** Parse a JSONL log produced by renderEventLog (blank lines tolerated). */
export function readEventLog(text: string): HoneypotEvent[] {
  const out: HoneypotEvent[] = [];
  for (const line of String(text ?? "").split("\n")) {
    if (!line.trim()) continue;
    out.push(toEvent(JSON.parse(line)));
  }
  return out;
}

/** Deterministic summary: totals, unique IPs, top sources (count desc, ip asc) and per-protocol counts. */
export function summarize(events: readonly HoneypotEvent[]): EventSummary {
  const uniq = new Set<string>();
  const bySrc = new Map<string, number>();
  const byProtocol: Record<Protocol, number> = { ssh: 0, http: 0, plain: 0 };
  for (const e of events) {
    uniq.add(e.srcIp);
    bySrc.set(e.srcIp, (bySrc.get(e.srcIp) ?? 0) + 1);
    if (isProtocol(e.protocol)) byProtocol[e.protocol] += 1;
  }
  const topSourceIps = Array.from(bySrc.entries())
    .map(([ip, count]) => ({ ip, count }))
    .sort((a, b) => b.count - a.count || a.ip.localeCompare(b.ip))
    .slice(0, TOP_SOURCES);
  return { total: events.length, uniqIps: uniq.size, topSourceIps, byProtocol };
}