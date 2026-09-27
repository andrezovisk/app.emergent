import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const c = await api<any>("/company/me");
        setWebhookUrl(c.webhook_url || "");
      } catch {}
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api("/company/settings", { method: "PATCH", body: JSON.stringify({ webhook_url: webhookUrl.trim() || null }) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) { Alert.alert("Erro", e.message); }
    setSaving(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Configurações</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 40 }}>
        <View style={styles.card}>
          <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center", marginBottom: spacing.sm }}>
            <Ionicons name="cloud-upload" size={20} color={colors.brandPrimary} />
            <Text style={styles.cardTitle}>Webhook de novos pedidos</Text>
          </View>
          <Text style={styles.desc}>
            Informe uma URL do seu ERP/sistema. Toda vez que um novo pedido chegar, enviamos um POST com o pedido em JSON para essa URL, para você não precisar ficar consultando a API.
          </Text>
          {loading ? <ActivityIndicator style={{ marginTop: 20 }} color={colors.brandPrimary} /> : (
            <>
              <Text style={styles.label}>URL do webhook</Text>
              <TextInput
                testID="webhook-input"
                value={webhookUrl}
                onChangeText={setWebhookUrl}
                placeholder="https://seu-erp.com/webhook/pedidos"
                placeholderTextColor={colors.muted}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="url"
              />
              <Text style={styles.hint}>Deixe em branco para desativar. O payload contém {"{ event: 'order.created', order: {...} }"}.</Text>
              <Pressable testID="save-webhook-btn" onPress={save} disabled={saving} style={[styles.primary, saving && { opacity: 0.7 }]}>
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>{saved ? "Salvo!" : "Salvar"}</Text>}
              </Pressable>
            </>
          )}
        </View>

        <View style={styles.card}>
          <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center", marginBottom: spacing.sm }}>
            <Ionicons name="pricetag" size={20} color={colors.brandPrimary} />
            <Text style={styles.cardTitle}>Cupons de desconto</Text>
          </View>
          <Text style={styles.desc}>Crie códigos promocionais que seus clientes digitam no carrinho para aumentar vendas.</Text>
          <Pressable testID="open-coupons-btn" onPress={() => router.push("/(company)/coupons" as any)} style={styles.linkBtn}>
            <Text style={styles.linkBtnText}>Gerenciar cupons</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.brandPrimary} />
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center", marginBottom: spacing.sm }}>
            <Ionicons name="code-slash" size={20} color={colors.brandPrimary} />
            <Text style={styles.cardTitle}>Integração ERP (API)</Text>
          </View>
          <Text style={styles.desc}>Puxe pedidos e envie produtos direto do seu ERP via API REST.</Text>
          <Pressable testID="open-erp-btn" onPress={() => router.push("/(company)/erp" as any)} style={styles.linkBtn}>
            <Text style={styles.linkBtnText}>Ver documentação e chave</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.brandPrimary} />
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: colors.onSurface },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  cardTitle: { fontSize: 15, fontWeight: "800", color: colors.onSurface },
  desc: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: "600", color: colors.onSurface, marginTop: spacing.md, marginBottom: 6 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 46, color: colors.onSurface, fontSize: 14 },
  hint: { fontSize: 11, color: colors.muted, marginTop: 6 },
  primary: { backgroundColor: colors.brandPrimary, height: 46, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  primaryText: { color: colors.onBrandPrimary, fontWeight: "700" },
  linkBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.md },
  linkBtnText: { color: colors.brandPrimary, fontWeight: "700", fontSize: 14 },
});
