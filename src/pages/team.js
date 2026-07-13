/**
 * team.js — Team Management: list members, invite, change roles, remove
 */

import { getOrgMembers, addOrgMember, updateMemberRole, removeMember, getCurrentOrg } from '../utils/tenant.js';
import { getCurrentUser } from '../utils/auth.js';
import { hasPermission, ACTIONS, getRoleLabel, getRoleBadgeClass } from '../utils/rbac.js';
import { showToast, navigateTo, showConfirm } from '../main.js';

export async function render(container) {
  // Permission gate — only admin/owner can view
  const canManage = await hasPermission(ACTIONS.MANAGE_MEMBERS);
  if (!canManage) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
        <h3 class="empty-state-title">Access Denied</h3>
        <p class="empty-state-desc">You don't have permission to manage team members.</p>
        <button class="btn btn-primary" id="backDashBtn">Back to Dashboard</button>
      </div>
    `;
    const backBtn = container.querySelector('#backDashBtn');
    if (backBtn) backBtn.addEventListener('click', () => navigateTo('dashboard'));
    return;
  }

  const currentUser = await getCurrentUser();
  const currentOrg = await getCurrentOrg();
  const orgName = currentOrg ? currentOrg.name : 'Your Organization';

  // Fetch members
  const { data: members, error } = await getOrgMembers();
  if (error) {
    showToast('Failed to load team members.', 'error');
  }

  const memberList = members || [];

  // Sort: owner first, then admin, member, viewer
  const roleOrder = { owner: 0, admin: 1, member: 2, viewer: 3 };
  memberList.sort((a, b) => (roleOrder[a.role] ?? 4) - (roleOrder[b.role] ?? 4));

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Team Management</h1>
        <p class="page-header-subtitle">${escapeHtml(orgName)}</p>
      </div>
    </div>

    <!-- Invite Member -->
    <div class="card section-gap">
      <div class="card-header">
        <h3 class="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          Invite Member
        </h3>
      </div>
      <div class="form-row form-row-3 section-gap">
        <div class="form-group">
          <label class="form-label">User ID</label>
          <input type="text" class="form-input" id="inviteUserId" placeholder="Enter user ID (UUID)" />
        </div>
        <div class="form-group">
          <label class="form-label">Role</label>
          <select class="form-select" id="inviteRole">
            <option value="viewer">Viewer</option>
            <option value="member" selected>Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div class="form-group" style="display: flex; align-items: flex-end;">
          <button class="btn btn-primary" id="inviteBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
            Invite
          </button>
        </div>
      </div>
    </div>

    <!-- Members Table -->
    <div class="card section-gap">
      <div class="card-header">
        <h3 class="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
          </svg>
          Members (${memberList.length})
        </h3>
      </div>
      ${memberList.length === 0 ? `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="8.5" cy="7" r="4"/>
          </svg>
          <h3 class="empty-state-title">No members found</h3>
          <p class="empty-state-desc">Invite someone to your organization using the form above.</p>
        </div>
      ` : `
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Joined</th>
                <th class="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${memberList.map(member => {
                const isCurrentUser = currentUser && member.user_id === currentUser.id;
                const isOwner = member.role === 'owner';
                const rowClass = isCurrentUser ? ' class="team-row-highlight"' : '';
                return `
                  <tr${rowClass}>
                    <td>
                      <div class="team-user-cell">
                        <span class="fw-600">${escapeHtml(member.user_id)}</span>
                        ${isCurrentUser ? '<span class="badge badge-draft" style="font-size: 0.65rem; margin-left: 6px;">You</span>' : ''}
                      </div>
                    </td>
                    <td>
                      <span class="badge ${getRoleBadgeClass(member.role)}">${getRoleLabel(member.role)}</span>
                    </td>
                    <td>${formatJoinedDate(member.invited_at)}</td>
                    <td class="text-center">
                      <div class="team-actions">
                        ${isOwner ? `
                          <span class="team-owner-label">—</span>
                        ` : `
                          <select class="form-select form-select-sm team-role-select" data-member-id="${escAttr(member.id)}" data-current-role="${escAttr(member.role)}">
                            <option value="viewer"${member.role === 'viewer' ? ' selected' : ''}>Viewer</option>
                            <option value="member"${member.role === 'member' ? ' selected' : ''}>Member</option>
                            <option value="admin"${member.role === 'admin' ? ' selected' : ''}>Admin</option>
                          </select>
                          <button class="btn btn-danger btn-sm team-remove-btn" data-member-id="${escAttr(member.id)}" data-user-id="${escAttr(member.user_id)}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                            </svg>
                            Remove
                          </button>
                        `}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>

    <style>
      .team-row-highlight {
        background: var(--primary-light, rgba(99, 102, 241, 0.06)) !important;
      }
      .team-user-cell {
        display: flex;
        align-items: center;
        gap: 4px;
        word-break: break-all;
      }
      .team-actions {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .team-owner-label {
        color: var(--text-secondary, #64748b);
        font-size: 0.85rem;
      }
      .form-select-sm {
        padding: 4px 8px;
        font-size: 0.8rem;
        min-width: 100px;
      }
      .team-role-select {
        height: 32px;
      }
      .team-remove-btn {
        white-space: nowrap;
      }
    </style>
  `;

  // ========== Event Listeners ==========

  // Invite button
  const inviteBtn = container.querySelector('#inviteBtn');
  if (inviteBtn) {
    inviteBtn.addEventListener('click', async () => {
      const userId = container.querySelector('#inviteUserId').value.trim();
      const role = container.querySelector('#inviteRole').value;

      if (!userId) {
        showToast('Please enter a user ID.', 'error');
        return;
      }

      inviteBtn.disabled = true;
      inviteBtn.textContent = 'Inviting…';

      try {
        const { data, error } = await addOrgMember(userId, role);
        if (error) {
          showToast(`Failed to invite: ${error.message || 'Unknown error'}`, 'error');
        } else {
          showToast(`Member invited successfully as ${getRoleLabel(role)}.`, 'success');
          // Re-render the page to show updated list
          await render(container);
        }
      } catch (err) {
        showToast('An unexpected error occurred.', 'error');
        console.error('[team] invite error:', err);
      } finally {
        inviteBtn.disabled = false;
        inviteBtn.textContent = 'Invite';
      }
    });
  }

  // Role change dropdowns
  container.querySelectorAll('.team-role-select').forEach(select => {
    select.addEventListener('change', async (e) => {
      const memberId = e.target.getAttribute('data-member-id');
      const previousRole = e.target.getAttribute('data-current-role');
      const newRole = e.target.value;

      if (newRole === previousRole) return;

      const confirmed = await showConfirm(
        'Change Role',
        `Are you sure you want to change this member's role from ${getRoleLabel(previousRole)} to ${getRoleLabel(newRole)}?`
      );

      if (!confirmed) {
        e.target.value = previousRole;
        return;
      }

      e.target.disabled = true;
      try {
        const { error } = await updateMemberRole(memberId, newRole);
        if (error) {
          showToast(`Failed to update role: ${error.message || 'Unknown error'}`, 'error');
          e.target.value = previousRole;
        } else {
          showToast(`Role updated to ${getRoleLabel(newRole)}.`, 'success');
          // Re-render to reflect changes
          await render(container);
        }
      } catch (err) {
        showToast('An unexpected error occurred.', 'error');
        e.target.value = previousRole;
        console.error('[team] role change error:', err);
      } finally {
        e.target.disabled = false;
      }
    });
  });

  // Remove buttons
  container.querySelectorAll('.team-remove-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const memberId = btn.getAttribute('data-member-id');
      const userId = btn.getAttribute('data-user-id');

      const confirmed = await showConfirm(
        'Remove Member',
        `Are you sure you want to remove this member (${escapeHtml(userId)}) from the organization? This action cannot be undone.`
      );

      if (!confirmed) return;

      btn.disabled = true;
      btn.textContent = 'Removing…';

      try {
        const { error } = await removeMember(memberId);
        if (error) {
          showToast(`Failed to remove member: ${error.message || 'Unknown error'}`, 'error');
        } else {
          showToast('Member removed successfully.', 'success');
          // Re-render the page
          await render(container);
        }
      } catch (err) {
        showToast('An unexpected error occurred.', 'error');
        console.error('[team] remove error:', err);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Remove';
      }
    });
  });
}

// ========== Helpers ==========

function formatJoinedDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function escAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
