import assert from "node:assert/strict";
import test from "node:test";
import { brandOwnsUrl, verificationQuery, compareObservations, domainOf, normalizeSearchParams, parsedSourceDate, publicSourceUrl, sanitizeSearchPayload, searchCacheKey, validateCandidates, verifiedOfficialHit } from "../src/brand/competition.ts";

test("evidence links reject active schemes, credentials, local addresses and malformed hosts", () => {
  for (const url of ["javascript:alert(1)", "file:///etc/passwd", "https://user:secret@brand.in", "http://localhost/x", "http://127.0.0.1", "http://[::1]/", "https://api.internal/", "https://bad..com/"]) assert.equal(publicSourceUrl(url), null, url);
  assert.equal(publicSourceUrl("https://brand.in/product?utm_source=ad&api_key=secret&variant=2#top"), "https://brand.in/product?variant=2");
  assert.equal(domainOf("www.brand.in"), "brand.in");
  assert.equal(domainOf("co.in"), null);
});

test("SerpApi cache distinguishes engine/query/locale while ignoring parameter order and extra credential fields", () => {
  const a = { engine: "google", q: "  Brand   competitors India ", gl: "in", hl: "en" };
  const b = { hl: "en", gl: "in", q: "Brand competitors India", engine: "google", api_key: "never persisted" };
  assert.equal(searchCacheKey(a), searchCacheKey(b));
  assert.notEqual(searchCacheKey(a), searchCacheKey({ ...a, gl: "us" }));
  assert.notEqual(searchCacheKey(a), searchCacheKey({ ...a, engine: "google_forums" }));
  assert.deepEqual(normalizeSearchParams({ engine: "amazon", k: "Brand product", amazon_domain: "internal" }), { engine: "amazon", k: "Brand product", amazon_domain: "amazon.in" });
  assert.throws(() => normalizeSearchParams({ engine: "amazon_product", asin: "B012345678too-long" }));
});

test("sanitized cache keeps attributed excerpts and removes raw metadata, credentials, reviewer profiles and AI summaries", () => {
  const payload = sanitizeSearchPayload({
    api_key: "SECRET", search_metadata: { id: "search-123", raw_html_file: "https://serpapi.com/file?api_key=SECRET" }, search_parameters: { api_key: "SECRET" },
    organic_results: [{ title: "Brand product", link: "https://www.amazon.in/dp/B012345678", asin: "B012345678", rating: 4.5, reviews: 25, extracted_price: 999, price: "₹999", snippet: "Listed product" }],
    product_results: { title: "Brand product" }, about_item: ["A listed benefit"],
    reviews_information: { summary: { text: "Everyone loves this!", insights: [{ sentiment: "positive" }] }, authors_reviews: [{ title: "Works", text: "Customer excerpt", rating: 4, date: "October 1, 2026", author: "Personal name", author_link: "https://amazon.in/profile/private", verified_purchase: true }] },
  }, { engine: "amazon_product", asin: "B012345678" });
  assert.equal(payload.searchId, "search-123");
  assert.equal(payload.hits[0].price, 999);
  assert.deepEqual(payload.reviews, [{ title: "Works", text: "Customer excerpt", sourceDate: "October 1, 2026", rating: 4, verifiedPurchase: true }]);
  const saved = JSON.stringify(payload);
  for (const excluded of ["SECRET", "Everyone loves", "Personal name", "raw_html_file", "search_parameters", "author_link"]) assert.equal(saved.includes(excluded), false, excluded);
});

test("missing reviews and invalid numeric metrics remain unavailable instead of invented zero values", () => {
  const payload = sanitizeSearchPayload({ organic_results: [{ title: "Item", link: "https://amazon.in/dp/B012345678", rating: 9, reviews: -1, price: "Unavailable", extracted_price: "999", asin: "B012345678extra" }], reviews_information: { summary: { text: "Positive" } } }, { engine: "amazon", k: "Item" });
  assert.equal(payload.hits[0].rating, null);
  assert.equal(payload.hits[0].reviewCount, null);
  assert.equal(payload.hits[0].price, null);
  assert.equal(payload.hits[0].asin, null);
  assert.deepEqual(payload.reviews, []);
});

const sources = [{ id: "source-1", source_title: "Acme alternatives include Beta and Gamma", source_snippet: "Beta is a competing product brand; Forbes reports on the category.", source_url: "https://news.example.org/brands" }];
const candidate = { name: "Beta", official_domain: "beta.in", rationale: "Same product category", evidence_ids: ["source-1"] };

test("competitor extraction rejects hallucinated names, foreign citations, source publishers, own brand and duplicate domains", () => {
  const competitors = [candidate, { ...candidate }, { ...candidate, name: "Invented", official_domain: "invented.in" }, { ...candidate, name: "Gamma", official_domain: "gamma.in", evidence_ids: ["other-campaign-source"] }, { ...candidate, name: "Forbes", official_domain: "forbes.com" }, { ...candidate, name: "Acme", official_domain: "shop.acme.in" }];
  assert.deepEqual(validateCandidates({ competitors }, sources, "Acme", "acme.in"), [candidate]);
});

test("official-domain verification cannot accept publisher articles or lookalike domains", () => {
  const hit = { title: "Beta official products", url: "https://beta.in/", snippet: "Beta skincare", sourceDate: null, asin: null, rating: null, reviewCount: null, price: null, priceText: null };
  assert.equal(verifiedOfficialHit(candidate, [{ ...hit, url: "https://beta.in.attacker.com/" }]), null);
  assert.equal(verifiedOfficialHit(candidate, [{ ...hit, url: "https://news.example.org/beta" }]), null);
  assert.equal(verifiedOfficialHit(candidate, [{ ...hit, title: "Completely different company", snippet: "Something else" }]), null);
  assert.equal(verifiedOfficialHit(candidate, [hit]), hit);
});

test("reviewed parent and regional sites work without accepting other brands or lookalikes", () => {
  const pepsodent = { name: "Pepsodent", official_domain: "pepsodent.in" };
  const colgate = { name: "Colgate", official_domain: "colgatepalmolive.co.in" };
  assert.equal(brandOwnsUrl(pepsodent, "https://www.hul.co.in/brands/personal-care/pepsodent/"), true);
  for (const url of ["https://www.hul.co.in/brands/personal-care/ponds/", "https://www.hul.co.in/", "https://www.hul.co.in.attacker.com/brands/personal-care/pepsodent/"]) assert.equal(brandOwnsUrl(pepsodent, url), false);
  assert.equal(brandOwnsUrl(colgate, "https://www.colgate.com/en-in/colgate-dental-screening-basic/start"), true);
  assert.equal(brandOwnsUrl(colgate, "https://colgate.com.attacker.com/"), false);
  assert.equal(brandOwnsUrl({ name: "Unrelated", official_domain: colgate.official_domain }, "https://colgate.com/"), false);
  assert.match(verificationQuery(pepsodent), /official website India/);
  assert.match(verificationQuery(pepsodent), /-site:instagram.com/);
});

test("observation comparisons count source changes without producing market-share or sentiment estimates", () => {
  const result = compareObservations([{ source_record_key: "same", content_hash: "1" }, { source_record_key: "edited", content_hash: "new" }, { source_record_key: "added", content_hash: "3" }], [{ source_record_key: "same", content_hash: "1" }, { source_record_key: "edited", content_hash: "old" }, { source_record_key: "removed", content_hash: "4" }]);
  assert.deepEqual(result, { added: 1, changed: 1, unchanged: 1, absent: 1 });
  assert.equal(parsedSourceDate("2 days ago"), null);
  assert.equal(parsedSourceDate(null), null);
  assert.equal(parsedSourceDate("October 1, 2026"), "2026-10-01T00:00:00.000Z");
});
