import { fetchJson } from "../client.js";
import type { Provider, SongMetadata } from "../types.js";

const DEEZER = "deezer" as Provider;

const SEARCH_URL = "https://api.deezer.com/search";

interface DeezerTrack {
    id: number;
    title: string;
    artist: { name: string };
    album?: { title: string; cover_medium?: string; cover_big?: string };
    link?: string;
    preview?: string;
    duration?: number; // seconds
}

/** Returns metadata for the top Deezer result. */
export async function deezerMetadata(query: string): Promise<SongMetadata> {
    const [track] = await deezerSearch(query, 1);

    if (!track) {
        throw new Error(`No Deezer result found for "${query}"`);
    }

    return track;
}

/** Searches Deezer tracks. */
export async function deezerSearch(query: string, limit = 10): Promise<SongMetadata[]> {
    const url = `${SEARCH_URL}?q=${encodeURIComponent(query)}&limit=${Math.min(limit, 50)}`;

    const data = await fetchJson<{ data?: DeezerTrack[] }>(url);
    const items = data.data ?? [];

    return items.map(
        (track): SongMetadata => ({
            provider: DEEZER,
            title: track.title,
            artist: track.artist?.name ?? "",
            album: track.album?.title,
            coverUrl: track.album?.cover_big ?? track.album?.cover_medium,
            url: track.link,
            durationMs: track.duration ? track.duration * 1000 : undefined,
            previewUrl: track.preview,
            raw: track as unknown as Record<string, unknown>,
        }),
    );
}
