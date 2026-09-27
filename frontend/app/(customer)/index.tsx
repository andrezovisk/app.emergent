import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, RefreshControl, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { colors, spacing, radius } from "@/src/theme";
import { useAuth } from "@/src/auth";
import { useCart } from "@/src/cart";
import { api } from "@/src/api";

type Store = { id: string; name: string; segment: string; cover_image?: string; logo?: string; description?: string; delivery_time?: string; delivery_fee: number };

const CATEGORIES = [
  { key: "all", label: "Tudo", icon: "grid" },
  { key: "food", label: "Comida", icon: "fast-food" },
  { key: "market", label: "Mercado", icon: "basket" },
  { key: "pharmacy", label: "Farmácia", icon: "medkit" },
  { key: "drinks", label: "Bebidas", icon: "wine" },
];

export default function CustomerHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { logout, user } = useAuth();
  const { count } = useCart();
  const [stores, setStores] = useState<Store[]>([]);
  const [seg, setSeg] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const q = seg === "all" ? "" : `?segment=${seg}`;
      const data = await api<Store[]>(`/stores${q}`);
      setStores(data);
    } catch (e) { console.log("load", e); }
  }, [seg]);

  useEffect(() => { (async () => { await load(); setLoading(false); })(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Olá, {user?.name?.split(" ")[0]}</Text>
          <Text style={styles.title}>O que vai pedir hoje?</Text>
        </View>
        <Pressable testID="orders-btn" onPress={() => router.push("/(customer)/orders" as any)} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="receipt-outline" size={22} color={colors.onSurface} />
        </Pressable>
        <Pressable testID="logout-btn" onPress={logout} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="log-out-outline" size={22} color={colors.onSurface} />
        </Pressable>
      </View>

      <FlatList
        data={stores}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + (count > 0 ? 100 : 40) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {CATEGORIES.map((c) => (
                <Pressable key={c.key} testID={`cat-${c.key}`} onPress={() => setSeg(c.key)} style={[styles.chip, seg === c.key && styles.chipActive]}>
                  <Ionicons name={c.icon as any} size={16} color={seg === c.key ? colors.onBrandPrimary : colors.onSurface} />
                  <Text style={[styles.chipText, seg === c.key && styles.chipTextActive]}>{c.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.section}>{stores.length} lojas disponíveis</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`store-${item.id}`}
            onPress={() => router.push({ pathname: "/(customer)/store/[id]", params: { id: item.id } } as any)}
            style={styles.storeCard}
          >
            <View style={styles.storeCover}>
              {item.cover_image ? (
                <Image source={{ uri: item.cover_image }} style={StyleSheet.absoluteFill as any} contentFit="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }]}>
                  <Ionicons name="storefront" size={40} color={colors.brandPrimary} />
                </View>
              )}
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.55)"]} style={StyleSheet.absoluteFill as any} />
              <View style={styles.tagOnCover}>
                <Text style={styles.tagOnCoverText}>{item.segment.toUpperCase()}</Text>
              </View>
            </View>
            <View style={{ padding: spacing.md }}>
              <Text style={styles.storeName}>{item.name}</Text>
              <View style={{ flexDirection: "row", gap: spacing.md, marginTop: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="time-outline" size={12} color={colors.muted} />
                  <Text style={styles.storeMeta}>{item.delivery_time}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="bicycle-outline" size={12} color={colors.muted} />
                  <Text style={styles.storeMeta}>R$ {item.delivery_fee.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandPrimary} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="storefront-outline" size={48} color={colors.muted} />
              <Text style={styles.emptyText}>Nenhuma loja disponível</Text>
            </View>
          )
        }
      />

      {count > 0 && (
        <Pressable testID="floating-cart-btn" onPress={() => router.push("/(customer)/cart" as any)} style={[styles.fab, { bottom: insets.bottom + 16 }]}>
          <Ionicons name="cart" size={22} color={colors.onBrandPrimary} />
          <Text style={styles.fabText}>{count} {count === 1 ? "item" : "itens"} no carrinho</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.onBrandPrimary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.sm },
  hello: { color: colors.muted, fontSize: 13 },
  title: { color: colors.onSurface, fontSize: 20, fontWeight: "800", marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  chipRow: { gap: spacing.sm, paddingVertical: spacing.sm, paddingRight: spacing.md },
  chip: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurface, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: colors.onBrandPrimary },
  section: { color: colors.muted, fontSize: 12, fontWeight: "700", marginVertical: spacing.md, textTransform: "uppercase" },
  storeCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, marginBottom: spacing.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  storeCover: { height: 130, position: "relative" },
  tagOnCover: { position: "absolute", top: spacing.sm, left: spacing.sm, backgroundColor: colors.brandPrimary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tagOnCoverText: { color: colors.onBrandPrimary, fontSize: 10, fontWeight: "800" },
  storeName: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  storeMeta: { fontSize: 12, color: colors.muted },
  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyText: { color: colors.muted, fontSize: 14 },
  fab: { position: "absolute", left: spacing.xl, right: spacing.xl, backgroundColor: colors.brandPrimary, height: 54, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  fabText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 15 },
});
