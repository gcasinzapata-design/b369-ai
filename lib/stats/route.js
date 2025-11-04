import { NextResponse } from 'next/server'
import { readStats } from '../../../../lib/stats.js'

export async function GET(){
  return NextResponse.json({ ok:true, ...readStats() })
}
