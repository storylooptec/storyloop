import type { Json } from "@/types/database.types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AuditEventInput = {
  companyId: string;
  actorUserId: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  beforeState?: Json | null;
  afterState?: Json | null;
  metadata?: Json;
  status?: "success" | "failed";
  isReversible?: boolean;
  undoActionKey?: string | null;
  durationMinutes?: number | null;
};

export async function logAuditEvent(input: AuditEventInput) {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from("audit_logs").insert({
    company_id: input.companyId,
    actor_user_id: input.actorUserId,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    before_state: input.beforeState ?? null,
    after_state: input.afterState ?? null,
    metadata: input.metadata ?? {},
    status: input.status ?? "success",
    is_reversible: input.isReversible ?? false,
    undo_action_key: input.undoActionKey ?? null,
    duration_minutes: input.durationMinutes ?? null,
  });

  if (error) {
    throw new Error("Unable to write audit log");
  }
}
