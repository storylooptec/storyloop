"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { permissions } from "@/auth/permissions";
import { requirePermission } from "@/auth/require-permission";
import {
  BRAND_ASSET_SLOTS,
  deleteBrandAsset,
  type BrandAssetSlot,
  uploadBrandAsset,
} from "@/lib/r2/brand-assets";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function isBrandAssetSlot(value: string): value is BrandAssetSlot {
  return BRAND_ASSET_SLOTS.includes(value as BrandAssetSlot);
}

const keyColumnBySlot = {
  primary_logo: "primary_logo_key",
  dark_logo: "dark_logo_key",
  light_logo: "light_logo_key",
  favicon: "favicon_key",
} as const;

const metadataColumnBySlot = {
  primary_logo: "primary_logo_meta",
  dark_logo: "dark_logo_meta",
  light_logo: "light_logo_meta",
  favicon: "favicon_meta",
} as const;

export async function uploadBrandAssetAction(formData: FormData) {
  const context = await requirePermission(permissions.approvalsPerform);
  const slot = String(formData.get("slot") ?? "");
  const file = formData.get("file");

  if (!isBrandAssetSlot(slot)) {
    throw new Error("Invalid brand asset slot");
  }

  if (!(file instanceof File)) {
    throw new Error("A file is required");
  }

  const supabase = await createServerSupabaseClient();
  const keyColumn = keyColumnBySlot[slot];
  const metadataColumn = metadataColumnBySlot[slot];

  const { data: current } = await supabase
    .from("company_brand_settings")
    .select(keyColumn)
    .eq("company_id", context.companyId)
    .single();

  const oldObjectKey =
    current && typeof current[keyColumn] === "string"
      ? current[keyColumn]
      : null;

  const uploaded = await uploadBrandAsset({
    companyId: context.companyId,
    slot,
    file,
  });

  const { error } = await supabase
    .from("company_brand_settings")
    .update({
      [keyColumn]: uploaded.objectKey,
      [metadataColumn]: {
        contentType: uploaded.contentType,
        sizeBytes: uploaded.sizeBytes,
        originalFilename: uploaded.originalFilename,
        publicUrl: uploaded.publicUrl,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", context.companyId);

  if (error) {
    try {
      await deleteBrandAsset(uploaded.objectKey);
    } catch {
      // Best-effort cleanup. Never hide the metadata-write failure.
    }

    throw new Error("Upload completed, but metadata could not be saved.");
  }

  if (oldObjectKey && oldObjectKey !== uploaded.objectKey) {
    try {
      await deleteBrandAsset(oldObjectKey);
    } catch {
      // Replacement succeeded. Old-object cleanup can be retried operationally.
    }
  }

  revalidatePath("/admin/settings/brand");
  redirect(`/admin/settings/brand?uploaded=${slot}`);
}
