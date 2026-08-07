import { supabase } from './supabaseClient'

/**
 * Client-side mirror of the `roles` catalog ordering (owner > admin >
 * worker), used only to decide what the UI shows. The real authorization
 * boundary is Postgres RLS (has_minimum_role/has_role/has_application_access)
 * on the database side, evaluated against the same user_application_roles
 * rows this ordering is derived from -- nothing here can grant access the
 * database wouldn't also grant.
 */
export const ROLE_LEVELS = { owner: 30, admin: 20, worker: 10 }

/**
 * Fetches every application + role grant the current authenticated user
 * holds, across every application in this Supabase project, in one call.
 * Backed by `my_permissions()` (SECURITY DEFINER, scoped to auth.uid() --
 * a user can only ever see their own grants).
 */
export async function fetchMyPermissions() {
  const { data, error } = await supabase.rpc('my_permissions')
  if (error) throw error
  return data || []
}

/** Team list for an application -- owner/platform-admin only (enforced in SQL). */
export async function fetchApplicationMembers(appSlug) {
  const { data, error } = await supabase.rpc('application_members', { p_application_slug: appSlug })
  if (error) throw error
  return data || []
}

/** Grants a role to a user by email -- owner/platform-admin only (enforced in SQL). */
export async function grantRoleByEmail(email, appSlug, roleSlug) {
  const { error } = await supabase.rpc('grant_application_role_by_email', {
    p_email: email,
    p_application_slug: appSlug,
    p_role_slug: roleSlug,
  })
  if (error) throw error
}

/** Revokes a user's role on an application -- owner/platform-admin only (enforced in SQL). */
export async function revokeRole(userId, appSlug) {
  const { error } = await supabase.rpc('revoke_application_role', {
    p_user_id: userId,
    p_application_slug: appSlug,
  })
  if (error) throw error
}
