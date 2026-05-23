import { useNavigate } from 'react-router-dom';
import ElectricBackground from '../components/ElectricBackground';
import { Button } from '../components/ui';

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="relative flex-1 min-h-[calc(100vh-3.5rem)] sm:min-h-[calc(100vh-4rem)] overflow-hidden flex items-center justify-center">
      <ElectricBackground className="z-0" />

      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-surface/20 via-transparent to-black/60 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-2xl animate-fade-in">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-4 drop-shadow-lg font-display">
          HireMate <span className="text-brand">AI</span>
        </h1>

        <p className="text-lg md:text-2xl text-brand mb-10 font-semibold">
          From Candidacy to Career
        </p>

        <Button size="lg" className="rounded-full px-10" onClick={() => navigate('/resume-analyzer')}>
          Get Started
        </Button>
      </div>
    </div>
  );
};

export default HomePage;
