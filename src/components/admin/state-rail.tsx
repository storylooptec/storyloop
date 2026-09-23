const states = ["Brief", "Shortlist", "Approved", "Funded", "Live", "Paid"] as const;

export function StateRail({ current }: { current: (typeof states)[number] }) {
  const currentIndex = states.indexOf(current);

  return (
    <ol className="state-rail" aria-label="Campaign state">
      {states.map((state, index) => (
        <li
          key={state}
          data-state={
            index < currentIndex ? "done" : index === currentIndex ? "current" : "next"
          }
        >
          <span>{index < currentIndex ? "✓" : index === currentIndex ? "▶" : "·"}</span>
          {state}
        </li>
      ))}
    </ol>
  );
}
