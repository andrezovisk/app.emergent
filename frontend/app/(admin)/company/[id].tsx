import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";

type Company = { id: string; name: string; segment: string; plan: string; whatsapp: string; address: string; active: boolean; license_expires_at: string; delivery_fee: number; min_order: number };

export default function CompanyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [c, setC] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const list = await api<Company[]>("/admin/companies");
      const found = list.find((x) => x.id === id);
      setC(found || null);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const renew = async (plan: "basic" | "pro" | "premium", days: number) => {
    try {
      await api(`/admin/companies/${id}/license`, {
        method: "PATCH",
        body: JSON.stringify({ plan, add_days: days }),
      });
      await load();
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  };

  const toggleActive = async () => {
    if (!c) return;
    try {
      await api(`/admin/companies/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !c.active }),
      });
      await load();
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  };

  const del = async () => {
    Alert.alert("Excluir empresa?", "Todos os dados serão removidos.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: async () => {
        await api(`/admin/companies/${id}`, { method: "DELETE" });
        router.back();
      }},
    ]);
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.brandPrimary} /></View>;
  if (!c) return <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}><Text>Empresa não encontrada</Text></View>;

  const expiresAt = new Date(c.license_expires_at).toLocaleDateString("pt-BR");
  const expired = new Date(c.license_expires_at) < new Date();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{c.name}</Text>
        <Pressable testID="delete-company-btn" onPress={del} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 40, gap: spacing.md }}>
        <View style={styles.card}>
          <Row icon="storefront" label="Segmento" value={c.segment} />
          <Row icon="logo-whatsapp" label="WhatsApp" value={c.whatsapp} />
          <Row icon="location" label="Endereço" value={c.address} />
          <Row icon="bicycle" label="Taxa entrega" value={`R$ ${c.delivery_fee.toFixed(2)}`} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Licença</Text>
          <Text style={styles.detail}>Plano: <Text style={{ fontWeight: "800" }}>{c.plan.toUpperCase()}</Text></Text>
          <Text style={styles.detail}>Expira em: <Text style={{ color: expired ? colors.error : colors.success, fontWeight: "700" }}>{expiresAt}</Text></Text>
          <Text style={styles.detail}>Status: <Text style={{ fontWeight: "700" }}>{c.active ? "Ativa" : "Inativa"}</Text></Text>

          <Text style={[styles.cardTitle, { marginTop: spacing.md, fontSize: 13 }]}>Renovar / Alterar plano</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
            <Pressable testID="renew-basic" onPress={() => renew("basic", 30)} style={styles.planBtn}><Text style={styles.planBtnText}>Básico +30d</Text></Pressable>
            <Pressable testID="renew-pro" onPress={() => renew("pro", 60)} style={styles.planBtn}><Text style={styles.planBtnText}>Pro +60d</Text></Pressable>
            <Pressable testID="renew-premium" onPress={() => renew("premium", 90)} style={styles.planBtn}><Text style={styles.planBtnText}>Premium +90d</Text></Pressable>
          </View>

          <Pressable testID="toggle-active-btn" onPress={toggleActive} style={[styles.toggle, { backgroundColor: c.active ? colors.error : colors.success }]}>
            <Text style={styles.toggleText}>{c.active ? "Desativar empresa" : "Ativar empresa"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}><Ionicons name={icon as any} size={16} color={colors.brandPrimary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: colors.onSurface },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.xs },
  detail: { fontSize: 14, color: colors.onSurface },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.xs },
  rowIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 12, color: colors.muted },
  rowValue: { fontSize: 15, color: colors.onSurface, fontWeight: "600" },
  planBtn: { paddingHorizontal: spacing.md, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  planBtnText: { color: colors.brandPrimary, fontWeight: "700", fontSize: 13 },
  toggle: { height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  toggleText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
});
