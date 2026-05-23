import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleAuthProvider, createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { Briefcase, Chrome, Sparkles } from 'lucide-react';
import formatFirebaseError from '../utils/formatFirebaseError';
import ElectricBackground from '../components/ElectricBackground';
import { Badge, Button, Card } from '../components/ui';
import { employerAuth, employerFirebaseReady } from '../config/employerFirebase';

const EmployerSignupPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleGoogleSignup = async () => {
    if (!employerFirebaseReady || !employerAuth) {
      setError('Set the employer Firebase environment variables before signing up.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(employerAuth, provider);
      setSuccess('Employer account created successfully with Google.');
      navigate('/employer/profile');
    } catch (signupError) {
      setError(formatFirebaseError(signupError));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!employerFirebaseReady || !employerAuth) {
      setError('Set the employer Firebase environment variables before signing up.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await createUserWithEmailAndPassword(employerAuth, email.trim(), password);
      setSuccess('Employer account created successfully.');
      setPassword('');
      navigate('/employer/profile');
    } catch (signupError) {
      setError(formatFirebaseError(signupError));
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'mt-2 w-full bg-surface-overlay border border-brand-border text-white px-4 py-3 rounded-xl focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/50 transition-colors';

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden">
      <ElectricBackground className="z-0 opacity-45" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(5,252,211,0.14),transparent_36%),linear-gradient(to_bottom,rgba(5,8,14,0.45),rgba(5,8,14,0.92))] pointer-events-none z-[1]" />

      <div className="relative z-10 flex items-center justify-center px-4 py-10 sm:py-14">
        <Card variant="elevated" padding="lg" className="w-full max-w-5xl overflow-hidden">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] items-stretch">
            <div className="rounded-2xl border border-brand-border/40 bg-gradient-to-br from-brand-muted/20 via-transparent to-transparent p-6 sm:p-8 flex flex-col justify-between min-h-[260px] order-1 lg:order-none">
              <div>
                <Badge className="mb-4">Employer Access</Badge>
                <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight">
                  Create your <span className="text-brand">Employer Account</span>
                </h1>
                <p className="text-gray-300 text-sm sm:text-base mt-4 max-w-md leading-relaxed">
                  Set up your hiring workspace to post roles, screen candidates, and manage your
                  recruitment flow.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-3 text-xs sm:text-sm text-gray-300">
                <span className="inline-flex items-center gap-2 rounded-full border border-brand-border/50 bg-surface-overlay/80 px-3 py-2">
                  <Briefcase className="w-4 h-4 text-brand" />
                  Hiring dashboard
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-brand-border/50 bg-surface-overlay/80 px-3 py-2">
                  <Sparkles className="w-4 h-4 text-brand" />
                  Talent automation
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-surface/70 backdrop-blur-xl p-6 sm:p-8">
              <p className="text-brand text-xs font-semibold uppercase tracking-[0.24em]">
                Create account
              </p>

              <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-white">
                Email, password, or Google
              </h2>

              <p className="text-gray-400 text-sm sm:text-base mt-2">
                This page uses the employer Firebase app only.
              </p>

              {!employerFirebaseReady && (
                <p className="mt-6 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
                  Configure the employer Firebase env vars in frontend/.env before testing signup.
                </p>
              )}

              {error && (
                <p className="mt-6 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              {success && (
                <p className="mt-6 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
                  {success}
                </p>
              )}

              <button
                type="button"
                onClick={handleGoogleSignup}
                disabled={!employerFirebaseReady || loading}
                className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-xl border border-brand-border/70 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-brand/10 hover:border-brand/60 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Chrome className="w-5 h-5 text-brand" />
                Sign up with Google
              </button>

              <div className="my-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-xs uppercase tracking-[0.22em] text-gray-500">or</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <label className="block text-sm font-medium text-white">
                  Email
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={inputClass}
                    placeholder="employer@company.com"
                  />
                </label>

                <label className="block text-sm font-medium text-white">
                  Password
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={inputClass}
                    placeholder="Create a password"
                  />
                </label>

                <Button
                  fullWidth
                  size="lg"
                  type="submit"
                  loading={loading}
                  disabled={!employerFirebaseReady}
                >
                  Create Employer Account
                </Button>
              </form>

              <div className="mt-6 flex items-center justify-between gap-4 text-sm text-gray-400">
                <span>Already have an account?</span>
                <button
                  type="button"
                  onClick={() => navigate('/employer-login')}
                  className="font-semibold text-brand transition-colors hover:text-brand-dim"
                >
                  Back to login
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default EmployerSignupPage;