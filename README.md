# b369-ai — v7 (Next.js + Tailwind, Netlify-stable)

## Local
npm ci || npm install  
npm run dev

## Build / Run (prod)
npm run build  
npm start

## Netlify
- Build: `npm run build`
- Publish: `.next`
- Env: `NODE_VERSION=20.19.5`
- Plugin: `@netlify/plugin-nextjs`

### Estabilidad
- Páginas interactivas marcadas `'use client'`: `/resultados`, `/tasador`.
- `.nvmrc` incluido para Node 20.19.5.
