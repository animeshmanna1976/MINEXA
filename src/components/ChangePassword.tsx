import { useState, type FormEvent } from 'react';

const API_URL = 'http://localhost:3000/api/v1';

type ChangePasswordProps = {
  onPasswordChanged: () => void;
};

export default function ChangePassword({
  onPasswordChanged,
}: ChangePasswordProps) {
  const [currentPassword, setCurrentPassword] =
    useState('');

  const [newPassword, setNewPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (
    e: FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();

    setError('');
    setSuccess('');

    // Basic validation
    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }

    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(
        'New password and confirm password do not match.',
      );
      return;
    }

    if (newPassword.length < 8) {
      setError(
        'New password must contain at least 8 characters.',
      );
      return;
    }

    if (currentPassword === newPassword) {
      setError(
        'New password must be different from your current password.',
      );
      return;
    }

    try {
      setLoading(true);

      // IMPORTANT:
      // Your application stores the JWT as minexa_token.
      const token =
        localStorage.getItem('minexa_token');

      if (!token) {
        setError(
          'Your session has expired. Please log in again.',
        );
        return;
      }

      const response = await fetch(
        `${API_URL}/auth/change-password`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            currentPassword,
            newPassword,
          }),
        },
      );

      const data =
        await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          data?.message ??
            'Failed to change password.',
        );
        return;
      }

      // Update stored user information
      const userString =
        localStorage.getItem('minexa_user');

      if (userString) {
        try {
          const user = JSON.parse(userString);

          user.mustChangePassword = false;

          localStorage.setItem(
            'minexa_user',
            JSON.stringify(user),
          );
        } catch (parseError) {
          console.error(
            'Failed to update local user data:',
            parseError,
          );
        }
      }

      setSuccess(
        'Password changed successfully.',
      );

      // Tell NeonovaPlatform that the password change
      // has completed so it can open the dashboard.
      setTimeout(() => {
        onPasswordChanged();
      }, 700);
    } catch (error) {
      console.error(
        'Change password error:',
        error,
      );

      setError(
        'Unable to connect to server.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">

      <div className="w-full max-w-md">

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-xl">

          <h1 className="text-2xl font-bold text-foreground">
            Change Your Password
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            You must change your temporary password
            before continuing.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-4"
          >

            {/* Current Password */}
            <div>
              <label
                htmlFor="currentPassword"
                className="mb-2 block text-xs font-semibold text-foreground"
              >
                Current Password
              </label>

              <input
                id="currentPassword"
                type="password"
                placeholder="Enter temporary password"
                value={currentPassword}
                onChange={(e) =>
                  setCurrentPassword(
                    e.target.value,
                  )
                }
                disabled={loading}
                autoComplete="current-password"
                className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>

            {/* New Password */}
            <div>
              <label
                htmlFor="newPassword"
                className="mb-2 block text-xs font-semibold text-foreground"
              >
                New Password
              </label>

              <input
                id="newPassword"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) =>
                  setNewPassword(
                    e.target.value,
                  )
                }
                disabled={loading}
                autoComplete="new-password"
                className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-xs font-semibold text-foreground"
              >
                Confirm New Password
              </label>

              <input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(
                    e.target.value,
                  )
                }
                disabled={loading}
                autoComplete="new-password"
                className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-safety-danger/30 bg-safety-danger/10 p-3">
                <p className="text-sm text-safety-danger">
                  {error}
                </p>
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="rounded-lg border border-safety-success/30 bg-safety-success/10 p-3">
                <p className="text-sm text-safety-success">
                  {success}
                </p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary p-3 font-semibold text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? 'Changing...'
                : 'Change Password'}
            </button>

          </form>

        </div>

      </div>

    </div>
  );
}