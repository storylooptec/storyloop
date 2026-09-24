export const CREATOR_DEMO_OTP = "123456";

export function getCreatorAuthMode(): "demo" | "otp" {
  return process.env.CREATOR_AUTH_MODE === "otp" ? "otp" : "demo";
}

export const creatorDemoCookies = {
  session: "storyloop_creator_demo",
  phone: "storyloop_creator_demo_phone",
  onboarded: "storyloop_creator_demo_onboarded",
  handle: "storyloop_creator_demo_handle",
} as const;
