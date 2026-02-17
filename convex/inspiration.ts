import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"

export const generateUploadUrl = mutation({
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx)
        if (!userId) {
            throw new Error('Not authenticated')

        }
        // Generate upload URL that expires in 1 hour
        return await ctx.storage.generateUploadUrl()
    },
})

export const getInspirationImages = query({
    args: {
        projectId: v.id('projects'),
    },
    handler: async (ctx, { projectId }) => {
        const userId = await getAuthUserId(ctx)
        if (!userId) {
            return []
        }
        // Get the project and verify ownership
        const project = await ctx.db.get(projectId)
        if (!project || project.userId !== userId) {
            return []
        }

        // Get storage IDs
        const storageIds = project.inspirationImages || []

        // Generate URLs for each image
        const images = await Promise.all(
            storageIds.map(async (storageId, index) => {
                try {
                    const url = await ctx.storage.getUrl(storageId)
                    return {
                        id: `inspiration-${storageId}`, // Unique ID for client-side tracking
                        storageId,
                        url,
                        uploaded: true,
                        uploading: false,
                        index, // Preserve order
                    }
                } catch (error) {
                    console.warn(
                        `[Convex] Failed to get URL for inspiration storage ID ${storageId}: `,
                        error
                    )
                    return null
                }
            })
        )
        const validImages = images
            .filter((image) => image !== null)
            .sort((a, b) => a!.index - b!.index)
        return validImages
    },
})


export const addInspirationImage = mutation({
    args: {
        projectId: v.id('projects'),
        storageId: v.id('_storage'),
    },
    handler: async (ctx, { projectId, storageId }) => {
        const userId = await getAuthUserId(ctx)
        if (!userId) {
            throw new Error('Not authenticated')
        }
        const project = await ctx.db.get(projectId)
        if (!project) {
            throw new Error('Project not found')
        }
        if (project.userId !== userId) {
            throw new Error('Not authorized to modify this project')
        }
        const currentImages = project.inspirationImages || []
        if (currentImages.includes(storageId)) {
            return { success: true, message: 'Image already added' }
        }
        if (currentImages.length >= 6) {
            throw new Error('Maximum of 6 inspiration images allowed per project')
        }

        const updatedImages = [...currentImages, storageId];
        await ctx.db.patch(projectId, {
            inspirationImages: updatedImages,
            lastModified: Date.now(),
        })

        return {
            success: true,
            message: 'Inspiration image added successfully',
            totalImages: updatedImages.length,
        }
    }
})

export const removeInspirationImage = mutation({
    args: {
        projectId: v.id('projects'),
        storageId: v.id('_storage'),
    },
    handler: async (ctx, { projectId, storageId }) => {
        const userId = await getAuthUserId(ctx)
        if (!userId) {
            throw new Error('Not authenticated')
        }
        const project = await ctx.db.get(projectId)
        if (!project) {
            throw new Error('Project not found')
        }
        if (project.userId !== userId) {
            throw new Error('Not authorized to modify this project')
        }
        const currentImages = project.inspirationImages || []
        const updatedImages = currentImages.filter((id) => id !== storageId)
        await ctx.db.patch(projectId, {
            inspirationImages: updatedImages,
            lastModified: Date.now(),
        })
        try {
            await ctx.storage.delete(storageId)
        } catch (error) {
            console.warn('Failed to delete file from storage:', error)
        }
        return {
            success: true,
            message: 'Inspiration image removed successfully',
            totalImages: updatedImages.length,
        }
    }
})