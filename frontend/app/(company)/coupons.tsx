import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, FlatList } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { formatBRL } from "@/src/format";

type Coupon = {
  id: string; code: string; discount_type: "percent" | "fixed"; value: number;
  min_order: number; max_uses: number | null; expires_at: string | null; active: boolean; uses: number;
};

type CouponStat = {
  id: string; code: string; active: boolean; discount_type: "percent" | "fixed"; value: number;
  uses: number; orders: number; revenue: number; discount_total: number;
};

export default function Coupons() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Coupon[]>([]);
  const [stats, setStats] = useState<CouponStat[]>([]);
  const [tab, setTab] = useState<"list" | "stats">("list");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState({ code: "", discount_type: "percent" as "percent" | "fixed", value: "", min_order: "0", max_uses: "", expires_at: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        api<Coupon[]>("/company/coupons"),
        api<CouponStat[]>("/company/coupons/stats"),
      ]);
      setItems(c);
      setStats(s);
    } catch (e) { console.log(e); }
  }, []);

  useEffect(() => { (async () => { await load(); setLoading(false); })(); }, [load]);

  const submit = async () => {
    if (!f.code.trim() || !f.value) { setError("Código e valor obrigatórios"); return; }
    setError(null);
    setSaving(true);
    try {
      await api("/company/coupons", {
        method: "POST",
        body: JSON.stringify({
          code: f.code.trim().toUpperCase(),
          discount_type: f.discount_type,
          value: Number(f.value),
          min_order: Number(f.min_order) || 0,
          max_uses: f.max_uses ? Number(f.max_uses) : null,
          expires_at: f.expires_at ? new Date(f.expires_at).toISOString() : null,
          active: true,
        }),
      });
      setF({ code: "", discount_type: "percent", value: "", min_order: "0", max_uses: "", expires_at: "" });
      setShowForm(false);
      await load();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  const toggle = async (c: Coupon) => {
    await api(`/company/coupons/${c.id}`, { method: "PATCH", body: JSON.stringify({ active: !c.active }) });
    await load();
  };

  const del = (c: Coupon) => {
    Alert.alert("Excluir cupom?", c.code, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: async () => {
        await api(`/company/coupons/${c.id}`, { method: "DELETE" });
        await load();
      }},
    ]);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Cupons de Desconto</Text>
        <Pressable testID="add-coupon-btn" onPress={() => setShowForm((v) => !v)} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name={showForm ? "close" : "add"} size={22} color={colors.onSurface} />
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 40 }}
        ListHeaderComponent={
          <View>
            {showForm && (
              <View style={styles.form}>
                <Text style={styles.formTitle}>Novo cupom</Text>
                <Field label="Código*" testID="c-code" value={f.code} onChangeText={(v: string) => setF({ ...f, code: v.toUpperCase() })} autoCapitalize="characters" />
                <View>
                  <Text style={styles.label}>Tipo</Text>
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <Pressable testID="type-percent" onPress={() => setF({ ...f, discount_type: "percent" })} style={[styles.chip, f.discount_type === "percent" && styles.chipActive]}>
                      <Text style={[styles.chipText, f.discount_type === "percent" && styles.chipTextActive]}>Percentual (%)</Text>
                    </Pressable>
                    <Pressable testID="type-fixed" onPress={() => setF({ ...f, discount_type: "fixed" })} style={[styles.chip, f.discount_type === "fixed" && styles.chipActive]}>
                      <Text style={[styles.chipText, f.discount_type === "fixed" && styles.chipTextActive]}>Valor fixo (R$)</Text>
                    </Pressable>
                  </View>
                </View>
                <Field label={f.discount_type === "percent" ? "% de desconto*" : "Valor R$*"} testID="c-value" value={f.value} onChangeText={(v: string) => setF({ ...f, value: v })} keyboardType="decimal-pad" />
                <Field label="Pedido mínimo (R$)" testID="c-min" value={f.min_order} onChangeText={(v: string) => setF({ ...f, min_order: v })} keyboardType="decimal-pad" />
                <Field label="Máx. usos (opcional)" testID="c-max" value={f.max_uses} onChangeText={(v: string) => setF({ ...f, max_uses: v })} keyboardType="number-pad" />
                <Field label="Expira em (YYYY-MM-DD, opcional)" testID="c-exp" value={f.expires_at} onChangeText={(v: string) => setF({ ...f, expires_at: v })} autoCapitalize="none" />
                {error && <Text style={{ color: colors.error, textAlign: "center" }}>{error}</Text>}
                <Pressable testID="save-coupon-btn" onPress={submit} disabled={saving} style={[styles.primary, saving && { opacity: 0.7 }]}>
                  {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Criar cupom</Text>}
                </Pressable>
              </View>
            )}
            {!showForm && (
              <View style={styles.intro}>
                <Ionicons name="pricetag" size={22} color={colors.brandPrimary} />
                <Text style={styles.introText}>
                  Crie códigos promocionais que os clientes digitam no carrinho. Aumente vendas e fidelize.
                </Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View testID={`coupon-${item.id}`} style={[styles.couponCard, !item.active && { opacity: 0.55 }]}>
            <View style={styles.couponLeft}>
              <Text style={styles.couponCode}>{item.code}</Text>
              <Text style={styles.couponSub}>
                {item.discount_type === "percent" ? `${item.value}% off` : `${formatBRL(item.value)} off`}
                {item.min_order > 0 ? ` · Min. ${formatBRL(item.min_order)}` : ""}
              </Text>
              <Text style={styles.couponMeta}>
                Usos: {item.uses}{item.max_uses ? `/${item.max_uses}` : ""}
                {item.expires_at ? ` · Expira ${new Date(item.expires_at).toLocaleDateString("pt-BR")}` : ""}
              </Text>
            </View>
            <View style={{ gap: spacing.xs }}>
              <Pressable testID={`toggle-${item.id}`} onPress={() => toggle(item)} style={styles.smallBtn}>
                <Ionicons name={item.active ? "pause" : "play"} size={16} color={colors.onSurface} />
              </Pressable>
              <Pressable testID={`del-${item.id}`} onPress={() => del(item)} style={styles.smallBtn}>
                <Ionicons name="trash-outline" size={16} color={colors.error} />
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          loading ? <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 40 }} /> : (
            <View style={styles.empty}>
              <Ionicons name="pricetag-outline" size={48} color={colors.muted} />
              <Text style={styles.emptyText}>Nenhum cupom criado ainda</Text>
            </View>
          )
        }
      />
    </KeyboardAvoidingView>
  );
}

function Field({ label, testID, ...rest }: any) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput testID={testID} style={styles.input} placeholderTextColor={colors.muted} {...rest} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: colors.onSurface },
  intro: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md },
  introText: { flex: 1, color: colors.onBrandTertiary, fontSize: 13 },
  form: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.md, marginBottom: spacing.lg },
  formTitle: { fontSize: 15, fontWeight: "800", color: colors.onSurface },
  label: { fontSize: 13, fontWeight: "600", color: colors.onSurface, marginBottom: 6 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 46, color: colors.onSurface, fontSize: 15 },
  chip: { flex: 1, height: 42, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurface, fontWeight: "700", fontSize: 13 },
  chipTextActive: { color: colors.onBrandPrimary },
  primary: { backgroundColor: colors.brandPrimary, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  primaryText: { color: colors.onBrandPrimary, fontWeight: "700" },
  couponCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  couponLeft: { flex: 1 },
  couponCode: { fontSize: 16, fontWeight: "800", color: colors.brandPrimary, letterSpacing: 1 },
  couponSub: { fontSize: 13, color: colors.onSurface, fontWeight: "600", marginTop: 2 },
  couponMeta: { fontSize: 11, color: colors.muted, marginTop: 4 },
  smallBtn: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyText: { color: colors.muted, fontSize: 14 },
});
