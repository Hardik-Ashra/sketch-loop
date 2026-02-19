import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server"
// FIX – import fetchQuery alongside preloadQuery.
// preloadQuery is for Server Components only — it needs a Next.js render
// context to resolve relative URLs internally. When called from an API route
// (which has no render context) it tries to fetch from a relative URL
// (/pipeline) and crashes with "Failed to parse URL from /pipeline".
// fetchQuery is the correct function for API routes — it resolves URLs
// absolutely using the Convex deployment URL from CONVEX_URL env var.
import { fetchQuery, fetchMutation, preloadQuery } from "convex/nextjs"
import { api } from "../../convex/_generated/api"
import { ConvexUserRaw, normalizeProfile } from "@/types/user"
import { Id } from "../../convex/_generated/dataModel"

// ─── Server Component queries (preloadQuery) ──────────────────────────────────
// These are only called from Server Components (page.tsx etc.) where a
// Next.js render context exists. Keep using preloadQuery here.

export const ProfileQuery = async () => {
    return await preloadQuery(
        api.user.getCurrentUser,
        {},
        { token: await convexAuthNextjsToken() }
    )
}

export const SubscriptionEntitlementQuery = async () => {
    const rawProfile = await ProfileQuery()
    const profile = normalizeProfile(
        rawProfile._valueJSON as unknown as ConvexUserRaw | null
    )
    const entitlement = await preloadQuery(
        api.subscription.hasEntitlement,
        { userId: profile?.id as Id<'users'> },
        { token: await convexAuthNextjsToken() }
    )
    return { entitlement, profileName: profile?.name }
}

export const ProjectQuery = async (projectId: string) => {
    const rawProfile = await ProfileQuery()
    const profile = normalizeProfile(
        rawProfile._valueJSON as unknown as ConvexUserRaw | null
    )
    if (!profile?.id || !projectId) {
        return { project: null, profile: null }
    }
    const project = await preloadQuery(
        api.projects.getProject,
        { projectId: projectId as Id<'projects'> },
        { token: await convexAuthNextjsToken() }
    )
    return { project, profile }
}

export const ProjectsQuery = async () => {
    const rawProfile = await ProfileQuery()
    const profile = normalizeProfile(
        rawProfile._valueJSON as unknown as ConvexUserRaw | null
    )
    if (!profile?.id) {
        return { projects: null, profile: null }
    }
    const projects = await preloadQuery(
        api.projects.getUserProjects,
        { userId: profile.id as Id<'users'> },
        { token: await convexAuthNextjsToken() }
    )
    return { projects, profile }
}

export const MoodboardImagesQuery = async (projectId: string) => {
    // Called from Server Components only — preloadQuery is correct here
    const images = await preloadQuery(
        api.moodboard.getMoodboardImages,
        { projectId: projectId as Id<'projects'> },
        { token: await convexAuthNextjsToken() }
    )
    return { images }
}

// ─── API Route queries (fetchQuery) ──────────────────────────────────────────
// These are called from /api/* route handlers where there is no render
// context. fetchQuery resolves absolutely via CONVEX_URL — no /pipeline crash.

export const StyleGuideQuery = async (projectId: string) => {
    const styleGuide = await fetchQuery(
        api.projects.getProjectStyleGuide,
        { projectId: projectId as Id<'projects'> },
        { token: await convexAuthNextjsToken() }
    )
    return { styleGuide }
}

export const InspirationImagesQuery = async (projectId: string) => {
    const images = await fetchQuery(
        api.inspiration.getInspirationImages,
        { projectId: projectId as Id<'projects'> },
        { token: await convexAuthNextjsToken() }
    )
    return { images }
}

export const CreditsBalanceQuery = async () => {
    const rawProfile = await fetchQuery(
        api.user.getCurrentUser,
        {},
        { token: await convexAuthNextjsToken() }
    )
    const profile = normalizeProfile(rawProfile as unknown as ConvexUserRaw | null)
    if (!profile?.id) {
        return { ok: false, balance: 0, profile: null }
    }
    const balance = await fetchQuery(
        api.subscription.getCreditsBalance,
        { userId: profile.id as Id<'users'> },
        { token: await convexAuthNextjsToken() }
    )
    return { ok: true, balance, profile }
}

export const ConsumeCreditsQuery = async ({ amount }: { amount?: number }) => {
    const rawProfile = await fetchQuery(
        api.user.getCurrentUser,
        {},
        { token: await convexAuthNextjsToken() }
    )
    const profile = normalizeProfile(rawProfile as unknown as ConvexUserRaw | null)
    if (!profile?.id) {
        return { ok: false, balance: 0, profile: null }
    }
    const credits = await fetchMutation(
        api.subscription.consumeCredits,
        {
            reason: 'ai:generation',
            userId: profile.id as Id<'users'>,
            amount: amount || 1,
        },
        { token: await convexAuthNextjsToken() }
    )
    return { ok: credits.ok, balance: credits.balance, profile }
}