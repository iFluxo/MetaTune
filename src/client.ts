const USER_AGENT = "MetaTune/1.0";

/** Minimal JSON fetch helper with a consistent user agent. */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/json",
            ...(init?.headers ?? {}),
        },
        ...init,
    });

    if (!res.ok) {
        throw new Error(`HTTP ${res.status} while requesting ${url}`);
    }

    return (await res.json()) as T;
}
