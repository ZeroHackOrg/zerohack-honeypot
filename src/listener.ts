/** No-sockets machinery for the honeypot listener plus the listener itself. */

import net from "node:net";
import http from "node:http";
import { makeBanner } from "./banner.ts";
import type { HoneypotEvent, Protocol } from "./events.ts";

export const DEFAULT_MAX_CONNECTIONS = 100;

export interface RateLimit {
  max: number;
  windowMs: number;
}

export const DEFAULT_RATE_LIMIT: RateLimit = { max: 10, windowMs: 60_000 };

/** Keep only hits still inside the rolling window, sorted ascending. */
export function pruneStale(hits: readonly number[], now: number, windowMs: number): number[] {
  return hits.filter((t) => now - t <= windowMs).sort((a, b) => a - b);
}

/** A connection from this IP is throttled once it already holds `max` hits in the window. */
export function isThrottled(hits: readonly number[], now: number, limit: RateLimit): boolean {
  return pruneStale(hits, now, limit.windowMs).length >= limit.max;
}

export interface ListenerHandle {
  server: net.Server | http.Server;
  close(): void;
}

export interface ListenerOptions {
  maxConnections?: number;
  rateLimit?: RateLimit;
}

/**
 * Create a banner honeypot server.
 * - ssh / plain: node:net, writes the banner immediately.
 * - http: node:http, answers any request with a minimal 200 line.
 * Emits one HoneypotEvent per connection (or a throttled marker when a single
 * IP exceeds the per-window rate). Not exercised against real sockets in tests.
 */
export function createListener(
  protocol: Protocol,
  dstPort: number,
  onEvent: (event: HoneypotEvent) => void,
  options: ListenerOptions = {}
): ListenerHandle {
  const maxConnections = options.maxConnections ?? DEFAULT_MAX_CONNECTIONS;
  const rateLimit = options.rateLimit ?? DEFAULT_RATE_LIMIT;
  const hitsByIp = new Map<string, number[]>();

  const iso = (t: number): string => new Date(t).toISOString();
  const banner = makeBanner(protocol, dstPort);
  const bannerBytes = Buffer.byteLength(banner, "utf8");

  const server: net.Server | http.Server =
    protocol === "http"
      ? http.createServer((_req, res) => {
          res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
          res.end(banner);
        })
      : net.createServer();

  server.maxConnections = maxConnections;

  const handleConnection = (socket: net.Socket): void => {
    const ip = socket.remoteAddress ?? "unknown";
    const now = Date.now();
    const srcPort = socket.remotePort ?? 0;
    const recent = pruneStale(hitsByIp.get(ip) ?? [], now, rateLimit.windowMs);
    if (recent.length >= rateLimit.max) {
      hitsByIp.set(ip, recent);
      onEvent({ ts: iso(now), srcIp: ip, srcPort, dstPort, protocol, data: "[rate-limited]", bytes: 0 });
      socket.destroy();
      return;
    }
    recent.push(now);
    hitsByIp.set(ip, recent);
    onEvent({ ts: iso(now), srcIp: ip, srcPort, dstPort, protocol, banner, bytes: bannerBytes });
    if (protocol !== "http") {
      let received = 0;
      socket.on("data", (chunk: Buffer) => {
        received += chunk.length;
      });
      socket.on("error", () => {
        /* keep the telemetry stream quiet on connection resets */
      });
      socket.write(banner);
      socket.on("end", () => socket.end());
    }
  };

  server.on("connection", handleConnection);

  const close = (): void => {
    server.close();
    if ("closeAllConnections" in server) server.closeAllConnections();
  };

  return { server, close };
}