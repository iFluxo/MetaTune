import type { Provider, SongMetadata } from "../types.js";

const SOUNDCLOUD = "soundcloud" as Provider;

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.178 Safari/537.36";

const CLIENT_ID_TTL_MS = 60 * 60_000;

interface SoundCloudTrack {
    id: number;
    title: string;
    duration?: number;
    full_duration?: number;
    artwork_url?: string | null;
    permalink_url?: string;
    user?: { username?: string };
}

interface CachedClientId {
    id: string;
    expiresAt: number;
}

let cachedClientId: CachedClientId | null = null;

/** Extracts the public client ID from the SoundCloud application bundle. */
async function getClientId(force = false): Promise<string> {
    if (!force && cachedClientId && cachedClientId.expiresAt > Date.now()) {
        return cachedClientId.id;
    }

    const page = await fetch("https://soundcloud.com/", {
        headers: { "User-Agent": USER_AGENT },
    });

    if (!page.ok) {
        throw new Error(`SoundCloud page returned HTTP ${page.status}`);
    }

    const html = await page.text();
    const scripts = [...html.matchAll(/src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g)].map((match) => match[1]);

    const found = await Promise.all(
        scripts.map(async (script) => {
            try {
                const js = await (await fetch(script)).text();
                return js.match(/client_id[=:]\s*["']([a-zA-Z0-9]{20,})["']/)?.[1];
            } catch {
                return undefined;
            }
        }),
    );

    const clientId = found.find(Boolean);
    if (!clientId) {
        throw new Error("SoundCloud client ID could not be resolved");
    }

    cachedClientId = { id: clientId, expiresAt: Date.now() + CLIENT_ID_TTL_MS };
    return clientId;
}

function artwork(url?: string | null): string | undefined {
    return url?.replace("-large", "-t500x500") ?? undefined;
}

async function search(query: string, limit: number, clientId: string): Promise<Response> {
    const url = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(
        query,
    )}&client_id=${clientId}&limit=${Math.min(limit, 100)}`;

    return fetch(url, { headers: { "User-Agent": USER_AGENT } });
}

/** Returns metadata for the top SoundCloud result. */
export async function soundcloudMetadata(query: string): Promise<SongMetadata> {
    const [track] = await soundcloudSearch(query, 1);

    if (!track) {
        throw new Error(`No SoundCloud result found for "${query}"`);
    }

    return track;
}

/** Searches SoundCloud tracks. */
export async function soundcloudSearch(query: string, limit = 10): Promise<SongMetadata[]> {
    let clientId = await getClientId();
    let res = await search(query, limit, clientId);

    if (res.status === 401 || res.status === 403) {
        clientId = await getClientId(true);
        res = await search(query, limit, clientId);
    }

    if (!res.ok) {
        throw new Error(`SoundCloud search returned HTTP ${res.status}`);
    }

    const data = (await res.json()) as { collection?: SoundCloudTrack[] };
    const items = data.collection ?? [];

    return items.slice(0, limit).map(
        (track): SongMetadata => ({
            provider: SOUNDCLOUD,
            title: track.title,
            artist: track.user?.username ?? "",
            coverUrl: artwork(track.artwork_url),
            url: track.permalink_url,
            durationMs: track.full_duration ?? track.duration,
            raw: track as unknown as Record<string, unknown>,
        }),
    );
}
