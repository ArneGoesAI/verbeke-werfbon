// Het logo uit docs/ontwerp/Main.dc.html: afgerond vierkant in warmte, met een dak en een golf.

export function Logo({ grootte = 56 }: { grootte?: number }) {
  return (
    <svg width={grootte} height={grootte} viewBox="0 0 56 56" role="img" aria-label="Logo Verbeke">
      <rect width="56" height="56" rx="16" fill="#C2531E" />
      <path d="M14 30 L28 18 L42 30" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 38 C23 34, 27 42, 31 38 S 37 34, 39 38" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
