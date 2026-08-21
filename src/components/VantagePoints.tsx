import { useState } from 'react'

interface Vantage {
  when: string
  scene: string
  known: string[]
  question: string
  options: { text: string; verdict: 'happened' | 'later' | 'no' }[]
  answer: string
  lesson: string
  jump?: { id: string; label: string }
}

const VANTAGES: Vantage[] = [
  {
    when: 'Mid 2020',
    scene: 'Four separate groups have spent the year attacking the quadratic cost. Sparse patterns, low-rank projection, random features, kernel tricks. Every one of them approximates attention and pays for it in accuracy.',
    known: ['Sparse Transformer', 'Longformer', 'Linformer', 'Linear attention', 'BigBird', 'Performer'],
    question: 'What is the next move?',
    options: [
      { text: 'A better approximation with tighter error bounds', verdict: 'no' },
      { text: 'Stop approximating — make exact attention cheaper', verdict: 'happened' },
      { text: 'Abandon attention for a recurrent architecture', verdict: 'later' },
      { text: 'Sparse patterns chosen by content rather than position', verdict: 'later' },
    ],
    answer: 'FlashAttention, May 2022. Nobody approximated anything. Dao et al. profiled the operation and argued the field had been optimising the wrong resource — the cost was memory traffic, not arithmetic. Tiling the computation so the score matrix never reaches HBM made exact attention several times faster.',
    lesson: 'Everyone was reducing a number that was not the bottleneck. Two years of clever mathematics lost to someone reading the hardware more carefully.',
    jump: { id: 'flashattention', label: 'FlashAttention' },
  },
  {
    when: 'Late 2019',
    scene: 'Noam Shazeer publishes a four-page note. Decoding is slow, he argues, and not because of arithmetic — every generated token re-reads the whole key/value cache from memory. Collapse the KV heads to one and the cache shrinks by the head count.',
    known: ['MHA', 'Sparse Transformer', 'Transformer-XL', 'MQA (just published)'],
    question: 'How long until this matters?',
    options: [
      { text: 'Immediately — it is a large, free-looking win', verdict: 'no' },
      { text: 'Within a year, once models get bigger', verdict: 'no' },
      { text: 'Roughly four years', verdict: 'happened' },
      { text: 'Never — the quality loss kills it', verdict: 'no' },
    ],
    answer: 'Almost nothing happens until 2022 and 2023, when PaLM and Falcon adopt MQA and then GQA softens its quality cost enough for Llama 2 to ship it. The idea did not improve while it waited. Models got large enough, and contexts long enough, that inference economics finally outweighed training economics.',
    lesson: 'Being right early is indistinguishable from being wrong until the constraint that makes you right actually arrives.',
    jump: { id: 'multi-query-attention', label: 'MQA' },
  },
  {
    when: '27 June 2023',
    scene: 'Position Interpolation lands. Rather than extrapolating RoPE past its training length, divide the position index so every rotation angle stays inside the range the model has seen. It works, with brief fine-tuning. It also squashes the fast dimensions that carry fine local distance, so short-context quality drops.',
    known: ['RoPE', 'ALiBi', 'Position Interpolation (two days old)'],
    question: 'What fixes the local-resolution problem, and when?',
    options: [
      { text: 'A follow-up paper from the same lab, months later', verdict: 'no' },
      { text: 'An anonymous Reddit post, two days later', verdict: 'happened' },
      { text: 'Nothing — the field accepts the trade', verdict: 'no' },
      { text: 'Abandoning RoPE for ALiBi', verdict: 'no' },
    ],
    answer: 'NTK-aware scaling, 29 June 2023, posted to r/LocalLLaMA by a pseudonymous user. Change the base frequency instead of the position index, so slow dimensions stretch a lot and fast ones barely at all. It needed no fine-tuning, became the default across open-source models for roughly six months, and had no paper. YaRN was written partly to give it a rigorous footing.',
    lesson: 'The most-used context-extension method of 2023 was a forum post. Where an idea comes from tells you very little about whether it works.',
    jump: { id: 'ntk-aware-rope-scaling', label: 'NTK-aware scaling' },
  },
  {
    when: 'Early 2021',
    scene: 'Schlag, Irie and Schmidhuber diagnose linear attention precisely. Its update only adds, so writing the same key twice superimposes both values forever. They propose the delta rule from 1960: read what is stored at that key, then write only the difference. It works, and it is unusable — the update is sequential, so it cannot saturate a GPU.',
    known: ['Linear attention', 'Performer', 'Delta rule (just formalised)'],
    question: 'What happens to this idea?',
    options: [
      { text: 'Adopted quickly — the recall gain is large', verdict: 'no' },
      { text: 'Three years of nothing, then a parallel algorithm', verdict: 'happened' },
      { text: 'Superseded by state space models', verdict: 'later' },
      { text: 'Abandoned permanently', verdict: 'no' },
    ],
    answer: 'Silence until June 2024, when Yang et al. reformulate the update using the WY representation so chunks compute in parallel. Semantics unchanged, throughput transformed. Gated DeltaNet follows six months later, KDA a year after that, and the line is still moving in 2026.',
    lesson: 'A correct idea that cannot use the hardware is indistinguishable from a wrong idea. What unblocked it was an algorithm, not an insight about memory.',
    jump: { id: 'delta-rule', label: 'the delta rule' },
  },
  {
    when: 'Late 2022',
    scene: 'FlashAttention has made exact dense attention fast enough that the approximation line has gone quiet. Sparse attention, low-rank projection and random features all look like solved-and-abandoned research directions.',
    known: ['FlashAttention', 'Sparse Transformer', 'BigBird', 'Longformer', 'Linear attention'],
    question: 'Is sparse attention finished?',
    options: [
      { text: 'Yes — exact attention won', verdict: 'no' },
      { text: 'It returns, rebuilt around the same hardware lesson', verdict: 'happened' },
      { text: 'It returns unchanged once contexts grow', verdict: 'no' },
      { text: 'It is replaced entirely by recurrent models', verdict: 'no' },
    ],
    answer: 'Sparsity returns in 2025 with NSA and DSA, and the difference is exactly the FlashAttention lesson applied. NSA selects contiguous blocks because contiguous blocks are what GPUs read efficiently, and trains with sparsity present rather than bolting it on at inference. DSA adds a cheap learned scorer, finally solving the flaw that had made top-k attention impractical since 2021.',
    lesson: 'Ideas do not usually die. They wait for the constraint that killed them to move, then come back shaped by whatever killed them.',
    jump: { id: 'native-sparse-attention', label: 'NSA' },
  },
]

export default function VantagePoints() {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const v = VANTAGES[i]

  const go = (n: number) => { setI(n); setPicked(null) }

  return (
    <section className="tool">
      <div className="wrap">
        <h2>Stand here. Guess what happens next.</h2>
        <p className="toollede">
          The point of a timeline is that it should let you predict the next move. So test it — but
          backwards, where the answer already exists and you can be marked. Cover the future, stand
          at a date, and say what you would have done.
        </p>

        <div className="vantagetabs">
          {VANTAGES.map((x, n) => (
            <button key={x.when} aria-pressed={n === i} onClick={() => go(n)}>{x.when}</button>
          ))}
        </div>

        <div className="vantagecard">
          <p className="vantagescene">{v.scene}</p>
          <p className="label">What exists at this point</p>
          <div className="vantageknown">
            {v.known.map(k => <span key={k}>{k}</span>)}
          </div>

          <p className="vantageq">{v.question}</p>
          <div className="vantageopts">
            {v.options.map((o, n) => {
              const shown = picked !== null
              const cls = !shown ? '' :
                o.verdict === 'happened' ? ' right' :
                  o.verdict === 'later' ? ' partial' : ' wrong'
              return (
                <button key={o.text} className={`vantageopt${cls}${picked === n ? ' chosen' : ''}`}
                  onClick={() => setPicked(n)} disabled={shown}>
                  <span>{o.text}</span>
                  {shown && (
                    <i>{o.verdict === 'happened' ? 'this happened'
                      : o.verdict === 'later' ? 'eventually, but not next' : 'no'}</i>
                  )}
                </button>
              )
            })}
          </div>

          {picked !== null && (
            <div className="vantagereveal">
              <p className="label">What actually happened</p>
              <p>{v.answer}</p>
              <p className="vantagelesson">{v.lesson}</p>
              {v.jump && <p><a href={`#${v.jump.id}`}>Go to {v.jump.label} on the timeline →</a></p>}
              {i < VANTAGES.length - 1 && (
                <button className="vantagenext" onClick={() => go(i + 1)}>
                  Next vantage point — {VANTAGES[i + 1].when} →
                </button>
              )}
            </div>
          )}
        </div>

        <p className="vantagesummary">
          Multi-query attention waited four years. The delta rule waited three. Sliding windows waited
          three and a half. Sparse attention waited six. In none of those cases did the idea improve
          while it waited — some other constraint moved. If you want to guess what comes next, the
          useful question is not which idea is best. It is which constraint is about to move.
        </p>
      </div>
    </section>
  )
}
