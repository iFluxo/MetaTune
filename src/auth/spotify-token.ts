/**
 * Spotify token manager.
 *
 * Creates anonymous access tokens natively from Spotify's TOTP-protected
 * token endpoint. Tokens are cached until shortly before they expire.
 *
 * No API key or external service is required.
 */

import { generateTOTP, spotifyTotpSecrets } from "./totp.js";

const TOKEN_URL = "https://open.spotify.com/api/token";
const SERVER_TIME_URL = "https://open.spotify.com/api/server-time";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.178 Safari/537.36";

const EXPIRY_TOLERANCE_MS = 60_000;
const FALLBACK_TTL_MS = 50 * 60_000;

interface CachedToken {
    accessToken: string;
    expiresAt: number;
}

let cachedToken: CachedToken | null = null;

/** Clears the cache so the next call requests a fresh token. */
export function invalidateToken(): void {
    cachedToken = null;
}

/** Returns Spotify's server time in Unix seconds, when available. */
async function fetchServerTime(): Promise<number | undefined> {
    try {
        const res = await fetch(SERVER_TIME_URL, {
            headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        });

        if (!res.ok) return undefined;

        const data = (await res.json()) as { serverTime?: unknown };
        const serverTime = Number(data.serverTime);

        return Number.isFinite(serverTime) && serverTime > 0 ? serverTime : undefined;
    } catch {
        return undefined;
    }
}

function readExpiry(data: Record<string, unknown>): number {
    const value = data.accessTokenExpirationTimestampMs;

    return typeof value === "number" && Number.isFinite(value) ? value : Date.now() + FALLBACK_TTL_MS;
}

/** Returns a valid anonymous Spotify access token. */
export async function getSpotifyToken(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now() + EXPIRY_TOLERANCE_MS) {
        return cachedToken.accessToken;
    }

    const serverTime = await fetchServerTime();
    const headers = { "User-Agent": USER_AGENT, Accept: "application/json" };
    let lastError = "no TOTP secret available";

    for (const { version, key } of spotifyTotpSecrets()) {
        const totp = await generateTOTP(key);
        const totpServer = serverTime ? await generateTOTP(key, serverTime * 1000) : "unavailable";

        const params = new URLSearchParams({
            reason: "init",
            productType: "web_player",
            totp,
            totpServer,
            totpVer: String(version),
        });

        try {
            const res = await fetch(`${TOKEN_URL}?${params.toString()}`, { headers });
            const raw = await res.text();

            if (!res.ok) {
                lastError = `HTTP ${res.status} (totpVer ${version})`;
                continue;
            }

            let data: Record<string, unknown>;
            try {
                data = JSON.parse(raw) as Record<string, unknown>;
            } catch {
                lastError = `invalid JSON response (totpVer ${version})`;
                continue;
            }

            const accessToken = data.accessToken;
            if (typeof accessToken !== "string" || accessToken.length === 0) {
                lastError = `missing accessToken (totpVer ${version})`;
                continue;
            }

            cachedToken = { accessToken, expiresAt: readExpiry(data) };
            return accessToken;
        } catch (err) {
            lastError = (err as Error).message;
        }
    }

    throw new Error(`Failed to create a native Spotify token: ${lastError}`);
}
