import { useState, useCallback } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useAuthStore } from "@/store/authStore";
import { apiClient } from "@/lib/api";
import { ExtractionResult } from "@/types";

interface ExtractionState {
  loading: boolean;
  error: string | null;
  result: ExtractionResult | null;
  storageUrl: string | null;
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30;

export function useExtraction() {
  const [state, setState] = useState<ExtractionState>({
    loading: false,
    error: null,
    result: null,
    storageUrl: null,
  });

  const reset = useCallback(() => {
    setState({ loading: false, error: null, result: null, storageUrl: null });
  }, []);

  const uploadImage = useCallback(async (uri: string): Promise<string | null> => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) {
      setState((s) => ({ ...s, error: "Not authenticated" }));
      return null;
    }

    setState((s) => ({ ...s, loading: true, error: null, result: null }));

    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `receipts/${userId}/${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);
      setState((s) => ({ ...s, storageUrl: downloadUrl }));
      return downloadUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setState((s) => ({ ...s, loading: false, error: message }));
      return null;
    }
  }, []);

  const pollExtraction = useCallback(async (storageUrl: string): Promise<ExtractionResult | null> => {
    let attempts = 0;

    while (attempts < MAX_POLL_ATTEMPTS) {
      try {
        const data = await apiClient<{ status: string; result?: ExtractionResult }>(
          `/extractions?storageUrl=${encodeURIComponent(storageUrl)}`
        );

        if (data.status === "completed" && data.result) {
          setState((s) => ({ ...s, loading: false, result: data.result! }));
          return data.result;
        }

        if (data.status === "error") {
          setState((s) => ({ ...s, loading: false, error: "Extraction failed" }));
          return null;
        }
      } catch {
        // Continue polling on transient errors
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    setState((s) => ({ ...s, loading: false, error: "Extraction timed out" }));
    return null;
  }, []);

  const extractFromImage = useCallback(async (uri: string): Promise<ExtractionResult | null> => {
    const url = await uploadImage(uri);
    if (!url) return null;
    return pollExtraction(url);
  }, [uploadImage, pollExtraction]);

  return {
    ...state,
    uploadImage,
    pollExtraction,
    extractFromImage,
    reset,
  };
}
