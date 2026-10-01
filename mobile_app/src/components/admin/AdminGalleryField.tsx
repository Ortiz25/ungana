// Ported from AdminDashboardScreen.svelte's {#snippet campusGalleryField(...)}
// — additional photos for an event's Past Events detail carousel, uploaded
// one at a time through the same single-file endpoint the cover attachment
// uses (there's no multi-file upload route), sequentially so a failure is
// attributable to a specific pick rather than racing several uploads at once.
import { useState } from "react";
import { View, Text, Image, Pressable, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Upload, X } from "lucide-react-native";
import { useAdminAuth } from "@/flow/AdminAuthContext";
import { adminUploadFile, type AdminUploadEndpoint } from "@/lib/adminApi";

export default function AdminGalleryField({
  images,
  onChange,
  endpoint,
  onError,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  endpoint: AdminUploadEndpoint;
  onError: (message: string) => void;
}) {
  const { token } = useAdminAuth();
  const [uploading, setUploading] = useState(false);

  async function pickAndAdd() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      onError("Photo library access is needed to upload a file");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, quality: 0.8 });
    if (picked.canceled || picked.assets.length === 0) return;

    setUploading(true);
    let next = images;
    for (const asset of picked.assets) {
      const result = await adminUploadFile(token!, endpoint, { uri: asset.uri, name: asset.fileName ?? "upload.jpg", mimeType: asset.mimeType ?? "image/jpeg" });
      if (!result.ok || !result.data?.url) {
        onError(result.data?.message || "Upload failed — check your connection");
        continue;
      }
      next = [...next, result.data.url];
      onChange(next);
    }
    setUploading(false);
  }

  return (
    <View>
      <Text className="text-[10px] font-sans-semibold mb-1 uppercase" style={{ color: "#AECAAE", letterSpacing: 1 }}>
        Gallery photos (optional — shown in the event&apos;s photo carousel)
      </Text>
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {images.map((url, i) => (
          <View key={url} className="rounded-lg overflow-hidden" style={{ width: 64, height: 64, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" }}>
            <Image source={{ uri: url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            <Pressable
              onPress={() => onChange(images.filter((_, idx) => idx !== i))}
              className="absolute items-center justify-center rounded-full"
              style={{ top: 2, right: 2, width: 16, height: 16, backgroundColor: "rgba(0,0,0,0.6)" }}
            >
              <X size={9} color="#fff" />
            </Pressable>
          </View>
        ))}
        <Pressable
          onPress={pickAndAdd}
          disabled={uploading}
          className="items-center justify-center rounded-lg"
          style={{ width: 64, height: 64, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderStyle: "dashed" }}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#C45C38" />
          ) : (
            <>
              <Upload size={13} color="#C4DAC0" />
              <Text className="text-[8px] font-sans-semibold mt-0.5" style={{ color: "#C4DAC0" }}>
                Add
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
