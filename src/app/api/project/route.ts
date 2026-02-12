import { inngest } from '@/inngest/client'
import { NextRequest, NextResponse } from 'next/server'

interface UpdateProjectRequest {
    projectId: string
    shapesData: {
        tool: string
        selected: Record<string, unknown>
        frameCounter: number
    }
    viewportData?: {
        scale: number
        translate: { x: number; y: number }
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body: UpdateProjectRequest & { userId?: string } =
            await request.json()
        const { projectId, shapesData, viewportData, userId } = body
        if (!projectId || !userId || !shapesData) {
            return NextResponse.json(
                { error: 'Project ID, User ID, and shapes data are required' },
                { status: 400 }
            )
        }
        const event = await inngest.send({
            name: "project/autosave.requested",
            data: {
                projectId,
                shapesData,
                viewportData,
                userId
            }
        })

        return NextResponse.json({
            success: true,
            event: "Project auto-saved successfully",
            eventId: event.ids[0]
        })
    } catch (error) {
        return NextResponse.json({
            error: "Failed to auto-save project",
            message: error instanceof Error ? error.message : "Unknown error"
        },
            { status: 500 }
        )

    }

}