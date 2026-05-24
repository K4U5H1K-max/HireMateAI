import { useLanguage, SUPPORTED_LANGUAGES } from '../contexts/LanguageContext';
import { Card } from './ui';

interface LanguageSelectorProps {
  label?: string;
  showLabel?: boolean;
}

const LanguageSelector = ({ label = 'Select Interview Language', showLabel = true }: LanguageSelectorProps) => {
  const { selectedLanguage, setSelectedLanguage } = useLanguage();

  return (
    <div className="space-y-2">
      {showLabel && <label className="text-white font-medium text-sm block">{label}</label>}
      <select
        value={selectedLanguage}
        onChange={(e) => setSelectedLanguage(e.target.value)}
        className="w-full bg-surface-overlay border border-brand-border text-white px-4 py-3 rounded-xl focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/50 transition-colors cursor-pointer"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSelector;
