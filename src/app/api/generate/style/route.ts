export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { MoodboardImage } from "@/hooks/use-styles"
import { generateObject } from "ai"
import { google } from "@ai-sdk/google"
import { z } from "zod"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { api } from "../../../../../convex/_generated/api"
import { Id } from "../../../../../convex/_generated/dataModel"
import { buildStyleGuidePrompt } from "@/prompts"

/* -------------------------------------------------------------------------- */
/*                                AUTH TOKEN                                  */
/* -------------------------------------------------------------------------- */

function getConvexToken(request: NextRequest): string | undefined {
    const cookie = request.cookies.get("__Host-__convexAuthJWT")?.value
    if (cookie) return cookie
    const authHeader = request.headers.get("authorization")
    if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7)
    return undefined
}

/* -------------------------------------------------------------------------- */
/*                                  SCHEMA                                    */
/* -------------------------------------------------------------------------- */

const ColorSwatchSchema = z.object({
    name: z.string(),
    hexColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    description: z.string().optional(),
})

const ColorSectionSchema = (count: number) =>
    z.object({
        title: z.string(),
        swatches: z.array(ColorSwatchSchema).length(count),
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
        primary: ColorSectionSchema(4),
        secondary: ColorSectionSchema(4),
        ui: ColorSectionSchema(6),
        utility: ColorSectionSchema(3),
        status: ColorSectionSchema(2),
    }),
    typographySections: z.array(TypographySectionSchema).min(1).max(3),
})

/* -------------------------------------------------------------------------- */
/*                            STYLE GUIDE PROMPT                              */
/* -------------------------------------------------------------------------- */


/* -------------------------------------------------------------------------- */
/*                         SAFE AI GENERATION WRAPPER                         */
/* -------------------------------------------------------------------------- */

async function generateStyleGuideSafe(config: any) {
    try {
        return await generateObject({ ...config, maxRetries: 1 })
    } catch {
        console.warn("Retrying with repair instructions...")
        return await generateObject({
            ...config,
            system:
                config.system +
                `
CRITICAL FIX:
Generate EXACTLY:
- 4 primary colors
- 4 secondary colors
- 6 ui colors
- 3 utility colors
- 2 status colors
Return ONLY JSON.`,
            maxRetries: 1,
        })
    }
}

/* -------------------------------------------------------------------------- */
/*                            NORMALIZATION LAYER                             */
/* -------------------------------------------------------------------------- */

function normalizeStyleGuide(obj: any) {
    const fill = (arr: any[], target: number) => {
        const clone = [...arr]
        while (clone.length < target) {
            clone.push({
                name: "Auto Generated",
                hexColor: "#CCCCCC",
                description: "Auto-filled to match schema",
            })
        }
        return clone.slice(0, target)
    }

    obj.colorSections.primary.swatches = fill(
        obj.colorSections.primary.swatches,
        4
    )
    obj.colorSections.secondary.swatches = fill(
        obj.colorSections.secondary.swatches,
        4
    )
    obj.colorSections.ui.swatches = fill(
        obj.colorSections.ui.swatches,
        6
    )
    obj.colorSections.utility.swatches = fill(
        obj.colorSections.utility.swatches,
        3
    )
    obj.colorSections.status.swatches = fill(
        obj.colorSections.status.swatches,
        2
    )

    obj.typographySections = obj.typographySections.slice(0, 3)
    return obj
}

/* -------------------------------------------------------------------------- */
/*                              IMAGE CONVERSION                              */
/* -------------------------------------------------------------------------- */

async function urlToBase64(imageUrl: string): Promise<string> {
    const response = await fetch(imageUrl)
    const blob = await response.blob()
    const buffer = await blob.arrayBuffer()
    const base64 = Buffer.from(buffer).toString("base64")
    return `data:${blob.type || "image/jpeg"};base64,${base64}`
}

/* -------------------------------------------------------------------------- */
/*                                   ROUTE                                    */
/* -------------------------------------------------------------------------- */

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const projectId = body.projectId

        if (!projectId) {
            return NextResponse.json(
                { error: "Project ID is required" },
                { status: 400 }
            )
        }

        const token = getConvexToken(request)
        const tokenOpts = token ? { token } : {}

        /* ------------------------------ AUTH USER ------------------------------ */

        const currentUser = await fetchQuery(
            api.user.getCurrentUser,
            {},
            tokenOpts
        )

        if (!currentUser?._id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const balance = await fetchQuery(
            api.subscription.getCreditsBalance,
            { userId: currentUser._id as Id<"users"> },
            tokenOpts
        )

        if (!balance || balance === 0) {
            return NextResponse.json(
                { error: "Insufficient credits" },
                { status: 402 }
            )
        }

        /* --------------------------- FETCH MOODBOARD --------------------------- */

        const moodboardResult = await fetchQuery(
            api.moodboard.getMoodboardImages,
            { projectId: projectId as Id<"projects"> },
            tokenOpts
        )

        const images = (moodboardResult as unknown as MoodboardImage[]) ?? []

        if (images.length === 0) {
            return NextResponse.json(
                { error: "No moodboard images found" },
                { status: 404 }
            )
        }

        const imageUrls = images
            .map((img) => img.url)
            .filter((url): url is string => Boolean(url))

        console.log(`Converting ${imageUrls.length} images to base64...`)

        const base64Images = await Promise.all(
            imageUrls.map(urlToBase64)
        )

        /* ------------------------------ AI CALL -------------------------------- */

        const result = await generateStyleGuideSafe({
            model: google("gemini-2.5-pro"),
            schema: StyleGuideSchema,
            system: buildStyleGuidePrompt(imageUrls.length),
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Analyze these ${imageUrls.length} mood board images and generate a structured design system.`,
                        },
                        ...base64Images.map((img) => ({
                            type: "image" as const,
                            image: img,
                        })),
                    ],
                },
            ],
        })

        /* ------------------------ STRICT VALIDATION ---------------------------- */

        const safeObject = StyleGuideSchema.parse(
            normalizeStyleGuide(result.object)
        )

        /* ---------------------------- CONSUME CREDIT --------------------------- */

        await fetchMutation(
            api.subscription.consumeCredits,
            {
                reason: "ai:generation",
                userId: currentUser._id as Id<"users">,
                amount: 1,
            },
            tokenOpts
        )

        /* ----------------------------- SAVE RESULT ----------------------------- */

        await fetchMutation(
            api.projects.updateProjectStyleGuide,
            {
                projectId: projectId as Id<"projects">,
                styleGuideData: safeObject,
            },
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
            {
                error: "Failed to generate style guide",
                details:
                    error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        )
    }
}