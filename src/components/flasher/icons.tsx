type P = { className?: string };

export const CheckCircle = ({ className = "h-5 w-5" }: P) => (
  <svg viewBox="0 0 20 20" className={className} aria-hidden>
    <circle cx="10" cy="10" r="10" className="fill-green-500" />
    <path d="M6 10.2l2.6 2.6L14.2 7.2" className="stroke-neutral-950" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ErrorCircle = ({ className = "h-5 w-5" }: P) => (
  <svg viewBox="0 0 20 20" className={className} aria-hidden>
    <circle cx="10" cy="10" r="10" className="fill-red-500" />
    <path d="M7 7l6 6M13 7l-6 6" className="stroke-neutral-950" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

export const WaitCircle = ({ className = "h-5 w-5" }: P) => (
  <svg viewBox="0 0 20 20" className={className} aria-hidden>
    <circle cx="10" cy="10" r="10" className="fill-amber-400" />
    <path d="M10 5.5V10l3 2" className="stroke-neutral-950" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);

export const IdleCircle = ({ className = "h-5 w-5" }: P) => (
  <svg viewBox="0 0 20 20" className={className} aria-hidden>
    <circle cx="10" cy="10" r="8.5" className="fill-none stroke-neutral-600" strokeWidth="2" />
  </svg>
);

export const Spinner = ({ className = "h-5 w-5" }: P) => (
  <svg viewBox="0 0 20 20" className={`${className} animate-spin`} aria-hidden>
    <circle cx="10" cy="10" r="8" className="fill-none stroke-neutral-700" strokeWidth="2.5" />
    <path d="M10 2a8 8 0 018 8" className="fill-none stroke-blue-400" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export const Reflash = ({ className = "h-4 w-4" }: P) => (
  <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M16 10a6 6 0 01-10.4 4.1M4 10a6 6 0 0110.4-4.1" />
    <path d="M14.8 2.8v3.3h-3.3M5.2 17.2v-3.3h3.3" />
  </svg>
);

export const Bolt = ({ className = "h-4 w-4" }: P) => (
  <svg viewBox="0 0 20 20" className={className} fill="currentColor" aria-hidden>
    <path d="M11.3 1.5L3.5 11h5l-1 7.5L16.5 9h-5l-.2-7.5z" />
  </svg>
);

export const Upload = ({ className = "h-4 w-4" }: P) => (
  <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M10 13V3M6 7l4-4 4 4M3.5 13.5v2A1.5 1.5 0 005 17h10a1.5 1.5 0 001.5-1.5v-2" />
  </svg>
);
