import { redirect } from "next/navigation";

import { requireAdminContext } from "@/auth/admin-context";
import {
  roleHasPermission,
  type StoryloopPermission,
} from "@/auth/permissions";

export async function requirePermission(permission: StoryloopPermission) {
  const context = await requireAdminContext();

  if (!roleHasPermission(context.role, permission)) {
    redirect("/admin/unauthorized");
  }

  return context;
}
