import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

/* =========================================================
   INTERNAL HELPER — NOT A MUTATION
   (runs inside the calling mutation's transaction)
   ========================================================= */

async function getNextProjectNumber(
  ctx: any,
  userId: Id<"users">
): Promise<number> {
  const counter = await ctx.db
    .query("project_counters")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .unique();

  if (!counter) {
    await ctx.db.insert("project_counters", {
      userId,
      nextProjectNumber: 2,
    });
    return 1;
  }

  const projectNumber = counter.nextProjectNumber;

  await ctx.db.patch(counter._id, {
    nextProjectNumber: projectNumber + 1,
  });

  return projectNumber;
}

/* =========================================================
   GET SINGLE PROJECT
   ========================================================= */

export const getProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const project = await ctx.db.get(projectId);
    if (!project) throw new Error("Project not found");

    if (project.userId !== userId && !project.isPublic) {
      throw new Error("Access denied");
    }

    return project;
  },
});

/* =========================================================
   CREATE PROJECT  (ATOMIC COUNTER SAFE)
   ========================================================= */

export const createProject = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    sketchesData: v.any(),
    thumbnail: v.optional(v.string()),
  },
  handler: async (ctx, { userId, name, sketchesData, thumbnail }) => {
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) throw new Error("Not authenticated");
    if (authUserId !== userId) throw new Error("Access denied");

    const projectNumber = await getNextProjectNumber(ctx, userId);
    const projectName = name || `Project ${projectNumber}`;

    const projectId = await ctx.db.insert("projects", {
      userId,
      name: projectName,
      sketchesData,
      projectNumber,
      thumbnail,
      lastModified: Date.now(),
      createdAt: Date.now(),
      isPublic: false,
    });

    return {
      projectId,
      name: projectName,
      projectNumber,
    };
  },
});

/* =========================================================
   GET USER PROJECTS
   ========================================================= */

export const getUserProjects = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit = 20 }) => {
    const allProjects = await ctx.db
      .query("projects")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const projects = allProjects.slice(0, limit);

    return projects.map((project) => ({
      _id: project._id,
      name: project.name,
      projectNumber: project.projectNumber,
      thumbnail: project.thumbnail,
      lastModified: project.lastModified,
      createdAt: project.createdAt,
      isPublic: project.isPublic,
    }));
  },
});

/* =========================================================
   GET STYLE GUIDE
   ========================================================= */

export const getProjectStyleGuide = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const project = await ctx.db.get(projectId);
    if (!project) throw new Error("Project not found");

    if (project.userId !== userId && !project.isPublic) {
      throw new Error("Access denied");
    }

    return project.styleGuide ? JSON.parse(project.styleGuide) : null;
  },
});

/* =========================================================
   UPDATE SKETCHES (AUTH-PROTECTED)
   ========================================================= */

export const updateProjectSketches = mutation({
  args: {
    projectId: v.id("projects"),
    userId: v.optional(v.id("users")),
    sketchesData: v.any(),
    viewportData: v.optional(v.any()),
  },
  handler: async (ctx, { projectId, userId: argUserId, sketchesData, viewportData }) => {
    // Auth: prefer session auth, fall back to explicit userId (server-side / Inngest)
    const sessionUserId = await getAuthUserId(ctx);
    const effectiveUserId = sessionUserId ?? argUserId;
    if (!effectiveUserId) throw new Error("Not authenticated");

    const project = await ctx.db.get(projectId);
    if (!project) throw new Error("Project not found");
    if (project.userId !== effectiveUserId) throw new Error("Access denied");

    const updateData: Record<string, unknown> = {
      sketchesData,
      lastModified: Date.now(),
    };

    if (viewportData) {
      updateData.viewportData = viewportData;
    }

    await ctx.db.patch(projectId, updateData);

    return { success: true };
  },
});

/* =========================================================
   UPDATE STYLE GUIDE
   ========================================================= */

export const updateProjectStyleGuide = mutation({
  args: {
    projectId: v.id("projects"),
    styleGuideData: v.any(),
  },
  handler: async (ctx, { projectId, styleGuideData }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const project = await ctx.db.get(projectId);
    if (!project) throw new Error("Project not found");

    if (project.userId !== userId) {
      throw new Error("Access denied");
    }

    await ctx.db.patch(projectId, {
      styleGuide: JSON.stringify(styleGuideData),
      lastModified: Date.now(),
    });

    return { success: true, styleGuide: styleGuideData };
  },
});