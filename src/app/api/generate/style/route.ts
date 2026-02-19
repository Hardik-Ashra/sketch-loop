import { NextRequest, NextResponse } from "next/server"
import { MoodboardImage } from "@/hooks/use-styles"
import { prompts } from "@/prompts"
import { generateObject } from "ai"
import { google } from "@ai-sdk/google"
import z from "zod/v3"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { api } from "../../../../../convex/_generated/api"
import { Id } from "../../../../../convex/_generated/dataModel"

// FIX – no longer importing convexAuthNextjsToken (causes /pipeline crash in API routes)
// Token is read directly from the request cookie instead.
function getConvexToken(request: NextRequest): string | undefined {
    const cookie = request.cookies.get("__Host-__convexAuthJWT")?.value
    if (cookie) return cookie
    const authHeader = request.headers.get("authorization")
    if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7)
    return undefined
}

const ColorSwatchSchema = z.object({
    name: z.string(),
    hexColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    description: z.string().optional(),
})

const ColorSectionSchema = z.object({
    title: z.string(),
    swatches: z.array(ColorSwatchSchema).min(2).max(8),
})

const TypographyStyleSchema = z.object({
    name: z.string(),
    fontFamily: z.string(),
    fontSize: z.string(),
    fontWeight: z.string(),
    lineHeight: z.string(),
    letterSpacing: z.string().optional(),
    description: z.string().optional(),
})

const TypographySectionSchema = z.object({
    title: z.string(),
    styles: z.array(TypographyStyleSchema).min(1),
})

const StyleGuideSchema = z.object({
    theme: z.string(),
    description: z.string(),
    colorSections: z.object({
        primary: ColorSectionSchema,
        secondary: ColorSectionSchema,
        ui: ColorSectionSchema,
        utility: ColorSectionSchema,
        status: ColorSectionSchema,
    }),
    typographySections: z.array(TypographySectionSchema).min(1).max(5),
})

async function generateStyleGuideSafe(config: any) {
    try {
        return await generateObject({ ...config, maxRetries: 1 })
    } catch {
        console.warn("First generation failed. Retrying with repair prompt...")
        return await generateObject({
            ...config,
            system: config.system + `
CRITICAL FIX:
Previous output failed schema validation.
You MUST generate:
- 4 primary colors
- 4 secondary colors
- 6 ui colors
- 3 utility colors
- 2 status colors
Return ONLY valid JSON.`,
            maxRetries: 1,
        })
    }
}

function normalizeStyleGuide(obj: any) {
    const fill = (arr: any[], target: number) => {
        const clone = [...arr]
        while (clone.length < target) {
            clone.push({ name: "Auto Generated", hexColor: "#CCCCCC", description: "Auto-filled to match schema" })
        }
        return clone.slice(0, target)
    }
    obj.colorSections.primary.swatches = fill(obj.colorSections.primary.swatches, 4)
    obj.colorSections.secondary.swatches = fill(obj.colorSections.secondary.swatches, 4)
    obj.colorSections.ui.swatches = fill(obj.colorSections.ui.swatches, 6)
    obj.colorSections.utility.swatches = fill(obj.colorSections.utility.swatches, 3)
    obj.colorSections.status.swatches = fill(obj.colorSections.status.swatches, 2)
    obj.typographySections = obj.typographySections.slice(0, 3)
    return obj
}

async function urlToBase64(imageUrl: string): Promise<string> {
    try {
        const response = await fetch(imageUrl)
        const blob = await response.blob()
        const buffer = await blob.arrayBuffer()
        const base64 = Buffer.from(buffer).toString("base64")
        return `data:${blob.type || "image/jpeg"};base64,${base64}`
    } catch (error) {
        console.error(`Failed to convert image URL to base64: ${imageUrl}`, error)
        throw new Error(`Failed to process image: ${imageUrl}`)
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const projectId = body.projectId
        if (!projectId) {
            return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
        }

        const token = getConvexToken(request)
        const tokenOpts = token ? { token } : {}

        // FIX – use fetchQuery instead of preloadQuery + convexAuthNextjsToken
        const currentUser = await fetchQuery(api.user.getCurrentUser, {}, tokenOpts)
        if (!currentUser?._id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const balance = await fetchQuery(
            api.subscription.getCreditsBalance,
            { userId: currentUser._id as Id<"users"> },
            tokenOpts
        )

        if (!balance || balance === 0) {
            return NextResponse.json({ error: "Insufficient credits" }, { status: 402 })
        }

        // FIX – use fetchQuery instead of preloadQuery
        const moodboardResult = await fetchQuery(
            api.moodboard.getMoodboardImages,
            { projectId: projectId as Id<"projects"> },
            tokenOpts
        )

        const images = (moodboardResult as unknown as MoodboardImage[]) ?? []
        if (images.length === 0) {
            return NextResponse.json(
                { error: "No moodboard images found. Please upload moodboard images" },
                { status: 404 }
            )
        }

        const imageUrls = images.map((img) => img.url).filter((url): url is string => Boolean(url))
        if (imageUrls.length === 0) {
            return NextResponse.json({ error: "No valid image URLs found" }, { status: 400 })
        }

        console.log(`Converting ${imageUrls.length} images to base64...`)
        const base64Images = await Promise.all(imageUrls.map(urlToBase64))

        const result = await generateStyleGuideSafe({
            model: google("gemini-2.0-flash"),
            schema: StyleGuideSchema,
            system: prompts.styleGuide.system,
            messages: [{
                role: "user",
                content: [
                    { type: "text", text: `Analyze these ${imageUrls.length} mood board images and generate a design system. Extract colors that work harmoniously together and create typography that matches the aesthetic. Return ONLY the JSON object matching the exact schema structure.` },
                    ...base64Images.map((img) => ({ type: "image" as const, image: img })),
                ],
            }],
        })

        const safeObject = normalizeStyleGuide(result.object)

        // Consume credits
        await fetchMutation(
            api.subscription.consumeCredits,
            { reason: "ai:generation", userId: currentUser._id as Id<"users">, amount: 1 },
            tokenOpts
        )

        // Update style guide
        await fetchMutation(
            api.projects.updateProjectStyleGuide,
            { projectId: projectId as Id<"projects">, styleGuideData: safeObject },
            tokenOpts
        )

        return NextResponse.json({
            success: true,
            styleGuide: safeObject,
            message: "Style guide generated successfully",
        })
    } catch (error) {
        console.error("Error generating style guide:", error)
        return NextResponse.json(
            { error: "Failed to generate style guide", details: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        )
    }
}