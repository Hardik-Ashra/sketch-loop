import { createSlice, PayloadAction } from "@reduxjs/toolkit";


interface ProjectSummary {
    _id: string;
    name: string;
    projectNumber: number;
    thumbnail?: string;
    lastModified: number;
    createdAt: number;
    isPublic?: boolean;
}

interface ProjectState {
    projects: ProjectSummary[];
    total: number;
    isLoading: boolean;
    error: string | null;
    lastFetch: number | null;
    isCreating: boolean;
    createError: string | null;
}

const initialState: ProjectState = {
    projects: [],
    total: 0,
    isLoading: false,
    error: null,
    lastFetch: null,
    isCreating: false,
    createError: null,
}

const projectSlice = createSlice({
    name: "projects",
    initialState,
    reducers: {
        fetchProjectsStart: (state) => {
            state.isLoading = true;
            state.error = null;
        },
        fetchProjectsSuccess: (
            state,
            action: PayloadAction<{ projects: ProjectSummary[]; total: number }>
        ) => {
            state.isLoading = false;
            state.projects = action.payload.projects;
            state.total = action.payload.total;
            state.error = null;
            state.lastFetch = Date.now();
        },
        fetchProjectsFailure: (state, action: PayloadAction<string>) => {
            state.error = action.payload;
            state.isLoading = false;
        },

        //Create Project Action
        createProjectStart: (state) => {
            state.isCreating = true;
            state.createError = null;
        },
        createProjectSuccess: (state) => {
            state.isCreating = false;
            state.createError = null;
        },
        createProjectFailure: (state, action: PayloadAction<string>) => {
            state.createError = action.payload;
            state.isCreating = false;
        },
        addProject: (state, action: PayloadAction<ProjectSummary>) => {
            state.projects.unshift(action.payload);
            state.total++;
        },
        updateProject: (state, action: PayloadAction<ProjectSummary>) => {
            const index = state.projects.findIndex(
                (project) => project._id === action.payload._id
            );
            if (index !== -1) {
                state.projects[index] = action.payload;
            }
        },
        removeProject: (state, action: PayloadAction<string>) => {
            state.projects = state.projects.filter((project) => project._id !== action.payload);
            state.total--;
        },
        clearProjects: (state) => {
            state.projects = [];
            state.total = 0;
            state.lastFetch = null;
            state.error = null;
            state.createError = null;
        },
        clearErrors: (state) => {
            state.error = null;
            state.createError = null;
        },
    },
});

export const {
    fetchProjectsStart,
    fetchProjectsSuccess,
    fetchProjectsFailure,
    createProjectStart,
    createProjectSuccess,
    createProjectFailure,
    addProject,
    updateProject,
    removeProject,
    clearProjects,
    clearErrors,
} = projectSlice.actions;

export default projectSlice.reducer;