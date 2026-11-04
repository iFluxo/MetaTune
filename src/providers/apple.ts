import { fetchJson } from "../client.js";
import type { Provider, SongMetadata } from "../types.js";

const APPLE = "apple" as Provider;

const SEARCH_URL = "https://itunes.apple.com/search";

interface ItunesResult {
    trackName: string;
    artistName: string;
    collectionName?: string;
    artworkUrl100?: string;
    trackViewUrl?: string;
    previewUrl?: string;
    trackTimeMillis?: number;
}

/** Returns metadata for the top Apple Music result. */
export async function appleMetadata(query: string): Promise<SongMetadata> {
    const [track] = await appleSearch(query, 1);

    if (!track) {
        throw new Error(`No Apple Music result found for "${query}"`);
    }

    return track;
}

/** Searches Apple Music tracks via the iTunes Search API. */
export async function appleSearch(query: string, limit = 10): Promise<SongMetadata[]> {
    const url = `${SEARCH_URL}?term=${encodeURIComponent(query)}&entity=musicTrack&limit=${Math.min(limit, 200)}&country=US`;

    const data = await fetchJson<{ results?: ItunesResult[] }>(url);
    const items = data.results ?? [];

    return items.map(
        (track): SongMetadata => ({
            provider: APPLE,
            title: track.trackName,
            artist: track.artistName,
            album: track.collectionName,
            coverUrl: track.artworkUrl100?.replace("100x100", "600x600"),
            url: track.trackViewUrl,
            durationMs: track.trackTimeMillis,
            previewUrl: track.previewUrl,
            raw: track as unknown as Record<string, unknown>,
        }),
    );
}
