'use client'

import { addProject, createProjectFailure, createProjectStart, createProjectSuccess } from "@/redux/slices/projects"
import { useAppDispatch, useAppSelector } from "@/redux/store"
import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import generateGradientThumbnail from "@/lib/helper"
import { fetchMutation } from "convex/nextjs"
import { Id } from "../../convex/_generated/dataModel"
import { api } from "../../convex/_generated/api"

export const useProjectCreation = () => {
    const dispatch = useAppDispatch()
    const router = useRouter()

    // ✅ Granular selectors — only re-renders when the specific field changes,
    // not whenever anything in the profile/projects/shapes slice changes.
    const userId = useAppSelector((state) => state.profile?.id)
    const username = useAppSelector((state) => state.profile?.name)

    const isCreating = useAppSelector((state) => state.projects.isCreating)
    const projects = useAppSelector((state) => state.projects.projects)
    const projectTotal = useAppSelector((state) => state.projects.total)

    const shapes = useAppSelector((state) => state.shapes.shapes)
    const tool = useAppSelector((state) => state.shapes.tool)
    const selected = useAppSelector((state) => state.shapes.selected)
    const frameCounter = useAppSelector((state) => state.shapes.frameCounter)

    const createProject = useCallback(async (name?: string) => {
        if (!userId) {
            toast.error("You must be logged in to create a project")
            return
        }

        // ✅ Concurrent call guard — prevents duplicate projects on double-click
        if (isCreating) return

        dispatch(createProjectStart())

        try {
            const thumbnail = generateGradientThumbnail()

            const result = await fetchMutation(api.projects.createProject, {
                userId: userId as Id<'users'>,
                // ✅ trim() rejects whitespace-only strings like "   "
                name: name?.trim() || undefined,
                sketchesData: { shapes, tool, selected, frameCounter },
                thumbnail,
            })

            // ✅ Single timestamp — createdAt and lastModified are guaranteed identical
            const now = Date.now()

            dispatch(addProject({
                _id: result.projectId,
                name: result.name,
                projectNumber: result.projectNumber,
                thumbnail,
                lastModified: now,
                createdAt: now,
                isPublic: false,
            }))

            dispatch(createProjectSuccess())
            toast.success('Project created! Taking you there now...')

            // ✅ Navigate directly into the new project
            router.push(`/dashboard/${username}/canvas?project=${result.projectId}`)

            return result.projectId

        } catch (error) {
            // ✅ Real error message in Redux state, not a hardcoded string
            const message = error instanceof Error ? error.message : 'Failed to create project'
            dispatch(createProjectFailure(message))
            toast.error('Failed to create project')
            console.error(error)
        }
    }, [dispatch, router, userId, username, isCreating, shapes, tool, selected, frameCounter])

    return {
        createProject,
        isCreating,
        projects,
        projectTotal,
        // ✅ canCreate blocks UI during in-flight requests — no extra logic needed in consumers
        canCreate: !!userId && !isCreating,
    }
}