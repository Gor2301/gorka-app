// src/pages/UsersPage.tsx
// Slice 8.2. Lists org users, provides the invite-agent modal.
// Backend endpoints: GET /api/users, POST /api/users/invite-agent
// (see src/backend/routes/users.ts from Slice 8.3).

import { useEffect, useState } from 'react';
import {
  Button,
  ErrorBanner,
  Input,
  Label,
  Modal,
  Spinner,
} from '@/components/primitives';
import { usersService, UserRow } from '@/services/users.service';
import './UsersPage.css';

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const loadUsers = async () => {
    setListError('');
    setLoading(true);
    try {
      const rows = await usersService.listUsers();
      setUsers(rows);
    } catch (err) {
      setListError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const resetInviteForm = () => {
    setInviteEmail('');
    setInviteName('');
    setInvitePassword('');
    setInviteError('');
  };

  const handleCloseInvite = () => {
    if (inviting) return;
    setShowInvite(false);
    resetInviteForm();
  };

  const handleInvite = async () => {
    setInviteError('');

    if (!inviteEmail.trim()) {
      setInviteError('Email is required');
      return;
    }
    if (invitePassword.length < 8) {
      setInviteError('Temporary password must be at least 8 characters');
      return;
    }

    setInviting(true);
    try {
      await usersService.inviteAgent({
        email: inviteEmail.trim(),
        name: inviteName.trim() || undefined,
        tempPassword: invitePassword,
      });
      setShowInvite(false);
      resetInviteForm();
      await loadUsers();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : String(err));
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="users-page">
      <div className="users-header">
        <h1 className="users-title">Users</h1>
        <Button
          type="button"
          variant="primary"
          onClick={() => setShowInvite(true)}
        >
          Create Agent
        </Button>
      </div>

      {listError && <ErrorBanner message={listError} />}

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center' }}>
          <Spinner />
        </div>
      ) : users.length === 0 ? (
        <div className="users-empty">
          No users in this organization yet.
        </div>
      ) : (
        <table className="users-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.name || '—'}</td>
                <td>{u.role}</td>
                <td>{u.isActive ? 'Active' : 'Inactive'}</td>
                <td>
                  {u.lastLogin
                    ? new Date(u.lastLogin).toLocaleDateString()
                    : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="users-permissions-card">
        <h2 className="users-permissions-title">Permissions</h2>
        <p className="users-permissions-text">
          Permissions — Coming soon. In the current MVP, every Agent
          user in this organization has the same access to debtor data.
        </p>
      </div>

      <Modal
        isOpen={showInvite}
        onClose={handleCloseInvite}
        title="Create Agent User"
      >
        {inviteError && <ErrorBanner message={inviteError} />}

        <div className="form-field">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            disabled={inviting}
            autoFocus
          />
        </div>

        <div className="form-field">
          <Label htmlFor="invite-name">Name (optional)</Label>
          <Input
            id="invite-name"
            type="text"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            disabled={inviting}
          />
        </div>

        <div className="form-field">
          <Label htmlFor="invite-password">Temporary password</Label>
          <Input
            id="invite-password"
            type="password"
            value={invitePassword}
            onChange={(e) => setInvitePassword(e.target.value)}
            disabled={inviting}
            placeholder="At least 8 characters"
          />
        </div>

        <p className="users-modal-hint">
          Deliver this password to the user out of band. It is not
          emailed automatically. The user can change it after their
          first login.
        </p>

        <div className="users-modal-actions">
          <Button
            type="button"
            variant="ghost"
            onClick={handleCloseInvite}
            disabled={inviting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={inviting}
            onClick={handleInvite}
          >
            {inviting ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}