import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { api, API_BASE } from "@/src/api";

export default function ErpDoc() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    try {
      const r = await api<{ api_key: string }>("/company/api-key");
      setApiKey(r.api_key);
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const copy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const regen = async () => {
    Alert.alert("Regenerar chave?", "A chave atual deixará de funcionar.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Regenerar", style: "destructive", onPress: async () => {
        const r = await api<{ api_key: string }>("/company/api-key/regenerate", { method: "POST" });
        setApiKey(r.api_key);
      }},
    ]);
  };

  const baseUrl = `${API_BASE}/api`;

  const examples = [
    {
      title: "Testar conexão (ping)",
      method: "GET",
      path: "/erp/ping",
      snippet: `curl -H "X-API-Key: SUA_CHAVE" ${baseUrl}/erp/ping`,
    },
    {
      title: "Importar produtos do ERP (bulk upsert)",
      method: "POST",
      path: "/erp/products/bulk",
      snippet: `curl -X POST -H "X-API-Key: SUA_CHAVE" -H "Content-Type: application/json" \\
  -d '[{"external_id":"SKU-001","name":"Produto A","price":19.9,"category":"Bebidas"}]' \\
  ${baseUrl}/erp/products/bulk`,
    },
    {
      title: "Baixar pedidos",
      method: "GET",
      path: "/erp/orders",
      snippet: `curl -H "X-API-Key: SUA_CHAVE" ${baseUrl}/erp/orders?status=placed`,
    },
    {
      title: "Atualizar status de um pedido",
      method: "PATCH",
      path: "/erp/orders/{id}/status",
      snippet: `curl -X PATCH -H "X-API-Key: SUA_CHAVE" -H "Content-Type: application/json" \\
  -d '{"status":"confirmed"}' \\
  ${baseUrl}/erp/orders/ORDER_ID/status`,
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Integração ERP</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 40 }}>
        <View style={styles.intro}>
          <View style={styles.introIcon}><Ionicons name="git-network" size={22} color={colors.brandPrimary} /></View>
          <Text style={styles.introTitle}>Conecte seu ERP em minutos</Text>
          <Text style={styles.introText}>
            Funciona com qualquer ERP (online ou offline). Basta enviar suas requisições usando o cabeçalho X-API-Key.
            Nenhuma configuração adicional necessária.
          </Text>
        </View>

        <Text style={styles.section}>Sua chave (X-API-Key)</Text>
        <View style={styles.keyCard}>
          {loading ? <ActivityIndicator color={colors.brandPrimary} /> : (
            <>
              <Text testID="api-key-text" style={styles.keyText} selectable>{apiKey}</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                <Pressable testID="copy-key-btn" onPress={() => apiKey && copy(apiKey)} style={styles.keyBtn}>
                  <Ionicons name={copied ? "checkmark" : "copy"} size={16} color={colors.onBrandPrimary} />
                  <Text style={styles.keyBtnText}>{copied ? "Copiado!" : "Copiar chave"}</Text>
                </Pressable>
                <Pressable testID="regen-key-btn" onPress={regen} style={[styles.keyBtn, { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }]}>
                  <Ionicons name="refresh" size={16} color={colors.onSurface} />
                  <Text style={[styles.keyBtnText, { color: colors.onSurface }]}>Regenerar</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        <Text style={styles.section}>URL base</Text>
        <Pressable style={styles.codeBlock} onPress={() => copy(baseUrl)}>
          <Text style={styles.code} selectable>{baseUrl}</Text>
          <Ionicons name="copy-outline" size={16} color={colors.muted} />
        </Pressable>

        <Text style={styles.section}>Como usar em 3 passos</Text>
        <StepCard n={1} title="Copie sua chave acima" text="Uma chave por empresa. Não compartilhe publicamente." />
        <StepCard n={2} title="Configure no seu ERP" text="Adicione no header de todas as chamadas: X-API-Key: SUA_CHAVE." />
        <StepCard n={3} title="Chame os endpoints" text="Use os exemplos abaixo. Todos retornam JSON com nomes claros em português/inglês." />

        <Text style={styles.section}>Endpoints e exemplos</Text>
        {examples.map((e, i) => (
          <View key={i} style={styles.exCard}>
            <View style={styles.exHeader}>
              <View style={[styles.method, { backgroundColor: e.method === "GET" ? colors.info + "22" : e.method === "POST" ? colors.success + "22" : colors.warning + "22" }]}>
                <Text style={[styles.methodText, { color: e.method === "GET" ? colors.info : e.method === "POST" ? colors.success : colors.warning }]}>{e.method}</Text>
              </View>
              <Text style={styles.exPath}>{e.path}</Text>
            </View>
            <Text style={styles.exTitle}>{e.title}</Text>
            <Pressable style={styles.codeBlock} onPress={() => copy(e.snippet)}>
              <Text style={styles.code} selectable>{e.snippet}</Text>
            </Pressable>
          </View>
        ))}

        <View style={styles.faq}>
          <Text style={styles.faqTitle}>Perguntas frequentes</Text>
          <Text style={styles.faqQ}>Meu ERP é offline. Posso usar?</Text>
          <Text style={styles.faqA}>Sim. Envie os dados quando tiver conexão. O endpoint /erp/products/bulk faz upsert usando external_id, então você pode enviar o mesmo lote quantas vezes precisar sem duplicar.</Text>
          <Text style={styles.faqQ}>Preciso instalar algum SDK?</Text>
          <Text style={styles.faqA}>Não. É REST puro sobre HTTPS. Qualquer linguagem (PHP, .NET, Delphi, Node, Python, Excel/VBA) faz.</Text>
          <Text style={styles.faqQ}>E se minha chave vazar?</Text>
          <Text style={styles.faqA}>Toque em Regenerar acima. A chave antiga deixa de funcionar imediatamente.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function StepCard({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepN}><Text style={styles.stepNText}>{n}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: colors.onSurface },
  intro: { backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  introIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  introTitle: { fontSize: 16, fontWeight: "800", color: colors.onBrandTertiary },
  introText: { fontSize: 13, color: colors.onBrandTertiary, marginTop: 4, lineHeight: 19 },
  section: { fontSize: 14, fontWeight: "800", color: colors.onSurface, marginTop: spacing.md, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.4 },
  keyCard: { backgroundColor: colors.surfaceInverse, padding: spacing.md, borderRadius: radius.md },
  keyText: { color: "#7CFF9D", fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }), fontSize: 13 },
  keyBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.brandPrimary, height: 42, borderRadius: radius.md },
  keyBtnText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 13 },
  codeBlock: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceInverse, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.xs },
  code: { flex: 1, color: "#F1F1F1", fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }), fontSize: 12, lineHeight: 18 },
  step: { flexDirection: "row", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  stepN: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  stepNText: { color: colors.onBrandPrimary, fontWeight: "800" },
  stepTitle: { fontSize: 14, fontWeight: "800", color: colors.onSurface },
  stepText: { fontSize: 13, color: colors.muted, marginTop: 2 },
  exCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  exHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 4 },
  method: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  methodText: { fontSize: 11, fontWeight: "800" },
  exPath: { flex: 1, fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }), fontSize: 12, color: colors.onSurface },
  exTitle: { fontSize: 14, fontWeight: "700", color: colors.onSurface, marginTop: 2 },
  faq: { marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  faqTitle: { fontSize: 15, fontWeight: "800", color: colors.onSurface, marginBottom: spacing.sm },
  faqQ: { fontSize: 13, fontWeight: "700", color: colors.onSurface, marginTop: spacing.sm },
  faqA: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 2 },
});
