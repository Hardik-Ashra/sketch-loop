import { Reducer } from "@reduxjs/toolkit";
import profile from "./profile";
import projects from "./projects";
import shapes from "./shaped";
import viewport from "./viewport";

export const slices: Record<string, Reducer> = {
    profile,
    projects,
    shapes,
    viewport
}