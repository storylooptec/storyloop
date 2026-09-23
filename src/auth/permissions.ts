export const permissions = {
  operationsWork: "operations.work",
  draftsManage: "drafts.manage",
  reversibleActionsPerform: "reversible_actions.perform",
  discoveryWithinCap: "discovery.within_cap",
  communicationsSend: "communications.send",
  approvalsPerform: "approvals.perform",
  creatorVerifiedGrant: "creator.verified_grant",
  financialActionsPerform: "financial_actions.perform",
  capsOverride: "caps.override",
} as const;

export type StoryloopPermission =
  (typeof permissions)[keyof typeof permissions];

export type TeamRole = "junior" | "senior";

const rolePermissions: Record<TeamRole, readonly StoryloopPermission[]> = {
  junior: [
    permissions.operationsWork,
    permissions.draftsManage,
    permissions.reversibleActionsPerform,
    permissions.discoveryWithinCap,
  ],
  senior: [
    permissions.operationsWork,
    permissions.draftsManage,
    permissions.reversibleActionsPerform,
    permissions.discoveryWithinCap,
    permissions.communicationsSend,
    permissions.approvalsPerform,
    permissions.creatorVerifiedGrant,
    permissions.financialActionsPerform,
    permissions.capsOverride,
  ],
};

export function roleHasPermission(
  role: TeamRole,
  permission: StoryloopPermission,
): boolean {
  return rolePermissions[role].includes(permission);
}
