import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface NeonDropdownOption<T extends string = string> {
  label: string;
  value: T;
}

export interface NeonDropdownProps<T extends string = string> {
  label?: string;
  showLabel?: boolean;
  value: T;
  onChange: (value: T) => void;
  options: NeonDropdownOption<T>[];
  ariaLabel?: string;
  className?: string;
}

const NeonDropdown = <T extends string,>({
  label,
  showLabel = true,
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: NeonDropdownProps<T>) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value]
  );
  const selectedLabel = selectedOption?.label ?? String(value ?? '');

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
    <div ref={containerRef} className={cn('relative space-y-2', className)}>
      {showLabel && label ? <label className="text-white font-medium text-sm block">{label}</label> : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? label ?? selectedLabel ?? 'Dropdown'}
        className={cn(
          'w-full flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all duration-300',
          'bg-[#060b14]/95 backdrop-blur-xl text-white shadow-[0_0_0_1px_rgba(5,252,211,0.08),0_18px_40px_rgba(0,0,0,0.45)]',
          'border-brand-border/40 hover:border-brand/60 hover:shadow-[0_0_0_1px_rgba(5,252,211,0.22),0_0_24px_rgba(5,252,211,0.12)]',
          'focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand'
        )}
      >
        <span className="min-w-0 flex-1">
          {showLabel && label ? (
            <span className="block text-[0.72rem] uppercase tracking-[0.24em] text-gray-400 mb-1">
              {label}
            </span>
          ) : null}
          <span className="block truncate text-sm font-medium text-white">{selectedLabel || 'Select an option'}</span>
        </span>
        <ChevronDown
          className={cn('w-4 h-4 shrink-0 text-brand transition-transform duration-300', open && 'rotate-180')}
        />
      </button>

      {open ? (
        <div
          className="absolute left-0 right-0 z-[70] mt-3 overflow-hidden rounded-2xl border border-[#0f766e]/45 shadow-[0_16px_36px_rgba(0,0,0,0.72)] animate-fadeIn"
          style={{ backgroundColor: '#050505', isolation: 'isolate' }}
        >
          <div
            role="listbox"
            aria-label={ariaLabel ?? label}
            className="max-h-72 overflow-y-auto custom-scrollbar py-2"
            style={{ backgroundColor: '#050505', isolation: 'isolate' }}
          >
            {options.map((option) => {
              const active = option.value === value;

              return (
                <button
                  key={`${option.value}-${option.label}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-medium transition-colors duration-200 border-b border-white/5 last:border-b-0',
                    'hover:bg-cyan-400/12',
                    active ? 'bg-cyan-400/14 border-l-2 border-l-brand' : 'bg-transparent'
                  )}
                  style={{
                    color: '#ffffff',
                    opacity: 1,
                    minHeight: '46px',
                    backgroundColor: active ? 'rgba(5, 252, 211, 0.14)' : 'transparent',
                    mixBlendMode: 'normal',
                  }}
                >
                  <span
                    className="truncate"
                    style={{ color: '#ffffff', opacity: 1, fontWeight: 500, lineHeight: 1.25 }}
                  >
                    {option.label}
                  </span>
                  {active ? <Check className="w-4 h-4 shrink-0 text-brand" aria-hidden style={{ opacity: 1 }} /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default NeonDropdown;