import { ConsumeCreditsQuery } from "@/convex/query.config";
import { prompts } from "@/prompts";
import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { buildWorkflowRedesignPrompt } from "@/lib/ai/promptBuilder";
import {
    validateAndFetchContext,
    sanitizeHTML,
    buildStream,
    handleRouteError,
    checkRateLimit,
} from "@/lib/ai/withAIRoute";

const MAX_MESSAGE_LENGTH = 2000;

export async function POST(request: NextRequest) {
    try {
        const rateLimitError = await checkRateLimit(request);
        if (rateLimitError) return rateLimitError;
        // ── 1. Parse & validate body ──────────────────────────────────────────
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
            return NextResponse.json(
                { error: "currentHTML is missing or exceeds size limit" },
                { status: 400 }
            );
        }

        // ── 2. Credits + context (parallel-safe single call) ─────────────────
        const contextResult = await validateAndFetchContext(projectId as string);
        if ("error" in contextResult) return contextResult.error;
        const { styleGuide } = contextResult.context;

        // ── 3. Build prompt ───────────────────────────────────────────────────
        const userPrompt = buildWorkflowRedesignPrompt({
            userMessage: userMessage as string,
            currentHTML: safeHTML,
            colors: styleGuide.colorSections,
            typography: styleGuide.typographySections,
        });

        // ── 4. Gemini call ────────────────────────────────────────────────────
        const result = streamText({
            model: google("gemini-2.0-flash"),
            system: prompts.generativeUi.system,
            messages: [{ role: "user", content: userPrompt }],
            temperature: 0.7,
            abortSignal: AbortSignal.timeout(60_000), // 60s hard timeout
        });

        // ── 5. Stream with post-success credit deduction ──────────────────────
        return buildStream(result, async () => {
            await ConsumeCreditsQuery({ amount: 1 });
        });

    } catch (error) {
        return handleRouteError(error, "workflow-redesign");
    }
}