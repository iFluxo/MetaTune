import { AppleMusic, Deezer, SoundCloud, Spotify, Tidal, YTMusic } from "../dist/index.js";

const providers = [
    ["Spotify", Spotify, "The Weeknd"],
    ["Deezer", Deezer, "The Weeknd"],
    ["Apple Music", AppleMusic, "Blinding Lights"],
    ["Tidal", Tidal, "The Weeknd"],
    ["SoundCloud", SoundCloud, "The Weeknd"],
    ["YouTube Music", YTMusic, "The Weeknd"],
];

for (const [name, provider, query] of providers) {
    try {
        const results = await provider.search(query, 5);
        console.log(`\n${name} — ${results.length} result(s) for "${query}"`);

        results.forEach((song, index) => {
            const duration = song.durationMs ? `${Math.round(song.durationMs / 1000)}s` : "-";
            console.log(`${index + 1}. ${song.title} — ${song.artist} (${song.album ?? "-"}, ${duration})`);
        });
    } catch (error) {
        console.error(`${name} failed: ${error.message}`);
    }
}

const single = await Spotify.metadata("https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b");
console.log(`\nSpotify metadata: ${single.title} — ${single.artist}`);
