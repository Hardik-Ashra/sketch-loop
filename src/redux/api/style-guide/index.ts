import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"

export interface ColorSection {
    title: 'Primary Colours'
    | 'Secondary Colours & Accent Colors'
    | 'UI Components Colors'
    | 'Utility & Form Colors'
    | 'Status & Feedback Colors'
    swatches: ColorSwatch[]
}
export interface ColorSwatch {
    name: string
    hexColor: string
    description?: string
}

export interface TypographyStyle {
    name: string
    fontFamily: string
    fontSize: string
    fontWeight: string
    lineHeight: string
    letterSpacing?: string
    description?: string
}
export interface TypographySection {
    title: string
    styles: TypographyStyle[]
}

export interface StyleGuide {
    theme: string
    description: string
    colorSections: [
        ColorSection,
        ColorSection,
        ColorSection,
        ColorSection,
        ColorSection,
    ]

    typographySections: [
        TypographySection,
        TypographySection,
        TypographySection
    ]

}

export interface GenerateStyleGuideRequest {
    projectId: string
}

export interface GenerateStyleGuideResponse {
    success: boolean
    message: string
    styleGuide: StyleGuide
}

export const styleGuideApi = createApi({
    reducerPath: 'styleGuideApi',
    baseQuery: fetchBaseQuery({
        baseUrl: '/api/generate',
    }),
    tagTypes: ['StyleGuide'],
    endpoints: (builder) => ({
        generateStyleGuide: builder.mutation<
            GenerateStyleGuideResponse,
            GenerateStyleGuideRequest>({
                query: (data) => ({

                    url: '/style',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: data
                }),
                invalidatesTags: ['StyleGuide']
            }),

    }),

})

export const { useGenerateStyleGuideMutation } = styleGuideApi