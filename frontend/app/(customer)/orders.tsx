import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, RefreshControl, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { formatBRL, statusLabel } from "@/src/format";

export default function MyOrders() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<any[]>("/orders/me");
      setOrders(data);
    } catch {}
  }, []);

  useEffect(() => { (async () => { await load(); setLoading(false); })(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Meus Pedidos</Text>
        <View style={{ width: 40 }} />
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandPrimary} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <View testID={`order-${item.id}`} style={styles.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={styles.name}>{item.company_name}</Text>
                <Text style={styles.total}>{formatBRL(item.total)}</Text>
              </View>
              <Text style={styles.sub}>{item.items.length} itens · {new Date(item.created_at).toLocaleString("pt-BR")}</Text>
              <View style={styles.statusPill}>
                <View style={[styles.dot, { backgroundColor: item.status === "delivered" ? colors.success : item.status === "cancelled" ? colors.error : colors.warning }]} />
                <Text style={styles.status}>{statusLabel(item.status)}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="receipt-outline" size={48} color={colors.muted} /><Text style={{ color: colors.muted, marginTop: 8 }}>Nenhum pedido ainda</Text></View>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: colors.onSurface },
  card: { padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  name: { fontSize: 15, fontWeight: "800", color: colors.onSurface },
  total: { fontSize: 15, fontWeight: "800", color: colors.brandPrimary },
  sub: { fontSize: 12, color: colors.muted, marginTop: 4 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { fontSize: 12, color: colors.onSurface, fontWeight: "600" },
  empty: { alignItems: "center", padding: spacing.xxl },
});
