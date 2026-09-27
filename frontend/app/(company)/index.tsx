import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, FlatList } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";
import { formatBRL, statusLabel } from "@/src/format";

type Company = { id: string; name: string; plan: string; license_expires_at: string; active: boolean };
type Stats = { total_orders: number; today_orders: number; products: number; revenue: number };
type Order = { id: string; customer_name: string; total: number; status: string; created_at: string; items: any[] };

export default function CompanyHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { logout, user } = useAuth();
  const [tab, setTab] = useState<"orders" | "products">("orders");
  const [me, setMe] = useState<Company | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, s, o, p] = await Promise.all([
        api<Company>("/company/me"),
        api<Stats>("/company/stats"),
        api<Order[]>("/company/orders"),
        api<any[]>("/company/products"),
      ]);
      setMe(c); setStats(s); setOrders(o); setProducts(p);
    } catch (e) { console.log("company load err", e); }
  }, []);

  useEffect(() => { (async () => { await load(); setLoading(false); })(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const advance = async (o: Order) => {
    const flow: Record<string, string> = { placed: "confirmed", confirmed: "preparing", preparing: "delivered" };
    const next = flow[o.status];
    if (!next) return;
    await api(`/company/orders/${o.id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
    await load();
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.brandPrimary} /></View>;

  const licenseExpires = me ? new Date(me.license_expires_at).toLocaleDateString("pt-BR") : "";

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Bem-vindo</Text>
          <Text style={styles.title}>{me?.name}</Text>
        </View>
        <Pressable testID="manual-btn" onPress={() => router.push("/manual?role=company" as any)} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="help-circle-outline" size={22} color={colors.onSurface} />
        </Pressable>
        <Pressable testID="erp-btn" onPress={() => router.push("/(company)/erp" as any)} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="code-slash" size={20} color={colors.onSurface} />
        </Pressable>
        <Pressable testID="logout-btn" onPress={logout} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="log-out-outline" size={22} color={colors.onSurface} />
        </Pressable>
      </View>

      <FlatList
        data={tab === "orders" ? orders : products}
        keyExtractor={(item: any) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + 100 }}
        ListHeaderComponent={
          <View>
            <View style={styles.statRow}>
              <Stat label="Pedidos hoje" value={String(stats?.today_orders || 0)} icon="today" />
              <Stat label="Faturamento" value={formatBRL(stats?.revenue || 0)} icon="cash" tint={colors.success} />
            </View>
            <View style={styles.statRow}>
              <Stat label="Total pedidos" value={String(stats?.total_orders || 0)} icon="receipt" />
              <Stat label="Produtos" value={String(stats?.products || 0)} icon="pricetag" tint={colors.brandPrimary} />
            </View>

            <View style={styles.licenseBanner}>
              <Ionicons name="shield-checkmark" size={18} color={colors.brandPrimary} />
              <Text style={styles.licenseText}>Plano {me?.plan?.toUpperCase()} · expira em {licenseExpires}</Text>
            </View>

            <View style={styles.tabs}>
              <Pressable testID="tab-orders" onPress={() => setTab("orders")} style={[styles.tab, tab === "orders" && styles.tabActive]}>
                <Text style={[styles.tabText, tab === "orders" && styles.tabTextActive]}>Pedidos</Text>
              </Pressable>
              <Pressable testID="tab-products" onPress={() => setTab("products")} style={[styles.tab, tab === "products" && styles.tabActive]}>
                <Text style={[styles.tabText, tab === "products" && styles.tabTextActive]}>Produtos</Text>
              </Pressable>
            </View>

            {tab === "products" && (
              <Pressable testID="add-product-btn" onPress={() => router.push("/(company)/new-product" as any)} style={styles.addBtn}>
                <Ionicons name="add" size={20} color={colors.onBrandPrimary} />
                <Text style={styles.addBtnText}>Adicionar produto</Text>
              </Pressable>
            )}
          </View>
        }
        renderItem={({ item }: any) =>
          tab === "orders" ? (
            <Pressable testID={`order-${item.id}`} onPress={() => advance(item)} style={styles.orderCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderTitle}>{item.customer_name}</Text>
                <Text style={styles.orderSub}>{item.items.length} itens · {formatBRL(item.total)}</Text>
                <View style={styles.statusPill}>
                  <View style={[styles.statusDot, { backgroundColor: item.status === "delivered" ? colors.success : item.status === "cancelled" ? colors.error : colors.warning }]} />
                  <Text style={styles.statusTxt}>{statusLabel(item.status)}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Pressable>
          ) : (
            <Pressable testID={`product-${item.id}`} onPress={() => router.push({ pathname: "/(company)/product/[id]", params: { id: item.id } } as any)} style={styles.productCard}>
              <View style={styles.productImg}><Ionicons name="pricetag" size={22} color={colors.brandPrimary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productSub}>{item.category} · {formatBRL(item.price)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Pressable>
          )
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name={tab === "orders" ? "receipt-outline" : "pricetag-outline"} size={48} color={colors.muted} />
            <Text style={styles.emptyText}>{tab === "orders" ? "Nenhum pedido ainda" : "Nenhum produto cadastrado"}</Text>
          </View>
        }
      />
    </View>
  );
}

function Stat({ label, value, icon, tint }: any) {
  return (
    <View style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: (tint || colors.brandPrimary) + "22" }]}>
        <Ionicons name={icon} size={18} color={tint || colors.brandPrimary} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.md },
  hello: { color: colors.muted, fontSize: 13 },
  title: { color: colors.onSurface, fontSize: 22, fontWeight: "800", marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  statRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  stat: { flex: 1, backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  statIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  statValue: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },
  licenseBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md },
  licenseText: { color: colors.onBrandTertiary, fontSize: 13, fontWeight: "600" },
  tabs: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, padding: 4, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  tab: { flex: 1, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  tabActive: { backgroundColor: colors.brandPrimary },
  tabText: { color: colors.onSurface, fontWeight: "700", fontSize: 14 },
  tabTextActive: { color: colors.onBrandPrimary },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.brandPrimary, height: 46, borderRadius: radius.md, marginBottom: spacing.md },
  addBtnText: { color: colors.onBrandPrimary, fontWeight: "700" },
  orderCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  orderTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  orderSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusTxt: { fontSize: 12, color: colors.onSurface, fontWeight: "600" },
  productCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  productImg: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  productName: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  productSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyText: { color: colors.muted, fontSize: 14 },
});
