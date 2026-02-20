import { ConsumeCreditsQuery } from "@/convex/query.config";
import { prompts } from "@/prompts";
import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { buildSketchGenerationPrompt } from "@/prompts";
import { validateAndFetchContext, buildStream, handleRouteError } from "@/lib/ai/withAIRoute";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: NextRequest) {
    try {
        let formData: FormData;
        try {
            formData = await request.formData();
        } catch {
            return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
        }

        const imageFile = formData.get("image") as File | null;
        const projectId = formData.get("projectId") as string | null;

        if (!imageFile || !projectId) {
            return NextResponse.json({ error: "Missing image or projectId" }, { status: 400 });
        }
        if (!ALLOWED_TYPES.has(imageFile.type)) {
            return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
        }
        if (imageFile.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: "Image exceeds 5MB limit" }, { status: 400 });
        }

        const imageBuffer = await imageFile.arrayBuffer();
        const base64Image = `data:${imageFile.type};base64,` + Buffer.from(imageBuffer).toString("base64");

        const contextResult = await validateAndFetchContext(projectId, { fetchImages: true, request });
        if ("error" in contextResult) return contextResult.error;
        const { styleGuide, imageUrls } = contextResult.context;

        const userPrompt = buildSketchGenerationPrompt({
            colors: styleGuide.colorSections,
            typography: styleGuide.typographySections,
        });

        const result = streamText({
            model: google("gemini-2.5-pro"),
            system: prompts.generativeUi.system,
            messages: [{
                role: "user",
                content: [
                    { type: "text", text: userPrompt },
                    { type: "image", image: base64Image },
                    ...imageUrls.map((url) => ({ type: "image" as const, image: url })),
                ],
            }],
            temperature: 0.7,
            abortSignal: AbortSignal.timeout(60_000),
        });

        return buildStream(result, async () => {
            await ConsumeCreditsQuery({ amount: 1 });
        });
    } catch (error) {
        return handleRouteError(error, "sketch");
    }
}