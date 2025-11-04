// app/api/search/route.js
import { NextResponse } from 'next/server'
import { scrapeAll } from '../../../lib/scrape/providers.js'
import { z } from 'zod'

const QuerySchema = z.object({
  q: z.string().default(''),
  minArea: z.number().optional(),
  minRooms: z.number().optional(),
  district: z.string().optional(),
  maxPrice: z.number().optional()
})

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    const { q, minArea, minRooms, district, maxPrice } = QuerySchema.parse(body)

    const ENABLE_SCRAPING = process.env.ENABLE_SCRAPING === 'true'
    const items = await scrapeAll({ q, minArea, minRooms, district, maxPrice, enable: ENABLE_SCRAPING })

    return NextResponse.json({ ok: true, items })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 })
  }
}
