"use client";
import { useMutation } from "convex/react";
import { useSearchParams } from "next/navigation";
import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";
import { useGenerateStyleGuideMutation } from "@/redux/api/style-guide";
import { useRouter } from "next/navigation";
import { updateShape } from "@/redux/slices/shapes";
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

// ─────────────────────────────────────────────────────────────────────────────
// useMoodBoard
// ─────────────────────────────────────────────────────────────────────────────
export const useMoodBoard = (guideImages: MoodboardImage[]) => {
  const [dragActive, setDragActive] = useState(false);
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");

  const form = useForm<StylesFormData>({
    defaultValues: { images: [] },
  });

  const { watch, setValue, getValues } = form;
  const images = watch("images");

  const generateUploadUrl = useMutation(api.moodboard.generateUploadUrl);
  const removeMoodBoardImage = useMutation(api.moodboard.removeMoodBoardImage);
  const addMoodBoardImage = useMutation(api.moodboard.addMoodBoardImage);

  // FIX #1 – useCallback gives uploadImage a stable reference so the upload
  // effect can list it as a dep without re-registering on every render.
  const uploadImage = useCallback(
    async (file: File): Promise<{ storageId: string; url?: string }> => {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) throw new Error(`Upload failed: ${result.statusText}`);
      const { storageId } = await result.json();
      if (projectId) {
        await addMoodBoardImage({
          projectId: projectId as Id<"projects">,
          storageId: storageId as Id<"_storage">,
        });
      }
      return { storageId };
    },
    [generateUploadUrl, addMoodBoardImage, projectId]
  );

  // FIX #2 – Server image sync:
  // • Only replaces an image once the server confirms it (storageId match).
  // • Never replaces an image that is still mid-upload (uploading: true).
  // • Only calls setValue when something actually changed — calling it
  //   unconditionally triggers watch → re-render → effect → infinite loop.
  useEffect(() => {
    if (!guideImages?.length) return;

    const serverImages: MoodboardImage[] = guideImages.map((img) => ({
      id: img.id,
      preview: img.url ?? img.preview,
      storageId: img.storageId,
      uploaded: true,
      uploading: false,
      url: img.url,
      isFromServer: true,
    }));

    const currentImages = getValues("images");

    if (currentImages.length === 0) {
      setValue("images", serverImages);
      return;
    }

    let changed = false;
    const merged = currentImages.map((clientImg) => {
      const serverMatch = serverImages.find(
        (s) => s.storageId && s.storageId === clientImg.storageId
      );
      if (!serverMatch || clientImg.uploading) return clientImg;
      if (clientImg.preview.startsWith("blob:")) URL.revokeObjectURL(clientImg.preview);
      changed = true;
      return serverMatch;
    });

    if (changed) setValue("images", merged);
  }, [guideImages, setValue, getValues]);

  // FIX #3 – addImage reads from getValues() not the watched `images` variable.
  // The watched variable closes over its value at creation time — reading via
  // getValues() always gives the latest list, preventing stale-closure overwrites
  // when two images are added in quick succession.
  const addImage = useCallback(
    (file: File) => {
      const current = getValues("images");
      if (current.length >= 5) {
        toast.error("Maximum 5 images allowed");
        return;
      }
      setValue("images", [
        ...current,
        {
          id: `${Date.now()}-${Math.random()}`,
          file,
          preview: URL.createObjectURL(file),
          uploaded: false,
          uploading: false,
          isFromServer: false,
        },
      ]);
      toast.success("Image added to mood board");
    },
    [getValues, setValue]
  );

  // FIX #4 – removeImage also reads via getValues() for the same reason.
  const removeImage = useCallback(
    async (imageId: string) => {
      const current = getValues("images");
      const target = current.find((img) => img.id === imageId);
      if (!target) return;

      if (target.isFromServer && target.storageId && projectId) {
        try {
          await removeMoodBoardImage({
            projectId: projectId as Id<"projects">,
            storageId: target.storageId as Id<"_storage">,
          });
        } catch (error) {
          console.error(error);
          toast.error("Failed to remove image from server");
          return;
        }
      }

      if (!target.isFromServer && target.preview.startsWith("blob:")) {
        URL.revokeObjectURL(target.preview);
      }

      setValue("images", current.filter((img) => img.id !== imageId));
      toast.success("Image removed");
    },
    [getValues, setValue, projectId, removeMoodBoardImage]
  );

  // FIX #5 – "dragleave" must be lowercase. e.type is a native DOM string;
  // "dragLeave" (camelCase) never matches so setDragActive(false) never fired —
  // the drag overlay was permanently stuck open after the first drag.
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  // FIX #6 – handleDrop checks getValues() per-file so the 5-image limit is
  // respected even when multiple files are dropped simultaneously.
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const imageFiles = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (imageFiles.length === 0) {
        toast.error("Please drop image files only");
        return;
      }
      imageFiles.forEach((file) => {
        if (getValues("images").length < 5) addImage(file);
      });
    },
    [addImage, getValues]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      Array.from(e.target.files || []).forEach((file) => addImage(file));
      e.target.value = "";
    },
    [addImage]
  );

  // FIX #7 – Upload effect: the original ran on every `images` change and
  // called setValue inside the loop, which re-triggered the effect immediately,
  // causing duplicate uploads. An in-flight ref tracks which ids are already
  // being uploaded so each image is only uploaded once regardless of how many
  // times the effect fires.
  const uploadingIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const uploadPendingImages = async () => {
      const current = getValues("images");
      for (const image of current) {
        if (
          image.uploaded ||
          image.uploading ||
          image.error ||
          !image.file || // ✅ Prevent undefined file upload
          uploadingIdsRef.current.has(image.id)
        ) continue;

        uploadingIdsRef.current.add(image.id);

        // Mark uploading
        const snap = getValues("images");
        const idx = snap.findIndex((img) => img.id === image.id);
        if (idx !== -1) {
          const updated = [...snap];
          updated[idx] = { ...updated[idx], uploading: true };
          setValue("images", updated);
        }

        try {
          const { storageId } = await uploadImage(image.file);
          const after = getValues("images");
          const fi = after.findIndex((img) => img.id === image.id);
          if (fi !== -1) {
            const final = [...after];
            final[fi] = { ...final[fi], storageId, uploaded: true, uploading: false, isFromServer: true };
            setValue("images", final);
          }
        } catch (error) {
          console.error(error);
          const err = getValues("images");
          const ei = err.findIndex((img) => img.id === image.id);
          if (ei !== -1) {
            const errList = [...err];
            errList[ei] = { ...errList[ei], uploading: false, error: "Upload failed" };
            setValue("images", errList);
          }
        } finally {
          uploadingIdsRef.current.delete(image.id);
        }
      }
    };

    if (images.length > 0) uploadPendingImages();
  }, [images, uploadImage, setValue, getValues]);

  // FIX #8 – Cleanup effect must list `images` as a dep so the closure
  // captures the final image list on unmount, not the empty initial list.
  useEffect(() => {
    return () => {
      images.forEach((img) => {
        if (img.preview.startsWith("blob:")) URL.revokeObjectURL(img.preview);
      });
    };
  }, [images]);

  const canAddMore = useMemo(() => images.length < 5, [images.length]);

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
    canAddMore,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// useStyleGuide
// ─────────────────────────────────────────────────────────────────────────────
export const useStyleGuide = (
  projectId: string,
  images: MoodboardImage[],
  fileInputRef: RefObject<HTMLInputElement | null>
) => {
  const [generateStyleGuide, { isLoading: isGenerating }] = useGenerateStyleGuideMutation();
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);
  const handleUploadClick = useCallback(() => fileInputRef.current?.click(), [fileInputRef]);

  const handleGenerateStyleGuide = useCallback(async () => {
    if (!projectId) {
      toast.error("No project selected");
      return;
    }
    if (images.length === 0) {
      toast.error("Please upload at least one image to generate style guide");
      return;
    }
    if (images.some((img) => img.uploading)) {
      toast.error("Please wait for all images to upload");
      return;
    }
    // FIX #9 – Also block generation when any image previously errored.
    if (images.some((img) => img.error)) {
      toast.error("Some images failed to upload. Please remove them and try again.");
      return;
    }

    try {
      toast.loading("Analyzing the mood board images...", { id: "style-guide-generation" });

      const result = await generateStyleGuide({ projectId }).unwrap();

      if (!result.success) {
        toast.error(result.message, { id: "style-guide-generation" });
        return;
      }

      router.refresh();
      toast.success("Style guide generated successfully", { id: "style-guide-generation" });

      // FIX #10 – Store timeout id so it can be cleared if the component
      // unmounts before it fires (prevents state update on unmounted component).
      timeoutRef.current = setTimeout(() => {
        toast.success("Style guide generated! Switch to the Colours tab to see the results", {
          duration: 5000,
        });
      }, 1000);
    } catch (error) {
      const errorMessage =
        error && typeof error === "object" && "error" in error
          ? (error as { error: string }).error
          : "Failed to generate style guide";
      toast.error(errorMessage, { id: "style-guide-generation" });
    }
  }, [projectId, images, generateStyleGuide, router]);

  return { handleGenerateStyleGuide, handleUploadClick, isGenerating };
};

// ─────────────────────────────────────────────────────────────────────────────
// useUpdateContainer
// ─────────────────────────────────────────────────────────────────────────────

// FIX #11 – Regex patterns compiled once at module scope, not on every
// sanitizeHtml call. The original on\w+ pattern also lacked a leading \s,
// meaning it could strip "on" from the middle of legitimate attribute values
// like action= or caption=.
const SANITIZE_PATTERNS: [RegExp, string][] = [
  [/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ""],
  [/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ""],
  [/\son\w+="[^"]*"/gi, ""],
  [/javascript:/gi, ""],
  [/\s(src|href)=["']data:[^"']*["']/gi, ""],
];


export const useUpdateContainer = (shape: GeneratedUIShape) => {
  const dispatch = useAppDispatch();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !shape.uiSpecData) return;

    const timeoutId = setTimeout(() => {
      const actualHeight = containerRef.current?.offsetHeight ?? 0;
      // Only dispatch when height is non-zero (guards hidden/collapsed renders)
      // and has actually changed beyond the 10px threshold.
      if (actualHeight > 0 && Math.abs(actualHeight - shape.h) > 10) {
        dispatch(updateShape({ id: shape.id, patch: { h: actualHeight } }));
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [shape.uiSpecData, shape.id, shape.h, dispatch]);

  // FIX #12 – useCallback gives sanitizeHtml a stable reference so child
  // components that receive it as a prop don't re-render on every parent render.
  const sanitizeHtml = useCallback((html: string): string => {
    return SANITIZE_PATTERNS.reduce(
      (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
      html
    );
  }, []);

  return { sanitizeHtml, containerRef };
};