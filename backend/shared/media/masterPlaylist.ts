export interface HLSVariant {
    height: number;
    width: number;
    bandwidth: number;
}

export function createMasterPlaylist(
    variants: HLSVariant[]
): string {
    const lines = [
        "#EXTM3U",
        "#EXT-X-VERSION:3",
        "",
    ];

    for (const variant of variants) {
        lines.push(
            `#EXT-X-STREAM-INF:BANDWIDTH=${variant.bandwidth},RESOLUTION=${variant.width}x${variant.height}`
        );

        lines.push(
            `${variant.height}p/playlist.m3u8`
        );

        lines.push("");
    }

    return lines.join("\n");
}