// app/api/search/route.js
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { geocodeAddress } from '@/lib/geo/geocode';
import { searchEverywhere } from '@/lib/scrape/providers';

const QSchema = z.object({
  q: z.string().optional().default(''),
  district: z.string().optional().default(''),
  minArea: z.number().optional(),
  minRooms: z.number().optional(),
  maxPriceUSD: z.number().optional(),
  limit: z.number().optional().default(20)
});

export async function POST(req) {
  try {
    const body = await req.json();
    const { q, district, minArea, minRooms, maxPriceUSD, limit } = QSchema.parse(body || {});

    // Scrape real si se habilita
    let items = [];
    if (process.env.ENABLE_SCRAPING === '1') {
      items = await searchEverywhere({ q, district, minArea, minRooms, maxPriceUSD, limit });
    }

    // Si no hay scraping o quedó vacío, intenta mock local
    if (!items.length) {
      try {
        const mock = await (await fetch(new URL('/mock.json', req.url))).json();
        items = mock;
      } catch {
        items = [];
      }
    }

    // Geocodificar faltantes (best-effort)
    const enriched = [];
    for (const it of items) {
      const hasLL = Number.isFinite(it.lat) && Number.isFinite(it.lon);
      if (hasLL) { enriched.push(it); continue; }
      const address = it.direccion || it.titulo || q || '';
      const geo = await geocodeAddress(address, district || '');
      if (geo.ok) enriched.push({ ...it, lat: geo.lat, lon: geo.lon });
      else enriched.push(it);
    }

    return NextResponse.json({ ok:true, items: enriched });
  } catch (e) {
    return NextResponse.json({ ok:false, error: String(e.message || e) }, { status: 400 });
  }
}
