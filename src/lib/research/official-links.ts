import "server-only";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import { publicSourceUrl } from "@/brand/competition";

function publicAddress(address: string): boolean {
  // Only public IPv4 is used. Pin this checked address in the TLS request to
  // prevent a second DNS resolution from reaching private infrastructure.
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split(".").map(Number);
  return ![0, 10, 127, 169].includes(a) && a < 224 && !(a === 100 && b >= 64 && b <= 127)
    && !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && [0, 168].includes(b)) && !(a === 198 && [18, 19].includes(b));
}

/** Read public social links from a verified official page. No search provider,
 * cookies, credentials, redirects or browser execution; failures cost no API credits. */
export async function officialSocialLinks(value: string): Promise<string[]> {
  const safe = publicSourceUrl(value);
  if (!safe || !safe.startsWith("https://")) return [];
  const url = new URL(safe);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const addresses = await Promise.race([
      lookup(url.hostname, { all: true, family: 4 }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("dns_timeout")), 1000); }),
    ]);
    clearTimeout(timer);
    if (!addresses.length || addresses.some(item => !publicAddress(item.address))) return [];
    const html = await new Promise<string>((resolve, reject) => {
      const req = request(url, {
        method: "GET", family: 4, headers: { Accept: "text/html", "User-Agent": "Storyloop/1.0 (public brand links)" },
        lookup: (_hostname, _options, callback) => callback(null, addresses[0].address, 4),
      }, response => {
        if (response.statusCode !== 200 || !String(response.headers["content-type"]).includes("text/html")) { response.destroy(); resolve(""); return; }
        const chunks: Buffer[] = []; let bytes = 0;
        response.on("data", chunk => { bytes += chunk.length; if (bytes > 512 * 1024) { response.destroy(); resolve(Buffer.concat(chunks).toString("utf8")); } else chunks.push(chunk); });
        response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        response.on("error", reject);
      });
      const deadline = setTimeout(() => req.destroy(new Error("page_timeout")), 3000);
      req.on("close", () => clearTimeout(deadline));
      req.on("error", reject); req.end();
    });
    const links = new Set<string>();
    for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)) {
      let link: string | null = null;
      try { link = publicSourceUrl(new URL(match[1].replaceAll("&amp;", "&"), url).href); } catch { continue; }
      if (link && /^(www\.)?(instagram|facebook|linkedin|youtube|x|twitter)\.com$/.test(new URL(link).hostname)) links.add(link);
      if (links.size >= 20) break;
    }
    return [...links];
  } catch { return []; } finally { clearTimeout(timer); }
}
