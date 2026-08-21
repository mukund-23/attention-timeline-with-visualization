import type { Entry } from '../types'
import MaskGlyph from './MaskGlyph'
import Viz from './viz'

const ERAS: Record<string, string> = {
  'learned-absolute-positional-embeddings': 'It wanted exactness',
  'sparse-transformer': 'The quadratic bill arrives',
  'flashattention': 'It wanted exactness back',
  'grouped-query-attention': 'It wanted length',
  'multi-head-latent-attention': 'It wanted memory back',
  'native-sparse-attention': 'Sparsity returns, hardware-first',
}

function monthsBetween(a: string, b: string) {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}

export default function EntryCard({ e, dim = false }: { e: Entry; dim?: boolean }) {
  const era = ERAS[e.id]
  const gap = e.adopted ? monthsBetween(e.date, e.adopted) : 0
  return (
    <article className={`entry${dim ? ' dim' : ''}`} id={e.id}>
      <div className="rail">
        {era && <div className="eratick">{era}</div>}
        <div className="railmark">
          <MaskGlyph id={e.id} label={e.name} />
          <span className="railyear">{e.date.slice(0, 4)}</span>
        </div>
      </div>

      <div className="card">
        <div className="cardhead">
          <span className="num">{String(e.num).padStart(2, '0')}</span>
          <h3>{e.name}</h3>
        </div>

        <p className="dates">
          {e.date}{e.dateUnverified && ' (unverified)'}
          {e.adopted && (
            <> &nbsp;·&nbsp; <span className="gap">
              became standard {e.adopted} — {Math.round(gap / 12 * 10) / 10} yr later
            </span></>
          )}
        </p>

        <div className="tags">
          <span className="tag">tier {e.tier}</span>
          {e.threads.map(t => <span className="tag" key={t}>{t}</span>)}
          {e.evidence !== 'independent' && <span className="tag warn">{e.evidence}</span>}
        </div>

        {e.note && <p className="note">{e.note.replace(/^\*\*[^*]+\*\*\s*/, '')}</p>}

        <p className="label">The problem at that moment</p>
        <p className="lede">{e.problem}</p>

        <p className="label">How it works</p>
        <p>{e.mechanism}</p>

        <Viz e={e} />

        <div className="ledger">
          <div className="buys">
            <h4>What it buys</h4>
            <ul>{e.buys.map((b, i) => <li key={i}>{b}</li>)}</ul>
          </div>
          <div className="costs">
            <h4>What it costs</h4>
            <ul>{e.costs.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>
        </div>

        {e.callout && <p className="callout">{e.callout.replace(/^\*\*[^*]+\*\*\s*/, '')}</p>}

        <div className="when">
          <div>
            <p className="label">Pick it when</p>
            <p>{e.pickWhen}</p>
          </div>
          <div>
            <p className="label">Don't when</p>
            <p>{e.avoidWhen}</p>
          </div>
        </div>

        <p className="lineage"><strong>Lineage.</strong> {e.lineage}</p>
      </div>
    </article>
  )
}
