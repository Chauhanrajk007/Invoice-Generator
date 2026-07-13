/**
 * tenant.js — Multi-Tenant Organization Management
 * 
 * Handles: create/switch orgs, manage members, role lookups.
 * All org data stored in Supabase with RLS for isolation.
 * Current org ID stored in localStorage for quick access.
 */

import { supabase, isSupabaseConfigured } from './supabase.js';
import { getCurrentUser } from './auth.js';

// ========== ORG CRUD ==========

/**
 * Create a new organization and make current user the owner.
 */
export async function createOrganization(name) {
  if (!isSupabaseConfigured()) return { data: null, error: { message: 'Not configured' } };

  const user = await getCurrentUser();
  if (!user) return { data: null, error: { message: 'Not authenticated' } };

  // Create org
  const { data: org, error } = await supabase
    .from('organizations')
    .insert({ name, created_by: user.id })
    .select()
    .single();

  if (error) return { data: null, error };

  // Add creator as owner
  await supabase.from('org_members').insert({
    org_id: org.id,
    user_id: user.id,
    role: 'owner',
  });

  // Create default settings
  await supabase.from('org_settings').insert({
    org_id: org.id,
    business_name: name,
  });

  return { data: org, error: null };
}

/**
 * Get all organizations the current user belongs to.
 */
export async function getUserOrganizations() {
  if (!isSupabaseConfigured()) return { data: [], error: null };

  const user = await getCurrentUser();
  if (!user) return { data: [], error: { message: 'Not authenticated' } };

  const { data: memberships, error } = await supabase
    .from('org_members')
    .select('org_id, role, organizations(id, name, created_at)')
    .eq('user_id', user.id);

  if (error) return { data: [], error };

  const orgs = (memberships || []).map(m => ({
    id: m.organizations.id,
    name: m.organizations.name,
    created_at: m.organizations.created_at,
    role: m.role,
  }));

  return { data: orgs, error: null };
}

// ========== CURRENT ORG ==========

/**
 * Get current org ID from localStorage.
 */
export function getCurrentOrgId() {
  return localStorage.getItem('invoiceflow_current_org') || null;
}

/**
 * Set current org ID.
 */
export function setCurrentOrgId(orgId) {
  if (orgId) {
    localStorage.setItem('invoiceflow_current_org', orgId);
  } else {
    localStorage.removeItem('invoiceflow_current_org');
  }
}

/**
 * Get full current org object.
 */
export async function getCurrentOrg() {
  const orgId = getCurrentOrgId();
  if (!orgId || !isSupabaseConfigured()) return null;

  const { data } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .single();

  return data || null;
}

// ========== MEMBERS ==========

/**
 * Get members of the current org (or specified org).
 */
export async function getOrgMembers(orgId) {
  const targetOrg = orgId || getCurrentOrgId();
  if (!targetOrg || !isSupabaseConfigured()) return { data: [], error: null };

  const { data, error } = await supabase
    .from('org_members')
    .select('id, user_id, role, invited_at')
    .eq('org_id', targetOrg);

  if (error) return { data: [], error };

  // Fetch user emails from auth.users via a workaround
  // Since we can't directly query auth.users, we store email in the membership
  // Alternative: use Supabase Edge Function or store email on invite
  const enriched = [];
  for (const member of (data || [])) {
    // Attempt to display a readable identifier: show truncated user_id as fallback
    const displayId = member.user_id
      ? member.user_id.substring(0, 8) + '…'
      : 'Unknown';
    enriched.push({
      ...member,
      email: displayId,
    });
  }

  return { data: enriched, error: null };
}

/**
 * Invite a user to the current org by looking up their user ID.
 * The user must already have a Supabase account.
 */
export async function addOrgMember(userId, role = 'member') {
  const orgId = getCurrentOrgId();
  if (!orgId || !isSupabaseConfigured()) return { data: null, error: { message: 'No org selected' } };

  const { data, error } = await supabase
    .from('org_members')
    .insert({ org_id: orgId, user_id: userId, role })
    .select()
    .single();

  return { data, error };
}

/**
 * Update a member's role.
 */
export async function updateMemberRole(memberId, newRole) {
  if (!isSupabaseConfigured()) return { error: { message: 'Not configured' } };

  const { error } = await supabase
    .from('org_members')
    .update({ role: newRole })
    .eq('id', memberId);

  return { error };
}

/**
 * Remove a member from the current org.
 */
export async function removeMember(memberId) {
  if (!isSupabaseConfigured()) return { error: { message: 'Not configured' } };

  const { error } = await supabase
    .from('org_members')
    .delete()
    .eq('id', memberId);

  return { error };
}

/**
 * Get the current user's role in the current org.
 */
export async function getCurrentUserRole() {
  const orgId = getCurrentOrgId();
  if (!orgId || !isSupabaseConfigured()) return null;

  const user = await getCurrentUser();
  if (!user) return null;

  const { data } = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single();

  return data?.role || null;
}

/**
 * Update organization name.
 */
export async function updateOrganization(orgId, updates) {
  if (!isSupabaseConfigured()) return { error: { message: 'Not configured' } };

  const { error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', orgId);

  return { error };
}
