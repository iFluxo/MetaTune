<p align="center">
  <img src="https://raw.githubusercontent.com/iFluxo/MetaTune/refs/heads/main/assets/banner.png" alt="MetaTune — song metadata from six providers" width="100%" />
</p>

<h1 align="center">MetaTune</h1>

<p align="center">
  <strong>Song metadata from Spotify, Deezer, Apple Music, Tidal, SoundCloud, and YouTube Music.</strong><br />
  Zero configuration. Zero dependencies. ESM + TypeScript.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/metatune"><img src="https://img.shields.io/npm/v/metatune.svg?style=for-the-badge&logo=npm&logoColor=red" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/metatune"><img src="https://img.shields.io/npm/dt/metatune.svg?style=for-the-badge&logo=npm&logoColor=red" alt="npm downloads" /></a>
  <a href="https://github.com/iFluxo/MetaTune/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/metatune.svg?style=for-the-badge" alt="license" /></a>
  <a href="https://github.com/iFluxo/MetaTune/actions/workflows/ci.yml"><img src="https://github.com/iFluxo/MetaTune/actions/workflows/ci.yml/badge.svg?branch=main&style=for-the-badge" alt="CI" /></a>
</p>

<p align="center">
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://bun.sh/"><img src="https://img.shields.io/badge/Bun-000000.svg?style=for-the-badge&logo=bun&logoColor=white" alt="Bun" /></a>
  <a href="https://deno.com/"><img src="https://img.shields.io/badge/Deno-000000.svg?style=for-the-badge&logo=deno&logoColor=white" alt="Deno" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-22%2B-339933.svg?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js 22+" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Made%20with%20%E2%99%A5%20in%20Indonesia-CE1126.svg?style=for-the-badge" alt="Made with ♥ in Indonesia" />
  <a href="https://github.com/iFluxo/MetaTune"><img src="https://img.shields.io/badge/GitHub-iFluxo%2FMetaTune-181717.svg?style=for-the-badge&logo=github" alt="GitHub" /></a>
</p>

<p align="center">
  <a href="https://nodei.co/npm/metatune/"><img src="https://nodei.co/npm/metatune.png?downloads=true&stars=true" alt="npm install metatune" /></a>
</p>

---

## Installation

```bash
# Bun
bun add metatune

# npm
npm install metatune

# Deno
deno add npm:metatune
```

## Usage

```ts
import {
  AppleMusic,
  Deezer,
  SoundCloud,
  Spotify,
  Tidal,
  YTMusic,
} from 'metatune';

// Search multiple tracks (default limit: 10)
const songs = await Spotify.search('The Weeknd', 5);

// Get the top matching track
const song = await Tidal.metadata('Blinding Lights');
```

Every provider exposes the same interface:

```ts
provider.search(query: string, limit?: number): Promise<SongMetadata[]>
provider.metadata(query: string): Promise<SongMetadata>
```

```ts
import type { SongMetadata } from 'metatune';

interface SongMetadata {
  provider: 'spotify' | 'deezer' | 'apple' | 'tidal' | 'soundcloud' | 'youtube';
  title: string;
  artist: string;
  album?: string;
  coverUrl?: string;
  url?: string;
  durationMs?: number;
  previewUrl?: string;
  raw?: Record<string, unknown>;
}
```

## Providers

| Export | Provider | Authentication |
| --- | --- | --- |
| `Spotify` | Spotify | Anonymous TOTP token generated automatically |
| `Deezer` | Deezer | None |
| `AppleMusic` | Apple Music | None |
| `Tidal` | Tidal | Public web player token |
| `SoundCloud` | SoundCloud | Public client ID resolved automatically |
| `YTMusic` | YouTube Music | None |

`Spotify.metadata()` accepts a track URL or ID:

```ts
await Spotify.metadata(
  'https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b'
);
```

## Runtime support

| Runtime | Status |
| --- | --- |
| Bun | Supported |
| Deno | Supported |
| Node.js 22+ | Supported |
| Modern browsers | Supported through a bundler, subject to each service's CORS policy |

The library uses only standard APIs: `fetch`, `URLSearchParams`, `TextEncoder`, and `crypto.subtle`.

## Development

```bash
bun install
bun run typecheck
bun run demo
```

## License

MIT
