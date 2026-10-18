export default function BrandIcon({ className = 'brand-icon', size = 32 }: { className?: string; size?: number | string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Project Interceptor tactical UAV logo"
      role="img"
    >
      <rect width="128" height="128" rx="16" fill="#0B0B0B" />

      {/* Outer Reticle Crosshairs */}
      <line x1="64" y1="10" x2="64" y2="28" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="square" />
      <line x1="64" y1="100" x2="64" y2="118" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="square" />
      <line x1="10" y1="64" x2="28" y2="64" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="square" />
      <line x1="100" y1="64" x2="118" y2="64" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="square" />

      {/* Concentric Radar Rings */}
      <circle cx="64" cy="64" r="46" stroke="#FFFFFF" strokeWidth="1.8" />
      <circle cx="64" cy="64" r="43" stroke="#FFFFFF" strokeWidth="0.8" strokeOpacity="0.4" />
      <circle cx="64" cy="64" r="39.5" stroke="#00E5FF" strokeWidth="1.2" strokeOpacity="0.85" />
      <circle cx="64" cy="64" r="36" stroke="#F59E0B" strokeWidth="0.9" strokeDasharray="4 3" strokeOpacity="0.75" />
      <circle cx="64" cy="64" r="28" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.35" />

      {/* Center Reticle Fine Grid */}
      <line x1="64" y1="32" x2="64" y2="96" stroke="#FFFFFF" strokeWidth="1" strokeOpacity="0.5" />
      <line x1="32" y1="64" x2="96" y2="64" stroke="#FFFFFF" strokeWidth="1" strokeOpacity="0.5" />

      {/* Center Target Lock */}
      <circle cx="64" cy="64" r="4.5" stroke="#F59E0B" strokeWidth="1.5" fill="#0B0B0B" />
      <circle cx="64" cy="64" r="1.5" fill="#00E5FF" />

      {/* Stealth UAV Delta Wing Airframe */}
      <g id="uav-airframe">
        <path
          d="M 64 34 L 72 48 L 94 85 L 86 91 L 76 76 L 64 88 L 52 76 L 42 91 L 34 85 L 56 48 Z"
          fill="#FFFFFF"
          stroke="#0B0B0B"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M 64 34 L 56 48 L 42 91 L 52 76 L 64 88 Z"
          fill="#ECEFF1"
          opacity="0.95"
        />
        <path
          d="M 64 34 L 72 48 L 94 85 L 86 91 L 76 76 L 64 88 Z"
          fill="#FFFFFF"
        />
        <path
          d="M 64 37 L 68 50 L 64 74 L 60 50 Z"
          fill="#0B0B0B"
          opacity="0.88"
        />
        <line x1="64" y1="37" x2="64" y2="74" stroke="#00E5FF" strokeWidth="1" />
        <polygon points="61,72 64,68 67,72 64,78" fill="#F59E0B" opacity="0.9" />
      </g>
    </svg>
  );
}
