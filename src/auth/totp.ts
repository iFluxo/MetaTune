/**
 * Time-based one-time passwords (RFC 6238) for the Spotify web player.
 *
 * Spotify ships its TOTP secrets in an obfuscated form. Each character is
 * XORed with `(index % 33) + 9`; the resulting decimal string is used as the
 * HMAC key, matching the exact behavior of Spotify's player code.
 *
 * Uses only the standard Web Crypto API, so it runs on Bun, Deno, Node.js
 * 22+, and modern browsers.
 */

export interface SpotifyTotpSecret {
    readonly version: number;
    readonly key: Uint8Array;
}

/** Secrets extracted from the Spotify web player bundle. */
const OBFUSCATED_SECRETS: ReadonlyArray<{ secret: string; version: number }> = [
    { secret: ',7/*F("rLJ2oxaKL^f+E1xvP@N', version: 61 },
    { secret: 'OmE{ZA.J^":0FG\\Uz?[@WW', version: 60 },
    { secret: "{iOFn;4}<1PFYKPV?5{%u14]M>/V0hDH", version: 59 },
];

const PERIOD_SECONDS = 30;
const DIGITS = 6;
const MODULO = 10 ** DIGITS;

function deobfuscateSecret(secret: string): Uint8Array {
    let decimal = "";

    for (let index = 0; index < secret.length; index++) {
        decimal += String(secret.charCodeAt(index) ^ ((index % 33) + 9));
    }

    return new TextEncoder().encode(decimal);
}

let cachedSecrets: readonly SpotifyTotpSecret[] | null = null;

/** Returns every known secret, newest version first. */
export function spotifyTotpSecrets(): readonly SpotifyTotpSecret[] {
    if (!cachedSecrets) {
        cachedSecrets = OBFUSCATED_SECRETS.map(({ secret, version }) => ({
            version,
            key: deobfuscateSecret(secret),
        }));
    }

    return cachedSecrets;
}

/**
 * Generates a six-digit TOTP using HMAC-SHA1 and a 30-second period.
 *
 * @param key Raw HMAC key.
 * @param epoch Time in milliseconds. Defaults to the current time.
 */
export async function generateTOTP(key: Uint8Array, epoch = Date.now()): Promise<string> {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) {
        throw new Error("Web Crypto API is not available in this runtime");
    }

    const counter = Math.floor(epoch / 1000 / PERIOD_SECONDS);
    const message = new ArrayBuffer(8);
    new DataView(message).setBigInt64(0, BigInt(counter), false);

    // Copy into a fresh buffer so the key is always a plain ArrayBuffer-backed view.
    const rawKey = Uint8Array.from(key);

    const cryptoKey = await subtle.importKey("raw", rawKey, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);

    const signature = await subtle.sign("HMAC", cryptoKey, message);
    const hmac = new Uint8Array(signature);

    // Dynamic truncation as defined by RFC 4226.
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
        ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);

    return (binary % MODULO).toString().padStart(DIGITS, "0");
}
