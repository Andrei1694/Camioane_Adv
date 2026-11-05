// The admin app's mark (BrandMark in frontend/src/components/AppShell.tsx): a car carrying a
// rooftop LED screen. The wheels are outlined in currentColor, so set `color` to the ground.
export default function BrandMark({ className = 'brand-mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="5" y="2" width="22" height="13" rx="2.5" fill="#12263a" />
      <rect x="7" y="4" width="18" height="9" rx="1.2" fill="#00c9e8" />
      <path d="M9 6.5h4v4H9zm5 0h4v4h-4zm5 0h4v4h-4zM11 15h2v3h-2zm8 0h2v3h-2z" fill="#12263a" />
      <path d="M3 26.5v-3.6c0-1.4 1-2.4 2.4-2.6l3-.4 3.1-3.3c.5-.5 1.1-.8 1.8-.8h6.6c.8 0 1.5.4 2 1l2.6 3.1 1.6.2c1.4.2 2.4 1.4 2.4 2.8v3.6z" fill="#12263a" />
      <path d="m10.4 20.2 2.4-2.6h3v2.6zm7.2-2.6h2.9l2.2 2.6h-5.1z" fill="#fff" />
      <rect x="4.6" y="22.6" width="3.2" height="1.4" rx=".7" fill="#00c9e8" />
      <circle cx="9.5" cy="26.5" r="3" fill="#12263a" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="22.5" cy="26.5" r="3" fill="#12263a" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
