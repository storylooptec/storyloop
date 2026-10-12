function siteOrigin(value: string | null | undefined, addScheme = false): string | null {
  const input = value?.trim();
  if (!input) return null;
  try {
    const url = new URL(addScheme && !input.includes("://") ? `https://${input}` : input);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Keep the PKCE callback on the submitting site, using only configured deployment origins. */
export function brandRegistrationRedirect(env: Record<string, string | undefined>, requestOrigin: string | null): string | null {
  const allowed = [env.NEXT_PUBLIC_SITE_URL, env.VERCEL_URL, env.VERCEL_PROJECT_PRODUCTION_URL, env.VERCEL_BRANCH_URL]
    .map(value => siteOrigin(value, true)).filter((value): value is string => value !== null);
  const origin = siteOrigin(requestOrigin);
  if (!origin || !allowed.includes(origin)) return null;
  return new URL("/brand/auth/callback", origin).toString();
}

export function brandRegistrationError(error: { code?: string; status?: number }): string {
  if (error.status === 429 || error.code === "over_email_send_rate_limit") return "rate_limit";
  switch (error.code) {
    case "weak_password": return "weak_password";
    case "email_address_invalid": return "details";
    case "email_address_not_authorized": return "email_unavailable";
    case "signup_disabled": return "unavailable";
    default: return "registration";
  }
}

export function brandRegistrationMessage(error?: string): string {
  switch (error) {
    case undefined: return "";
    case "details": return "Enter a valid work email and a password of at least 6 characters (maximum 128).";
    case "configuration": return "Account registration is temporarily unavailable. Please contact Storyloop support.";
    case "weak_password": return "This password was not accepted. Try a longer password with a mix of letters, numbers and symbols.";
    case "rate_limit": return "Too many attempts or confirmation emails have been requested. Please wait before trying again.";
    case "email_unavailable": return "We can’t send a confirmation email to this address yet. Please contact Storyloop support.";
    case "unavailable": return "New account registration is currently unavailable. Please try again later.";
    default: return "We couldn’t create your account. Please try again. If you already have an account, sign in.";
  }
}
