/**
 * rbac.js — Role-Based Access Control
 * 
 * 4 roles: owner > admin > member > viewer
 * Permission matrix controls both UI visibility and action execution.
 */

import { getCurrentUserRole } from './tenant.js';

// Role hierarchy (higher index = more power)
export const ROLES = {
  VIEWER: 'viewer',
  MEMBER: 'member',
  ADMIN: 'admin',
  OWNER: 'owner',
};

const ROLE_LEVEL = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

// Action constants
export const ACTIONS = {
  VIEW_INVOICES: 'view_invoices',
  CREATE_INVOICE: 'create_invoice',
  EDIT_INVOICE: 'edit_invoice',
  DELETE_INVOICE: 'delete_invoice',
  CHANGE_STATUS: 'change_status',
  DOWNLOAD_PRINT: 'download_print',
  SEND_EMAIL: 'send_email',
  MANAGE_SETTINGS: 'manage_settings',
  MANAGE_MEMBERS: 'manage_members',
  DELETE_ORG: 'delete_org',
};

// Permission matrix: minimum role required for each action
const PERMISSION_MAP = {
  [ACTIONS.VIEW_INVOICES]: 'viewer',
  [ACTIONS.DOWNLOAD_PRINT]: 'viewer',
  [ACTIONS.CREATE_INVOICE]: 'member',
  [ACTIONS.EDIT_INVOICE]: 'member',
  [ACTIONS.CHANGE_STATUS]: 'member',
  [ACTIONS.SEND_EMAIL]: 'member',
  [ACTIONS.DELETE_INVOICE]: 'admin',
  [ACTIONS.MANAGE_SETTINGS]: 'admin',
  [ACTIONS.MANAGE_MEMBERS]: 'admin',
  [ACTIONS.DELETE_ORG]: 'owner',
};

// Cache for current role to avoid repeated DB queries
let _cachedRole = null;
let _cacheExpiry = 0;
const CACHE_TTL = 30000; // 30 seconds

/**
 * Get current user role (with caching).
 */
async function getRole() {
  const now = Date.now();
  if (_cachedRole && now < _cacheExpiry) return _cachedRole;

  _cachedRole = await getCurrentUserRole();
  _cacheExpiry = now + CACHE_TTL;
  return _cachedRole;
}

/**
 * Clear the role cache (call on org switch or role change).
 */
export function clearRoleCache() {
  _cachedRole = null;
  _cacheExpiry = 0;
}

/**
 * Check if current user has permission for an action.
 */
export async function hasPermission(action) {
  const role = await getRole();
  if (!role) return false;

  const requiredRole = PERMISSION_MAP[action];
  if (!requiredRole) return false;

  return ROLE_LEVEL[role] >= ROLE_LEVEL[requiredRole];
}

/**
 * Check permission and show toast if denied.
 * Returns true if allowed, false if denied.
 */
export async function requirePermission(action) {
  const allowed = await hasPermission(action);
  if (!allowed) {
    // Dynamic import to avoid circular dependency
    const { showToast } = await import('../main.js');
    showToast('You don\'t have permission for this action.', 'error');
  }
  return allowed;
}

/**
 * Synchronous permission check using cached role.
 * Use for UI visibility (show/hide buttons).
 * Returns true if we don't know the role yet (optimistic).
 */
export function canShow(action) {
  if (!_cachedRole) return true; // Optimistic: show until we know
  const requiredRole = PERMISSION_MAP[action];
  if (!requiredRole) return false;
  return ROLE_LEVEL[_cachedRole] >= ROLE_LEVEL[requiredRole];
}

/**
 * Get current cached role string.
 */
export function getCachedRole() {
  return _cachedRole;
}

/**
 * Pre-warm the role cache. Call on app init and org switch.
 */
export async function warmRoleCache() {
  _cachedRole = await getCurrentUserRole();
  _cacheExpiry = Date.now() + CACHE_TTL;
  return _cachedRole;
}

/**
 * Get human-readable role label.
 */
export function getRoleLabel(role) {
  const labels = {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
    viewer: 'Viewer',
  };
  return labels[role] || 'Unknown';
}

/**
 * Get role badge color class.
 */
export function getRoleBadgeClass(role) {
  const classes = {
    owner: 'badge-paid',
    admin: 'badge-pending',
    member: 'badge-draft',
    viewer: 'badge-draft',
  };
  return classes[role] || 'badge-draft';
}
