import { NextRequest, NextResponse } from "next/server";
import { CreditsBalanceQuery, StyleGuideQuery, InspirationImagesQuery } from "@/convex/query.config";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const MAX_HTML_SIZE = 100_000; // 100KB max HTML input
export const MAX_IMAGE_COUNT = 10;

export type RouteContext = {
    styleGuide: {
        colorSections: unknown[];
        typographySections: unknown[];
    };
    imageUrls: string[];
};


const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 req/min per IP
});

export async function checkRateLimit(request: NextRequest): Promise<NextResponse | null> {
    const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
    const { success } = await ratelimit.limit(ip);
    if (!success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    return null;
}

export async function validateAndFetchContext(
    projectId: string,
    options: { fetchImages?: boolean } = {}
): Promise<{ error: NextResponse } | { context: RouteContext }> {
    // Credits check
    const { ok: balanceOk, balance } = await CreditsBalanceQuery();
    if (!balanceOk || balance === 0) {
        return {
            error: NextResponse.json({ error: "No credits available" }, { status: 402 }),
        };
    }

    // Style guide
    const styleGuide = await StyleGuideQuery(projectId);
    const styleGuideData = (styleGuide?.styleGuide?._valueJSON ?? {}) as any;
    const colorSections = Object.values(styleGuideData?.colorSections ?? {});
    const typographySections = styleGuideData?.typographySections ?? [];

    // Inspiration images (optional)
    let imageUrls: string[] = [];
    if (options.fetchImages) {
        const inspirationResult = await InspirationImagesQuery(projectId);
        const images = (inspirationResult?.images?._valueJSON as unknown as any[]) ?? [];
        imageUrls = images
            .map((img) => img.url)
            .filter(Boolean)
            .slice(0, MAX_IMAGE_COUNT);
    }

    return {
        context: {
            styleGuide: { colorSections, typographySections },
            imageUrls,
        },
    };
}

export function sanitizeHTML(html: string): string | null {
    if (!html || typeof html !== "string") return null;
    if (html.length > MAX_HTML_SIZE) return null;
    return html.trim();
}

export function buildStream(
    result: { textStream: AsyncIterable<string> },
    onSuccess: () => Promise<void>
): Response {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                for await (const chunk of result.textStream) {
                    controller.enqueue(encoder.encode(chunk));
                }
                await onSuccess();
                controller.close();
            } catch (err) {
                console.error("Stream error:", err);
                controller.error(err);
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Content-Type-Options": "nosniff",
        },
    });
}

export function handleRouteError(error: unknown, label: string): NextResponse {
    console.error(`[${label}] Error:`, error);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
        {
            error: "Request failed",
            ...(isDev && {
                details: error instanceof Error ? error.message : "Unknown error",
            }),
        },
        { status: 500 }
    );
}