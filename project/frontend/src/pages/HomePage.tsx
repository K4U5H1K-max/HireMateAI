import { useNavigate } from 'react-router-dom';
import ElectricBackground from '../components/ElectricBackground';
import { Button } from '../components/ui';

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="relative flex-1 min-h-[calc(100vh-3.5rem)] sm:min-h-[calc(100vh-4rem)] overflow-hidden flex items-start justify-center pt-20 sm:pt-24 lg:pt-28">
      <ElectricBackground className="z-0" />

      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-surface/20 via-transparent to-black/60 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-2xl animate-fade-in">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-4 drop-shadow-lg font-display leading-tight">
          HireMate <span className="text-brand">AI</span>
        </h1>

        <p className="text-lg md:text-2xl text-brand mb-10 font-semibold">
          From Candidacy to Career
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center">
          <Button
            size="lg"
            className="rounded-full px-8"
            onClick={() => navigate('/candidate-login')}
          >
            I&apos;m a Candidate
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="rounded-full px-8"
            onClick={() => navigate('/employer-login')}
          >
            I want to Hire
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
