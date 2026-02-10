import { useMutation } from "convex/react"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { api } from "../../convex/_generated/api"
import { toast } from "sonner"

export interface MoodboardImage {
    id: string
    file?: File
    preview: string
    storageId?: string
    uploaded: boolean
    uploading: boolean
    error?: string
    url?: string
    isFromServer?: boolean
}
interface StylesFormData {
    images: MoodboardImage[]
}

export const useMoodBoard = (guideImages: MoodboardImage[]) => {
    const [dragActive, setDragActive] = useState(false)
    const searchParams = useSearchParams()
    const projectId = searchParams.get('project')

    const form = useForm<StylesFormData>({
        defaultValues: {
            images: [],
        }
    })

    const { watch, setValue, getValues } = form
    const images = watch('images')
    const generateUploadUrl = useMutation(api.moodboard.generateUploadUrl)
    const removeMoodBoardImage = useMutation(api.moodboard.removeMoodBoardImage)


    const addImage = (file: File) => {
        if (images.length >= 5) {
            toast.error('Maximum 5 images allowed')
            return
        }



        const newImage: MoodboardImage = {
            id: `${Date.now()}-${Math.random()}`,
            file,
            preview: URL.createObjectURL(file),
            uploaded: false,
            uploading: false,
            isFromServer: false,

        }
    }
    return {
        images,
        dragActive,
        removeImage,
        handleDrag,
        handleDrop,
        handleFileInput,
        canAddMore,
    }
}