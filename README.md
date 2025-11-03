<<<<<<< HEAD

# b369-ai — v6 (Next.js + Tailwind, Netlify-stable)
=======
# b369-ai — v5-lite (Next.js + Tailwind)
>>>>>>> 498bff203ccdfeec93abf50005e4921202812e2d

## Local
npm ci || npm install
npm run dev
<<<<<<< HEAD

## Build / Run (prod)
npm run build
npm start

## Netlify
- Build: `npm run build`
- Publish: `.next`
- Env: `NODE_VERSION=20.19.5`
- Plugin: `@netlify/plugin-nextjs` (incluido en `devDependencies` y activado en `netlify.toml`)

### Estabilidad
- Páginas interactivas marcadas `'use client'`: `/resultados`, `/tasador`.
- `package-lock.json` + `.nvmrc` incluidos para builds deterministas.
=======
>>>>>>> 498bff203ccdfeec93abf50005e4921202812e2d
