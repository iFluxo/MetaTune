/** Providers supported by the library. */
export type Provider = "spotify" | "deezer" | "apple" | "tidal" | "soundcloud" | "youtube";

/** Normalized metadata returned by every provider. */
export interface SongMetadata {
    provider: Provider;
    title: string;
    artist: string;
    album?: string;
    coverUrl?: string;
    url?: string;
    durationMs?: number;
    previewUrl?: string;
    raw?: Record<string, unknown>;
}
