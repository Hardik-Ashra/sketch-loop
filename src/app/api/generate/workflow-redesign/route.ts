import { ConsumeCreditsQuery } from "@/convex/query.config";
import { prompts } from "@/prompts";
import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { buildWorkflowRedesignPrompt } from "@/lib/ai/promptBuilder";
import { validateAndFetchContext, sanitizeHTML, buildStream, handleRouteError } from "@/lib/ai/withAIRoute";

const MAX_MESSAGE_LENGTH = 2000;

export async function POST(request: NextRequest) {
    try {
        let body: Record<string, unknown>;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { generatedUIId, currentHTML, projectId, userMessage } = body as {
            generatedUIId?: string;
            currentHTML?: string;
            projectId?: string;
            userMessage?: string;
        };

        if (!generatedUIId || !projectId || !userMessage) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }
        if (typeof userMessage === "string" && userMessage.length > MAX_MESSAGE_LENGTH) {
            return NextResponse.json({ error: "userMessage too long" }, { status: 400 });
        }

        const safeHTML = sanitizeHTML(currentHTML as string);
        if (!safeHTML) {
            return NextResponse.json({ error: "currentHTML is missing or exceeds size limit" }, { status: 400 });
        }

        // FIX – was missing request, causing request.cookies crash
        const contextResult = await validateAndFetchContext(projectId as string, { request });
        if ("error" in contextResult) return contextResult.error;
        const { styleGuide } = contextResult.context;

        const userPrompt = buildWorkflowRedesignPrompt({
            userMessage: userMessage as string,
            currentHTML: safeHTML,
            colors: styleGuide.colorSections,
            typography: styleGuide.typographySections,
        });

        const result = streamText({
            model: google("gemini-2.5-pro"),
            system: prompts.generativeUi.system,
            messages: [{ role: "user", content: userPrompt }],
            temperature: 0.7,
            abortSignal: AbortSignal.timeout(60_000),
        });

        return buildStream(result, async () => {
            await ConsumeCreditsQuery({ amount: 1 });
        });
    } catch (error) {
        return handleRouteError(error, "workflow-redesign");
    }
}