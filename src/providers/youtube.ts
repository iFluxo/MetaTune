import type { Provider, SongMetadata } from "../types.js";

const YOUTUBE = "youtube" as Provider;

const SEARCH_URL = "https://music.youtube.com/youtubei/v1/search?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.178 Safari/537.36";

interface Run {
    text?: string;
    navigationEndpoint?: { watchEndpoint?: { videoId?: string } };
}

interface FlexColumn {
    musicResponsiveListItemFlexColumnRenderer?: { text?: { runs?: Run[] } };
}

interface Thumbnail {
    url?: string;
}

interface YouTubeItem {
    playlistItemData?: { videoId?: string };
    thumbnail?: {
        musicThumbnailRenderer?: {
            thumbnail?: { thumbnails?: Thumbnail[] };
        };
    };
    flexColumns?: FlexColumn[];
}

interface SearchSection {
    itemSectionRenderer?: { contents?: Array<{ musicResponsiveListItemRenderer?: YouTubeItem }> };
}

interface SearchResponse {
    contents?: {
        tabbedSearchResultsRenderer?: {
            tabs?: Array<{
                tabRenderer?: {
                    content?: { sectionListRenderer?: { contents?: SearchSection[] } };
                };
            }>;
        };
    };
}

function runsText(column?: FlexColumn): string {
    return column?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map((run) => run.text ?? "").join("") ?? "";
}

/** Searches YouTube Music tracks. */
export async function youtubeSearch(query: string, limit = 10): Promise<SongMetadata[]> {
    const res = await fetch(SEARCH_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
        body: JSON.stringify({
            context: {
                client: {
                    clientName: "WEB_REMIX",
                    clientVersion: "1.20240101.01.00",
                    hl: "en",
                    gl: "US",
                },
            },
            query,
        }),
    });

    if (!res.ok) {
        throw new Error(`YouTube Music search returned HTTP ${res.status}`);
    }

    const json = (await res.json()) as SearchResponse;
    const sections = json.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents ?? [];

    const results: SongMetadata[] = [];

    for (const section of sections) {
        for (const entry of section.itemSectionRenderer?.contents ?? []) {
            const item = entry.musicResponsiveListItemRenderer;
            if (!item) continue;

            const flex = item.flexColumns ?? [];
            const titleRuns = flex[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? [];
            const title = runsText(flex[0]);
            const meta = runsText(flex[1])
                .split("•")
                .map((part) => part.trim());
            const kind = meta[0];

            if (kind !== "Song" && kind !== "Video") continue;

            const videoId = item.playlistItemData?.videoId ?? titleRuns[0]?.navigationEndpoint?.watchEndpoint?.videoId;
            if (!videoId || !title) continue;

            const thumbnails = item.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? [];
            const cover = thumbnails.at(-1)?.url?.replace(/=w\d+-h\d+/, "=w544-h544");

            results.push({
                provider: YOUTUBE,
                title,
                artist: meta[1] ?? "",
                album: meta[2],
                coverUrl: cover,
                url: `https://music.youtube.com/watch?v=${videoId}`,
                raw: item as unknown as Record<string, unknown>,
            });

            if (results.length >= limit) return results;
        }
    }

    return results;
}

/** Returns metadata for the top YouTube Music result. */
export async function youtubeMetadata(query: string): Promise<SongMetadata> {
    const [track] = await youtubeSearch(query, 1);

    if (!track) {
        throw new Error(`No YouTube Music result found for "${query}"`);
    }

    return track;
}
