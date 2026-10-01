// Ported from AdminDashboardScreen.svelte's {#snippet fileOrUrlField(...)} —
// a text field for pasting a URL, plus an "Upload" button that fills the
// same field. The web version uses a hidden <input type="file">; this uses
// expo-image-picker's library picker instead, which is the RN equivalent
// (there's no local file browser to point at otherwise).
import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Upload } from "lucide-react-native";
import { useAdminAuth } from "@/flow/AdminAuthContext";
import { adminUploadFile, type AdminUploadEndpoint } from "@/lib/adminApi";

export default function AdminFileField({
  label,
  value,
  onChangeText,
  endpoint,
  mediaTypes,
  onError,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  endpoint: AdminUploadEndpoint;
  mediaTypes: "images" | "videos";
  onError: (message: string) => void;
}) {
  const { token } = useAdminAuth();
  const [uploading, setUploading] = useState(false);

  async function pickAndUpload() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      onError("Photo library access is needed to upload a file");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: [mediaTypes], quality: 0.8 });
    if (picked.canceled || !picked.assets[0]) return;

    const asset = picked.assets[0];
    setUploading(true);
    const result = await adminUploadFile(token!, endpoint, {
      uri: asset.uri,
      name: asset.fileName ?? `upload.${mediaTypes === "images" ? "jpg" : "mp4"}`,
      mimeType: asset.mimeType ?? (mediaTypes === "images" ? "image/jpeg" : "video/mp4"),
    });
    setUploading(false);

    if (!result.ok || !result.data?.url) {
      onError(result.data?.message || "Upload failed — check your connection");
      return;
    }
    onChangeText(result.data.url);
  }

  return (
    <View>
      <Text className="text-[10px] font-sans-semibold mb-1 uppercase" style={{ color: "#AECAAE", letterSpacing: 1 }}>
        {label}
      </Text>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="https://… or upload a file"
          placeholderTextColor="#4A6842"
          autoCapitalize="none"
          className="flex-1 rounded-xl px-3 py-2.5 text-sm"
          style={{ backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", color: "#E8D4B0" }}
        />
        <Pressable
          onPress={pickAndUpload}
          disabled={uploading}
          className="flex-row items-center gap-1 px-3 py-2.5 rounded-xl"
          style={{ backgroundColor: uploading ? "rgba(196,92,56,0.35)" : "rgba(255,255,255,0.14)" }}
        >
          {uploading ? <ActivityIndicator size="small" color="#C45C38" /> : <Upload size={12} color="#C4DAC0" />}
          <Text className="text-[11px] font-sans-semibold" style={{ color: uploading ? "#C45C38" : "#C4DAC0" }}>
            Upload
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
