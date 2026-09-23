"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { permissions } from "@/auth/permissions";
import { logAuditEvent } from "@/audit/log-event";
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

async function getCurrentObjectKey(
  slot: BrandAssetSlot,
  companyId: string,
) {
  const supabase = await createServerSupabaseClient();

  switch (slot) {
    case "primary_logo": {
      const { data } = await supabase
        .from("company_brand_settings")
        .select("primary_logo_key")
        .eq("company_id", companyId)
        .single();
      return data?.primary_logo_key ?? null;
    }
    case "dark_logo": {
      const { data } = await supabase
        .from("company_brand_settings")
        .select("dark_logo_key")
        .eq("company_id", companyId)
        .single();
      return data?.dark_logo_key ?? null;
    }
    case "light_logo": {
      const { data } = await supabase
        .from("company_brand_settings")
        .select("light_logo_key")
        .eq("company_id", companyId)
        .single();
      return data?.light_logo_key ?? null;
    }
    case "favicon": {
      const { data } = await supabase
        .from("company_brand_settings")
        .select("favicon_key")
        .eq("company_id", companyId)
        .single();
      return data?.favicon_key ?? null;
    }
  }
}

async function saveUploadedAsset(input: {
  slot: BrandAssetSlot;
  companyId: string;
  objectKey: string;
  metadata: {
    contentType: string;
    sizeBytes: number;
    originalFilename: string;
    publicUrl: string | null;
  };
}) {
  const supabase = await createServerSupabaseClient();
  const updatedAt = new Date().toISOString();

  switch (input.slot) {
    case "primary_logo":
      return supabase
        .from("company_brand_settings")
        .update({
          primary_logo_key: input.objectKey,
          primary_logo_meta: input.metadata,
          updated_at: updatedAt,
        })
        .eq("company_id", input.companyId);

    case "dark_logo":
      return supabase
        .from("company_brand_settings")
        .update({
          dark_logo_key: input.objectKey,
          dark_logo_meta: input.metadata,
          updated_at: updatedAt,
        })
        .eq("company_id", input.companyId);

    case "light_logo":
      return supabase
        .from("company_brand_settings")
        .update({
          light_logo_key: input.objectKey,
          light_logo_meta: input.metadata,
          updated_at: updatedAt,
        })
        .eq("company_id", input.companyId);

    case "favicon":
      return supabase
        .from("company_brand_settings")
        .update({
          favicon_key: input.objectKey,
          favicon_meta: input.metadata,
          updated_at: updatedAt,
        })
        .eq("company_id", input.companyId);
  }
}

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

  const oldObjectKey = await getCurrentObjectKey(slot, context.companyId);

  const uploaded = await uploadBrandAsset({
    companyId: context.companyId,
    slot,
    file,
  });

  const result = await saveUploadedAsset({
    slot,
    companyId: context.companyId,
    objectKey: uploaded.objectKey,
    metadata: {
      contentType: uploaded.contentType,
      sizeBytes: uploaded.sizeBytes,
      originalFilename: uploaded.originalFilename,
      publicUrl: uploaded.publicUrl,
    },
  });

  if (result.error) {
    try {
      await deleteBrandAsset(uploaded.objectKey);
    } catch {
      // Best-effort cleanup. Never hide the metadata-write failure.
    }

    throw new Error("Upload completed, but metadata could not be saved.");
  }

  await logAuditEvent({
    companyId: context.companyId,
    actorUserId: context.userId,
    action: "brand_asset.uploaded",
    entityType: "brand_asset",
    entityId: slot,
    beforeState: oldObjectKey ? { objectKey: oldObjectKey } : null,
    afterState: {
      objectKey: uploaded.objectKey,
      contentType: uploaded.contentType,
      sizeBytes: uploaded.sizeBytes,
      originalFilename: uploaded.originalFilename,
    },
    isReversible: false,
  });

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
