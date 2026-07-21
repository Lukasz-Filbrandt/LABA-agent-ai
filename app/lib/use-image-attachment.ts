"use client";

import { useCallback, useState } from "react";

export type AttachedImage = {
  url: string;
  mediaType: string;
  filename?: string;
};

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_BYTES = 4 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Wspólna logika dołączania obrazów (paste / upload / drag&drop) do dowolnego czatu */
export function useImageAttachment() {
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const attachFile = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setImageError("Nieobsługiwany format. Użyj PNG, JPG, GIF lub WEBP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setImageError("Max 4MB. Zrób screenshot fragmentu.");
      return;
    }
    setImageError(null);
    const url = await readAsDataUrl(file);
    setAttachedImage({ url, mediaType: file.type, filename: file.name });
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            void attachFile(file);
          }
          break;
        }
      }
    },
    [attachFile]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void attachFile(file);
      e.target.value = "";
    },
    [attachFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void attachFile(file);
    },
    [attachFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const clearImage = useCallback(() => {
    setAttachedImage(null);
    setImageError(null);
  }, []);

  return {
    attachedImage,
    imageError,
    isDragging,
    attachFile,
    handlePaste,
    handleFileInputChange,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    clearImage,
  };
}
