'use client'

import { addProject, createProjectFailure, createProjectStart, createProjectSuccess } from "@/redux/slices/projects"
import { useAppDispatch, useAppSelector } from "@/redux/store"
import { toast } from "sonner"
import generateGradientThumbnail from "@/lib/helper"

import { fetchMutation } from "convex/nextjs"
import { Id } from "../../convex/_generated/dataModel"
import { api } from "../../convex/_generated/api"

export const useProjectCreation = () => {
    const dispatch = useAppDispatch()
    const user = useAppSelector((state) => state.profile)
    const projectState = useAppSelector((state) => state.projects)
    const shapeState = useAppSelector((state) => state.shapes)

    const createProject = async (name?: string) => {
        if (!user?.id) {
            toast.error("You must be logged in to create a project")
            return
        }
        dispatch(createProjectStart())
        try {
            const thumbnail = generateGradientThumbnail();
            const result = await fetchMutation(api.projects.createProject, {
                userId: user.id as Id<'users'>,
                name: name || undefined,
                sketchesData: {
                    shapes: shapeState.shapes,
                    tool: shapeState.tool,
                    selected: shapeState.selected,
                    frameCounter: shapeState.frameCounter,
                },
                thumbnail,
            })

            dispatch(addProject({
                _id: result.projectId,
                name: result.name,
                projectNumber: result.projectNumber,
                thumbnail,
                lastModified: Date.now(),
                createdAt: Date.now(),
                isPublic: false,
            }))
            dispatch(createProjectSuccess())
            toast.success('Project created successfully')
        }
        catch (error) {
            dispatch(createProjectFailure('Failed to create project'))
            toast.error('Failed to create project')
            console.error(error)
        }
    }

    return {
        createProject,
        isCreating: projectState.isCreating,
        projects: projectState.projects,
        projectTotal: projectState.total,
        canCreate: !!user?.id
    }
}