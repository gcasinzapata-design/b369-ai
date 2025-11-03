
export type QueryMetric = { ts:string, latency_ms:number, type:'search'|'estimate' }
export const METRICS:{ queries: QueryMetric[], hist_price_m2:number[], errors_5xx:number, activity:{ts:string,type:string,summary:string}[] } = {
  queries: [], hist_price_m2: [], errors_5xx: 0, activity: []
}
export function logMetric(kind:'search'|'estimate', latency_ms:number, price_m2?:number){
  METRICS.queries.push({ ts: new Date().toISOString(), latency_ms, type: kind })
  if (price_m2!==undefined){ METRICS.hist_price_m2.push(price_m2); if (METRICS.hist_price_m2.length>400) METRICS.hist_price_m2.shift() }
}
export function logActivity(type:string, summary:string){
  METRICS.activity.unshift({ ts: new Date().toISOString(), type, summary })
  if (METRICS.activity.length>200) METRICS.activity.pop()
}
