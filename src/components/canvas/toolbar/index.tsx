import React from "react";
import HistoryPill from "./history";
import ZoomBar from "./zoombar";
import ToolBarShapes from "./toolbarShapes";

const Toolbar = () => {
  return (
    <div className="fixed bottom-0 w-full grid grid-cols-3 z-58 p-5">
      {/* <HistoryPill /> */}
      <ToolBarShapes />
      <ZoomBar />
    </div>
  );
};

export default Toolbar;
