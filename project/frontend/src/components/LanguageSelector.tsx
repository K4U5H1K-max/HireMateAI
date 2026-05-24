import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useLanguage, SUPPORTED_LANGUAGES } from '../contexts/LanguageContext';

interface LanguageSelectorProps {
  label?: string;
  showLabel?: boolean;
}

const LanguageSelector = ({ label = 'Select Interview Language', showLabel = true }: LanguageSelectorProps) => {
  const { selectedLanguage, setSelectedLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = useMemo(
    () => SUPPORTED_LANGUAGES.find((lang) => lang.code === selectedLanguage) ?? SUPPORTED_LANGUAGES[0],
    [selectedLanguage]
  );

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative space-y-2">
      {showLabel && label ? <label className="text-white font-medium text-sm block">{label}</label> : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className="w-full flex items-center justify-between gap-3 rounded-2xl border border-brand-border/40 bg-[#050505] px-4 py-3.5 text-left text-white shadow-[0_12px_30px_rgba(0,0,0,0.55)] transition-colors duration-200 hover:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/50"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[0.72rem] uppercase tracking-[0.24em] text-gray-400 mb-1">
            Interview Language
          </span>
          <span className="block truncate text-sm font-medium text-white">
            {selectedOption?.name ?? 'Select a language'}
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-brand transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div
          className="absolute left-0 right-0 z-50 mt-3 overflow-hidden rounded-2xl border border-brand-border/40 shadow-[0_16px_34px_rgba(0,0,0,0.65)]"
          style={{ backgroundColor: '#050505' }}
        >
          <div
            role="listbox"
            aria-label={label}
            className="max-h-72 overflow-y-auto custom-scrollbar py-1"
            style={{ backgroundColor: '#050505' }}
          >
            {SUPPORTED_LANGUAGES.map((lang) => {
              const active = lang.code === selectedLanguage;

              return (
                <button
                  key={lang.code}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setSelectedLanguage(lang.code);
                    setOpen(false);
                  }}
                  className="w-full flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3 text-left text-sm font-medium transition-colors duration-150 last:border-b-0 hover:bg-cyan-400/12"
                  style={{
                    minHeight: '46px',
                    color: '#ffffff',
                    opacity: 1,
                    backgroundColor: active ? 'rgba(5, 252, 211, 0.14)' : '#050505',
                  }}
                >
                  <span
                    className="truncate"
                    style={{
                      color: active ? '#eaffff' : '#ffffff',
                      opacity: 1,
                      fontWeight: 500,
                      lineHeight: 1.25,
                    }}
                  >
                    {lang.name}
                  </span>
                  {active ? <Check className="w-4 h-4 shrink-0 text-brand" aria-hidden /> : <span className="w-4 h-4 shrink-0" aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default LanguageSelector;
