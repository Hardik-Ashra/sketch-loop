"use client";
import { useMutation } from "convex/react";
import { useSearchParams } from "next/navigation";
import { RefObject, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";
import { useGenerateStyleGuideMutation } from "@/redux/api/style-guide";
import { useRouter } from "next/navigation";
import { updateShape } from "../../s2c-boiler-plate/slice/shapes";
import { GeneratedUIShape } from "@/redux/slices/shapes";
import { useAppDispatch } from "@/redux/store";

export interface MoodboardImage {
  id: string;
  file?: File;
  preview: string;
  storageId?: string;
  uploaded: boolean;
  uploading: boolean;
  error?: string;
  url?: string;
  isFromServer?: boolean;
}
interface StylesFormData {
  images: MoodboardImage[];
}

export const useMoodBoard = (guideImages: MoodboardImage[]) => {

  const [dragActive, setDragActive] = useState(false);
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");

  const form = useForm<StylesFormData>({
    defaultValues: {
      images: [],
    },
  });

  const { watch, setValue, getValues } = form;
  const images = watch("images");

  const generateUploadUrl = useMutation(api.moodboard.generateUploadUrl);
  const removeMoodBoardImage = useMutation(api.moodboard.removeMoodBoardImage);
  const addMoodBoardImage = useMutation(api.moodboard.addMoodBoardImage)

  const uploadImage = async (file: File): Promise<{ storageId: string; url?: string }> => {
    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!result.ok) {
        throw new Error(`Upload failed: ${result.statusText}`)
      }
      const { storageId } = await result.json()
      if (projectId) {
        await addMoodBoardImage({
          projectId: projectId as Id<'projects'>,
          storageId: storageId as Id<'_storage'>
        })

      }
      return { storageId }
    }
    catch (error) {
      console.error(error)
      throw error
    }
  }


  useEffect(() => {
    if (guideImages && guideImages.length > 0) {
      const serverImages: MoodboardImage[] = guideImages.map((img: any) => ({
        id: img.id,
        preview: img.url,
        storageId: img.storageId,
        uploaded: true,
        uploading: false,
        url: img.url,
        isFromServer: true,
      }));
      const currentImages = getValues("images");
      if (currentImages.length === 0) {
        setValue("images", serverImages);
      } else {
        const mergedImages = [...currentImages];
        serverImages.forEach((serverImg) => {
          const clientIndex = mergedImages.findIndex(
            (clientImg) => clientImg.storageId === serverImg.storageId,
          );
          if (clientIndex !== -1) {
            // Clean up old blob URL if it exists
            if (mergedImages[clientIndex].preview.startsWith("blob:")) {
              URL.revokeObjectURL(mergedImages[clientIndex].preview);
            }
            // Replace with server image
            mergedImages[clientIndex] = serverImg;
          }
        });
        setValue("images", mergedImages);
      }
    }
  }, [guideImages, setValue, getValues]);

  const addImage = (file: File) => {
    if (images.length >= 5) {
      toast.error("Maximum 5 images allowed");
      return;
    }
    const newImage: MoodboardImage = {
      id: `${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      uploaded: false,
      uploading: false,
      isFromServer: false,
    };
    const updatedImages = [...images, newImage];
    setValue("images", updatedImages);
    toast.success("Images added to mood board");
  };

  const removeImage = async (imageId: string) => {
    const imageToRemove = images.find((img) => img.id === imageId);
    if (!imageToRemove) return;

    if (imageToRemove.isFromServer && imageToRemove.storageId && projectId) {
      try {
        await removeMoodBoardImage({
          projectId: projectId as Id<"projects">,
          storageId: imageToRemove.storageId as Id<"_storage">,
        });
      } catch (error) {
        console.log(error);
        toast.error("Failed to remove image from server");
        return;
      }
    }

    const updatedImages = images.filter((img) => {
      if (img.id === imageId) {
        if (!img.isFromServer && img.preview.startsWith("blob")) {
          URL.revokeObjectURL(img.preview);
        }
        return false;
      }
      return true;
    });

    setValue("images", updatedImages);
    toast.success("Image removed");
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragLeave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    if (imageFiles.length === 0) {
      toast.error("Please drop image files only");
      return;
    }

    imageFiles.forEach((file) => {
      if (images.length < 5) {
        addImage(file);
      }
    });
  };
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => addImage(file));

    e.target.value = "";
  };

  useEffect(() => {
    const uploadPendingImages = async () => {
      const currentImages = getValues('images')
      for (let i = 0; i < currentImages.length; i++) {
        const image = currentImages[i]
        if (!image.uploaded && !image.uploading && !image.error) {
          const updatedImages = [...currentImages]
          updatedImages[i] = { ...image, uploading: true }
          setValue('images', updatedImages)
          try {
            const { storageId } = await uploadImage(image.file!)
            const finalImages = getValues('images')
            const finalIndex = finalImages.findIndex((img) => img.id === image.id)
            if (finalIndex !== -1) {
              finalImages[finalIndex] = {
                ...finalImages[finalIndex],
                storageId,
                uploaded: true,
                uploading: false,
                isFromServer: true
              }
              setValue('images', finalImages)
            }
          }
          catch (error) {
            console.error(error)
            const errorImages = getValues('images')
            const errorIndex = errorImages.findIndex((img) => img.id === image.id)
            if (errorIndex !== -1) {
              errorImages[errorIndex] = {
                ...errorImages[errorIndex],
                uploading: false,
                error: 'Upload failed',
              }
              setValue('images', [...errorImages])
            }
          }
        }
      }
    }

    if (images.length > 0) {
      uploadPendingImages()
    }

  }, [images, setValue, getValues])


  useEffect(() => {
    return () => {
      images.forEach((img) => {
        if (img.preview.startsWith('blob:')) {
          URL.revokeObjectURL(img.preview)
        }
      })
    }
  }, [])

  return {
    form,
    images,
    projectId,
    dragActive,
    addImage,
    removeImage,
    handleDrag,
    handleDrop,
    handleFileInput,
    canAddMore: images.length < 5,
  }
};

export const useStyleGuide = (
  projectId: string,
  images: MoodboardImage[],
  fileInputRef: RefObject<HTMLInputElement | null>,
) => {
  const [generateStyleGuide, { isLoading: isGenerating }] = useGenerateStyleGuideMutation()
  const router = useRouter()
  const handleUploadClick = () => fileInputRef.current?.click()

  const handleGenerateStyleGuide = async () => {
    if (!projectId) {
      toast.error("No project selected")
      return
    }
    if (images.length === 0) {
      toast.error("Please upload at least one image to generate style guide")
      return
    }
    if (images.some((img) => img.uploading)) {
      toast.error("Please wait for all images to upload")
      return
    }
    try {
      toast.loading("Analyzing the mood board images", {
        id: 'style-guide-generation'
      })

      const result = await generateStyleGuide({ projectId }).unwrap()
      if (!result.success) {
        toast.error(result.message, { id: 'style-guide-generation' })
        return
      }
      router.refresh()
      toast.success('Style guide generated successfully', { id: 'style-guide-generation' })
      setTimeout(() => {
        toast.success('Style guide generated! Switch to the Colours tab to see the results', {
          duration: 5000
        })
      }, 1000)
    }
    catch (error) {
      const errorMessage = error && typeof error === 'object' && 'error' in error
        ? (error as { error: string }).error
        : 'Failed to generate style guide'
      toast.error(errorMessage, { id: 'style-guide-generation' })
    }

  }
  return {
    handleGenerateStyleGuide,
    handleUploadClick,
    isGenerating
  }
}

export const useUpdateContainer = (shape: GeneratedUIShape) => {
  const dispatch = useAppDispatch()
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (containerRef.current && shape.uiSpecData) {
      const timeoutId = setTimeout(() => {
        const actualHeight = containerRef.current?.offsetHeight || 0
        if (actualHeight > 0 && Math.abs(actualHeight - shape.h) > 10) {
          dispatch(
            updateShape({
              id: shape.id,
              patch: { h: actualHeight },
            })
          )
        }
      }, 100)

      return () => clearTimeout(timeoutId)
    }
  }, [shape.uiSpecData, shape.id, shape.h, dispatch])

  const sanitizeHtml = (html: string) => {
    const sanitized = html
      .replace(/<script\b[^<]*(?:(?!\s\/script>)<[^<]*)*\s\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!\s\/iframe>)<[^<]*)*\s\/iframe>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')

    return sanitized
  }
  return {
    sanitizeHtml,
    containerRef
  }
}




