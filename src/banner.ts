/** Deterministic protocol banners for the honeypot. */

import type { Protocol } from "./events.ts";

const SSH_BANNER = "SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.6\r\n";
const HTTP_BANNER = "HTTP/1.1 200 OK\r\nServer: nginx\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
const PLAIN_BANNER = "220 honeypot ready\r\n";

/** Return the banner that a fake service on dstPort would greet a client with. */
export function makeBanner(protocol: Protocol, dstPort: number): string {
  switch (protocol) {
    case "ssh":
      return SSH_BANNER;
    case "http":
      return HTTP_BANNER;
    case "plain":
      return PLAIN_BANNER;
    default:
      throw new Error(`Unsupported protocol "${String(protocol)}"`);
  }
}