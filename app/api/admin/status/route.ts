
import { NextResponse } from 'next/server'
import { METRICS } from '../../_telemetry'

export async function GET(){
  const today = new Date().toISOString().slice(0,10)
  const todayQs = METRICS.queries.filter(q => q.ts.slice(0,10)===today)
  const latencies = todayQs.map(q=>q.latency_ms).sort((a,b)=>a-b)
  const p50 = latencies.length ? latencies[Math.floor(latencies.length/2)] : 0

  const hist = METRICS.hist_price_m2.slice(-200)
  let buckets = Array.from({length:6}, (_,i)=>({label:String(1500+i*100), value:0}))
  if (hist.length){
    const mn = Math.min(...hist), mx = Math.max(...hist)
    const span = Math.max(1, (mx-mn)/6)
    buckets = Array.from({length:6}, (_,i)=>({label:String(Math.round(mn+i*span)), value:0}))
    for (const v of hist){
      const idx = Math.min(5, Math.floor((v-mn)/span))
      buckets[idx].value++
    }
  }

  return NextResponse.json({
    metrics:{
      today_queries: todayQs.filter(q=>q.type==='search').length,
      today_estimates: todayQs.filter(q=>q.type==='estimate').length,
      latency_p50_ms: p50,
      errors_5xx: METRICS.errors_5xx
    },
    sources:[
      {id:'urbania', status:'ok', uptime_24h:99.5},
      {id:'adondevivir', status:'ok', uptime_24h:99.2},
      {id:'properati', status:'ok', uptime_24h:99.7},
      {id:'olx', status:'ok', uptime_24h:98.5},
    ],
    price_m2_hist: buckets,
    activity: METRICS.activity.slice(0,20)
  })
}
