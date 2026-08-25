import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconCircleCheck } from '@tabler/icons-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/endpoints';
import { errorMessage } from '../shared/errors';
import { useAuth } from './AuthProvider';

function emailValidation(value: string) {
  return /^\S+@\S+\.\S+$/.test(value.trim()) ? null : 'Enter a valid email address';
}

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: emailValidation,
      password: (value) => (!value ? 'Enter your password' : null),
    },
  });

  return (
    <Stack gap="lg">
      <div>
        <Text className="eyebrow">WELCOME BACK</Text>
        <Title order={2}>Sign in to your console</Title>
        <Text c="dimmed" mt={6}>
          Your live monitoring workspace is ready.
        </Text>
      </div>
      {error && <Alert color="red">{error}</Alert>}
      <form
        onSubmit={form.onSubmit(async (values) => {
          setError(null);
          try {
            await auth.login(values.email.trim(), values.password);
            const from = (location.state as { from?: string } | null)?.from;
            void navigate(from ?? '/app', { replace: true });
          } catch (caught) {
            setError(errorMessage(caught));
          }
        })}
      >
        <Stack>
          <TextInput
            label="Email"
            type="email"
            autoComplete="email"
            required
            {...form.getInputProps('email')}
          />
          <PasswordInput
            label="Password"
            autoComplete="current-password"
            required
            {...form.getInputProps('password')}
          />
          <Group justify="space-between">
            <Checkbox
              label="Remember this browser"
              disabled
              description="Secure refresh is automatic"
            />
            <Anchor component={Link} to="/forgot-password" size="sm">
              Forgot password?
            </Anchor>
          </Group>
          <Button type="submit" size="md" loading={form.submitting} fullWidth>
            Sign in
          </Button>
        </Stack>
      </form>
      <Text ta="center" size="sm">
        New to WatchTrace?{' '}
        <Anchor component={Link} to="/signup" fw={600}>
          Create an account
        </Anchor>
      </Text>
    </Stack>
  );
}

export function SignupPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    initialValues: { email: '', password: '', confirm: '', authorized: false },
    validate: {
      email: emailValidation,
      password: (value) => (value.length < 12 ? 'Use at least 12 characters' : null),
      confirm: (value, values) => (value !== values.password ? 'Passwords do not match' : null),
      authorized: (value) => (value ? null : 'Confirm authorization to continue'),
    },
  });

  return (
    <Stack gap="lg">
      <div>
        <Text className="eyebrow">START MONITORING</Text>
        <Title order={2}>Create your account</Title>
        <Text c="dimmed" mt={6}>
          Set up your first production monitor in minutes.
        </Text>
      </div>
      {error && <Alert color="red">{error}</Alert>}
      <form
        onSubmit={form.onSubmit(async (values) => {
          setError(null);
          try {
            await auth.signup(values.email.trim(), values.password);
            void navigate('/app', { replace: true });
          } catch (caught) {
            setError(errorMessage(caught));
          }
        })}
      >
        <Stack>
          <TextInput
            label="Work email"
            type="email"
            autoComplete="email"
            required
            {...form.getInputProps('email')}
          />
          <PasswordInput
            label="Password"
            description="At least 12 characters"
            autoComplete="new-password"
            required
            {...form.getInputProps('password')}
          />
          <PasswordInput
            label="Confirm password"
            autoComplete="new-password"
            required
            {...form.getInputProps('confirm')}
          />
          <Checkbox
            label="I am authorized to monitor the targets I configure."
            {...form.getInputProps('authorized', { type: 'checkbox' })}
          />
          <Button type="submit" size="md" loading={form.submitting} fullWidth>
            Create account
          </Button>
        </Stack>
      </form>
      <Text ta="center" size="sm">
        Already have an account?{' '}
        <Anchor component={Link} to="/login" fw={600}>
          Sign in
        </Anchor>
      </Text>
    </Stack>
  );
}

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm({ initialValues: { email: '' }, validate: { email: emailValidation } });
  return (
    <Stack gap="lg">
      <div>
        <Text className="eyebrow">ACCOUNT RECOVERY</Text>
        <Title order={2}>Reset your password</Title>
        <Text c="dimmed" mt={6}>
          We’ll send instructions if the address belongs to an account.
        </Text>
      </div>
      {sent ? (
        <Alert color="teal" icon={<IconCircleCheck />} title="Check your inbox">
          If that account exists, a reset link is on its way. The link expires after one hour.
        </Alert>
      ) : (
        <form
          onSubmit={form.onSubmit(async ({ email }) => {
            setError(null);
            try {
              await authApi.forgotPassword(email.trim());
              setSent(true);
            } catch (caught) {
              setError(errorMessage(caught));
            }
          })}
        >
          <Stack>
            {error && <Alert color="red">{error}</Alert>}
            <TextInput
              label="Email"
              type="email"
              autoComplete="email"
              required
              {...form.getInputProps('email')}
            />
            <Button type="submit" loading={form.submitting}>
              Send reset instructions
            </Button>
          </Stack>
        </form>
      )}
    </Stack>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    initialValues: { password: '', confirm: '' },
    validate: {
      password: (value) => (value.length < 12 ? 'Use at least 12 characters' : null),
      confirm: (value, values) => (value !== values.password ? 'Passwords do not match' : null),
    },
  });
  const token = params.get('token') ?? '';
  return (
    <Stack gap="lg">
      <Title order={2}>Choose a new password</Title>
      {complete ? (
        <Alert color="teal" title="Password updated">
          All existing sessions were signed out.{' '}
          <Anchor component={Link} to="/login">
            Sign in
          </Anchor>
        </Alert>
      ) : (
        <form
          onSubmit={form.onSubmit(async ({ password }) => {
            if (!token)
              return setError('This reset link is missing its token. Request a new link.');
            try {
              await authApi.resetPassword(token, password);
              setComplete(true);
            } catch (caught) {
              setError(errorMessage(caught));
            }
          })}
        >
          <Stack>
            {error && <Alert color="red">{error}</Alert>}
            <PasswordInput label="New password" required {...form.getInputProps('password')} />
            <PasswordInput label="Confirm password" required {...form.getInputProps('confirm')} />
            <Button type="submit" loading={form.submitting}>
              Update password
            </Button>
          </Stack>
        </form>
      )}
    </Stack>
  );
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [state, setState] = useState<'idle' | 'working' | 'complete' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const token = params.get('token') ?? '';
  return (
    <Stack gap="lg">
      <Title order={2}>Verify your email</Title>
      {state === 'complete' ? (
        <Alert color="teal" icon={<IconCircleCheck />}>
          Your email is verified. You can return to WatchTrace.
        </Alert>
      ) : (
        <>
          <Text c="dimmed">
            Confirm this address to receive invitations and incident notifications.
          </Text>
          {state === 'error' && <Alert color="red">{message}</Alert>}
          <Button
            loading={state === 'working'}
            onClick={() => {
              if (!token) {
                setMessage('This verification link is missing its token.');
                setState('error');
                return;
              }
              setState('working');
              void authApi
                .verifyEmail(token)
                .then(() => setState('complete'))
                .catch((caught: unknown) => {
                  setMessage(errorMessage(caught));
                  setState('error');
                });
            }}
          >
            Verify email
          </Button>
        </>
      )}
    </Stack>
  );
}

export function AcceptInvitationPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  return (
    <Stack maw={500} mx="auto" mt="10vh">
      <Text className="eyebrow">TEAM INVITATION</Text>
      <Title order={1}>Join a WatchTrace organization</Title>
      <Text c="dimmed">
        Accepting adds your verified account with the role selected by the inviter.
      </Text>
      {error && <Alert color="red">{error}</Alert>}
      <Button
        onClick={() => {
          const token = params.get('token');
          if (!token) return setError('This invitation link is missing its token.');
          void authApi
            .acceptInvitation(token)
            .then(() => navigate('/app', { replace: true }))
            .catch((caught: unknown) => setError(errorMessage(caught)));
        }}
      >
        Accept invitation
      </Button>
    </Stack>
  );
}
