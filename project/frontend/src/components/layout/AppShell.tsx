import { Link, Outlet, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { cn } from '../../lib/cn';
import StepProgress, { getStepIndex } from './StepProgress';

const HERO_ROUTES = ['/'];

const AppShell = () => {
  const { pathname } = useLocation();
  const isHero = HERO_ROUTES.includes(pathname);
  const stepIndex = getStepIndex(pathname);

  return (
    <div className="min-h-screen bg-surface text-white font-sans flex flex-col">
      <header
        className={cn(
          'sticky top-0 z-50 border-b border-white/5 backdrop-blur-xl',
          isHero ? 'bg-surface/40' : 'bg-surface-raised/80'
        )}
      >
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex h-14 sm:h-16 items-center justify-between gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 shrink-0 group"
              aria-label="HireMate AI home"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-muted border border-brand-border">
                <Sparkles className="w-4 h-4 text-brand" />
              </span>
              <span className="font-semibold text-white group-hover:text-brand transition-colors">
                HireMate <span className="text-brand">AI</span>
              </span>
            </Link>

            {!isHero && (
              <div className="hidden md:flex flex-1 max-w-xl mx-6">
                <StepProgress currentIndex={stepIndex} />
              </div>
            )}

            {!isHero && (
              <div className="text-xs text-gray-500 shrink-0 hidden sm:block">
                Step {stepIndex + 1} of 4
              </div>
            )}
          </div>

          {!isHero && (
            <div className="md:hidden pb-3">
              <StepProgress currentIndex={stepIndex} />
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col animate-fade-in">
        <Outlet />
      </main>
    </div>
  );
};

export default AppShell;
