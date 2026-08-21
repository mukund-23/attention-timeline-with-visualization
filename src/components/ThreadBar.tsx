export const THREADS: { id: string; label: string; blurb: string }[] = [
  { id: 'origins', label: 'Origins', blurb: 'Attention becomes the architecture.' },
  { id: 'position', label: 'Position', blurb: 'Where is this token, and how far is it from that one?' },
  { id: 'sparsity', label: 'Sparsity', blurb: 'Does every token really need every other token?' },
  { id: 'kv', label: 'KV memory', blurb: 'The cache, not the compute, is what you cannot afford.' },
  { id: 'context', label: 'Context length', blurb: 'Working past the length you trained on.' },
  { id: 'recurrent', label: 'Recurrent memory', blurb: 'Replace the matrix with a state you carry.' },
  { id: 'hardware', label: 'Hardware', blurb: 'The bill was being read wrong.' },
]

export default function ThreadBar({
  active, onToggle, counts,
}: {
  active: string | null
  onToggle: (id: string | null) => void
  counts: Record<string, number>
}) {
  const cur = THREADS.find(t => t.id === active)
  return (
    <div className="threadbar">
      <div className="wrap">
        <div className="threadrow">
          <span className="threadlabel">Trace a thread</span>
          {THREADS.map(t => (
            <button
              key={t.id}
              className="threadchip"
              aria-pressed={active === t.id}
              onClick={() => onToggle(active === t.id ? null : t.id)}
            >
              {t.label} <span className="threadcount">{counts[t.id] ?? 0}</span>
            </button>
          ))}
          {active && (
            <button className="threadclear" onClick={() => onToggle(null)}>clear</button>
          )}
        </div>
        <p className="threadblurb">
          {cur
            ? <><strong>{cur.label}.</strong> {cur.blurb} Entries outside the thread stay in place, dimmed — the dates never move.</>
            : 'Threads highlight in place. Nothing is reordered or grouped, so you can see two threads running at once and one of them going quiet.'}
        </p>
      </div>
    </div>
  )
}
