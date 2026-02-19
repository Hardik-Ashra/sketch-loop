import { ConsumeCreditsQuery } from "@/convex/query.config";
import { prompts } from "@/prompts";
import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { buildRedesignPrompt } from "@/lib/ai/promptBuilder";
import {
    validateAndFetchContext,
    sanitizeHTML,
    buildStream,
    handleRouteError,
} from "@/lib/ai/withAIRoute";

export async function POST(request: NextRequest) {
    try {
        let body: Record<string, unknown>;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { generatedUIId, currentHTML, projectId, userMessage, wireframeSnapshot } = body as any;

        if (!generatedUIId || !projectId || !userMessage) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const safeHTML = sanitizeHTML(currentHTML);
        if (!safeHTML) {
            return NextResponse.json({ error: "currentHTML missing or too large" }, { status: 400 });
        }

        const contextResult = await validateAndFetchContext(projectId, { fetchImages: true });
        if ("error" in contextResult) return contextResult.error;
        const { styleGuide, imageUrls } = contextResult.context;

        const userPrompt = buildRedesignPrompt({
            userMessage,
            currentHTML: safeHTML,
            colors: styleGuide.colorSections,
            typography: styleGuide.typographySections,
            hasWireframe: Boolean(wireframeSnapshot),
            imageCount: imageUrls.length,
        });

        const messageContent: any[] = [{ type: "text", text: userPrompt }];
        if (wireframeSnapshot) {
            messageContent.push({ type: "image", image: wireframeSnapshot });
        }

        const result = streamText({
            model: google("gemini-2.0-flash"),
            system: prompts.generativeUi.system,
            messages: [{ role: "user", content: messageContent }],
            temperature: 0.7,
            abortSignal: AbortSignal.timeout(60_000),
        });

        return buildStream(result, async () => {
            await ConsumeCreditsQuery({ amount: 1 });
        });

    } catch (error) {
        return handleRouteError(error, "redesign");
    }
}