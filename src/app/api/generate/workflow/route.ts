import { ConsumeCreditsQuery } from "@/convex/query.config";
import { prompts } from "@/prompts";
import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { buildWorkflowPrompt } from "@/lib/ai/promptBuilder";
import {
    validateAndFetchContext,
    sanitizeHTML,
    buildStream,
    handleRouteError,
    checkRateLimit,
} from "@/lib/ai/withAIRoute";

const PAGE_TYPES = [
    "Dashboard/Analytics page with charts, metrics, and KPIs",
    "Settings/Configuration page with preferences and account management",
    "User Profile page with personal information and activity",
    "Data Listing/Table page with search, filters, and pagination",
] as const;

export async function POST(request: NextRequest) {
    try {
        const rateLimitError = await checkRateLimit(request);
        if (rateLimitError) return rateLimitError;
        let body: Record<string, unknown>;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { generatedUIId, currentHTML, projectId, pageIndex } = body as any;

        if (!generatedUIId || !projectId || pageIndex === undefined) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const safeHTML = sanitizeHTML(currentHTML);
        if (!safeHTML) {
            return NextResponse.json({ error: "currentHTML missing or too large" }, { status: 400 });
        }

        const parsedIndex = Number(pageIndex);
        if (!Number.isInteger(parsedIndex) || parsedIndex < 0 || parsedIndex >= PAGE_TYPES.length) {
            return NextResponse.json({ error: "Invalid pageIndex" }, { status: 400 });
        }

        const contextResult = await validateAndFetchContext(projectId, { fetchImages: true });
        if ("error" in contextResult) return contextResult.error;
        const { styleGuide, imageUrls } = contextResult.context;

        const userPrompt = buildWorkflowPrompt({
            currentHTML: safeHTML,
            selectedPageType: PAGE_TYPES[parsedIndex],
            colors: styleGuide.colorSections,
            typography: styleGuide.typographySections,
            imageCount: imageUrls.length,
        });

        const result = streamText({
            model: google("gemini-2.0-flash"),
            system: prompts.generativeUi.system,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: userPrompt },
                        ...imageUrls.map((url) => ({ type: "image" as const, image: url })),
                    ],
                },
            ],
            temperature: 0.7,
            abortSignal: AbortSignal.timeout(60_000),
        });

        return buildStream(result, async () => {
            await ConsumeCreditsQuery({ amount: 1 });
        });

    } catch (error) {
        return handleRouteError(error, "workflow");
    }
}