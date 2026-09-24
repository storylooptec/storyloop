export function CreatorBrandLogo({
  src,
  compact = false,
}: {
  src: string | null;
  compact?: boolean;
}) {
  if (!src) {
    return <span className={compact ? "creator-logo-fallback compact" : "creator-logo-fallback"}>Storyloop</span>;
  }

  return (
    <span className={compact ? "creator-logo-wrap compact" : "creator-logo-wrap"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Storyloop" />
    </span>
  );
}
