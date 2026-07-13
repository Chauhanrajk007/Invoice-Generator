/**
 * auth.js — Supabase Authentication
 * 
 * Handles: sign up, sign in, sign out, session management.
 * All functions are async and return { data, error } pattern.
 */

import { supabase, isSupabaseConfigured } from './supabase.js';

/**
 * Register a new user.
 * Also creates their first organization automatically.
 */
export async function signUp(email, password, fullName, orgName) {
  if (!isSupabaseConfigured()) return { data: null, error: { message: 'Supabase not configured' } };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (error) return { data: null, error };

  // Create first organization for the user
  if (data.user) {
    const orgDisplayName = orgName || `${fullName}'s Organization`;
    const { error: orgError } = await supabase
      .from('organizations')
      .insert({ name: orgDisplayName, created_by: data.user.id });

    if (!orgError) {
      // Get the org we just created
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id')
        .eq('created_by', data.user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (orgs && orgs.length > 0) {
        // Add user as owner
        await supabase.from('org_members').insert({
          org_id: orgs[0].id,
          user_id: data.user.id,
          role: 'owner',
        });

        // Create default settings
        await supabase.from('org_settings').insert({
          org_id: orgs[0].id,
          business_name: orgDisplayName,
        });

        // Store current org
        localStorage.setItem('invoiceflow_current_org', orgs[0].id);
      }
    }
  }

  return { data, error: null };
}

/**
 * Sign in with email and password.
 */
export async function signIn(email, password) {
  if (!isSupabaseConfigured()) return { data: null, error: { message: 'Supabase not configured' } };

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (!error && data.user) {
    // Set current org if not set
    const currentOrg = localStorage.getItem('invoiceflow_current_org');
    if (!currentOrg) {
      const { data: memberships } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', data.user.id)
        .limit(1);

      if (memberships && memberships.length > 0) {
        localStorage.setItem('invoiceflow_current_org', memberships[0].org_id);
      }
    }
  }

  return { data, error };
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  if (!isSupabaseConfigured()) return { error: { message: 'Supabase not configured' } };

  localStorage.removeItem('invoiceflow_current_org');
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Get the currently authenticated user.
 */
export async function getCurrentUser() {
  if (!isSupabaseConfigured()) return null;

  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Get the current session.
 */
export async function getSession() {
  if (!isSupabaseConfigured()) return null;

  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Subscribe to auth state changes.
 * @param {Function} callback - (event, session) => void
 * @returns {object} subscription with unsubscribe()
 */
export function onAuthStateChange(callback) {
  if (!isSupabaseConfigured()) return { data: { subscription: { unsubscribe: () => {} } } };

  return supabase.auth.onAuthStateChange(callback);
}
