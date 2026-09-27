import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";

const SEGMENTS = ["food", "market", "pharmacy", "drinks", "other"];
const PLANS: { key: "basic" | "pro" | "premium"; label: string; days: number }[] = [
  { key: "basic", label: "Mensal (30d)", days: 30 },
  { key: "pro", label: "Trimestral (90d)", days: 90 },
  { key: "pro", label: "Semestral (180d)", days: 180 },
  { key: "premium", label: "Anual (365d)", days: 365 },
];

export default function NewCompany() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [f, setF] = useState({
    name: "", segment: "food", whatsapp: "", address: "",
    delivery_fee: "5", min_order: "0", delivery_time: "30-45 min",
    owner_name: "", owner_email: "", owner_password: "",
    plan: "basic" as "basic" | "pro" | "premium", license_days: 30,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.name || !f.whatsapp || !f.owner_email || !f.owner_password || !f.owner_name || !f.address) {
      setError("Preencha todos os campos obrigatórios");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api("/admin/companies", {
        method: "POST",
        body: JSON.stringify({
          name: f.name,
          segment: f.segment,
          whatsapp: f.whatsapp.replace(/\D/g, ""),
          address: f.address,
          delivery_fee: Number(f.delivery_fee) || 0,
          min_order: Number(f.min_order) || 0,
          delivery_time: f.delivery_time,
          owner_name: f.owner_name,
          owner_email: f.owner_email.trim(),
          owner_password: f.owner_password,
          plan: f.plan,
          license_days: f.license_days,
        }),
      });
      router.back();
    } catch (e: any) {
      setError(e.message || "Erro ao criar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Nova Empresa</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 120, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        <Field label="Nome da empresa*" value={f.name} onChangeText={(v) => update("name", v)} testID="c-name" />
        <View>
          <Text style={styles.label}>Segmento</Text>
          <View style={styles.chipRow}>
            {SEGMENTS.map((s) => (
              <Pressable
                key={s}
                testID={`seg-${s}`}
                onPress={() => update("segment", s)}
                style={[styles.chip, f.segment === s && styles.chipActive]}
              >
                <Text style={[styles.chipText, f.segment === s && styles.chipTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Field label="WhatsApp (55DDDNÚMERO)*" value={f.whatsapp} onChangeText={(v) => update("whatsapp", v)} testID="c-wpp" keyboardType="phone-pad" />
        <Field label="Endereço*" value={f.address} onChangeText={(v) => update("address", v)} testID="c-addr" />
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View style={{ flex: 1 }}><Field label="Taxa entrega (R$)" value={f.delivery_fee} onChangeText={(v) => update("delivery_fee", v)} keyboardType="decimal-pad" testID="c-fee" /></View>
          <View style={{ flex: 1 }}><Field label="Pedido mínimo (R$)" value={f.min_order} onChangeText={(v) => update("min_order", v)} keyboardType="decimal-pad" testID="c-min" /></View>
        </View>

        <View style={styles.divider} />
        <Text style={styles.section}>Proprietário (login lojista)</Text>
        <Field label="Nome do responsável*" value={f.owner_name} onChangeText={(v) => update("owner_name", v)} testID="c-owner-name" />
        <Field label="Email do lojista*" value={f.owner_email} onChangeText={(v) => update("owner_email", v)} testID="c-owner-email" keyboardType="email-address" autoCapitalize="none" />
        <Field label="Senha inicial*" value={f.owner_password} onChangeText={(v) => update("owner_password", v)} secureTextEntry testID="c-owner-pwd" />

        <View style={styles.divider} />
        <Text style={styles.section}>Plano / Licença</Text>
        <View style={styles.chipRow}>
          {PLANS.map((p) => {
            const selected = f.plan === p.key && f.license_days === p.days;
            return (
              <Pressable
                key={`${p.key}-${p.days}`}
                testID={`plan-${p.days}`}
                onPress={() => setF((prev) => ({ ...prev, plan: p.key, license_days: p.days }))}
                style={[styles.planChip, selected && styles.chipActive]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable testID="submit-company-btn" onPress={submit} disabled={loading} style={[styles.primary, loading && { opacity: 0.7 }]}>
          {loading ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryText}>Criar empresa</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, testID, ...rest }: any) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        style={styles.input}
        placeholderTextColor={colors.muted}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: colors.onSurface },
  label: { fontSize: 13, fontWeight: "600", color: colors.onSurface, marginBottom: 6 },
  input: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 50, color: colors.onSurface, fontSize: 15 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  planChip: { paddingHorizontal: spacing.md, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurface, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: colors.onBrandPrimary },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.md },
  section: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  primary: { backgroundColor: colors.brandPrimary, height: 54, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  primaryText: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: "700" },
  error: { color: colors.error, fontSize: 14, textAlign: "center" },
});
