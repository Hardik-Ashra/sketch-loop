// import { v } from "convex/values";
// import { mutation, query } from "./_generated/server";
// import { getAuthUserId } from "@convex-dev/auth/server";

// export const getProject = query({
//   args: { projectId: v.id("projects") },
//   handler: async (ctx, { projectId }) => {
//     const userId = await getAuthUserId(ctx)
//     if (!userId) {
//       throw new Error("Unauthorized")
//     }
//     const project = await ctx.db.get(projectId)
//     if (!project) {
//       throw new Error("Project not found")
//     }
//     if (project.userId !== userId && !project.isPublic) {
//       throw new Error("Access denied")
//     }
//     return project
//   }
// })

// export const createProject = mutation({
//   args: {
//     userId: v.id("users"),
//     name: v.optional(v.string()),
//     sketchesData: v.any(),
//     thumbnail: v.optional(v.string()),
//   },
//   handler: async (ctx, { userId, name, sketchesData, thumbnail }) => {
//     console.log('[Convex] Creating project for user:', userId)

//     const projectNumber = await getNextProjectNumber(ctx, userId)
//     const projectName = name || `Project ${projectNumber}`
//     const projectId = await ctx.db.insert('projects', {
//       userId,
//       name: projectName,
//       sketchesData,
//       projectNumber,
//       thumbnail,
//       lastModified: Date.now(),
//       createdAt: Date.now(),
//       isPublic: false,
//     })
//     console.log('[Convex] Project created:', {
//       projectId,
//       name: projectName,
//       projectNumber,
//     })
//     return {
//       projectId,
//       name: projectName,
//       projectNumber,
//     }
//   }
// })

// // async function getNextProjectNumber(ctx: any, userId: string): Promise<number> {
// //   const counter = await ctx.db
// //     .query('project_counters')
// //     //eslint-disable-next-line @typescript-eslint/no-explicit-any
// //     .withIndex('by_userId', (q: any) => q.eq('userId', userId))
// //     .first()

// //   if (!counter) {
// //     await ctx.db.insert('project_counters', {
// //       userId,
// //       nextProjectNumber: 1,
// //     })
// //     return 1
// //   }

// //   const projectNumber = counter.nextProjectNumber

// //   await ctx.db.patch(counter._id, {
// //     nextProjectNumber: projectNumber + 1,
// //   })
// //   return projectNumber
// // }
// export const getNextProjectNumber = mutation({
//   args: { userId: v.string() },
//   handler: async (ctx, { userId }) => {
//     const counter = await ctx.db
//       .query("project_counters")
//       .withIndex("by_userId", q => q.eq("userId", userId))
//       .unique();

//     if (!counter) {
//       await ctx.db.insert("project_counters", {
//         userId,
//         nextProjectNumber: 2,
//       });
//       return 1;
//     }

//     const projectNumber = counter.nextProjectNumber;

//     await ctx.db.patch(counter._id, {
//       nextProjectNumber: projectNumber + 1,
//     });

//     return projectNumber;
//   }
// });
// export const getUserProjects = query({
//   args: {
//     userId: v.id("users"),
//     limit: v.optional(v.number()),
//   },
//   handler: async (ctx, { userId, limit = 20 }) => {
//     const allProjects = await ctx.db
//       .query("projects")
//       .withIndex("by_userId", (q) => q.eq("userId", userId))
//       .order('desc')
//       .collect()

//     const projects = allProjects.slice(0, limit)

//     return projects.map((project) => ({
//       _id: project._id,
//       name: project.name,
//       projectNumber: project.projectNumber,
//       thumbnail: project.thumbnail,
//       lastModified: project.lastModified,
//       createdAt: project.createdAt,
//       isPublic: project.isPublic,
//     }))
//   }
// })

// export const getProjectStyleGuide = query({
//   args: {
//     projectId: v.id("projects"),
//   },
//   handler: async (ctx, { projectId }) => {
//     console.log("projectId", projectId)
//     const userId = await getAuthUserId(ctx)
//     if (!userId) {
//       throw new Error("Unauthorized")
//     }
//     const project = await ctx.db.get(projectId)
//     if (!project) {
//       throw new Error("Project not found")
//     }
//     if (project.userId !== userId && !project.isPublic) {
//       throw new Error("Access denied")
//     }

//     return project.styleGuide ? JSON.parse(project.styleGuide) : null
//   }
// })

// export const updateProjectSketches = mutation({
//   args: {
//     projectId: v.id("projects"),
//     userId: v.id("users"),
//     sketchesData: v.any(),
//     viewportData: v.optional(v.any()),
//   },
//   handler: async (ctx, { projectId, sketchesData, viewportData }) => {
//     const project = await ctx.db.get(projectId)
//     if (!project) throw new Error('Project not found')

//     const updateData: any = {
//       sketchesData,
//       lastModified: Date.now(),
//     }

//     if (viewportData) {
//       updateData.viewportData = viewportData
//     }

//     await ctx.db.patch(projectId, updateData)
//     console.log("Convex Project updated successfully")
//     return { success: true }
//   }

// })

// export const updateProjectStyleGuide = mutation({
//   args: {
//     projectId: v.id('projects'),
//     styleGuideData: v.any(),
//   },
//   handler: async (ctx, { projectId, styleGuideData }) => {
//     console.log(' [Convex] Updating project style guide: ', projectId)
//     const userId = await getAuthUserId(ctx)
//     if (!userId) throw new Error('Not authenticated')

//     const project = await ctx.db.get(projectId)
//     if (!project) throw new Error('Project not found')
//     if (project.userId !== userId) {
//       throw new Error('Access denied')
//     }

//     await ctx.db.patch(projectId, {
//       styleGuide: JSON.stringify(styleGuideData), // Store as JSON string
//       lastModified: Date.now(),
//     })

//     console.log(' [Convex] Project style guide updated successfully')
//     return { success: true, styleGuide: styleGuideData }
//   },
// })
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

/* =========================================================
   INTERNAL HELPER — NOT A MUTATION
   ========================================================= */

async function getNextProjectNumber(
  ctx: any,
  userId: Id<"users">
): Promise<number> {
  const counter = await ctx.db
    .query("project_counters")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .unique();

  // First project
  if (!counter) {
    await ctx.db.insert("project_counters", {
      userId,
      nextProjectNumber: 2, // next value stored
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
    console.log("[Convex] Creating project for user:", userId);

    // 🔥 SAFE — runs inside SAME mutation transaction
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

    console.log("[Convex] Project created:", {
      projectId,
      name: projectName,
      projectNumber,
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
   UPDATE SKETCHES
   ========================================================= */

export const updateProjectSketches = mutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
    sketchesData: v.any(),
    viewportData: v.optional(v.any()),
  },
  handler: async (ctx, { projectId, sketchesData, viewportData }) => {
    const project = await ctx.db.get(projectId);
    if (!project) throw new Error("Project not found");

    const updateData: any = {
      sketchesData,
      lastModified: Date.now(),
    };

    if (viewportData) {
      updateData.viewportData = viewportData;
    }

    await ctx.db.patch(projectId, updateData);
    console.log("Convex Project updated successfully");

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

    console.log("[Convex] Project style guide updated successfully");

    return { success: true, styleGuide: styleGuideData };
  },
});