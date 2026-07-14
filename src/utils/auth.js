/**
 * auth.js — Supabase Authentication
 * 
 * Handles: sign up, sign in, sign out, session management.
 * All functions are async and return { data, error } pattern.
 */

import { supabase, isSupabaseConfigured } from './supabase.js';

/**
 * Wrap a Supabase call to catch network/DNS failures gracefully.
 */
async function safeSupabaseCall(fn) {
  try {
    return await fn();
  } catch (err) {
    const msg = String(err?.message || err || '');
    if (msg.includes('Failed to fetch') || msg.includes('ERR_NAME_NOT_RESOLVED') || msg.includes('NetworkError')) {
      return { data: null, error: { message: 'Cannot reach the server. Please check your internet connection and try again.' } };
    }
    throw err;
  }
}

/**
 * Map raw Supabase auth errors to friendly user-facing messages.
 */
function friendlyAuthError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  const code = err?.code || '';

  if (msg.includes('invalid login credentials') || code === 'invalid_credentials') {
    return 'Email or password is incorrect. If you just signed up, please confirm your email first.';
  }
  if (msg.includes('user already registered') || code === 'user_already_exists') {
    return 'An account with this email already exists. Please sign in instead.';
  }
  if (msg.includes('password should be at least') || msg.includes('password too short')) {
    return 'Password must be at least 6 characters long.';
  }
  if (msg.includes('valid email') || msg.includes('invalid email') || code === 'validation_error') {
    return 'Please enter a valid email address.';
  }
  if (msg.includes('email not confirmed') || msg.includes('email address has not been confirmed')) {
    return 'Please confirm your email before signing in. Check your inbox for the confirmation link.';
  }
  if (msg.includes('signup disabled')) {
    return 'Registration is currently disabled. Please contact support.';
  }
  if (msg.includes('rate limit')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  return err?.message || 'An unexpected error occurred. Please try again.';
}

/**
 * Register a new user.
 * Also creates their first organization automatically.
 */
export async function signUp(email, password, fullName, orgName) {
  if (!isSupabaseConfigured()) return { data: null, error: { message: 'Supabase not configured' } };

  const { data, error } = await safeSupabaseCall(() =>
    supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    })
  );

  if (error) return { data: null, error: { message: friendlyAuthError(error) } };

  // Create first organization for the user
  if (data.user) {
    const orgDisplayName = orgName || `${fullName}'s Organization`;

    try {
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
    } catch {
      // Org setup failed but user was created — non-critical
    }
  }

  return { data, error: null };
}

/**
 * Sign in with email and password.
 */
export async function signIn(email, password) {
  if (!isSupabaseConfigured()) return { data: null, error: { message: 'Supabase not configured' } };

  const { data, error } = await safeSupabaseCall(() =>
    supabase.auth.signInWithPassword({
      email,
      password,
    })
  );

  if (!error && data.user) {
    // Set current org if not set
    try {
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
    } catch {
      // Non-critical — org lookup failed but auth succeeded
    }
  }

  // Pass raw error info so caller can detect email-not-confirmed specifically
  if (error) {
    const rawMsg = String(error?.message || '').toLowerCase();
    if (rawMsg.includes('email not confirmed') || rawMsg.includes('email address has not been confirmed')) {
      return { data: null, error: { message: 'Email not confirmed', code: 'EMAIL_NOT_CONFIRMED' } };
    }
    return { data: null, error: { message: friendlyAuthError(error) } };
  }

  return { data, error: null };
}

/**
 * Resend email verification for a given email address.
 */
export async function resendVerification(email) {
  if (!isSupabaseConfigured()) return { error: { message: 'Supabase not configured' } };

  return safeSupabaseCall(() =>
    supabase.auth.resend({
      type: 'signup',
      email,
    })
  );
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  if (!isSupabaseConfigured()) return { error: { message: 'Supabase not configured' } };

  localStorage.removeItem('invoiceflow_current_org');
  try {
    const { error } = await supabase.auth.signOut();
    return { error };
  } catch {
    return { error: null };
  }
}

/**
 * Get the currently authenticated user.
 */
export async function getCurrentUser() {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

/**
 * Get the current session.
 */
export async function getSession() {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  } catch {
    return null;
  }
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
