import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, MapPin, DollarSign, Users, ArrowRight, Search } from 'lucide-react';
import { getEmployerJobsAvailable } from '../utils/candidateStore';
import type { JobPosting } from '../types/employer';
import ElectricBackground from '../components/ElectricBackground';
import PageContainer from '../components/layout/PageContainer';
import { Button, Card, Badge } from '../components/ui';

const CandidateJobsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<JobPosting[]>([]);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('');

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const availableJobs = await getEmployerJobsAvailable();
        setJobs(availableJobs);
        setFilteredJobs(availableJobs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load jobs');
      } finally {
        setLoading(false);
      }
    };

    loadJobs();
  }, []);

  useEffect(() => {
    let filtered = jobs;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (job) =>
          job.positionTitle.toLowerCase().includes(query) ||
          job.companyName.toLowerCase().includes(query) ||
          job.location.toLowerCase().includes(query) ||
          job.jobDescription.toLowerCase().includes(query)
      );
    }

    if (selectedRole) {
      filtered = filtered.filter((job) => job.positionTitle === selectedRole);
    }

    setFilteredJobs(filtered);
  }, [searchQuery, selectedRole, jobs]);

  const uniqueRoles = Array.from(new Set(jobs.map((job) => job.positionTitle)));

  const handleApply = (job: JobPosting) => {
    navigate('/job-application', { state: { job } });
  };

  if (loading) {
    return (
      <div className="relative flex-1 min-h-screen flex items-center justify-center">
        <ElectricBackground className="z-0 opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-b from-surface-raised/70 to-surface pointer-events-none z-[1]" />
        <div className="relative z-10 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4" />
          <p className="text-gray-400">Loading available jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-0">
      <ElectricBackground className="z-0 opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-b from-surface-raised/70 to-surface pointer-events-none z-[1]" />

      <PageContainer className="relative z-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-2">
            Find Your <span className="text-brand">Opportunity</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Browse and apply to interview-based job opportunities
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Search and Filter */}
        <Card variant="elevated" padding="lg" className="mb-8">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search by role, company, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-overlay border border-brand-border text-white px-4 py-3 pl-10 rounded-xl focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/50 transition-colors"
              />
            </div>

            {uniqueRoles.length > 0 && (
              <div>
                <label className="text-sm text-gray-400 block mb-2">Filter by Role</label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedRole === '' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setSelectedRole('')}
                  >
                    All Roles
                  </Button>
                  {uniqueRoles.map((role) => (
                    <Button
                      key={role}
                      variant={selectedRole === role ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => setSelectedRole(role)}
                    >
                      {role}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Jobs List */}
        {filteredJobs.length === 0 ? (
          <Card variant="ghost" padding="lg" className="text-center">
            <Briefcase className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg mb-2">No jobs found</p>
            <p className="text-gray-500 text-sm">
              Try adjusting your search filters or check back later
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredJobs.map((job) => (
              <Card
                key={job.id}
                variant="ghost"
                padding="md"
                className="hover:bg-brand-muted/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">{job.positionTitle}</h3>
                    <p className="text-brand font-medium mb-3">{job.companyName}</p>

                    <div className="flex flex-wrap gap-3 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {job.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-4 h-4" />
                        {job.workMode}
                      </span>
                      {job.minScoreForHumanInterview && (
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          Min Score: {job.minScoreForHumanInterview}/10
                        </span>
                      )}
                    </div>
                  </div>

                  <Badge variant="secondary" className="shrink-0">
                    {job.status === 'open' ? 'Open' : 'Closed'}
                  </Badge>
                </div>

                {job.jobDescription && (
                  <p className="text-gray-300 text-sm mb-4 line-clamp-2">
                    {job.jobDescription}
                  </p>
                )}

                {job.requirements && (
                  <div className="mb-4 p-3 bg-brand-muted/20 rounded-lg">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Requirements
                    </p>
                    <p className="text-sm text-gray-300 line-clamp-2">{job.requirements}</p>
                  </div>
                )}

                <Button
                  onClick={() => handleApply(job)}
                  className="w-full gap-2"
                  disabled={job.status !== 'open'}
                >
                  {job.status === 'open' ? (
                    <>
                      Apply Now
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    'Position Closed'
                  )}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </PageContainer>
    </div>
  );
};

export default CandidateJobsPage;
