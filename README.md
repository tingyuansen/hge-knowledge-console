# HGE Knowledge Console

A literature-grounded knowledge base and answering surface for the **Hidden
Galaxy Explorer (HGE)** — an APOGEE-style near-infrared spectroscopic survey
concept inside SDSS-V's *After Sloan 5*, aimed at mapping the obscured far side
of the Milky Way disk and the full Galactic bulge/bar.

**Live console:** <https://tingyuansen.github.io/hge-knowledge-console/>

Every claim in every answer traces back to a verbatim quote from one of the
**6,415** retained galactic-archaeology arXiv papers in the underlying knowledge
base. No estimates, no synthesis on top of synthesis.

## What's behind it

A four-layer extraction over the corpus — curated full text, per-paper
quote-grounded deep reads, a curated vocabulary of **64,691** canonical entities,
typed numeric specs, and a GraphRAG of communities and relationships. An agent
dispatches each question to the right retrieval primitives, then synthesises a
cited answer with a Hidden-Galaxy-Explorer **science-case scorecard** and
follow-up questions.

## Models

Generation and embeddings run entirely on the **Google Gemini API**:

| Use | Model |
|---|---|
| Dispatch + answer synthesis | `gemini-3.5-flash` |
| Semantic retrieval (`concept_search`) | `gemini-embedding-001` |

## This repository

This repo is the **static front-end** only — a dependency-free site (React +
Babel from a CDN, a vanilla data layer), no build step. It's served by GitHub
Pages and talks to a FastAPI backend over HTTP. The backend (KB + agent loop)
and the knowledge-base indexes live separately.

### How it finds the backend

`index.html` resolves the backend URL in this order:

1. `?api=<url>` query parameter (ad-hoc override),
2. a pre-set `window.__HGE_API__`,
3. otherwise: `http://127.0.0.1:8000` on localhost, or the live backend
   (`https://hge-knowledge-api.fly.dev`) when served from GitHub Pages.

So the same files work both locally (run a backend, open the page) and in
production. If the backend is unreachable, the console shows a styled
"backend unavailable" overlay rather than fixture data — it never shows fake
results. **No secrets ever live in the browser**; all credentials stay on the
backend.

## Deploy

Served by GitHub Pages from this repository's default branch (root); it
redeploys on every push.

## Attribution

Part of the Hidden Galaxy Explorer / SDSS-V After Sloan 5 design effort.
Knowledge-base author: Yuan-Sen Ting (<ting.74@osu.edu>).
