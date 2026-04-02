import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useExtraction } from "@/hooks/useExtraction";
import { ExtractionReview } from "@/components/forms/ExtractionReview";
import { Theme } from "@/constants/theme";

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const { loading, error, result, extractFromImage, reset } =
    useExtraction();
  const [showReview, setShowReview] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync();
      if (photo?.uri) {
        setPreviewUri(photo.uri);
      }
    } catch {
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถถ่ายรูปได้ กรุณาลองใหม่");
    }
  };

  const handlePickImage = async () => {
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (!pickerResult.canceled && pickerResult.assets[0]) {
      setPreviewUri(pickerResult.assets[0].uri);
    }
  };

  const handleUsePhoto = async () => {
    if (!previewUri) return;
    const extraction = await extractFromImage(previewUri);
    if (extraction) {
      setPreviewUri(null);
      setShowReview(true);
    }
  };

  const handleRetake = () => {
    setPreviewUri(null);
  };

  const handleReviewDone = () => {
    setShowReview(false);
    reset();
  };

  // Show extraction review when result is ready
  if (showReview && result) {
    return (
      <ExtractionReview
        extraction={result}
        sourceRef=""
        extractedVia="image"
        onConfirm={handleReviewDone}
      />
    );
  }

  // Loading state during upload/extraction
  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Theme.accent.green} />
        <Text style={styles.loadingText}>กำลังสกัดข้อมูล...</Text>
        <Text style={styles.loadingSubtext}>กรุณารอสักครู่</Text>
      </View>
    );
  }

  // Image preview with confirm/retake
  if (previewUri) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Image source={{ uri: previewUri }} style={styles.previewImage} />
        <View style={styles.previewOverlay}>
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={styles.retakeButton}
              onPress={handleRetake}
            >
              <Text style={styles.retakeButtonText}>ถ่ายใหม่</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.usePhotoButton}
              onPress={handleUsePhoto}
            >
              <Text style={styles.usePhotoButtonText}>ใช้รูปนี้</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Permission not yet determined
  if (!permission) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Theme.accent.green} />
      </View>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top, padding: 24 }]}>
        <Text style={styles.permissionIcon}>📷</Text>
        <Text style={styles.permissionTitle}>ต้องการสิทธิ์กล้อง</Text>
        <Text style={styles.permissionText}>
          แอปต้องการเข้าถึงกล้องเพื่อถ่ายรูปบิลและใบเสร็จ
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          style={styles.grantButton}
        >
          <Text style={styles.grantButtonText}>อนุญาตเข้าถึงกล้อง</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handlePickImage} style={styles.galleryLink}>
          <Text style={styles.galleryLinkText}>
            หรือเลือกรูปจากคลังภาพแทน
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Camera view
  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        <View style={[styles.cameraOverlay, { paddingBottom: insets.bottom + 24 }]}>
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.cameraHint}>
            จัดวางบิลให้อยู่ในกรอบ แล้วกดถ่ายรูป
          </Text>

          <View style={styles.controlsRow}>
            <TouchableOpacity
              onPress={handlePickImage}
              style={styles.galleryButton}
            >
              <Text style={styles.galleryButtonIcon}>🖼️</Text>
              <Text style={styles.galleryButtonLabel}>คลังภาพ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCapture}
              style={styles.captureButton}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>

            <View style={styles.controlPlaceholder} />
          </View>
        </View>
      </CameraView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.background.primary,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.background.primary,
  },
  // Loading state
  loadingText: {
    fontSize: 18,
    fontWeight: "600",
    color: Theme.text.primary,
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 14,
    color: Theme.text.secondary,
    marginTop: 8,
  },
  // Permission denied
  permissionIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: Theme.text.primary,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    color: Theme.text.secondary,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  grantButton: {
    backgroundColor: Theme.accent.green,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  grantButtonText: {
    color: Theme.text.primary,
    fontSize: 16,
    fontWeight: "600",
  },
  galleryLink: {
    marginTop: 16,
  },
  galleryLinkText: {
    color: Theme.accent.greenLight,
    fontSize: 14,
  },
  // Camera view
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 24,
  },
  cameraHint: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginBottom: 24,
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 32,
  },
  galleryButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  galleryButtonIcon: {
    fontSize: 20,
  },
  galleryButtonLabel: {
    fontSize: 10,
    color: Theme.text.primary,
    marginTop: 2,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.6)",
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Theme.text.primary,
  },
  controlPlaceholder: {
    width: 56,
  },
  // Error banner
  errorBanner: {
    backgroundColor: Theme.status.critical + "CC",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: Theme.text.primary,
    textAlign: "center",
  },
  // Image preview
  previewImage: {
    flex: 1,
    resizeMode: "contain",
    backgroundColor: "#000",
  },
  previewOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  previewActions: {
    flexDirection: "row",
    gap: 12,
  },
  retakeButton: {
    flex: 1,
    backgroundColor: Theme.background.card,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  retakeButtonText: {
    color: Theme.text.primary,
    fontSize: 16,
    fontWeight: "600",
  },
  usePhotoButton: {
    flex: 1,
    backgroundColor: Theme.accent.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  usePhotoButtonText: {
    color: Theme.text.primary,
    fontSize: 16,
    fontWeight: "600",
  },
});
