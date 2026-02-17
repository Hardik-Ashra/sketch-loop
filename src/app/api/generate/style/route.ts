

import { NextRequest, NextResponse } from "next/server"
import { ConsumeCreditsQuery, CreditsBalanceQuery, MoodboardImagesQuery } from "@/convex/query.config"
import { MoodboardImage } from "@/hooks/use-styles"
import { prompts } from "@/prompts"
import { generateObject } from "ai"
import { google } from "@ai-sdk/google"
import z from "zod/v3"
import { fetchMutation } from "convex/nextjs"
import { api } from "../../../../../convex/_generated/api"
import { Id } from "../../../../../convex/_generated/dataModel"
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server"

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
        return await generateObject({
            ...config,
            maxRetries: 1, // SDK-level retry
        })
    } catch (err) {
        console.warn("⚠️ First generation failed. Retrying with repair prompt...")

        return await generateObject({
            ...config,
            system:
                config.system +
                `
CRITICAL FIX:
Previous output failed schema validation.
You MUST generate:
- 4 primary colors
- 4 secondary colors
- 6 ui colors
- 3 utility colors
- 2 status colors
Return ONLY valid JSON.
`,
            maxRetries: 1,
        })
    }
}
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

    obj.colorSections.primary.swatches =
        fill(obj.colorSections.primary.swatches, 4)

    obj.colorSections.secondary.swatches =
        fill(obj.colorSections.secondary.swatches, 4)

    obj.colorSections.ui.swatches =
        fill(obj.colorSections.ui.swatches, 6)

    obj.colorSections.utility.swatches =
        fill(obj.colorSections.utility.swatches, 3)

    obj.colorSections.status.swatches =
        fill(obj.colorSections.status.swatches, 2)

    obj.typographySections = obj.typographySections.slice(0, 3)

    return obj
}

// Helper function to convert URL to base64 data URL
async function urlToBase64(imageUrl: string): Promise<string> {
    try {
        const response = await fetch(imageUrl)
        const blob = await response.blob()
        const buffer = await blob.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const mimeType = blob.type || 'image/jpeg'
        return `data:${mimeType};base64,${base64}`
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
            return NextResponse.json(
                { error: 'Project ID is required' },
                { status: 400 }
            )
        }

        // Check credits balance
        const { ok: balanceOk, balance: balanceBalance } =
            await CreditsBalanceQuery()

        if (!balanceOk) {
            return NextResponse.json(
                { error: 'Failed to get balance' },
                { status: 500 }
            )
        }

        if (balanceBalance === 0) {
            return NextResponse.json(
                { error: 'Insufficient credits' },
                { status: 400 }
            )
        }

        // Fetch moodboard images

        const moodboardImages = await MoodboardImagesQuery(projectId)
        if (!moodboardImages || moodboardImages.images._valueJSON.length === 0) {
            return NextResponse.json(
                { error: 'No moodboard images found. Please upload moodboard images' },
                { status: 404 }
            )
        }

        const images = moodboardImages.images._valueJSON as unknown as MoodboardImage[]
        const imageUrls = images.map((img) => img.url).filter((url): url is string => Boolean(url) && url !== undefined)

        if (imageUrls.length === 0) {
            return NextResponse.json(
                { error: 'No valid image URLs found' },
                { status: 400 }
            )
        }

        // Convert image URLs to base64 for Gemini
        console.log(`Converting ${imageUrls.length} images to base64...`)
        const base64Images = await Promise.all(
            imageUrls.map(url => urlToBase64(url))
        )

        const systemPrompt = prompts.styleGuide.system
        const userPrompt = `Analyze these ${imageUrls.length} mood board images and generate a design system. Extract colors that work harmoniously together and create typography that matches the aesthetic. Return ONLY the JSON object matching the exact schema structure.`

        // Generate style guide using Google Gemini
        const result = await generateStyleGuideSafe({
            model: google("gemini-2.0-flash"),
            schema: StyleGuideSchema,
            system: systemPrompt,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: userPrompt,
                        },
                        ...base64Images.map((img) => ({
                            type: "image" as const,
                            image: img,
                        })),
                    ],
                },
            ],
        })

        const safeObject = normalizeStyleGuide(result.object)


        // Consume credits
        const { ok, balance } = await ConsumeCreditsQuery({ amount: 1 })
        if (!ok) {
            return NextResponse.json(
                { error: 'Failed to consume credits' },
                { status: 500 }
            )
        }

        // Update project with style guide
        await fetchMutation(
            api.projects.updateProjectStyleGuide,
            {
                projectId: projectId as Id<'projects'>,
                styleGuideData: result.object,
            },
            {
                token: await convexAuthNextjsToken(),
            }
        )

        return NextResponse.json({
            success: true,
            styleGuide: result.object,
            message: 'Style guide generated successfully',
            balance,
        })
    } catch (error) {
        console.error('Error generating style guide: ', error)
        return NextResponse.json(
            {
                error: 'Failed to generate style guide',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}