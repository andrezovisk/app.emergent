import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";

export default function NewProduct() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [f, setF] = useState({ name: "", description: "", price: "", category: "Geral", image: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!f.name || !f.price) { setError("Nome e preço são obrigatórios"); return; }
    setError(null);
    setLoading(true);
    try {
      await api("/company/products", {
        method: "POST",
        body: JSON.stringify({
          name: f.name, description: f.description, price: Number(f.price),
          category: f.category, image: f.image || null,
        }),
      });
      router.back();
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Novo Produto</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: insets.bottom + 40 }}>
        <Field label="Nome*" testID="p-name" value={f.name} onChangeText={(v: string) => setF({ ...f, name: v })} />
        <Field label="Descrição" testID="p-desc" value={f.description} onChangeText={(v: string) => setF({ ...f, description: v })} multiline />
        <Field label="Preço (R$)*" testID="p-price" value={f.price} onChangeText={(v: string) => setF({ ...f, price: v })} keyboardType="decimal-pad" />
        <Field label="Categoria" testID="p-cat" value={f.category} onChangeText={(v: string) => setF({ ...f, category: v })} />
        <Field label="URL da imagem (opcional)" testID="p-img" value={f.image} onChangeText={(v: string) => setF({ ...f, image: v })} autoCapitalize="none" />

        {error && <Text style={{ color: colors.error, textAlign: "center" }}>{error}</Text>}

        <Pressable testID="submit-product-btn" onPress={submit} disabled={loading} style={[styles.primary, loading && { opacity: 0.7 }]}>
          {loading ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryText}>Salvar</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, testID, multiline, ...rest }: any) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput testID={testID} multiline={multiline} style={[styles.input, multiline && { height: 90, textAlignVertical: "top", paddingTop: spacing.md }]} placeholderTextColor={colors.muted} {...rest} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: colors.onSurface },
  label: { fontSize: 13, fontWeight: "600", color: colors.onSurface, marginBottom: 6 },
  input: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 50, color: colors.onSurface, fontSize: 15 },
  primary: { backgroundColor: colors.brandPrimary, height: 54, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  primaryText: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: "700" },
});
