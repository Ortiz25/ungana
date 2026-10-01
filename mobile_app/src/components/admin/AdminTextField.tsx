// Ported from AdminDashboardScreen.svelte's {#snippet inputField(...)} —
// the one text-field shape reused across every admin create/edit form.
import { View, Text, TextInput, type KeyboardTypeOptions } from "react-native";

export default function AdminTextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = "default",
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  editable?: boolean;
}) {
  return (
    <View className="flex-1">
      <Text className="text-[10px] font-sans-semibold mb-1 uppercase" style={{ color: "#AECAAE", letterSpacing: 1 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#4A6842"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        editable={editable}
        autoCapitalize="none"
        className="rounded-xl px-3 py-2.5 text-sm"
        style={{ backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", color: "#E8D4B0", opacity: editable ? 1 : 0.5 }}
      />
    </View>
  );
}
