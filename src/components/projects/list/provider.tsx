"use client";

import { fetchProjectsSuccess } from "@/redux/slices/projects";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import { useEffect } from "react";
import { usePreloadedQuery } from "convex/react";
import type { Preloaded } from "convex/react";
import { api } from "../../../../convex/_generated/api";

type Props = {
  children: React.ReactNode;
  initialProjects: Preloaded<typeof api.projects.getUserProjects>;
};

const ProjectsProvider = ({ children, initialProjects }: Props) => {
  const dispatch = useAppDispatch();

  // FIX – swap the one-time _valueJSON read for a live Convex subscription.
  // usePreloadedQueryWithAuth uses initialProjects as the seed (so the page
  // still renders instantly from the server snapshot) but keeps a WebSocket
  // open so Convex pushes any changes — including a newly created project —
  // automatically. Back-navigation re-connects and gets the current state
  // without a reload.
  const liveProjects = usePreloadedQuery(initialProjects);

  useEffect(() => {
    if (!liveProjects) return;

    dispatch(
      fetchProjectsSuccess({
        projects: liveProjects.map((p: any) => ({
          _id: p._id,
          name: p.name,
          projectNumber: p.projectNumber,
          thumbnail: p.thumbnail,
          lastModified: p.lastModified ?? p._creationTime,
          createdAt: p._creationTime,
          isPublic: p.isPublic ?? false,
        })),
        total: liveProjects.length,
      }),
    );
  }, [liveProjects, dispatch]);

  return <>{children}</>;
};

export default ProjectsProvider;
