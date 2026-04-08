type AppIconName =
  | "profile"
  | "day"
  | "week"
  | "family"
  | "reminders"
  | "groceries"
  | "fruits"
  | "vegetables"
  | "dry_items"
  | "spark"
  | "balance"
  | "reset";

type AppIconProps = {
  name: AppIconName;
  className?: string;
};

const iconPaths: Record<AppIconName, JSX.Element> = {
  profile: (
    <>
      <circle cx="12" cy="8.2" r="3.2" />
      <path d="M5.5 18.2c1.7-3 4-4.5 6.5-4.5s4.8 1.5 6.5 4.5" />
    </>
  ),
  day: (
    <>
      <circle cx="12" cy="12" r="4.3" />
      <path d="M12 2.8v2.5M12 18.7v2.5M21.2 12h-2.5M5.3 12H2.8M18.6 5.4l-1.8 1.8M7.2 16.8l-1.8 1.8M18.6 18.6l-1.8-1.8M7.2 7.2L5.4 5.4" />
    </>
  ),
  week: (
    <>
      <rect x="4" y="5.2" width="16" height="14.8" rx="3.2" />
      <path d="M8 3.5v3.2M16 3.5v3.2M4 9.2h16M8 12.7h2.2M12 12.7h2.2M8 16.2h2.2M12 16.2h2.2" />
    </>
  ),
  family: (
    <>
      <circle cx="8" cy="9" r="2.6" />
      <circle cx="16.4" cy="8" r="2.2" />
      <path d="M3.8 18c1.2-2.4 3-3.7 5.2-3.7S13 15.6 14.2 18M13.4 18c.8-1.8 2.1-2.8 3.7-2.8 1.2 0 2.3.5 3.1 1.6" />
    </>
  ),
  reminders: (
    <>
      <path d="M12 4.2c-2.8 0-5 2.2-5 5v2.1L5.5 14v1.1h13V14L17 11.3V9.2c0-2.8-2.2-5-5-5Z" />
      <path d="M10 17.4c.5 1.1 1.1 1.6 2 1.6s1.5-.5 2-1.6" />
    </>
  ),
  groceries: (
    <>
      <path d="M5.2 6.2h14.4l-1.2 10.4H6.4L5.2 6.2Z" />
      <path d="M8.1 6.2a3.9 3.9 0 0 1 7.8 0" />
    </>
  ),
  fruits: (
    <>
      <path d="M12 7.3c-3.7 0-6 2.7-6 5.8 0 3 2.4 5.2 6 5.2s6-2.2 6-5.2c0-3.1-2.3-5.8-6-5.8Z" />
      <path d="M12 7.3c0-1.8 1-3.1 2.7-3.8M11.4 7c-1.6-1.4-2.3-2.5-2.5-4" />
    </>
  ),
  vegetables: (
    <>
      <path d="M12 19c-3.8-1.8-6.1-4.7-6.1-8 0-2.9 2.3-5 6.1-6.4 3.8 1.4 6.1 3.5 6.1 6.4 0 3.3-2.3 6.2-6.1 8Z" />
      <path d="M12 5.1V19" />
    </>
  ),
  dry_items: (
    <>
      <path d="M7 6.3h10v12.5H7z" />
      <path d="M8.8 4.8h6.4M9.2 10.3h5.6M9.2 13h5.6M9.2 15.7h4.2" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3.6 1.6 4.8 4.8 1.6-4.8 1.6-1.6 4.8-1.6-4.8-4.8-1.6 4.8-1.6L12 3.6Z" />
    </>
  ),
  balance: (
    <>
      <path d="M12 4.4v13.2M7 7.3h10M9 7.3 6.5 11h5L9 7.3Zm6 0L12.5 11h5L15 7.3ZM12 17.6h4.3" />
    </>
  ),
  reset: (
    <>
      <path d="M18.2 8.2A6.6 6.6 0 0 0 7 6.6M5.2 8.2V4.8h3.4M5.8 15.8A6.6 6.6 0 0 0 17 17.4M18.8 15.8v3.4h-3.4" />
    </>
  )
};

export default function AppIcon({ name, className = "" }: AppIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`app-icon ${className}`.trim()}
    >
      {iconPaths[name]}
    </svg>
  );
}
