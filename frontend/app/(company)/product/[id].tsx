import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";

export default function EditProduct() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [f, setF] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const list = await api<any[]>("/company/products");
      const p = list.find((x) => x.id === id);
      setF(p ? { ...p, price: String(p.price) } : null);
    })();
  }, [id]);

  const save = async () => {
    setLoading(true);
    try {
      await api(`/company/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: f.name, description: f.description, price: Number(f.price), category: f.category, image: f.image, active: f.active }),
      });
      router.back();
    } catch (e: any) { Alert.alert("Erro", e.message); }
    setLoading(false);
  };

  const del = async () => {
    Alert.alert("Excluir?", "", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: async () => {
        await api(`/company/products/${id}`, { method: "DELETE" });
        router.back();
      }},
    ]);
  };

  if (!f) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}><ActivityIndicator color={colors.brandPrimary} /></View>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Editar Produto</Text>
        <Pressable testID="delete-product-btn" onPress={del} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: insets.bottom + 40 }}>
        <Field label="Nome" value={f.name} onChangeText={(v: string) => setF({ ...f, name: v })} />
        <Field label="Descrição" value={f.description} onChangeText={(v: string) => setF({ ...f, description: v })} multiline />
        <Field label="Preço" value={f.price} onChangeText={(v: string) => setF({ ...f, price: v })} keyboardType="decimal-pad" />
        <Field label="Categoria" value={f.category} onChangeText={(v: string) => setF({ ...f, category: v })} />
        <Pressable testID="toggle-active" onPress={() => setF({ ...f, active: !f.active })} style={[styles.toggle, { backgroundColor: f.active ? colors.success : colors.muted }]}>
          <Text style={{ color: "#FFF", fontWeight: "700" }}>{f.active ? "Ativo" : "Inativo"}</Text>
        </Pressable>
        <Pressable testID="save-product-btn" onPress={save} disabled={loading} style={[styles.primary, loading && { opacity: 0.7 }]}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Salvar</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, multiline, ...rest }: any) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput multiline={multiline} style={[styles.input, multiline && { height: 90, textAlignVertical: "top", paddingTop: spacing.md }]} placeholderTextColor={colors.muted} {...rest} />
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
  primaryText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  toggle: { height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
});
