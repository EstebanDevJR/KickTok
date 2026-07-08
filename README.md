# ⚡ KickTok

**English** · [Español](#-kicktok-español)

An open-source vertical clip feed for [Kick.com](https://kick.com).

Streamers on Kick generate great clips every day, but there's no obvious place to discover them — so most clips die with a handful of views. KickTok gives those moments a second life: a fullscreen, snap-scrolling short-video feed where you can binge the best clips on the platform and jump straight to the streamer's channel.

## Features

- 📱 **Fullscreen vertical feed** — snap scrolling, autoplay, one clip at a time
- 🎲 **MIX mode (default)** — a shuffled recommendation feed that's different on every refresh
- 🧠 **Watch history** — MIX remembers what you've seen (locally) and skips it
- 💚 **Personalized MIX** — your likes and watch history (kept locally) nudge clips from your favorite categories and channels earlier in the deck
- ⏩ **Seek & auto-advance** — drag the progress bar to scrub, and the feed rolls to the next clip when one ends
- 🔞 **18+ filter** — one tap in the top bar hides mature-flagged clips
- 🎯 **Channel & category feeds** — tap a streamer's name/avatar (`/c/[slug]`) or a category chip (`/g/[slug]`) to binge just that
- 🔥 **Trending filters** — most-viewed clips of the last 24h / 7d / 30d / all time, or newest first
- ♾️ **Infinite scroll** — cursor-based pagination straight from Kick's clip feed
- ❤️ **Double-tap to like** — with the mandatory heart burst (likes are stored locally)
- 📤 **Share** — native share sheet on mobile, copy-link on desktop
- ⚡ **Straight to the streamer** — every card links to the clip on Kick
- ⌨️ **Keyboard nav** — `↑` `↓` to move between clips, `M` to mute, click to pause
- 🎞️ **HLS playback** — hls.js everywhere, native HLS on Safari/iOS, buffering indicator included
- 📲 **Installable** — PWA manifest, works as a home-screen app on mobile

## How the MIX feed works

Kick's API only offers deterministic sorts (`view`/`date`), so a naive feed shows the same clips in the same order on every visit. The MIX feed builds a **recommendation deck** instead:

1. Four pools are fetched in parallel: trending **today**, **this week**, **this month**, and the **freshest uploads** (which is how small streamers surface).
2. Each request gets a random **seed**. A seeded PRNG (mulberry32) shuffles every pool deterministically.
3. The deck is dealt by **weighted round-robin** across pools — 40% today's hits, 25% weekly, 15% monthly, 20% brand-new — with duplicates removed.
4. Pagination reuses the same seed, so scrolling stays stable within a session; refreshing generates a new seed and a new feed. When the deck runs out, the client reshuffles with a fresh seed and keeps going, skipping clips you've already seen.
5. If you've liked or watched clips before, the browser sends your top categories and channels (computed locally, never stored server-side) along with the seed, and matching clips are promoted deterministically within the deck.

## How it reaches Kick

Kick has no official clips API, and its undocumented one (`kick.com/api/v2/clips`) sits behind Cloudflare TLS fingerprinting — plain `fetch`/`curl` gets a 403. KickTok runs small Next.js route handlers (`/api/feed`, `/api/clips`) that fetch the listing with [`got-scraping`](https://github.com/apify/got-scraping), which presents a real browser TLS handshake. Responses are cached in memory for 60s to keep traffic to Kick minimal.

The clip videos themselves are served from Kick's public CDN (`clips.kick.com`) with open CORS, so playback happens directly in your browser — no video traffic touches the server.

```
Browser ──► /api/feed · /api/clips (Next.js + got-scraping) ──► kick.com/api/v2/clips
   │
   └────── hls.js ──► clips.kick.com (direct, CDN)
```

## Getting started

```bash
git clone <this-repo>
cd kicktok
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and scroll.

> **Note:** deploys fine on any Node host (Vercel, Railway, a VPS…). The Kick API is reached from the server, so hosts whose egress IPs Cloudflare distrusts may see occasional 403s.

## Stack

- [Next.js](https://nextjs.org) (App Router) + React
- [Tailwind CSS v4](https://tailwindcss.com)
- [hls.js](https://github.com/video-dev/hls.js) for playback
- [got-scraping](https://github.com/apify/got-scraping) to reach Kick's API

## Project structure

```
app/
  page.tsx            # server component, prefetches the first MIX page
  c/[slug]/page.tsx   # one channel's clips
  g/[slug]/page.tsx   # one category's clips
  manifest.ts         # PWA manifest
  api/feed/route.ts   # shuffled recommendation feed (seed + page)
  api/clips/route.ts  # proxy to Kick's sorted clip feeds (global/channel/category)
components/
  Feed.tsx            # snap-scroll container, modes, scopes, infinite scroll
  ClipCard.tsx        # HLS player, action rail, double-tap like, progress bar
  TopBar.tsx          # logo, scope pill, MIX/TOP/NEW tabs, time range, mute
lib/
  recommend.ts        # seeded shuffle + weighted pool mixing + favorites boost
  kick.ts             # got-scraping fetcher, types, in-memory cache
  format.ts           # compact numbers, durations, relative time
  likes.ts            # localStorage-backed likes
  watched.ts          # localStorage-backed watch history
  affinity.ts         # localStorage-backed taste profile (categories/channels)
  settings.ts         # localStorage-backed preferences (18+ filter)
```

## Contributing

PRs welcome. Some ideas:

- Search (channels, categories)
- Language filters
- A "liked clips" page built from local likes
- Service worker for offline shell / faster repeat visits

## Disclaimer

KickTok is a fan-made, open-source project. It is **not affiliated with, endorsed by, or connected to Kick** in any way. All clips, usernames, and avatars belong to their creators and are loaded from Kick's own CDN. It uses an undocumented API that may change or break at any time.

## License

[MIT](LICENSE)

---

# ⚡ KickTok (Español)

[English](#-kicktok) · **Español**

Un feed vertical de clips de [Kick.com](https://kick.com), de código abierto.

Los streamers de Kick generan clips geniales todos los días, pero no hay un lugar claro donde descubrirlos — la mayoría muere con un puñado de vistas. KickTok les da una segunda vida: un feed de video corto a pantalla completa, con scroll que encaja clip a clip, donde puedes ver lo mejor de la plataforma y saltar directo al canal del streamer.

## Características

- 📱 **Feed vertical a pantalla completa** — scroll con snap, autoplay, un clip a la vez
- 🎲 **Modo MIX (por defecto)** — un feed de recomendaciones mezclado, distinto en cada refresco
- 🧠 **Historial de vistos** — MIX recuerda lo que ya viste (localmente) y lo salta
- 💚 **MIX personalizado** — tus likes e historial (guardados localmente) adelantan en el mazo los clips de tus categorías y canales favoritos
- ⏩ **Seek y avance automático** — arrastra la barra de progreso para adelantar, y el feed pasa solo al siguiente clip cuando uno termina
- 🔞 **Filtro 18+** — un toque en la barra superior oculta los clips marcados como contenido maduro
- 🎯 **Feeds por canal y categoría** — toca el nombre/avatar de un streamer (`/c/[slug]`) o el chip de categoría (`/g/[slug]`) para ver solo eso
- 🔥 **Filtros de tendencias** — los clips más vistos de las últimas 24h / 7d / 30d / siempre, o los más nuevos
- ♾️ **Scroll infinito** — paginación por cursor directa del feed de clips de Kick
- ❤️ **Doble toque para dar like** — con su explosión de corazón (los likes se guardan localmente)
- 📤 **Compartir** — hoja de compartir nativa en móvil, copiar enlace en escritorio
- ⚡ **Directo al streamer** — cada tarjeta enlaza al clip en Kick
- ⌨️ **Navegación por teclado** — `↑` `↓` para moverte entre clips, `M` para silenciar, clic para pausar
- 🎞️ **Reproducción HLS** — hls.js en todos los navegadores, HLS nativo en Safari/iOS, con indicador de buffering
- 📲 **Instalable** — manifest PWA, funciona como app de pantalla de inicio en móvil

## Cómo funciona el feed MIX

La API de Kick solo ofrece ordenamientos deterministas (`view`/`date`), así que un feed ingenuo muestra los mismos clips en el mismo orden en cada visita. El feed MIX construye en su lugar un **mazo de recomendaciones**:

1. Se descargan cuatro fuentes en paralelo: tendencias de **hoy**, de **la semana**, del **mes**, y los **clips más recientes** (que es como los streamers pequeños ganan visibilidad).
2. Cada solicitud recibe una **semilla** aleatoria. Un PRNG con semilla (mulberry32) mezcla cada fuente de forma determinista.
3. El mazo se reparte por **round-robin ponderado** entre fuentes — 40% éxitos de hoy, 25% semanales, 15% mensuales, 20% recién subidos — eliminando duplicados.
4. La paginación reutiliza la misma semilla, así el scroll es estable dentro de una sesión; refrescar genera una semilla nueva y un feed nuevo. Cuando el mazo se agota, el cliente vuelve a mezclar con otra semilla y sigue, saltando los clips ya vistos.
5. Si ya diste likes o viste clips, el navegador envía tus categorías y canales favoritos (calculados localmente, nunca guardados en el servidor) junto con la semilla, y los clips que coinciden se promueven de forma determinista dentro del mazo.

## Cómo llega a Kick

Kick no tiene API oficial de clips, y la no documentada (`kick.com/api/v2/clips`) está detrás del fingerprinting TLS de Cloudflare — un `fetch`/`curl` normal recibe 403. KickTok usa route handlers de Next.js (`/api/feed`, `/api/clips`) que consultan el listado con [`got-scraping`](https://github.com/apify/got-scraping), que presenta un handshake TLS de navegador real. Las respuestas se cachean en memoria 60s para minimizar el tráfico hacia Kick.

Los videos se sirven desde el CDN público de Kick (`clips.kick.com`) con CORS abierto, así que la reproducción ocurre directamente en tu navegador — ningún video pasa por el servidor.

## Primeros pasos

```bash
git clone <este-repo>
cd kicktok
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) y haz scroll.

> **Nota:** se despliega bien en cualquier host con Node (Vercel, Railway, un VPS…). La API de Kick se consulta desde el servidor, así que hosts cuyas IPs de salida no le gusten a Cloudflare pueden ver 403 ocasionales.

## Contribuir

Los PRs son bienvenidos. Algunas ideas:

- Búsqueda (canales, categorías)
- Filtros por idioma
- Una página de "clips que me gustaron" a partir de los likes locales
- Service worker para shell offline / visitas repetidas más rápidas

## Aviso legal

KickTok es un proyecto de fans, de código abierto. **No está afiliado, respaldado ni conectado con Kick** de ninguna manera. Todos los clips, nombres de usuario y avatares pertenecen a sus creadores y se cargan desde el propio CDN de Kick. Usa una API no documentada que puede cambiar o romperse en cualquier momento.

## Licencia

[MIT](LICENSE)
