import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

interface AutoSaveProjectResponse {
    success: boolean,
    message: string,
    eventId: string
}
interface AutoSaveProjectRequest {
    userId: string,
    projectId: string,
    shapesData: {
        shapes: Record<string, unknown>,
        tool: string,
        selected: Record<string, unknown>,
        frameCounter: number
    }
    viewportData?: {
        scale: number
        translate: {
            x: number,
            y: number
        }
    }
}
export const projectApi = createApi({
    reducerPath: "projectApi",
    baseQuery: fetchBaseQuery({ baseUrl: "/api/project" }),
    tagTypes: ['Project'],
    endpoints: (builder) => ({
        autoSaveProject: builder.mutation<AutoSaveProjectResponse, AutoSaveProjectRequest>({
            query: (data) => ({
                url: "",
                method: "PATCH",
                body: data
            })
        })
    })
})