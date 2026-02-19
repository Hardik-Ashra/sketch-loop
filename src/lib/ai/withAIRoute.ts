import { NextRequest, NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

export const MAX_HTML_SIZE = 100_000;
export const MAX_IMAGE_COUNT = 10;

export type RouteContext = {
    styleGuide: {
        colorSections: unknown[];
        typographySections: unknown[];
    };
    imageUrls: string[];
};

function getConvexToken(request: NextRequest): string | undefined {
    const cookie = request.cookies.get("__Host-__convexAuthJWT")?.value
    if (cookie) return cookie
    const authHeader = request.headers.get("authorization")
    if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7)
    return undefined
}

export async function validateAndFetchContext(
    projectId: string,
    options: { fetchImages?: boolean; request: NextRequest }
): Promise<{ error: NextResponse } | { context: RouteContext }> {

    const token = getConvexToken(options.request)
    const tokenOpts = token ? { token } : {}

    // Step 1 — fetch current user to get userId
    const currentUser = await fetchQuery(api.user.getCurrentUser, {}, tokenOpts)
    if (!currentUser?._id) {
        return {
            error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        }
    }

    // Step 2 — check credits using the resolved userId
    const balance = await fetchQuery(
        api.subscription.getCreditsBalance,
        { userId: currentUser._id as Id<"users"> },
        tokenOpts
    )

    if (!balance || balance === 0) {
        return {
            error: NextResponse.json({ error: "No credits available" }, { status: 402 }),
        }
    }

    // Step 3 — fetch style guide
    const styleGuideResult = await fetchQuery(
        api.projects.getProjectStyleGuide,
        { projectId: projectId as Id<"projects"> },
        tokenOpts
    )

    const styleGuideData = (styleGuideResult ?? {}) as any
    const colorSections = Object.values(styleGuideData?.colorSections ?? {})
    const typographySections = styleGuideData?.typographySections ?? []

    if (!colorSections.length && !typographySections.length) {
        return {
            error: NextResponse.json({ error: "Style guide not found" }, { status: 404 }),
        }
    }

    // Step 4 — fetch inspiration images (optional)
    let imageUrls: string[] = []
    if (options.fetchImages) {
        const inspirationResult = await fetchQuery(
            api.inspiration.getInspirationImages,
            { projectId: projectId as Id<"projects"> },
            tokenOpts
        )
        const images = (inspirationResult as unknown as any[]) ?? []
        imageUrls = images
            .map((img) => img.url)
            .filter(Boolean)
            .slice(0, MAX_IMAGE_COUNT)
    }

    return {
        context: {
            styleGuide: { colorSections, typographySections },
            imageUrls,
        },
    }
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