import React, { useState } from 'react';
import {
  Shield,
  Users,
  Eye,
  HardHat,
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';

import { Button } from '@/components/ui/button';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { Input } from '@/components/ui/input';

import neonovaLogo from '@/assets/neonova-logo.png';
import heroBg from '@/assets/hero-bg.jpg';

import { loginUser } from '@/lib/api';

type AppRole =
  | 'worker'
  | 'supervisor'
  | 'dgms';

interface LoginPageProps {
  onLogin: (
    role: AppRole,
    mustChangePassword: boolean
  ) => void;
}

type RoleCardProps = {
  role: AppRole;
  title: string;
  description: string;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
  features: string[];
  selectedRole: AppRole | null;
  onSelect: (role: AppRole) => void;
};

const roleToBackendRole: Record<
  AppRole,
  string
> = {
  worker: 'FIELD_WORKER',
  supervisor: 'SUPERVISOR',
  dgms: 'DGMS',
};

const RoleCard: React.FC<RoleCardProps> = ({
  role,
  title,
  description,
  icon: Icon,
  colorClass,
  bgClass,
  features,
  selectedRole,
  onSelect,
}) => {
  const selected =
    selectedRole === role;

  return (
    <Card
      onClick={() => onSelect(role)}
      className={`cursor-pointer transition-all duration-300 ${
        selected
          ? `ring-2 ring-offset-2 ring-offset-background ${colorClass}`
          : 'hover:neonova-glow'
      }`}
    >
      <CardHeader className="text-center">
        <div
          className={`mx-auto mb-4 w-fit rounded-full p-4 ${bgClass}`}
        >
          <Icon
            className={`h-8 w-8 ${colorClass}`}
          />
        </div>

        <CardTitle className="text-xl font-bold">
          {title}
        </CardTitle>

        <CardDescription className="text-foreground-muted">
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ul className="mb-2 space-y-2 text-sm text-foreground-muted">
          {features.map((feature) => (
            <li
              key={feature}
              className="flex items-center gap-2"
            >
              <Shield
                className={`h-4 w-4 ${colorClass}`}
              />

              {feature}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

const LoginPage: React.FC<LoginPageProps> = ({
  onLogin,
}) => {
  const [selectedRole, setSelectedRole] =
    useState<AppRole | null>(null);

const [identifier, setIdentifier] =
  useState('');

  const [password, setPassword] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const handleSelectRole = (
    role: AppRole,
  ) => {
    setSelectedRole(role);
    setError('');
  };

  const handleBack = () => {
    setSelectedRole(null);
    setIdentifier('');
    setPassword('');
    setError('');
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError('');

    if (!selectedRole) {
      setError(
        'Please select your account type first.',
      );

      return;
    }

    if (!identifier.trim()) {
      setError(
        'Please enter your email address.',
      );

      return;
    }

    if (!password) {
      setError(
        'Please enter your password.',
      );

      return;
    }

    try {
      setLoading(true);

      const data = await loginUser(
        identifier.trim(),
        password,
      );

      const expectedRole =
        roleToBackendRole[selectedRole];

      /*
       * The role comes from the backend.
       * The selected card is only a UI hint.
       */
      if (data.user.role !== expectedRole) {
        throw new Error(
          `This account is registered as ${data.user.role}, not ${expectedRole}.`,
        );
      }

      // Save authentication data
      localStorage.setItem(
        'minexa_token',
        data.token,
      );

      localStorage.setItem(
        'minexa_user',
        JSON.stringify(data.user),
      );

if (data.user.mustChangePassword) {
  // Don't open the dashboard yet.
  // The parent app should show ChangePassword.
  onLogin(selectedRole, true);
  return;
}

onLogin(selectedRole, false);
    } catch (err) {
      console.error(
        'Login failed:',
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Login failed. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-4"
      style={{
        backgroundImage: `url(${heroBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

      {/* Floating elements */}
      <div className="animate-float absolute left-20 top-20 h-20 w-20 rounded-full bg-neonova-blue/20 blur-xl" />

      <div
        className="animate-float absolute bottom-32 right-32 h-32 w-32 rounded-full bg-safety-success/20 blur-xl"
        style={{
          animationDelay: '2s',
        }}
      />

      <div
        className="animate-float absolute left-10 top-1/2 h-16 w-16 rounded-full bg-safety-warning/20 blur-xl"
        style={{
          animationDelay: '4s',
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-5xl">
        {/* Header */}
        <div className="neonova-animate-fade-in mb-10 text-center">
          <div className="mb-5 flex justify-center">
            <img
              src={neonovaLogo}
              alt="NEONOVA Logo"
              className="h-20 w-20 neonova-animate-pulse-slow"
            />
          </div>

          <h1 className="text-5xl font-bold text-gradient md:text-6xl">
            NEONOVA
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-xl leading-relaxed text-foreground-muted">
            Smart Mine Safety &amp; Productivity
            Management Platform
          </p>

          <p className="mx-auto mt-2 max-w-xl text-foreground-muted">
            Digital transformation for coal mine
            operations with real-time safety
            monitoring, compliance tracking, and
            intelligent reporting.
          </p>
        </div>

        {!selectedRole ? (
          <>
            {/* Role selection */}
            <div className="mb-6 text-center">
              <p className="text-sm font-semibold text-foreground">
                Select your workspace
              </p>

              <p className="mt-1 text-xs text-foreground-muted">
                Your account permissions are
                verified by the MINEXA backend.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Worker */}
              <RoleCard
                role="worker"
                title="Mine Worker"
                description="Report hazards, complete tasks, and access safety protocols"
                icon={HardHat}
                colorClass="text-safety-success"
                bgClass="bg-safety-success/20"
                selectedRole={selectedRole}
                onSelect={
                  handleSelectRole
                }
                features={[
                  'Submit hazard reports',
                  'Track daily tasks',
                  'Access safety guidelines',
                ]}
              />

              {/* Supervisor */}
              <RoleCard
                role="supervisor"
                title="Supervisor"
                description="Validate reports, monitor teams, and manage shift operations"
                icon={Users}
                colorClass="text-safety-warning"
                bgClass="bg-safety-warning/20"
                selectedRole={selectedRole}
                onSelect={
                  handleSelectRole
                }
                features={[
                  'Validate worker reports',
                  'Monitor team activities',
                  'Generate shift logs',
                ]}
              />

              {/* DGMS */}
              <RoleCard
                role="dgms"
                title="DGMS Official"
                description="Monitor compliance, view analytics, and access comprehensive reports"
                icon={Eye}
                colorClass="text-safety-info"
                bgClass="bg-safety-info/20"
                selectedRole={selectedRole}
                onSelect={
                  handleSelectRole
                }
                features={[
                  'View analytics dashboard',
                  'Monitor compliance',
                  'Generate reports',
                ]}
              />
            </div>
          </>
        ) : (
          /* Login form */
          <div className="mx-auto max-w-md">
            <Card className="neonova-animate-slide-up">
              <CardHeader>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mb-3 w-fit gap-2 px-2"
                  onClick={handleBack}
                  disabled={loading}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Change workspace
                </Button>

                <CardTitle className="text-2xl">
                  Sign in to MINEXA
                </CardTitle>

                <CardDescription className="text-foreground-muted">
                  Sign in to your{' '}
                  <span className="font-semibold text-foreground">
                    {selectedRole ===
                    'worker'
                      ? 'Mine Worker'
                      : selectedRole ===
                          'supervisor'
                        ? 'Supervisor'
                        : 'DGMS Official'}
                  </span>{' '}
                  workspace.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form
                  onSubmit={
                    handleSubmit
                  }
                  className="space-y-5"
                >
                  {/* Error */}
                  {error && (
                    <div className="flex gap-3 rounded-lg border border-safety-danger/30 bg-safety-danger/10 p-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-safety-danger" />

                      <p className="text-xs leading-5 text-safety-danger">
                        {error}
                      </p>
                    </div>
                  )}

                  {/* User ID / Email */}
<div>
  <label
    htmlFor="login-identifier"
    className="mb-2 block text-sm font-semibold"
  >
    User ID or Email
  </label>

  <div className="relative">
    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

    <Input
      id="login-identifier"
      type="text"
      value={identifier}
      onChange={(event) =>
        setIdentifier(event.target.value)
      }
      placeholder="MW-TEST02 or you@minexa.com"
      autoComplete="username"
      disabled={loading}
      className="pl-10"
    />
  </div>
</div>

                  {/* Password */}
                  <div>
                    <label
                      htmlFor="login-password"
                      className="mb-2 block text-sm font-semibold"
                    >
                      Password
                    </label>

                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                      <Input
                        id="login-password"
                        type="password"
                        value={password}
                        onChange={(event) =>
                          setPassword(
                            event.target.value,
                          )
                        }
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        disabled={loading}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Submit */}
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign in securely'
                    )}
                  </Button>
                </form>

                <div className="mt-5 rounded-lg border border-border bg-background/40 p-3">
                  <p className="text-[10px] leading-5 text-muted-foreground">
                    Authentication is verified by
                    the MINEXA Express API. Your
                    workspace role is determined
                    by the account stored in the
                    backend.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="neonova-animate-fade-in mt-10 text-center">
          <p className="text-sm text-foreground-muted">
            Secure • Compliant • Real-time •
            Intelligent
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;