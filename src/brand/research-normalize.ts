import { domainOf, objectValue, publicSourceUrl, textValue, type SearchHit } from "./competition";
import type { Json } from "../types/database.types";

export type ResearchEvidence = {
  kind: "meta_ad" | "google_ad" | "social_post" | "social_comment" | "product_price" | "social_profile" | "facebook_review" | "linkedin_ad" | "reddit_ad";
  title: string;
  url: string;
  text: string;
  sourceDate: string | null;
  attributes: Record<string, Json>;
};
export type SearchApiPayload = {
  searchId: string | null;
  hits: SearchHit[];
  evidence: ResearchEvidence[];
  instagramUsername: string | null;
  postId: string | null;
  profileWebsite: string | null;
  facebookPage?: { id: string; name: string; url: string; website: string | null; username: string | null; instagram: string | null };
  pages?: Array<{ id: string; name: string; alias: string | null; country: string | null }>;
};

const list = (value: unknown, limit: number): Record<string, unknown>[] => (Array.isArray(value) ? value : []).slice(0, limit).map(objectValue);
const count = (value: unknown): number | null => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
const label = (value: unknown, max = 200): string | null => textValue(value, max) || null;
const identifier = (value: unknown, pattern: RegExp): string | null => typeof value === "string" && pattern.test(value) ? value : null;

export function instagramUsernameFromUrl(value: unknown): string | null {
  const safe = publicSourceUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  const parts = url.pathname.split("/").filter(Boolean);
  if (!["instagram.com", "www.instagram.com"].includes(url.hostname) || parts.length !== 1 || ["p", "reel", "reels", "explore", "stories", "accounts", "direct", "about"].includes(parts[0])) return null;
  return identifier(parts[0], /^[a-zA-Z0-9._]{1,30}$/);
}

function instagramPost(value: unknown): { id: string; url: string } | null {
  if (typeof value !== "string") return null;
  const id = identifier(value, /^[a-zA-Z0-9_-]{5,80}$/);
  if (id) return { id, url: `https://www.instagram.com/p/${id}/` };
  const safe = publicSourceUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  const match = url.pathname.match(/^\/(p|reel)\/([a-zA-Z0-9_-]{5,80})\/?$/);
  return ["instagram.com", "www.instagram.com"].includes(url.hostname) && match ? { id: match[2], url: `https://www.instagram.com/${match[1]}/${match[2]}/` } : null;
}

/** One first-page request only. Credentials, arbitrary endpoints and pagination are never forwarded. */
export function normalizeSearchApiParams(input: Record<string, string>): Record<string, string> {
  const engine = input.engine;
  const params: Record<string, string> = { engine };
  const query = textValue(input.q, 800).replace(/\s+/g, " ");
  if (engine === "google") {
    if (!query) throw new Error("invalid_search_query");
    Object.assign(params, { q: query, gl: /^[a-z]{2}$/.test(input.gl ?? "") ? input.gl : "in", hl: /^[a-z-]{2,8}$/.test(input.hl ?? "") ? input.hl : "en" });
  } else if (engine === "meta_ad_library") {
    const pageId = identifier(input.page_id, /^\d{1,30}$/);
    if (!query && !pageId) throw new Error("invalid_search_query");
    if (query) params.q = query;
    if (pageId) params.page_id = pageId;
    params.country = /^(?:[A-Z]{2}|ALL)$/.test(input.country ?? "") ? input.country : "IN";
    params.active_status = ["active", "inactive", "all"].includes(input.active_status) ? input.active_status : "active";
    params.sort_by = "most_recent";
  } else if (engine === "meta_ad_library_page_search" || engine === "reddit_ad_library") {
    if (!query) throw new Error("invalid_search_query");
    params.q = query;
    if (engine === "meta_ad_library_page_search") params.country = "IN";
  } else if (engine === "linkedin_ad_library") {
    const advertiser = textValue(input.advertiser, 200);
    if (!advertiser) throw new Error("invalid_advertiser");
    params.advertiser = advertiser; params.country = "IN";
  } else if (["facebook_business_page", "facebook_business_page_reviews"].includes(engine)) {
    const pageId = identifier(input.page_id, /^\d{1,30}$/);
    const url = publicSourceUrl(input.url);
    if (pageId) params.page_id = pageId;
    else if (url && /^(www\.)?facebook\.com$/.test(new URL(url).hostname)) params.url = url;
    else throw new Error("invalid_facebook_page");
  } else if (engine === "google_ads_transparency_center") {
    const domain = domainOf(textValue(input.domain, 253));
    if (!domain) throw new Error("invalid_search_domain");
    params.domain = domain;
    params.time_period = ["today", "last_7_days", "last_30_days"].includes(input.time_period) ? input.time_period : "last_30_days";
    // Official region docs accept ISO alpha-2 codes as well as numeric region identifiers.
    params.region = /^(?:anywhere|ANYWHERE|[A-Z]{2}|\d{1,6})$/.test(input.region ?? "") ? input.region : "IN";
    params.num = "20";
  } else if (engine === "instagram_profile") {
    const username = identifier(input.username, /^[a-zA-Z0-9._]{1,30}$/);
    if (!username) throw new Error("invalid_instagram_username");
    params.username = username;
  } else if (engine === "instagram_comments") {
    const post = instagramPost(input.post_id);
    if (!post) throw new Error("invalid_instagram_post");
    params.post_id = post.id;
  } else throw new Error("invalid_search_engine");
  return params;
}

/**
 * Contract references: searchapi.io/docs/{google,meta-ad-library-api,
 * google-ads-transparency-center-api,instagram-profile-api,instagram-comments-api}.
 * Whitelist observed fields only. A search match is NOT proof of brand ownership;
 * the worker must compare advertiser/targetDomain/profileWebsite with the verified brand.
 */
export function sanitizeSearchApiPayload(input: unknown, params: Record<string, string>): SearchApiPayload {
  const raw = objectValue(input);
  const result: SearchApiPayload = { searchId: label(objectValue(raw.search_metadata).id, 100), hits: [], evidence: [], instagramUsername: null, postId: null, profileWebsite: null };
  if (params.engine === "google") {
    for (const item of list(raw.organic_results, 15)) {
      const url = publicSourceUrl(item.link);
      const title = textValue(item.title, 300);
      if (!url || !title) continue;
      result.hits.push({ title, url, snippet: textValue(item.snippet, 1200), sourceDate: label(item.date, 100), asin: null, rating: null, reviewCount: null, price: null, priceText: null });
      // Keep links for the worker to match against the brand; never guess a handle from its name.
      result.instagramUsername ??= instagramUsernameFromUrl(url);
    }
  } else if (params.engine === "meta_ad_library_page_search") {
    result.pages = list(raw.page_results, 10).flatMap(row => {
      const id = identifier(row.page_id, /^\d{1,30}$/); const name = textValue(row.name, 100);
      return id && name && row.page_is_deleted !== true ? [{ id, name, alias: label(row.page_alias, 120), country: label(row.country, 10) }] : [];
    });
  } else if (params.engine === "facebook_business_page") {
    const page = objectValue(raw.page); const about = objectValue(raw.about);
    const id = identifier(page.id, /^\d{1,30}$/); const url = publicSourceUrl(page.link);
    if (id && url && /^(www\.)?facebook\.com$/.test(new URL(url).hostname)) {
      const name = textValue(page.name, 100); const website = publicSourceUrl(about.website);
      const instagram = identifier(about.instagram_username, /^[a-zA-Z0-9._]{1,30}$/);
      result.facebookPage = { id, name, url, website, username: label(page.username, 120), instagram };
      result.evidence.push({ kind: "social_profile", title: name + " · Facebook", url,
        text: [label(about.category), label(about.address), label(about.business_services, 600), label(about.price_range)].filter(Boolean).join(" · "), sourceDate: null,
        attributes: { platform: "Facebook", followers: count(objectValue(page.followers).count), recommendationPercent: typeof about.rating === "number" && about.rating >= 0 && about.rating <= 100 ? about.rating : null, reviewsCount: count(about.reviews_count), website, instagramUsername: instagram } });
    }
  } else if (params.engine === "facebook_business_page_reviews") {
    const page = objectValue(raw.page); const pageId = identifier(page.id, /^\d{1,30}$/);
    // First-page responses must identify the requested page. Never accept a different page's reviews.
    if (pageId && pageId === params.page_id) for (const review of list(raw.reviews, 30)) {
      const url = publicSourceUrl(review.link); const text = textValue(review.text, 1800);
      if (!url || !/^(www\.)?facebook\.com$/.test(new URL(url).hostname) || !text) continue;
      const recommendation = ["recommends", "doesn't recommend"].includes(String(review.recommendation)) ? String(review.recommendation) : null;
      result.evidence.push({ kind: "facebook_review", title: "Facebook review", url, text, sourceDate: label(review.iso_date ?? review.date, 100), attributes: { platform: "Facebook", commentId: label(review.review_id, 100), pageId, recommendation } });
    }
  } else if (params.engine === "linkedin_ad_library") {
    for (const ad of list(raw.ads, 20)) {
      const url = publicSourceUrl(ad.link); const content = objectValue(ad.content); const advertiser = objectValue(ad.advertiser);
      if (!url || !/^(www\.)?linkedin\.com$/.test(new URL(url).hostname)) continue;
      const landingUrls = (Array.isArray(content.headline_links) ? content.headline_links : []).map(value => publicSourceUrl(typeof value === "string" ? value : objectValue(value).link)).filter((url): url is string => !!url);
      result.evidence.push({ kind: "linkedin_ad", title: textValue(content.headline ?? content.title, 250) || "LinkedIn advertisement", url,
        text: textValue(content.description ?? content.text, 1800), sourceDate: null,
        attributes: { platform: "LinkedIn", advertiser: label(advertiser.name), adId: label(ad.id, 100), format: label(ad.ad_type, 80), callToAction: label(content.cta, 100), landingUrls, ownership: "Advertiser name match; ownership not independently confirmed" } });
    }
  } else if (params.engine === "reddit_ad_library") {
    for (const ad of list(raw.ads, 20)) {
      const creative = objectValue(ad.creative); const url = publicSourceUrl(creative.post_url);
      if (!url || !/^(www\.)?reddit\.com$/.test(new URL(url).hostname)) continue;
      const landingUrls = list(creative.content, 5).map(row => publicSourceUrl(row.destination_url)).filter((url): url is string => !!url);
      result.evidence.push({ kind: "reddit_ad", title: textValue(creative.headline, 250) || "Reddit advertisement", url, text: textValue(creative.body, 1800), sourceDate: label(creative.created_at, 100),
        attributes: { platform: "Reddit", advertiser: label(objectValue(ad.profile_info).name), adId: label(ad.id, 100), objective: label(ad.objective), landingUrls, format: label(creative.type, 80) } });
    }
  } else if (params.engine === "meta_ad_library") {
    for (const ad of list(raw.ads, 20)) {
      const snapshot = objectValue(ad.snapshot);
      const id = identifier(ad.ad_archive_id, /^\d{1,30}$/);
      if (!id) continue;
      const cards = list(snapshot.cards, 5);
      const landingUrls = [snapshot.link_url, ...cards.map(card => card.link_url)].map(publicSourceUrl).filter((url): url is string => Boolean(url));
      const advertiser = label(snapshot.page_name ?? ad.page_name);
      const body = textValue(objectValue(snapshot.body).text, 1800) || textValue(snapshot.body, 1800) || cards.map(card => textValue(card.body, 600)).filter(Boolean).join("\n").slice(0, 1800);
      result.evidence.push({
        kind: "meta_ad", title: textValue(cards[0]?.title, 250) || advertiser || "Meta advertisement",
        url: `https://www.facebook.com/ads/library/?id=${id}`, text: body, sourceDate: label(ad.start_date, 100),
        attributes: { adId: id, advertiser, advertiserId: label(ad.page_id ?? snapshot.page_id, 50), advertiserUrl: publicSourceUrl(snapshot.page_profile_uri), targetDomain: landingUrls[0] ? domainOf(landingUrls[0]) : null, landingUrls, format: label(snapshot.display_format, 50), callToAction: label(snapshot.cta_text, 100), active: typeof ad.is_active === "boolean" ? ad.is_active : null, endDate: label(ad.end_date, 100), platforms: (Array.isArray(ad.publisher_platform) ? ad.publisher_platform : []).map(value => textValue(value, 30)).filter(Boolean).slice(0, 6) },
      });
    }
  } else if (params.engine === "google_ads_transparency_center") {
    for (const ad of list(raw.ad_creatives, 20)) {
      const url = publicSourceUrl(ad.details_link);
      if (!url || new URL(url).hostname !== "adstransparency.google.com") continue;
      const advertiser = objectValue(ad.advertiser);
      const name = label(advertiser.name);
      result.evidence.push({ kind: "google_ad", title: name ? `${name} advertisement` : "Google advertisement", url, text: "", sourceDate: label(ad.first_shown_datetime, 100), attributes: { adId: label(ad.id, 100), advertiser: name, advertiserId: label(advertiser.id, 100), targetDomain: domainOf(textValue(ad.target_domain, 253)), format: label(ad.format, 50), lastShownDate: label(ad.last_shown_datetime, 100), totalDaysShown: count(ad.total_days_shown) } });
      // The list endpoint has metadata, not creative copy. Never execute details_script_link.
    }
  } else if (params.engine === "instagram_profile") {
    const profile = objectValue(raw.profile);
    result.instagramUsername = identifier(profile.username, /^[a-zA-Z0-9._]{1,30}$/);
    result.profileWebsite = publicSourceUrl(profile.external_link) ?? list(profile.bio_links, 5).map(link => publicSourceUrl(link.url)).find(Boolean) ?? null;
    for (const item of list(raw.posts, 12)) {
      const post = instagramPost(item.permalink) ?? instagramPost(item.id);
      if (!post) continue;
      result.postId ??= post.id;
      result.evidence.push({ kind: "social_post", title: "Instagram post", url: post.url, text: textValue(item.caption, 1800), sourceDate: label(item.iso_date, 100), attributes: { postId: post.id, username: result.instagramUsername, format: label(item.type, 50), likes: count(item.likes), comments: count(item.comments) } });
    }
  } else if (params.engine === "instagram_comments") {
    const post = objectValue(raw.post);
    const source = instagramPost(post.permalink) ?? instagramPost(post.id) ?? instagramPost(params.post_id);
    result.postId = source?.id ?? null;
    result.instagramUsername = identifier(objectValue(post.user).username, /^[a-zA-Z0-9._]{1,30}$/);
    if (source) for (const item of list(raw.comments, 60)) {
      const text = textValue(item.text, 1800);
      if (!text) continue;
      // Store actual comment excerpts, never a generated summary or the author's personal profile.
      result.evidence.push({ kind: "social_comment", title: "Instagram comment", url: source.url, text, sourceDate: label(item.iso_date, 100), attributes: { commentId: identifier(item.id, /^\d{1,40}$/), postId: source.id, likes: count(item.likes) } });
    }
  }
  return result;
}
