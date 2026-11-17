import React, { useId } from 'react';

interface SrvLogoProps {
  className?: string;
  size?: number;
  showMonogram?: boolean;
}

/**
 * Custom SRV Book + Brain geometric emblem for SmartEd by ST Group.
 */
export const SrvLogo: React.FC<SrvLogoProps> = ({
  className = '',
  size = 36,
  showMonogram = true,
}) => {
  const uid = useId().replace(/:/g, '');
  const brainGradId = `srv-brain-${uid}`;
  const bookGradId = `srv-book-${uid}`;
  const glowGradId = `srv-glow-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="SRV SmartEd Book and Brain Logo"
    >
      <defs>
        <linearGradient id={brainGradId} x1="16" y1="8" x2="48" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="55%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id={bookGradId} x1="10" y1="30" x2="54" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="50%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
        <radialGradient id={glowGradId} cx="32" cy="24" r="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#060913" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Subtle ambient core behind the brain */}
      <circle cx="32" cy="24" r="20" fill={`url(#${glowGradId})`} />

      {/* Left Brain Hemisphere */}
      <path
        d="M31.2 11.5C27.2 10.6 22.8 12.2 20.6 15.6C18.1 16.5 16.5 19 16.8 21.8C15.5 23.8 15.8 26.8 17.6 28.6C18.2 31.1 20.4 33 23.2 33.4H31.2V11.5Z"
        stroke={`url(#${brainGradId})`}
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="#0B1426"
        fillOpacity="0.65"
      />
      {/* Right Brain Hemisphere */}
      <path
        d="M32.8 11.5C36.8 10.6 41.2 12.2 43.4 15.6C45.9 16.5 47.5 19 47.2 21.8C48.5 23.8 48.2 26.8 46.4 28.6C45.8 31.1 43.6 33 40.8 33.4H32.8V11.5Z"
        stroke={`url(#${brainGradId})`}
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="#0B1426"
        fillOpacity="0.65"
      />

      {/* Neural Sulci & Synaptic Pathways */}
      <path
        d="M28 16.2C25.2 16.6 23.2 18.6 23.2 21.2M26.8 23.6C24.2 24 22 25.8 21.8 28.2M28.2 28.5H24.2"
        stroke="#7DD3FC"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M36 16.2C38.8 16.6 40.8 18.6 40.8 21.2M37.2 23.6C39.8 24 42 25.8 42.2 28.2M35.8 28.5H39.8"
        stroke="#67E8F9"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="23.2" cy="21.4" r="1.4" fill="#38BDF8" />
      <circle cx="28" cy="16.2" r="1.3" fill="#22D3EE" />
      <circle cx="40.8" cy="21.4" r="1.4" fill="#22D3EE" />
      <circle cx="36" cy="16.2" r="1.3" fill="#38BDF8" />

      {/* Open Book Pages */}
      <path
        d="M32 35.8C25.6 32.8 17.8 32.4 11 34.4V49.2C17.8 47.2 25.6 47.6 32 50.8C38.4 47.6 46.2 47.2 53 49.2V34.4C46.2 32.4 38.4 32.8 32 35.8Z"
        fill="#091224"
        stroke={`url(#${bookGradId})`}
        strokeWidth="2.1"
        strokeLinejoin="round"
      />
      {/* Central Book Spine */}
      <path
        d="M32 35.8V50.8"
        stroke="#7DD3FC"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Subtle Page Lines */}
      <path
        d="M15.5 38.8C19.8 37.8 24.4 38.1 28 39.4M15.5 43.3C19.8 42.3 24.4 42.6 28 43.9"
        stroke="#38BDF8"
        strokeOpacity="0.55"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M48.5 38.8C44.2 37.8 39.6 38.1 36 39.4M48.5 43.3C44.2 42.3 39.6 42.6 36 43.9"
        stroke="#22D3EE"
        strokeOpacity="0.55"
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      {/* Book Hardcover Base */}
      <path
        d="M8.5 51.6C16.2 49.8 24.4 50.4 32 53.2C39.6 50.4 47.8 49.8 55.5 51.6"
        stroke={`url(#${bookGradId})`}
        strokeWidth="1.9"
        strokeLinecap="round"
      />

      {/* SRV Monogram Plate */}
      {showMonogram && (
        <g>
          <rect
            x="21.5"
            y="53.6"
            width="21"
            height="8.4"
            rx="2.5"
            fill="#060913"
            stroke="#38BDF8"
            strokeOpacity="0.7"
            strokeWidth="1"
          />
          <text
            x="32"
            y="59.6"
            textAnchor="middle"
            fill="#E0F2FE"
            fontSize="6.4"
            fontWeight="700"
            letterSpacing="1.1"
            fontFamily="Outfit, Plus Jakarta Sans, sans-serif"
          >
            SRV
          </text>
        </g>
      )}
    </svg>
  );
};
