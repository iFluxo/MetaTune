import { appleMetadata, appleSearch } from "./providers/apple.js";
import { deezerMetadata, deezerSearch } from "./providers/deezer.js";
import { soundcloudMetadata, soundcloudSearch } from "./providers/soundcloud.js";
import { spotifyMetadata, spotifySearch } from "./providers/spotify.js";
import { tidalMetadata, tidalSearch } from "./providers/tidal.js";
import { youtubeMetadata, youtubeSearch } from "./providers/youtube.js";
import type { SongMetadata } from "./types.js";

export type { Provider, SongMetadata } from "./types.js";

/** Common interface implemented by every provider. */
export interface MusicProvider {
    /** Searches for multiple tracks. */
    search(query: string, limit?: number): Promise<SongMetadata[]>;
    /** Returns metadata for the top matching track. */
    metadata(query: string): Promise<SongMetadata>;
}

/** Spotify — anonymous TOTP tokens are generated automatically. */
export const Spotify: MusicProvider = {
    search: spotifySearch,
    metadata: spotifyMetadata,
};

/** Deezer — public search API. */
export const Deezer: MusicProvider = {
    search: deezerSearch,
    metadata: deezerMetadata,
};

/** Apple Music — public iTunes Search API. */
export const AppleMusic: MusicProvider = {
    search: appleSearch,
    metadata: appleMetadata,
};

/** Tidal — public web player search API. */
export const Tidal: MusicProvider = {
    search: tidalSearch,
    metadata: tidalMetadata,
};

/** SoundCloud — public API with an automatically resolved client ID. */
export const SoundCloud: MusicProvider = {
    search: soundcloudSearch,
    metadata: soundcloudMetadata,
};

/** YouTube Music — public InnerTube search API. */
export const YTMusic: MusicProvider = {
    search: youtubeSearch,
    metadata: youtubeMetadata,
};
