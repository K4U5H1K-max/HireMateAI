import { type ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  /** Constrain content width */
  narrow?: boolean;
}

const PageContainer = ({ children, className, narrow = false }: PageContainerProps) => {
  return (
    <div
      className={cn(
        'container mx-auto px-4 sm:px-6 py-8 sm:py-12',
        narrow ? 'max-w-4xl' : 'max-w-6xl',
        className
      )}
    >
      {children}
    </div>
  );
};

export default PageContainer;
