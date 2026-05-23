import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, LogOut, Save } from 'lucide-react';
import PageContainer from '../components/layout/PageContainer';
import ElectricBackground from '../components/ElectricBackground';
import { Badge, Button, Card } from '../components/ui';
import {
  getEmployerProfile,
  onEmployerUserChanged,
  saveEmployerProfile,
  signOutEmployer,
} from '../utils/employerStore';

interface EmployerProfileForm {
  companyName: string;
  employerPosition: string;
  contactName: string;
  contactEmail: string;
  phoneNumber: string;
  website: string;
  companyDescription: string;
}

const EMPTY_FORM: EmployerProfileForm = {
  companyName: '',
  employerPosition: '',
  contactName: '',
  contactEmail: '',
  phoneNumber: '',
  website: '',
  companyDescription: '',
};

const EmployerProfilePage = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState<EmployerProfileForm>(EMPTY_FORM);

  useEffect(() => {
    const unsubscribe = onEmployerUserChanged(async (user) => {
      if (!user) {
        navigate('/employer-login');
        return;
      }

      setUserId(user.uid);
      setForm((current) => ({
        ...current,
        contactEmail: current.contactEmail || user.email || '',
      }));

      try {
        const profile = await getEmployerProfile(user.uid);
        if (profile) {
          setForm({
            companyName: profile.companyName,
            employerPosition: profile.employerPosition,
            contactName: profile.contactName,
            contactEmail: profile.contactEmail || user.email || '',
            phoneNumber: profile.phoneNumber,
            website: profile.website || '',
            companyDescription: profile.companyDescription || '',
          });
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load profile.');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const missingRequiredCount = useMemo(() => {
    const requiredValues = [
      form.companyName,
      form.employerPosition,
      form.contactName,
      form.contactEmail,
      form.phoneNumber,
    ];
    return requiredValues.filter((value) => !value.trim()).length;
  }, [form]);

  const setField = (field: keyof EmployerProfileForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await saveEmployerProfile(userId, form);
      setSuccess('Profile saved. You can now post and manage jobs.');
      navigate('/employer/jobs');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutEmployer();
      navigate('/employer-login');
    } catch {
      setError('Could not sign out. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <p className="text-gray-300">Loading employer profile...</p>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden">
      <ElectricBackground className="z-0 opacity-35" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(5,252,211,0.12),transparent_35%)] pointer-events-none z-[1]" />
      <PageContainer className="relative z-10 max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <Badge className="mb-3">Employer Setup</Badge>
            <h1 className="text-3xl font-bold text-white">Create your employer profile</h1>
            <p className="text-gray-400 mt-1">
              Complete this once to unlock job posting and applicant analytics.
            </p>
          </div>
          <Button variant="ghost" onClick={handleSignOut}>
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
        </div>

        <Card variant="elevated" padding="lg">
          <form onSubmit={handleSave} className="grid gap-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm text-gray-300">
                Company name *
                <input
                  className="mt-2 w-full bg-surface-overlay border border-brand-border text-white px-4 py-3 rounded-xl"
                  value={form.companyName}
                  onChange={(event) => setField('companyName', event.target.value)}
                  placeholder="HireMate AI Pvt. Ltd."
                  required
                />
              </label>

              <label className="text-sm text-gray-300">
                Your position *
                <input
                  className="mt-2 w-full bg-surface-overlay border border-brand-border text-white px-4 py-3 rounded-xl"
                  value={form.employerPosition}
                  onChange={(event) => setField('employerPosition', event.target.value)}
                  placeholder="Hiring Manager"
                  required
                />
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm text-gray-300">
                Contact name *
                <input
                  className="mt-2 w-full bg-surface-overlay border border-brand-border text-white px-4 py-3 rounded-xl"
                  value={form.contactName}
                  onChange={(event) => setField('contactName', event.target.value)}
                  placeholder="Aarav Singh"
                  required
                />
              </label>

              <label className="text-sm text-gray-300">
                Contact email *
                <input
                  className="mt-2 w-full bg-surface-overlay border border-brand-border text-white px-4 py-3 rounded-xl"
                  value={form.contactEmail}
                  onChange={(event) => setField('contactEmail', event.target.value)}
                  placeholder="hr@company.com"
                  type="email"
                  required
                />
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm text-gray-300">
                Phone number *
                <input
                  className="mt-2 w-full bg-surface-overlay border border-brand-border text-white px-4 py-3 rounded-xl"
                  value={form.phoneNumber}
                  onChange={(event) => setField('phoneNumber', event.target.value)}
                  placeholder="+91 98765 43210"
                  required
                />
              </label>

              <label className="text-sm text-gray-300">
                Website
                <input
                  className="mt-2 w-full bg-surface-overlay border border-brand-border text-white px-4 py-3 rounded-xl"
                  value={form.website}
                  onChange={(event) => setField('website', event.target.value)}
                  placeholder="https://company.com"
                />
              </label>
            </div>

            <label className="text-sm text-gray-300">
              Company description
              <textarea
                className="mt-2 w-full bg-surface-overlay border border-brand-border text-white px-4 py-3 rounded-xl min-h-28"
                value={form.companyDescription}
                onChange={(event) => setField('companyDescription', event.target.value)}
                placeholder="Short summary about culture, mission, and hiring focus."
              />
            </label>

            {error && (
              <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            {success && (
              <p className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
                {success}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-gray-400 inline-flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand" />
                {missingRequiredCount === 0
                  ? 'Profile is complete.'
                  : `${missingRequiredCount} required field(s) remaining.`}
              </p>
              <Button type="submit" loading={saving}>
                <Save className="w-4 h-4" />
                Save and Continue
              </Button>
            </div>
          </form>
        </Card>
      </PageContainer>
    </div>
  );
};

export default EmployerProfilePage;
