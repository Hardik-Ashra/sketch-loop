import { ProjectQuery } from "@/convex/query.config";
import ProjectsProvider from "@/components/projects/provider";
import InfinityCanvas from "@/components/canvas";
import React from "react";

interface CanvasPageProps {
  searchParams: Promise<{ project: string }>;
}
const Page = async ({ searchParams }: CanvasPageProps) => {
  const params = await searchParams;
  const projectId = params.project;
  if (!projectId) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <p className="text-muted-foreground">No project selected</p>
      </div>
    );
  }
  const { project, profile } = await ProjectQuery(projectId);
  if (!profile) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Authentication required</p>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <p className="text-red-500">Project not found access denied</p>
      </div>
    );
  }
  return (
    <ProjectsProvider initialProject={project}>
      <InfinityCanvas />
    </ProjectsProvider>
  );
};

export default Page;
