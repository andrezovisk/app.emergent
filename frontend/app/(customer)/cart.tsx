import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Linking } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { useCart } from "@/src/cart";
import { api } from "@/src/api";
import { formatBRL } from "@/src/format";

export default function Cart() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, companyId, inc, dec, remove, clear, subtotal } = useCart();
  const [store, setStore] = useState<any>(null);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState<"money" | "card" | "pix">("money");
  const [loading, setLoading] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponInfo, setCouponInfo] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  useEffect(() => {
    if (companyId) api(`/stores/${companyId}`).then(setStore).catch(() => {});
  }, [companyId]);

  // Re-validate when subtotal changes
  useEffect(() => {
    if (couponInfo && companyId) {
      api<{ code: string; discount: number }>("/coupons/validate", {
        method: "POST",
        body: JSON.stringify({ company_id: companyId, code: couponInfo.code, subtotal }),
      }).then(setCouponInfo).catch(() => { setCouponInfo(null); setCouponError("Cupom não aplicável"); });
    }
  }, [subtotal, companyId]);

  const applyCoupon = async () => {
    if (!companyId || !couponCode.trim()) return;
    setApplyingCoupon(true);
    setCouponError(null);
    try {
      const r = await api<{ code: string; discount: number }>("/coupons/validate", {
        method: "POST",
        body: JSON.stringify({ company_id: companyId, code: couponCode.trim().toUpperCase(), subtotal }),
      });
      setCouponInfo(r);
      setCouponCode("");
    } catch (e: any) {
      setCouponInfo(null);
      setCouponError(e.message || "Cupom inválido");
    }
    setApplyingCoupon(false);
  };

  const removeCoupon = () => {
    setCouponInfo(null);
    setCouponError(null);
  };

  const deliveryFee = store?.delivery_fee || 0;
  const discount = couponInfo?.discount || 0;
  const total = Math.max(0, subtotal - discount) + deliveryFee;

  const submit = async () => {
    if (!companyId || items.length === 0) return;
    if (!address.trim()) { Alert.alert("Endereço", "Informe o endereço de entrega"); return; }
    setLoading(true);
    try {
      const order = await api<any>("/orders", {
        method: "POST",
        body: JSON.stringify({
          company_id: companyId,
          items: items.map((i) => ({ product_id: i.product_id, name: i.name, price: i.price, quantity: i.quantity })),
          notes, address, payment_method: payment,
          coupon_code: couponInfo?.code || null,
        }),
      });
      // Build WhatsApp message
      const lines = [
        `*Novo Pedido - ${store?.name}*`,
        `Cliente: ${order.customer_name || ""}`,
        `Telefone: ${order.customer_phone || "-"}`,
        `Endereço: ${address}`,
        "",
        "*Itens:*",
        ...items.map((i) => `• ${i.quantity}x ${i.name} - ${formatBRL(i.price * i.quantity)}`),
        "",
        `Subtotal: ${formatBRL(subtotal)}`,
        discount > 0 ? `Desconto (${couponInfo?.code}): -${formatBRL(discount)}` : "",
        `Taxa entrega: ${formatBRL(deliveryFee)}`,
        `*Total: ${formatBRL(total)}*`,
        `Pagamento: ${payment.toUpperCase()}`,
        notes ? `\nObservações: ${notes}` : "",
        `\nPedido #${order.id.slice(0, 8)}`,
      ].filter(Boolean).join("\n");
      const phone = order.whatsapp || store?.whatsapp;
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(lines)}`;
      await Linking.openURL(url);
      clear();
      router.replace("/(customer)/orders" as any);
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
    setLoading(false);
  };

  if (items.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>Carrinho</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.empty}>
          <Ionicons name="cart-outline" size={64} color={colors.muted} />
          <Text style={styles.emptyText}>Carrinho vazio</Text>
          <Pressable testID="find-food-btn" onPress={() => router.replace("/(customer)" as any)} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>Descobrir lojas</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{store?.name || "Carrinho"}</Text>
        <Pressable testID="clear-cart-btn" onPress={clear} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 200 }} keyboardShouldPersistTaps="handled">
        {items.map((i) => (
          <View key={i.product_id} testID={`cart-item-${i.product_id}`} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{i.name}</Text>
              <Text style={styles.itemPrice}>{formatBRL(i.price)}</Text>
            </View>
            <View style={styles.qty}>
              <Pressable testID={`dec-${i.product_id}`} onPress={() => dec(i.product_id)} style={styles.qtyBtn}><Ionicons name="remove" size={16} color={colors.brandPrimary} /></Pressable>
              <Text style={styles.qtyVal}>{i.quantity}</Text>
              <Pressable testID={`inc-${i.product_id}`} onPress={() => inc(i.product_id)} style={styles.qtyBtn}><Ionicons name="add" size={16} color={colors.brandPrimary} /></Pressable>
            </View>
          </View>
        ))}

        <View style={styles.section}>
          <Text style={styles.label}>Endereço de entrega*</Text>
          <TextInput testID="address-input" value={address} onChangeText={setAddress} placeholder="Rua, número, bairro" placeholderTextColor={colors.muted} style={styles.input} />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Forma de pagamento</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {(["money", "card", "pix"] as const).map((p) => (
              <Pressable key={p} testID={`pay-${p}`} onPress={() => setPayment(p)} style={[styles.payChip, payment === p && styles.chipActive]}>
                <Text style={[styles.chipText, payment === p && styles.chipTextActive]}>{p.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Observações</Text>
          <TextInput testID="notes-input" value={notes} onChangeText={setNotes} placeholder="Ex: sem cebola, troco para R$50" placeholderTextColor={colors.muted} multiline style={[styles.input, { height: 80, textAlignVertical: "top", paddingTop: spacing.md }]} />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Cupom de desconto</Text>
          {couponInfo ? (
            <View style={styles.appliedCoupon}>
              <Ionicons name="pricetag" size={18} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.appliedCode}>{couponInfo.code}</Text>
                <Text style={styles.appliedDiscount}>Desconto: -{formatBRL(couponInfo.discount)}</Text>
              </View>
              <Pressable testID="remove-coupon-btn" onPress={removeCoupon} hitSlop={12}>
                <Ionicons name="close-circle" size={22} color={colors.error} />
              </Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <TextInput
                testID="coupon-input"
                value={couponCode}
                onChangeText={(v) => setCouponCode(v.toUpperCase())}
                placeholder="Digite o código"
                placeholderTextColor={colors.muted}
                style={[styles.input, { flex: 1 }]}
                autoCapitalize="characters"
              />
              <Pressable testID="apply-coupon-btn" onPress={applyCoupon} disabled={applyingCoupon || !couponCode.trim()} style={[styles.applyBtn, (applyingCoupon || !couponCode.trim()) && { opacity: 0.5 }]}>
                {applyingCoupon ? <ActivityIndicator color="#FFF" /> : <Text style={styles.applyBtnText}>Aplicar</Text>}
              </Pressable>
            </View>
          )}
          {couponError && !couponInfo && <Text testID="coupon-error" style={{ color: colors.error, fontSize: 12, marginTop: 6 }}>{couponError}</Text>}
        </View>

        <View style={styles.summary}>
          <Row label="Subtotal" value={formatBRL(subtotal)} />
          {discount > 0 && <Row label={`Cupom (${couponInfo?.code})`} value={`-${formatBRL(discount)}`} tint={colors.success} />}
          <Row label="Taxa de entrega" value={formatBRL(deliveryFee)} />
          <View style={styles.divider} />
          <Row label="Total" value={formatBRL(total)} bold />
        </View>
      </ScrollView>

      <View style={[styles.stickyBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable testID="checkout-whatsapp-btn" onPress={submit} disabled={loading} style={[styles.wpp, loading && { opacity: 0.7 }]}>
          {loading ? <ActivityIndicator color="#FFF" /> : (
            <>
              <Ionicons name="logo-whatsapp" size={22} color="#FFF" />
              <Text style={styles.wppText}>Enviar pedido via WhatsApp · {formatBRL(total)}</Text>
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Row({ label, value, bold, tint }: { label: string; value: string; bold?: boolean; tint?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
      <Text style={{ color: bold ? colors.onSurface : (tint || colors.muted), fontSize: bold ? 16 : 14, fontWeight: bold ? "800" : "500" }}>{label}</Text>
      <Text style={{ color: tint || colors.onSurface, fontSize: bold ? 16 : 14, fontWeight: bold ? "800" : "600" }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: colors.onSurface },
  itemRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  itemName: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  itemPrice: { fontSize: 13, color: colors.brandPrimary, fontWeight: "700", marginTop: 2 },
  qty: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, borderRadius: radius.pill, padding: 4 },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  qtyVal: { minWidth: 20, textAlign: "center", fontWeight: "700", color: colors.onSurface },
  section: { marginTop: spacing.lg },
  label: { fontSize: 13, fontWeight: "700", color: colors.onSurface, marginBottom: 6 },
  input: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 50, color: colors.onSurface, fontSize: 15 },
  payChip: { flex: 1, height: 46, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurface, fontWeight: "700", fontSize: 13 },
  chipTextActive: { color: colors.onBrandPrimary },
  summary: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.lg },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: 6 },
  stickyBar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.xl, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  wpp: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: "#25D366", height: 54, borderRadius: radius.md },
  wppText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  applyBtn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.lg, height: 46, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  applyBtnText: { color: colors.onBrandPrimary, fontWeight: "700" },
  appliedCoupon: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "#E8F8ED", borderWidth: 1, borderColor: colors.success, padding: spacing.md, borderRadius: radius.md },
  appliedCode: { fontSize: 15, fontWeight: "800", color: colors.success, letterSpacing: 1 },
  appliedDiscount: { fontSize: 12, color: colors.onSurface, marginTop: 2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xxl },
  emptyText: { color: colors.muted, fontSize: 16 },
  emptyBtn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.xl, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  emptyBtnText: { color: colors.onBrandPrimary, fontWeight: "700" },
});
