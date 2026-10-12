import { createHash } from "node:crypto";

export const SEARCH_CACHE_MS = 24 * 60 * 60 * 1000;
export type SearchEngine = "google" | "google_forums" | "amazon" | "amazon_product";
export type SearchParams = { engine: SearchEngine; q?: string; k?: string; asin?: string; gl?: string; hl?: string; amazon_domain?: string };
export type SearchHit = { title: string; url: string; snippet: string; sourceDate: string | null; asin: string | null; rating: number | null; reviewCount: number | null; price: number | null; priceText: string | null };
export type ReviewExcerpt = { title: string; text: string; sourceDate: string | null; rating: number | null; verifiedPurchase: boolean | null };
export type SafeSearchPayload = { searchId: string | null; hits: SearchHit[]; productTitle: string | null; productFeatures: string[]; reviews: ReviewExcerpt[] };
export type CandidateInput = { name: string; official_domain: string; rationale: string; evidence_ids: string[] };
export type CitationSource = { id: string; source_title: string; source_snippet: string; source_url: string };

export function textValue(value: unknown, max = 600): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max) : "";
}
export function objectValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function contentHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
export function normalizedName(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
export function nameInText(name: string, value: string): boolean {
  const needle = normalizedName(name);
  return needle.length >= 2 && (` ${normalizedName(value)} `).includes(` ${needle} `);
}
export function publicSourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2083) return null;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(host) || host.split(".").some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|gclid$|fbclid$|ref$|api_key$|apikey$|access_token$|token$|key$)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch { return null; }
}
export function domainOf(value: string): string | null {
  const url = publicSourceUrl(value.includes("://") ? value : `https://${value}`);
  const domain = url ? new URL(url).hostname.toLowerCase().replace(/^www\./, "") : null;
  return domain && !["co.in", "com.au", "co.uk", "org.in", "net.in", "com.br", "co.jp", "co.nz", "com.sg"].includes(domain) ? domain : null;
}
export function isDomainWithin(actual: string, domain: string): boolean {
  return actual === domain || actual.endsWith(`.${domain}`);
}
const SOURCE_ONLY_DOMAINS = ["reddit.com", "quora.com", "wikipedia.org", "youtube.com", "instagram.com", "facebook.com", "linkedin.com", "amazon.in", "amazon.com", "google.com", "google.co.in", "g2.com", "capterra.com", "crunchbase.com", "tracxn.com", "zoominfo.com", "similarweb.com", "forbes.com", "techcrunch.com", "medium.com", "business-standard.com", "economictimes.indiatimes.com", "yourstory.com"];
export function isSourceOnlyDomain(domain: string): boolean {
  return SOURCE_ONLY_DOMAINS.some((item) => isDomainWithin(domain, item));
}
export function normalizeSearchParams(params: SearchParams): Record<string, string> {
  const result: Record<string, string> = { engine: params.engine };
  if (params.engine === "google" || params.engine === "google_forums") {
    const q = textValue(params.q, 800).replace(/\s+/g, " ");
    if (!q) throw new Error("invalid_search_query");
    Object.assign(result, { q, gl: params.gl ?? "in", hl: params.hl ?? "en" });
  } else if (params.engine === "amazon") {
    const k = textValue(params.k, 300).replace(/\s+/g, " ");
    if (!k) throw new Error("invalid_search_query");
    Object.assign(result, { k, amazon_domain: "amazon.in" });
  } else if (params.engine === "amazon_product") {
    const asin = textValue(params.asin, 30).toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(asin)) throw new Error("invalid_asin");
    Object.assign(result, { asin, amazon_domain: "amazon.in" });
  } else { throw new Error("invalid_search_engine"); }
  return result;
}
export function searchCacheKey(params: SearchParams): string {
  const normalized = normalizeSearchParams(params);
  return contentHash(JSON.stringify(["serpapi-v2", ...Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b))]));
}
function finiteNumber(value: unknown, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max ? value : null;
}
/** Whitelist provider output. Never cache search_parameters, API links, or raw response/error objects. */
export function sanitizeSearchPayload(input: unknown, params: SearchParams): SafeSearchPayload {
  const raw = objectValue(input);
  const metadata = objectValue(raw.search_metadata);
  const hits: SearchHit[] = [];
  for (const item of (Array.isArray(raw.organic_results) ? raw.organic_results : []).slice(0, 15)) {
    const record = objectValue(item);
    const url = publicSourceUrl(record.link_clean ?? record.link);
    const title = textValue(record.title, 300);
    if (!url || !title) continue;
    const asin = textValue(record.asin, 30).toUpperCase();
    hits.push({ title, url, snippet: textValue(record.snippet), sourceDate: textValue(record.date, 100) || null, asin: /^[A-Z0-9]{10}$/.test(asin) ? asin : null, rating: finiteNumber(record.rating, 5), reviewCount: finiteNumber(record.reviews, 2147483647), price: finiteNumber(record.extracted_price, 1e12), priceText: textValue(record.price, 100) || null });
  }
  const product = objectValue(raw.product_results);
  const information = objectValue(raw.reviews_information);
  const reviews: ReviewExcerpt[] = [];
  // Amazon's AI review summary is intentionally not promoted into customer testimony.
  for (const item of (Array.isArray(information.authors_reviews) ? information.authors_reviews : []).slice(0, 8)) {
    const review = objectValue(item);
    const text = textValue(review.text);
    if (!text) continue;
    reviews.push({ title: textValue(review.title, 220) || "Customer review excerpt", text, sourceDate: textValue(review.date, 100) || null, rating: finiteNumber(review.rating, 5), verifiedPurchase: typeof review.verified_purchase === "boolean" ? review.verified_purchase : null });
  }
  return { searchId: textValue(metadata.id, 100) || null, hits, productTitle: params.engine === "amazon_product" ? textValue(product.title, 300) || null : null, productFeatures: (Array.isArray(raw.about_item) ? raw.about_item : []).map((item) => textValue(item, 400)).filter(Boolean).slice(0, 5), reviews };
}
export function parsedSourceDate(value: string | null): string | null {
  // Preserve relative dates as source_date_text; do not invent a publication timestamp.
  if (!value || !/\b(?:19|20)\d{2}\b/.test(value)) return null;
  const explicitIso = /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const isoDay = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const namedMonth = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/i.test(value);
  if (!explicitIso && !isoDay && !namedMonth) return null;
  // Date-only observations have day precision. UTC avoids shifting that day with the server timezone.
  const timestamp = Date.parse(explicitIso ? value : isoDay ? `${value}T00:00:00Z` : `${value} UTC`);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}
export function validateCandidates(input: unknown, sources: CitationSource[], ownName: string, ownDomain: string | null): CandidateInput[] {
  const data = objectValue(input);
  if (!Array.isArray(data.competitors)) return [];
  const byId = new Map(sources.map((source) => [source.id, source]));
  const seen = new Set<string>();
  const accepted: CandidateInput[] = [];
  for (const entry of data.competitors.slice(0, 10)) {
    const record = objectValue(entry);
    const name = textValue(record.name, 100);
    const domain = domainOf(textValue(record.official_domain, 253));
    const rationale = textValue(record.rationale);
    const ids = [...new Set((Array.isArray(record.evidence_ids) ? record.evidence_ids : []).filter((id): id is string => typeof id === "string" && byId.has(id)))];
    if (name.length < 2 || !domain || !rationale || !ids.length || isSourceOnlyDomain(domain) || seen.has(domain)) continue;
    if (normalizedName(name) === normalizedName(ownName) || (ownDomain && (isDomainWithin(domain, ownDomain) || isDomainWithin(ownDomain, domain)))) continue;
    if (!ids.some((id) => { const source = byId.get(id)!; return nameInText(name, source.source_title + " " + source.source_snippet); })) continue;
    seen.add(domain);
    accepted.push({ name, official_domain: domain, rationale, evidence_ids: ids });
    if (accepted.length === 5) break;
  }
  return accepted;
}
export function verifiedOfficialHit(candidate: Pick<CandidateInput, "name" | "official_domain">, hits: SearchHit[]): SearchHit | null {
  if (isSourceOnlyDomain(candidate.official_domain)) return null;
  return hits.find((hit) => {
    const domain = domainOf(hit.url);
    return domain && isDomainWithin(domain, candidate.official_domain) && nameInText(candidate.name, hit.title + " " + hit.snippet);
  }) ?? null;
}
export function compareObservations(current: { source_record_key: string; content_hash: string }[], previous: { source_record_key: string; content_hash: string }[]) {
  const prior = new Map(previous.map((item) => [item.source_record_key, item.content_hash]));
  const now = new Set(current.map((item) => item.source_record_key));
  return { added: current.filter((item) => !prior.has(item.source_record_key)).length, changed: current.filter((item) => prior.has(item.source_record_key) && prior.get(item.source_record_key) !== item.content_hash).length, unchanged: current.filter((item) => prior.get(item.source_record_key) === item.content_hash).length, absent: previous.filter((item) => !now.has(item.source_record_key)).length };
}
