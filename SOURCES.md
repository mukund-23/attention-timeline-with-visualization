# Sources

Every date on the timeline, with its source and how it was verified.

## Dating rule

1. **arXiv v1 submission date.** Not v2, not the conference date, not the journal date.
2. **Fallback A — dated public post**, where no paper exists. Applies to NTK-aware scaling.
3. **Fallback B — artifact release date**, where the technique shipped before or without a paper. Applies to DeepSeek Sparse Attention.
4. **Adoption marker.** A second date appears only where the gap from first appearance is **>= 12 months** *and* a named release carries its own date.

## Verification status

- **primary** — arXiv abstract page read directly, by machine or by a human opening the link
- **user** — supplied by a human who opened the source directly (no paper exists)

**All 29 first-appearance dates are verified against their stated primary source or fallback source.** Four adoption markers
are model-release dates still pending confirmation; those render with a visible "(unverified)" label
next to the adoption date in the app. First-appearance dates and adoption markers are tracked
separately, so an entry is never mislabelled because its secondary marker is unconfirmed.

## Table

| # | Mechanism | Appeared | arXiv / source | v1 timestamp (UTC) | Status |
|---:|---|---|---|---|---|
| 1 | Learned absolute positions | 2017-05-08 | [1705.03122](https://arxiv.org/abs/1705.03122) | 23:25:30 | primary |
| 2 | Scaled dot-product / MHA | 2017-06-12 | [1706.03762](https://arxiv.org/abs/1706.03762) | — | primary |
| 3 | Sinusoidal encoding | 2017-06-12 | [1706.03762](https://arxiv.org/abs/1706.03762) | — | primary |
| 4 | Relative position representations | 2018-03-06 | [1803.02155](https://arxiv.org/abs/1803.02155) | — | primary |
| 5 | Transformer-XL | 2019-01-09 | [1901.02860](https://arxiv.org/abs/1901.02860) | 18:28:19 | primary |
| 6 | Sparse Transformer | 2019-04-23 | [1904.10509](https://arxiv.org/abs/1904.10509) | — | primary |
| 7 | MQA | 2019-11-06 | [1911.02150](https://arxiv.org/abs/1911.02150) | — | primary |
| 8 | Longformer / sliding window | 2020-04-10 | [2004.05150](https://arxiv.org/abs/2004.05150) | — | primary |
| 9 | Linear attention | 2020-06-29 | [2006.16236](https://arxiv.org/abs/2006.16236) | — | primary |
| 10 | BigBird | 2020-07-28 | [2007.14062](https://arxiv.org/abs/2007.14062) | — | primary |
| 11 | Performer / FAVOR+ | 2020-09-30 | [2009.14794](https://arxiv.org/abs/2009.14794) | — | primary |
| 12 | Delta rule / fast weights | 2021-02-22 | [2102.11174](https://arxiv.org/abs/2102.11174) | — | primary |
| 13 | RoPE | 2021-04-20 | [2104.09864](https://arxiv.org/abs/2104.09864) | 09:54:06 | primary |
| 14 | Top-k attention | 2021-06-13 | [2106.06899](https://arxiv.org/abs/2106.06899) | — | primary |
| 15 | ALiBi | 2021-08-27 | [2108.12409](https://arxiv.org/abs/2108.12409) | — | primary |
| 16 | FlashAttention | 2022-05-27 | [2205.14135](https://arxiv.org/abs/2205.14135) | — | primary |
| 17 | GQA | 2023-05-22 | [2305.13245](https://arxiv.org/abs/2305.13245) | 17:16:38 | primary |
| 18 | NoPE | 2023-05-31 | [2305.19466](https://arxiv.org/abs/2305.19466) | — | primary |
| 19 | Position Interpolation | 2023-06-27 | [2306.15595](https://arxiv.org/abs/2306.15595) | — | primary |
| 20 | NTK-aware RoPE scaling | 2023-06-29 | [r/LocalLLaMA `14lz7j5`](https://www.reddit.com/r/LocalLLaMA/comments/14lz7j5/) | — | user |
| 21 | YaRN | 2023-08-31 | [2309.00071](https://arxiv.org/abs/2309.00071) | — | primary |
| 22 | Attention sinks / StreamingLLM | 2023-09-29 | [2309.17453](https://arxiv.org/abs/2309.17453) | 17:59:56 | primary |
| 23 | MLA | 2024-05-07 | [2405.04434](https://arxiv.org/abs/2405.04434) | — | primary |
| 24 | DeltaNet (parallelized) | 2024-06-10 | [2406.06484](https://arxiv.org/abs/2406.06484) | — | primary |
| 25 | Gated DeltaNet | 2024-12-09 | [2412.06464](https://arxiv.org/abs/2412.06464) | 13:09:04 | primary |
| 26 | NSA | 2025-02-16 | [2502.11089](https://arxiv.org/abs/2502.11089) | — | primary |
| 27 | DSA | 2025-09-29 | [DeepSeek release note](https://api-docs.deepseek.com/news/news250929) | — | primary |
| 28 | KDA / Kimi Linear | 2025-10-30 | [2510.26692](https://arxiv.org/abs/2510.26692) | — | primary |
| 29 | DroPE | 2025-12-13 | [2512.12167](https://arxiv.org/abs/2512.12167) | — | primary |
| — | Gated DeltaNet-2 *(closing section, not on timeline)* | 2026-05-21 | [2605.22791](https://arxiv.org/abs/2605.22791) | — | primary |

## Adoption markers

Second dates, where the rule above is satisfied.

| Mechanism | Appeared | Became standard | Gap | Marker source | Status |
|---|---|---|---|---|---|
| Sliding window | 2020-04-10 | 2023-09-27 | 3 yr 5 mo | Mistral 7B release | secondary |
| MQA | 2019-11-06 | 2023-07-18 | 3 yr 8 mo | Llama 2 70B (via GQA) | secondary |
| RoPE | 2021-04-20 | 2023-02 | 1 yr 10 mo | LLaMA | secondary |
| Gated DeltaNet | 2024-12-09 | 2025-09 | 9 mo | Qwen3-Next — **below threshold, shown for context only** | secondary |

## Notes on individual entries

**Learned absolute positions.** Also present in Gehring et al., *A Convolutional Encoder Model for NMT* ([1611.02344](https://arxiv.org/abs/1611.02344), v1 2016-11-07), by the same group — roughly six months before ConvS2S and nineteen months before the Transformer. We date the timeline to ConvS2S because that is the citation the field uses, but the earlier appearance is the more strictly correct answer under our own rule. Flagged rather than hidden.

**Scaled dot-product attention and sinusoidal encoding** share a date because they share a paper. Learned absolute positions predates both by five weeks, so the timeline opens with a positional scheme before the mechanism it positions. Standard attention is additionally explained in a prologue outside the timeline.

**NTK-aware RoPE scaling** has no paper. It is a Reddit post by a pseudonymous user, `bloc97`, and it became the default context-extension method across open-source models for roughly six months before anything formal was written about it. The timestamp was confirmed by a human opening the thread directly; reddit.com was not machine-readable during verification. This is the messiest provenance on the timeline and it is left visible rather than smoothed over.

**DSA** uses the artifact-release fallback. DeepSeek-V3.2-Exp shipped 2025-09-29; the technical report followed later.

**DroPE** should not be confused with **DRoPE** (Directional Rotary Position Embedding, [2503.15029](https://arxiv.org/abs/2503.15029), March 2025), an unrelated method for agent trajectory modelling.

**Position Interpolation and NTK-aware scaling** land two days apart. Under strict chronology PI comes first, which is also causally correct — NTK-aware was written to fix PI's uniform-frequency-squashing problem.

## Outstanding

First-appearance dates: none. All 29 are verified.

Adoption markers: four remain unconfirmed — Mistral 7B (sliding window), LLaMA (RoPE), Llama 2 70B
(GQA) and Qwen3-Next (Gated DeltaNet). These are model-release dates rather than arXiv submissions,
so the source is a blog post, model card or repo tag in each case. The Qwen3-Next marker spans about
nine months, below this project's own twelve-month threshold; it is retained for context and
labelled, not counted as a qualifying marker.
