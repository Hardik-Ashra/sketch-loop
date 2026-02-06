import { getAuthUserId } from "@convex-dev/auth/server";
import { queryGeneric } from "convex/server";

export const getCurrentUser = queryGeneric({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx)
        if (!userId) return null;
        return await ctx.db.get(userId)
    }
})