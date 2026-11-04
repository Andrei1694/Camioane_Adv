export default function Icon({ name, className = '' }: { name: 'arrow' | 'pin' | 'search' | 'close' | 'plus' | 'screen' | 'car' | 'fit' | 'warning' | 'reset' | 'check', className?: string }) {
  const paths = {
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    screen: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>,
    car: <><path d="m5 8 2-4h10l2 4 2 3v7H3v-7Zm-2 3h18M6 18v2m12-2v2M6 14h2m8 0h2" /></>,
    fit: <><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /><circle cx="12" cy="12" r="3" /></>,
    warning: <><path d="m12 3 10 18H2Zm0 5v5m0 3v1" /></>,
    reset: <><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  }
  return <svg className={`fleet-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
