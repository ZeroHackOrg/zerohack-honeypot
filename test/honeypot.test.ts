import { describe, expect, it } from "vitest";
import { makeBanner } from "../src/banner.ts";
import { readEventLog, renderEventLog, summarize, type HoneypotEvent } from "../src/events.ts";
import { DEFAULT_RATE_LIMIT, isThrottled, pruneStale } from "../src/listener.ts";

const FIXTURE: HoneypotEvent[] = [
  {
    ts: "2026-09-16T10:00:00.000Z",
    srcIp: "192.0.2.10",
    srcPort: 40123,
    dstPort: 2222,
    protocol: "ssh",
    banner: makeBanner("ssh", 2222),
    bytes: makeBanner("ssh", 2222).length,
  },
  {
    ts: "2026-09-16T10:00:01.000Z",
    srcIp: "192.0.2.10",
    srcPort: 40124,
    dstPort: 2222,
    protocol: "ssh",
    banner: makeBanner("ssh", 2222),
    bytes: makeBanner("ssh", 2222).length,
  },
  {
    ts: "2026-09-16T10:00:02.000Z",
    srcIp: "198.51.100.7",
    srcPort: 44321,
    dstPort: 8080,
    protocol: "http",
    bytes: 0,
  },
  {
    ts: "2026-09-16T10:00:03.000Z",
    srcIp: "203.0.113.9",
    srcPort: 55555,
    dstPort: 25,
    protocol: "plain",
    data: "[rate-limited]",
    bytes: 0,
  },
];

describe("makeBanner", () => {
  it("is deterministic and protocol-specific", () => {
    expect(makeBanner("ssh", 2222)).toBe("SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.6\r\n");
    expect(makeBanner("http", 8080)).toBe("HTTP/1.1 200 OK\r\nServer: nginx\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
    expect(makeBanner("plain", 25)).toBe("220 honeypot ready\r\n");
    expect(makeBanner("ssh", 2222)).toBe(makeBanner("ssh", 9022));
    expect(makeBanner("http", 8080)).toBe(makeBanner("http", 9000));
  });

  it("throws on unsupported protocols", () => {
    expect(() => makeBanner("dns" as never, 53)).toThrow();
  });
});

describe("event JSONL round-trip", () => {
  it("serializes and parses back equal events", () => {
    const text = renderEventLog(FIXTURE);
    expect(text.endsWith("\n")).toBe(true);
    const parsed = readEventLog(text);
    expect(parsed).toEqual(FIXTURE);
    expect(renderEventLog([])).toBe("");
    expect(readEventLog("")).toEqual([]);
    expect(readEventLog("  \n\n")).toEqual([]);
  });

  it("builds a JSON event object per line", () => {
    const lines = renderEventLog(FIXTURE).trim().split("\n");
    expect(lines).toHaveLength(FIXTURE.length);
    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(typeof parsed.ts).toBe("string");
      expect(parsed.protocol).toBeDefined();
      expect(typeof parsed.bytes).toBe("number");
    }
  });

  it("rejects malformed lines", () => {
    expect(() => readEventLog('{"ts": "x"}')).toThrow();
    expect(() => readEventLog("not json")).toThrow();
    expect(() => readEventLog('{"ts":"a","srcIp":"b","srcPort":1,"dstPort":2,"protocol":"gopher","bytes":3}')).toThrow();
  });
});

describe("summarize", () => {
  it("aggregates totals, unique IPs, top sources and per-protocol counts", () => {
    const s = summarize(FIXTURE);
    expect(s.total).toBe(4);
    expect(s.uniqIps).toBe(3);
    expect(s.byProtocol).toEqual({ ssh: 2, http: 1, plain: 1 });
  });

  it("orders top sources by count desc, then ip asc (deterministic)", () => {
    const events: HoneypotEvent[] = [
      ...FIXTURE,
      { ts: "t", srcIp: "10.0.0.1", srcPort: 1, dstPort: 22, protocol: "ssh", bytes: 0 },
      { ts: "t", srcIp: "10.0.0.1", srcPort: 2, dstPort: 22, protocol: "ssh", bytes: 0 },
      { ts: "t", srcIp: "10.0.0.2", srcPort: 1, dstPort: 22, protocol: "ssh", bytes: 0 },
    ];
    const s = summarize(events);
    expect(s.topSourceIps[0]).toEqual({ ip: "10.0.0.1", count: 2 });
    expect(s.topSourceIps[1]).toEqual({ ip: "192.0.2.10", count: 2 });
    expect(s.topSourceIps.slice(2)).toEqual([
      { ip: "10.0.0.2", count: 1 },
      { ip: "198.51.100.7", count: 1 },
      { ip: "203.0.113.9", count: 1 },
    ]);
  });
});

describe("rate limiting (pure machinery)", () => {
  it("prunes hits outside the window", () => {
    const now = 100_000;
    expect(pruneStale([99_000, 50_000, 100_000], now, 60_000)).toEqual([50_000, 99_000, 100_000]);
  });

  it("throttles once the per-window max is reached", () => {
    const hits = [1000, 2000, 3000];
    const now = 4000;
    expect(isThrottled(hits, now, DEFAULT_RATE_LIMIT)).toBe(false);
    const full = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10_000];
    expect(isThrottled(full, now, DEFAULT_RATE_LIMIT)).toBe(true);
    expect(isThrottled([0, 10_000_000], now, DEFAULT_RATE_LIMIT)).toBe(false);
  });
});