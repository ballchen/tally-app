import { SupabaseClient } from "@supabase/supabase-js"

export async function logActivity(
  supabase: SupabaseClient,
  params: {
    groupId: string
    action: string
    entityType: string
    entityId?: string
    changes?: Record<string, unknown>
  }
) {
  try {
    await supabase.rpc("log_activity", {
      p_group_id: params.groupId,
      p_action: params.action,
      p_entity_type: params.entityType,
      p_entity_id: params.entityId ?? null,
      p_changes: params.changes ?? {},
    })
  } catch (error) {
    // Logging should never block the main operation
    console.error("Failed to log activity:", error)
  }
}
