import { Eye, EyeOff } from 'lucide-react';

// Shared auth input — labels visible, calm neutral surface, brand focus ring.
export default function AuthField({
  label,
  icon: Icon,
  right,
  hint,
  className = '',
  ...inputProps
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-gray-500">{label}</span>
      <div className="relative">
        {Icon && (
          <Icon
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
        )}
        <input
          {...inputProps}
          className={`h-12 w-full rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-800 placeholder:text-gray-400 outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:opacity-60 ${Icon ? 'pl-10' : 'pl-3.5'} ${right ? 'pr-11' : 'pr-3.5'} ${className}`}
        />
        {right && <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{right}</div>}
      </div>
      {hint && <span className="mt-1.5 block text-[11px] font-semibold leading-relaxed text-gray-400">{hint}</span>}
    </label>
  );
}

export const PasswordToggle = ({ show, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={show ? 'Password hide karein' : 'Password dikhayein'}
    className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
  >
    {show ? <EyeOff size={17} /> : <Eye size={17} />}
  </button>
);
