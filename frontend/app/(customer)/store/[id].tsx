import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { useCart } from "@/src/cart";
import { formatBRL } from "@/src/format";

export default function StoreDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { add, count, companyId, clear } = useCart();
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, p] = await Promise.all([api(`/stores/${id}`), api<any[]>(`/stores/${id}/products`)]);
        setStore(s);
        setProducts(p);
      } catch {}
      setLoading(false);
    })();
  }, [id]);

  const addToCart = (prod: any) => {
    if (companyId && companyId !== id) {
      // switching store - clear cart
      clear();
    }
    add(id, { product_id: prod.id, name: prod.name, price: prod.price, image: prod.image });
  };

  if (loading) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}><ActivityIndicator color={colors.brandPrimary} /></View>;
  if (!store) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}><Text>Loja indisponível</Text></View>;

  const grouped: Record<string, any[]> = {};
  products.forEach((p) => {
    const k = p.category || "Geral";
    grouped[k] = grouped[k] || [];
    grouped[k].push(p);
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + (count > 0 ? 100 : 24) }}>
        <View style={styles.cover}>
          {store.cover_image ? (
            <Image source={{ uri: store.cover_image }} style={StyleSheet.absoluteFill as any} contentFit="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.brandTertiary }]} />
          )}
          <LinearGradient colors={["rgba(0,0,0,0.3)", "transparent", "rgba(0,0,0,0.55)"]} style={StyleSheet.absoluteFill as any} />
          <Pressable testID="back-btn" onPress={() => router.back()} style={[styles.back, { top: insets.top + spacing.sm }]} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color="#000" />
          </Pressable>
        </View>

        <View style={styles.info}>
          <Text style={styles.storeName}>{store.name}</Text>
          <Text style={styles.storeDesc}>{store.description || store.segment}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}><Ionicons name="time-outline" size={14} color={colors.brandPrimary} /><Text style={styles.metaText}>{store.delivery_time}</Text></View>
            <View style={styles.metaItem}><Ionicons name="bicycle-outline" size={14} color={colors.brandPrimary} /><Text style={styles.metaText}>{formatBRL(store.delivery_fee)}</Text></View>
            <View style={styles.metaItem}><Ionicons name="cart-outline" size={14} color={colors.brandPrimary} /><Text style={styles.metaText}>Min. {formatBRL(store.min_order)}</Text></View>
          </View>
        </View>

        {Object.keys(grouped).length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="pricetag-outline" size={40} color={colors.muted} />
            <Text style={styles.emptyText}>Sem produtos disponíveis</Text>
          </View>
        ) : (
          Object.entries(grouped).map(([cat, list]) => (
            <View key={cat} style={{ paddingHorizontal: spacing.xl }}>
              <Text style={styles.category}>{cat}</Text>
              {list.map((p) => (
                <View key={p.id} testID={`prod-${p.id}`} style={styles.prodCard}>
                  <View style={styles.prodImg}>
                    {p.image ? <Image source={{ uri: p.image }} style={{ width: 68, height: 68, borderRadius: radius.sm }} /> : <Ionicons name="fast-food" size={26} color={colors.brandPrimary} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prodName}>{p.name}</Text>
                    {p.description ? <Text style={styles.prodDesc} numberOfLines={2}>{p.description}</Text> : null}
                    <Text style={styles.prodPrice}>{formatBRL(p.price)}</Text>
                  </View>
                  <Pressable testID={`add-${p.id}`} onPress={() => addToCart(p)} style={styles.addProdBtn}>
                    <Ionicons name="add" size={20} color={colors.onBrandPrimary} />
                  </Pressable>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {count > 0 && (
        <Pressable testID="go-cart-btn" onPress={() => router.push("/(customer)/cart" as any)} style={[styles.fab, { bottom: insets.bottom + 16 }]}>
          <Ionicons name="cart" size={22} color={colors.onBrandPrimary} />
          <Text style={styles.fabText}>Ver carrinho ({count})</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.onBrandPrimary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { height: 200 },
  back: { position: "absolute", left: spacing.md, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.95)", alignItems: "center", justifyContent: "center" },
  info: { padding: spacing.xl, backgroundColor: colors.surfaceSecondary, marginTop: -20, marginHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  storeName: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  storeDesc: { fontSize: 13, color: colors.muted, marginTop: 4 },
  metaRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md, flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: colors.onSurface, fontWeight: "600" },
  category: { fontSize: 16, fontWeight: "800", color: colors.onSurface, marginTop: spacing.lg, marginBottom: spacing.sm },
  prodCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  prodImg: { width: 68, height: 68, borderRadius: radius.sm, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  prodName: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  prodDesc: { fontSize: 12, color: colors.muted, marginTop: 2 },
  prodPrice: { fontSize: 15, fontWeight: "800", color: colors.brandPrimary, marginTop: 4 },
  addProdBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyText: { color: colors.muted, fontSize: 14 },
  fab: { position: "absolute", left: spacing.xl, right: spacing.xl, backgroundColor: colors.brandPrimary, height: 54, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md },
  fabText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 15 },
});
