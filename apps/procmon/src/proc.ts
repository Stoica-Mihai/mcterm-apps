// Pure process-list helpers (no DOM/solid) — unit-testable.

export interface Proc { pid: number; cpu: number; mem: number; cmd: string }

export function parseProcList(psText: string): Proc[] {
  return psText.trim().split('\n').slice(1).map(l => {
    const m = l.trim().match(/^(\d+)\s+([\d.]+)\s+([\d.]+)\s+(.+)$/)
    return m ? { pid: +m[1], cpu: +m[2], mem: +m[3], cmd: m[4] } : null
  }).filter((p): p is Proc => p !== null)
}

// No filter → top N (the cpu/mem leaders); filter → all matches, case-insensitive.
export function visibleProcs(all: Proc[], filter: string, topN: number): Proc[] {
  if (!filter) return all.slice(0, topN)
  const f = filter.toLowerCase()
  return all.filter(p => p.cmd.toLowerCase().includes(f))
}
