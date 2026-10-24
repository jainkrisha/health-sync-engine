/**
 * The HealthSync mark: a medical cross drawn as one solid bar and one
 * outlined bar, two copies of a record that meet. Takes the text colour.
 */
export function Mark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="12" y="2" width="8" height="28" fill="currentColor" />
      <rect x="3.5" y="12.5" width="25" height="7" fill="none" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}
