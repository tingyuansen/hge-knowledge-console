# HGE Knowledge Console (static front-end)

The public, editorial front-end for the **Hidden Galaxy Explorer** knowledge
base. This is a dependency-free static site (React + Babel from a CDN, vanilla
data layer) — no build step. It talks to a FastAPI backend over HTTP.

**Live:** <https://tingyuansen.github.io/hge-knowledge-console/>

## Backend URL

`index.html` resolves the backend in this order:

1. `?api=<url>` query parameter (ad-hoc override),
2. a pre-set `window.__HGE_API__`,
3. otherwise: `http://127.0.0.1:8000` when opened on localhost, or the live
   Fly backend (`https://hge-knowledge-api.fly.dev`) when served from GitHub
   Pages.

So the same files work both locally (run the backend, open the file) and in
production (GitHub Pages → live backend). If the backend is down, the console
shows a styled "backend unavailable" overlay rather than fixture data.

## Deploy

Served by GitHub Pages from this repository's default branch (root).
No secrets ever live in the browser — all credentials stay on the backend.
