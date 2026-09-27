import React from "react";
import { View, Text, StyleSheet, Pressable, ImageBackground } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceInverse }}>
      <ImageBackground
        source={{ uri: "https://images.unsplash.com/photo-1612006567758-1846b36dd130?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzl8MHwxfHNlYXJjaHwyfHxkZWxpdmVyeSUyMGNvdXJpZXIlMjBzY29vdGVyJTIwYXBwJTIwb25ib2FyZGluZ3xlbnwwfHx8fDE3OTA1NDkxOTR8MA&ixlib=rb-4.1.0&q=85" }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <LinearGradient
        colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.95)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.container, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.top}>
          <View style={styles.logoRow}>
            <View style={styles.logoBadge}>
              <Ionicons name="bicycle" size={22} color={colors.onBrandPrimary} />
            </View>
            <Text style={styles.brandText}>Consumidor</Text>
          </View>
          <Text style={styles.tagline}>Peça de qualquer lugar,{"\n"}direto pelo WhatsApp</Text>
        </View>

        <View style={styles.bottom}>
          <Text style={styles.chooseText}>Entrar como</Text>

          <Pressable
            testID="role-customer-btn"
            style={[styles.roleCard, { backgroundColor: colors.brandPrimary }]}
            onPress={() => router.push("/login?role=customer" as any)}
          >
            <View style={styles.roleIcon}>
              <Ionicons name="fast-food" size={26} color={colors.onBrandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.roleTitle}>Sou Cliente</Text>
              <Text style={styles.roleSub}>Descubra e faça pedidos</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.onBrandPrimary} />
          </Pressable>

          <Pressable
            testID="role-company-btn"
            style={[styles.roleCard, { backgroundColor: colors.surfaceSecondary }]}
            onPress={() => router.push("/login?role=company" as any)}
          >
            <View style={[styles.roleIcon, { backgroundColor: colors.brandTertiary }]}>
              <Ionicons name="storefront" size={26} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.roleTitle, { color: colors.onSurface }]}>Sou Lojista</Text>
              <Text style={[styles.roleSub, { color: colors.muted }]}>Gerencie sua loja</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.onSurface} />
          </Pressable>

          <Pressable
            testID="role-admin-btn"
            style={[styles.roleCard, { backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.25)", borderWidth: 1 }]}
            onPress={() => router.push("/login?role=admin" as any)}
          >
            <View style={[styles.roleIcon, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
              <Ionicons name="shield-checkmark" size={24} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.roleTitle, { color: "#FFF" }]}>Administrador</Text>
              <Text style={[styles.roleSub, { color: "rgba(255,255,255,0.75)" }]}>Painel da plataforma</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#FFF" />
          </Pressable>

          <Pressable
            testID="open-manual-btn"
            onPress={() => router.push("/manual?role=customer" as any)}
            style={styles.manualLink}
            hitSlop={12}
          >
            <Ionicons name="book-outline" size={16} color="#FFF" />
            <Text style={styles.manualLinkText}>Primeira vez? Abrir manual de uso</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: "space-between" },
  top: { marginTop: spacing.xxl },
  logoRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xl },
  logoBadge: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center",
  },
  brandText: { color: "#FFF", fontSize: 22, fontWeight: "800" },
  tagline: { color: "#FFF", fontSize: 34, fontWeight: "800", lineHeight: 40 },
  bottom: { gap: spacing.md },
  chooseText: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: "600", marginBottom: spacing.sm },
  roleCard: {
    flexDirection: "row", alignItems: "center", padding: spacing.lg, borderRadius: radius.lg, gap: spacing.md,
  },
  roleIcon: {
    width: 48, height: 48, borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center",
  },
  roleTitle: { fontSize: 17, fontWeight: "700", color: "#FFF" },
  roleSub: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  manualLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: spacing.md, paddingVertical: spacing.sm },
  manualLinkText: { color: "#FFF", fontSize: 14, fontWeight: "600", textDecorationLine: "underline" },
});
