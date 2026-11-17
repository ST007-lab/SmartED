import React from 'react';

interface BlueprintGridDecorProps {
  className?: string;
}

/**
 * Subtle architectural coordinate grid & dot backdrop for focal containers.
 */
export const BlueprintGridDecor: React.FC<BlueprintGridDecorProps> = ({
  className = '',
}) => {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <svg
        className="h-full w-full opacity-[0.16]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="smarted-blueprint-grid"
            width="36"
            height="36"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 36 0 L 0 0 0 36"
              fill="none"
              stroke="rgba(56, 189, 248, 0.28)"
              strokeWidth="0.7"
            />
            <circle cx="0" cy="0" r="1.1" fill="rgba(34, 211, 238, 0.55)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#smarted-blueprint-grid)" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-br from-sky-500/[0.06] via-transparent to-cyan-500/[0.05]" />
    </div>
  );
};

interface CornerBracketFrameProps {
  className?: string;
}

/**
 * Precision hairline corner reticles for framed SmartEd workspaces.
 */
export const CornerBracketFrame: React.FC<CornerBracketFrameProps> = ({
  className = '',
}) => {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${className}`}
    >
      <span className="absolute top-2.5 left-2.5 h-3 w-3 border-t border-l border-sky-400/45" />
      <span className="absolute top-2.5 right-2.5 h-3 w-3 border-t border-r border-cyan-400/45" />
      <span className="absolute bottom-2.5 left-2.5 h-3 w-3 border-b border-l border-cyan-400/35" />
      <span className="absolute bottom-2.5 right-2.5 h-3 w-3 border-b border-r border-sky-400/35" />
    </div>
  );
};
