"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { permissions } from "@/auth/permissions";
import { logAuditEvent } from "@/audit/log-event";
import { requirePermission } from "@/auth/require-permission";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const HEX = /^#[0-9A-F]{6}$/i;
const allowedFonts = new Set(["Montserrat", "Exo 2"]);

function color(formData: FormData, name: string): string {
  const value = String(formData.get(name) ?? "").trim();
  if (!HEX.test(value)) throw new Error(`Invalid color: ${name}`);
  return value.toUpperCase();
}

function number(formData: FormData, name: string): number {
  const value = Number(formData.get(name));
  if (!Number.isFinite(value)) throw new Error(`Invalid number: ${name}`);
  return value;
}

function nullableNumber(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid number: ${name}`);
  }
  return value;
}

export async function saveBrandSettings(formData: FormData) {
  const context = await requirePermission(permissions.approvalsPerform);
  const supabase = await createServerSupabaseClient();

  const { data: before } = await supabase
    .from("company_brand_settings")
    .select("default_theme,dark_colors,light_colors,gradient,typography,radius,spacing")
    .eq("company_id", context.companyId)
    .single();

  const defaultTheme =
    String(formData.get("defaultTheme")) === "light" ? "light" : "dark";

  const displayFamily = String(formData.get("displayFamily") ?? "");
  const bodyFamily = String(formData.get("bodyFamily") ?? "");
  const systemFamily = String(formData.get("systemFamily") ?? "");

  if (
    !allowedFonts.has(displayFamily) ||
    !allowedFonts.has(bodyFamily) ||
    !allowedFonts.has(systemFamily)
  ) {
    throw new Error("Unsupported font family");
  }

  const darkColors = {
    canvas: color(formData, "dark_canvas"),
    surface: color(formData, "dark_surface"),
    raised: color(formData, "dark_raised"),
    line: color(formData, "dark_line"),
    ink: color(formData, "dark_ink"),
    body: color(formData, "dark_body"),
    slate: color(formData, "dark_slate"),
    dim: color(formData, "dark_dim"),
    accent: color(formData, "dark_accent"),
    ok: color(formData, "dark_ok"),
    edge: color(formData, "dark_edge"),
  };

  const lightColors = {
    canvas: color(formData, "light_canvas"),
    surface: color(formData, "light_surface"),
    raised: color(formData, "light_raised"),
    line: color(formData, "light_line"),
    ink: color(formData, "light_ink"),
    body: color(formData, "light_body"),
    slate: color(formData, "light_slate"),
    dim: color(formData, "light_dim"),
    accent: color(formData, "light_accent"),
    edge: color(formData, "light_edge"),
  };

  const gradient = {
    angle: number(formData, "gradientAngle"),
    start: color(formData, "gradientStart"),
    middle: color(formData, "gradientMiddle"),
    end: color(formData, "gradientEnd"),
  };

  const typography = {
    displayFamily,
    bodyFamily,
    systemFamily,
    displayWeight: number(formData, "displayWeight"),
    titleWeight: number(formData, "titleWeight"),
    bodyWeight: number(formData, "bodyWeight"),
    systemWeight: number(formData, "systemWeight"),
    systemLetterSpacing: String(formData.get("systemLetterSpacing") ?? "0.1em"),
  };

  const radius = {
    sm: nullableNumber(formData, "radiusSm"),
    md: nullableNumber(formData, "radiusMd"),
    lg: nullableNumber(formData, "radiusLg"),
  };

  const spacing = String(formData.get("spacing") ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (spacing.length === 0) throw new Error("Spacing tokens are required");

  const { error } = await supabase
    .from("company_brand_settings")
    .update({
      default_theme: defaultTheme,
      dark_colors: darkColors,
      light_colors: lightColors,
      gradient,
      typography,
      radius,
      spacing,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", context.companyId);

  if (error) throw new Error("Unable to save brand settings");

  await logAuditEvent({
    companyId: context.companyId,
    actorUserId: context.userId,
    action: "brand_settings.updated",
    entityType: "company_brand_settings",
    entityId: context.companyId,
    beforeState: before,
    afterState: {
      default_theme: defaultTheme,
      dark_colors: darkColors,
      light_colors: lightColors,
      gradient,
      typography,
      radius,
      spacing,
    },
    isReversible: true,
    undoActionKey: "brand_settings.restore",
  });

  revalidatePath("/admin", "layout");
  revalidatePath("/admin/settings/brand");
  redirect("/admin/settings/brand?saved=1");
}
