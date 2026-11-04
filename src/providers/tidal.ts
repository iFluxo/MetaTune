import type { Provider, SongMetadata } from "../types.js";

const TIDAL = "tidal" as Provider;

const SEARCH_URL = "https://api.tidal.com/v1/search/tracks";
const COUNTRY = "US";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.178 Safari/537.36";

/**
 * Public client tokens used by the Tidal web player. Multiple tokens are kept
 * so the provider keeps working if one of them is revoked.
 */
const TIDAL_TOKENS = ["CzET4vdadNUFQ5JU", "wc8j_yBJd20zOmx0"];

interface TidalTrack {
    id: number;
    title: string;
    duration?: number; // seconds
    artist?: { name?: string };
    artists?: Array<{ name?: string }>;
    album?: { title?: string; cover?: string };
}

function coverUrl(cover?: string): string | undefined {
    return cover ? `https://resources.tidal.com/images/${cover.replace(/-/g, "/")}/640x640.jpg` : undefined;
}

/** Returns metadata for the top Tidal result. */
export async function tidalMetadata(query: string): Promise<SongMetadata> {
    const [track] = await tidalSearch(query, 1);

    if (!track) {
        throw new Error(`No Tidal result found for "${query}"`);
    }

    return track;
}

/** Searches Tidal tracks. */
export async function tidalSearch(query: string, limit = 10): Promise<SongMetadata[]> {
    const url = `${SEARCH_URL}?query=${encodeURIComponent(query)}&limit=${Math.min(limit, 100)}&countryCode=${COUNTRY}`;

    let lastStatus = 0;

    for (const token of TIDAL_TOKENS) {
        const res = await fetch(url, {
            headers: { "X-Tidal-Token": token, "User-Agent": USER_AGENT },
        });

        if (res.status === 401 || res.status === 403) {
            lastStatus = res.status;
            continue;
        }

        if (!res.ok) {
            throw new Error(`Tidal search returned HTTP ${res.status}`);
        }

        const data = (await res.json()) as { items?: TidalTrack[] };
        const items = data.items ?? [];

        return items.slice(0, limit).map(
            (track): SongMetadata => ({
                provider: TIDAL,
                title: track.title,
                artist:
                    track.artists
                        ?.map((artist) => artist.name)
                        .filter(Boolean)
                        .join(", ") ??
                    track.artist?.name ??
                    "",
                album: track.album?.title,
                coverUrl: coverUrl(track.album?.cover),
                url: `https://tidal.com/browse/track/${track.id}`,
                durationMs: track.duration ? track.duration * 1000 : undefined,
                raw: track as unknown as Record<string, unknown>,
            }),
        );
    }

    throw new Error(`Tidal search failed: token rejected (HTTP ${lastStatus})`);
}
