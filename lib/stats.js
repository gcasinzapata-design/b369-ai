// lib/stats.js
const state = {
  startedAt: Date.now(),
  counts: {
    search: 0,
    search_cache_hit: 0,
    search_error: 0,
    estimate: 0,
    estimate_no_comps: 0,
    estimate_error: 0
  },
  lastErrors: [] // { t, type, msg }
}

export async function logEvent(type, payload={}){
  if(state.counts[type] !== undefined) state.counts[type]++
  if(type.endsWith('_error')){
    state.lastErrors.unshift({ t: Date.now(), type, msg: payload.error || 'error' })
    state.lastErrors = state.lastErrors.slice(0,20)
  }
}

export function readStats(){
  return {
    uptimeSec: Math.floor((Date.now()-state.startedAt)/1000),
    counts: state.counts,
    lastErrors: state.lastErrors
  }
}
