import { useAppDispatch } from "@/redux/store";
import React from "react";

type Props = {
  children: React.ReactNode;
  initialProject: any;
};
const ProjectProvider = ({ children, initialProject }: Props) => {
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (initialProject?._valueJSON?.sketchesData) {
      const projectData = initialProject._valueJSON;

      dispatch(loopProject(projectData.sketchesData));

      if (projectData.viewportData) {
        dispatch(restoreViewport(projectData.viewportData));
      }
    }
  }, [dispatch, initialProject]);

  return <div>ProjectProvider</div>;
};

export default ProjectProvider;
