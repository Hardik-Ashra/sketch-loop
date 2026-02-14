"use client";
import { useAppDispatch } from "@/redux/store";
import React, { useEffect } from "react";
import { loadProject } from "@/redux/slices/shapes";
import { restoreViewport } from "@/redux/slices/viewport";

type Props = {
  children: React.ReactNode;
  initialProject: any;
};
const ProjectProvider = ({ children, initialProject }: Props) => {
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (initialProject?._valueJSON?.sketchesData) {
      const projectData = initialProject._valueJSON;

      dispatch(loadProject(projectData.sketchesData));

      if (projectData.viewportData) {
        dispatch(restoreViewport(projectData.viewportData));
      }
    }
  }, [dispatch, initialProject]);

  return <>{children}</>;
};

export default ProjectProvider;
