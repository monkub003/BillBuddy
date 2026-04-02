import { useState, useCallback } from "react";
import { Platform } from "react-native";
import { apiClient } from "@/lib/api";
import { ExtractionResult } from "@/types";

interface ExtractionState {
  loading: boolean;
  error: string | null;
  result: ExtractionResult | null;
}

async function uriToBase64(uri: string): Promise<string> {
  if (Platform.OS === "web") {
    // On web, fetch the blob and convert via FileReader
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        // Strip the data:image/...;base64, prefix
        resolve(dataUrl.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // On native, use expo-file-system
  const FileSystem = require("expo-file-system");
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export function useExtraction() {
  const [state, setState] = useState<ExtractionState>({
    loading: false,
    error: null,
    result: null,
  });

  const reset = useCallback(() => {
    setState({ loading: false, error: null, result: null });
  }, []);

  const extractFromImage = useCallback(async (uri: string): Promise<ExtractionResult | null> => {
    setState({ loading: true, error: null, result: null });

    try {
      const base64 = await uriToBase64(uri);

      const result = await apiClient<ExtractionResult>("/extract", {
        method: "POST",
        body: JSON.stringify({ imageBase64: base64, mimeType: "image/jpeg" }),
      });

      setState({ loading: false, error: null, result });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "การสกัดข้อมูลล้มเหลว";
      setState({ loading: false, error: message, result: null });
      return null;
    }
  }, []);

  return {
    ...state,
    extractFromImage,
    reset,
  };
}
