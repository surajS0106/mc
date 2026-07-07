type IconProps = { className?: string };

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const PlusIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <path d="M8 3.5v9M3.5 8h9" />
  </svg>
);

export const HistoryIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <path d="M3 8a5 5 0 1 0 1.6-3.7" />
    <path d="M3 3v2.5h2.5" />
    <path d="M8 5v3l2 1.5" />
  </svg>
);

export const MoreIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <circle cx="3.5" cy="8" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="12.5" cy="8" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

export const CloseIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

export const ChevronDownIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <path d="M4 6l4 4 4-4" />
  </svg>
);

export const ChevronUpIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <path d="M4 10l4-4 4 4" />
  </svg>
);

export const SendIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" />
  </svg>
);

export const StopIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <rect x="4.5" y="4.5" width="7" height="7" rx="1" fill="currentColor" stroke="none" />
  </svg>
);

export const PaperclipIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <path d="M11.5 7l-4.2 4.2a2 2 0 1 1-2.8-2.8L9.5 3.4a2.8 2.8 0 0 1 4 4l-5.4 5.4" />
  </svg>
);

export const SparkleIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <path d="M8 2.5l1.4 3.1L12.5 7l-3.1 1.4L8 11.5 6.6 8.4 3.5 7l3.1-1.4z" />
  </svg>
);

export const GearIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <circle cx="8" cy="8" r="2" />
    <path d="M8 1.5v1.8M8 12.7v1.8M14.5 8h-1.8M3.3 8H1.5M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3M12.6 12.6l-1.3-1.3M4.7 4.7L3.4 3.4" />
  </svg>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <path d="M12.5 8H3.5M7 4l-3.5 4L7 12" />
  </svg>
);

export const EyeIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
    <circle cx="8" cy="8" r="1.8" />
  </svg>
);

export const EyeOffIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <path d="M1.5 8s2.5-4.5 6.5-4.5c1.4 0 2.6.5 3.6 1.2M14.5 8s-1 1.8-3 3.2M8 12.5c-4 0-6.5-4.5-6.5-4.5" />
    <path d="M2 2l12 12" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <path d="M3 8.5l3 3 7-7.5" />
  </svg>
);

export const ExternalLinkIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <path d="M9 3h4v4M13 3L7 9M11 9v3.5H3.5V5H7" />
  </svg>
);

export const SearchIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5l3 3" />
  </svg>
);

export const RobotIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <rect x="3" y="5.5" width="10" height="7" rx="1.5" />
    <path d="M8 3v2.5" />
    <circle cx="6" cy="9" r="0.7" fill="currentColor" stroke="none" />
    <circle cx="10" cy="9" r="0.7" fill="currentColor" stroke="none" />
  </svg>
);

export const CubeIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <path d="M8 2.5l5 2.5v6L8 13.5 3 11V5z" />
    <path d="M3 5l5 2.5L13 5M8 7.5v6" />
  </svg>
);

export const WrenchIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <path d="M11.5 2.5a3 3 0 0 0-3.7 3.7L2.5 11.5l2 2 5.3-5.3a3 3 0 0 0 3.7-3.7l-1.8 1.8-1.4-1.4z" />
  </svg>
);

export const BookIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <path d="M3 3.5h4a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 0 7 11.5H3z" />
    <path d="M13 3.5H9A1.5 1.5 0 0 0 7.5 5v8A1.5 1.5 0 0 1 9 11.5h4z" />
  </svg>
);

export const TerminalIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <rect x="2" y="3" width="12" height="10" rx="1.5" />
    <path d="M5 7l2 1.5L5 10M8.5 10.5h3" />
  </svg>
);

export const GlobeIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M2.5 8h11M8 2.5c2 2 2 9 0 11M8 2.5c-2 2-2 9 0 11" />
  </svg>
);

export const FlaskIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <path d="M6.5 2.5h3v3l3 6.5a1 1 0 0 1-.9 1.5H4.4a1 1 0 0 1-.9-1.5l3-6.5z" />
    <path d="M5 9h6" />
  </svg>
);

export const InfoIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M8 7v3.5M8 5v.1" />
  </svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <svg {...base} className={p.className}>
    <path d="M6 4l4 4-4 4" />
  </svg>
);

export const BrandMark = (p: IconProps) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={p.className}
  >
    <path d="M4 4.5l3.2 3.5L4 11.5" />
    <path d="M8.8 11.5h3.5" />
  </svg>
);
