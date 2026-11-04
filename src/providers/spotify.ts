import { getSpotifyToken, invalidateToken } from "../auth/spotify-token.js";
import { fetchJson } from "../client.js";
import type { Provider, SongMetadata } from "../types.js";

const SPOTIFY = "spotify" as Provider;

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.178 Safari/537.36";

const PARTNER_URL = "https://api-partner.spotify.com/pathfinder/v1/query";
const SEARCH_HASH = "fcad5a3e0d5af727fb76966f06971c19cfa2275e6ff7671196753e008611873c";
const APP_VERSION = "1.2.80.289.gd6b01cc3";

interface SpotifyTrack {
    id: string;
    name: string;
    artists: Array<{ name: string }>;
    album: { name: string; images: Array<{ url: string }> };
    external_urls: { spotify: string };
    duration_ms: number;
    preview_url: string | null;
}

interface PartnerTrack {
    name?: string;
    uri?: string;
    artists?: { items?: Array<{ profile?: { name?: string } }> };
    albumOfTrack?: {
        name?: string;
        coverArt?: { sources?: Array<{ url?: string }> };
    };
    duration?: { totalMilliseconds?: number };
}

interface EmbedEntity {
    title?: string;
    name?: string;
    artists?: Array<{ name?: string }>;
    duration?: number;
    audioPreview?: { url?: string } | null;
    visualIdentity?: {
        image?: Array<{ url?: string; maxWidth?: number }>;
    };
}

/** Reads the public embed page payload for a track. */
async function fetchEmbedEntity(trackId: string): Promise<EmbedEntity | null> {
    const res = await fetch(`https://open.spotify.com/embed/track/${trackId}`, {
        headers: { "User-Agent": USER_AGENT },
    });

    if (!res.ok) return null;

    const html = await res.text();
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match) return null;

    try {
        const data = JSON.parse(match[1]) as {
            props?: { pageProps?: { state?: { data?: { entity?: EmbedEntity } } } };
        };

        return data.props?.pageProps?.state?.data?.entity ?? null;
    } catch {
        return null;
    }
}

/** Extracts a Spotify track ID from a URL, URI, or raw ID. */
export function extractSpotifyTrackId(input: string): string | null {
    const trimmed = input.trim();

    const uriMatch = trimmed.match(/^spotify:track:([a-zA-Z0-9]+)$/);
    if (uriMatch) return uriMatch[1];

    const urlMatch = trimmed.match(/(?:open\.spotify\.com\/track\/)([a-zA-Z0-9]+)/);
    if (urlMatch) return urlMatch[1];

    if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) return trimmed;

    return null;
}

/** Fetches metadata for a single track via the public embed payload. */
export async function spotifyMetadata(query: string): Promise<SongMetadata> {
    const trackId = extractSpotifyTrackId(query);

    if (!trackId) {
        throw new Error("Spotify metadata requires a track URL or ID (for example: https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b)");
    }

    const url = `https://open.spotify.com/track/${trackId}`;
    const entity = await fetchEmbedEntity(trackId);

    if (entity) {
        const images = entity.visualIdentity?.image ?? [];
        const cover = images.reduce<{ url?: string; maxWidth?: number }>(
            (best, image) => ((image.maxWidth ?? 0) > (best.maxWidth ?? 0) ? image : best),
            {},
        );

        return {
            provider: SPOTIFY,
            title: entity.title ?? entity.name ?? "",
            artist:
                entity.artists
                    ?.map((artist) => artist.name)
                    .filter(Boolean)
                    .join(", ") ?? "",
            coverUrl: cover.url,
            url,
            durationMs: entity.duration,
            previewUrl: entity.audioPreview?.url ?? undefined,
            raw: entity as unknown as Record<string, unknown>,
        };
    }

    // Fall back to oEmbed when the embed payload is unavailable.
    const data = await fetchJson<Record<string, unknown>>(`https://open.spotify.com/oembed?url=${url}`);

    return {
        provider: SPOTIFY,
        title: (data.title as string) || "",
        artist: (data.author_name as string) || "",
        coverUrl: (data.thumbnail_url as string) || undefined,
        url,
        raw: data,
    };
}

/**
 * Searches Spotify tracks.
 *
 * The Partner API is used first because it works with anonymous tokens;
 * the public Web API is used as a fallback.
 */
export async function spotifySearch(query: string, limit = 10): Promise<SongMetadata[]> {
    const safeLimit = Math.min(limit, 50);

    try {
        return await partnerSearch(query, safeLimit);
    } catch {
        return await webApiSearch(query, safeLimit);
    }
}

/* ------------------------------- Partner API ----------------------------- */

function partnerRequest(token: string, payload: unknown): Promise<Response> {
    return fetch(PARTNER_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "Spotify-App-Version": APP_VERSION,
            "User-Agent": USER_AGENT,
            Referer: "https://open.spotify.com/",
        },
        body: JSON.stringify(payload),
    });
}

async function partnerSearch(query: string, limit: number): Promise<SongMetadata[]> {
    const payload = {
        variables: {
            searchTerm: query,
            offset: 0,
            limit,
            numberOfTopResults: 5,
            includeAudiobooks: true,
            includeArtistHasConcertsField: false,
            includePreReleases: true,
            includeAuthors: false,
        },
        operationName: "searchDesktop",
        extensions: {
            persistedQuery: { version: 1, sha256Hash: SEARCH_HASH },
        },
    };

    let token = await getSpotifyToken();
    let res = await partnerRequest(token, payload);

    if (res.status === 401) {
        invalidateToken();
        token = await getSpotifyToken();
        res = await partnerRequest(token, payload);
    }

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Spotify Partner API returned HTTP ${res.status}: ${body.slice(0, 150)}`);
    }

    const json = (await res.json()) as {
        data?: {
            searchV2?: {
                tracksV2?: { items?: Array<{ item?: { data?: PartnerTrack } }> };
            };
        };
    };

    const items = json.data?.searchV2?.tracksV2?.items ?? [];

    return items
        .map((entry) => entry.item?.data)
        .filter((track): track is PartnerTrack => Boolean(track?.uri))
        .slice(0, limit)
        .map(
            (track): SongMetadata => ({
                provider: SPOTIFY,
                title: track.name ?? "",
                artist:
                    track.artists?.items
                        ?.map((artist) => artist.profile?.name)
                        .filter(Boolean)
                        .join(", ") ?? "",
                album: track.albumOfTrack?.name,
                coverUrl: track.albumOfTrack?.coverArt?.sources?.[0]?.url,
                url: `https://open.spotify.com/track/${track.uri!.replace("spotify:track:", "")}`,
                durationMs: track.duration?.totalMilliseconds,
                raw: track as unknown as Record<string, unknown>,
            }),
        );
}

/* ----------------------------- Web API fallback -------------------------- */

async function webApiSearch(query: string, limit: number): Promise<SongMetadata[]> {
    const url = `https://api.spotify.com/v1/search?type=track&q=${encodeURIComponent(query)}&limit=${limit}&market=US`;

    const request = (token: string) => fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    let token = await getSpotifyToken();
    let res = await request(token);

    if (res.status === 401) {
        invalidateToken();
        token = await getSpotifyToken();
        res = await request(token);
    }

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Spotify Web API returned HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as { tracks?: { items?: SpotifyTrack[] } };
    const items = data.tracks?.items ?? [];

    return items.map(
        (track): SongMetadata => ({
            provider: SPOTIFY,
            title: track.name,
            artist: track.artists.map((artist) => artist.name).join(", "),
            album: track.album.name,
            coverUrl: track.album.images?.[0]?.url,
            url: track.external_urls.spotify,
            durationMs: track.duration_ms,
            previewUrl: track.preview_url ?? undefined,
            raw: track as unknown as Record<string, unknown>,
        }),
    );
}
