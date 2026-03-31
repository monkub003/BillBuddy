import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useExtraction } from "@/hooks/useExtraction";
import { ExtractionReview } from "@/components/forms/ExtractionReview";

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const { loading, error, result, storageUrl, extractFromImage, reset } =
    useExtraction();
  const [showReview, setShowReview] = useState(false);

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync();
      if (photo?.uri) {
        const extraction = await extractFromImage(photo.uri);
        if (extraction) setShowReview(true);
      }
    } catch {
      Alert.alert("Error", "Failed to capture photo");
    }
  };

  const handlePickImage = async () => {
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!pickerResult.canceled && pickerResult.assets[0]) {
      const extraction = await extractFromImage(pickerResult.assets[0].uri);
      if (extraction) setShowReview(true);
    }
  };

  const handleReviewDone = () => {
    setShowReview(false);
    reset();
  };

  // Show extraction review when result is ready
  if (showReview && result && storageUrl) {
    return (
      <ExtractionReview
        extraction={result}
        sourceRef={storageUrl}
        extractedVia="image"
        onConfirm={handleReviewDone}
      />
    );
  }

  // Loading state during upload/extraction
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="text-sm text-gray-500 mt-4">
          Processing image...
        </Text>
      </View>
    );
  }

  // Permission not yet determined
  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 p-6">
        <Text className="text-base text-gray-700 text-center mb-4">
          Camera access is needed to scan bills and receipts.
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="bg-blue-500 rounded-lg px-6 py-3"
        >
          <Text className="text-white font-semibold">Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handlePickImage} className="mt-4">
          <Text className="text-blue-500 text-sm">
            Or pick from gallery instead
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView ref={cameraRef} className="flex-1" facing="back">
        <View className="flex-1 justify-end pb-10 px-6">
          {error && (
            <View className="bg-red-500/80 rounded-lg p-3 mb-4">
              <Text className="text-white text-sm text-center">{error}</Text>
            </View>
          )}

          <View className="flex-row justify-center items-center gap-6">
            <TouchableOpacity
              onPress={handlePickImage}
              className="bg-white/30 rounded-full w-14 h-14 items-center justify-center"
            >
              <Text className="text-white text-xs">Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCapture}
              className="bg-white rounded-full w-20 h-20 items-center justify-center border-4 border-gray-300"
            >
              <View className="bg-white rounded-full w-16 h-16" />
            </TouchableOpacity>

            <View className="w-14" />
          </View>
        </View>
      </CameraView>
    </View>
  );
}
