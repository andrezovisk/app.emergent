import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, FlatList } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";

type Company = { id: string; name: string; segment: string; plan: string; active: boolean; license_expires_at: string; whatsapp: string };
type Stats = { total_companies: number; active_companies: number; total_users: number; total_orders: number };

export default function AdminHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { logout, user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([api<Stats>("/admin/stats"), api<Company[]>("/admin/companies")]);
      setStats(s);
      setCompanies(c);
    } catch (e) {
      console.log("admin load err", e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const isExpired = (iso: string) => {
    try { return new Date(iso) < new Date(); } catch { return false; }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Olá, {user?.name || "Admin"}</Text>
          <Text style={styles.title}>Painel Admin</Text>
        </View>
        <Pressable testID="logout-btn" onPress={logout} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="log-out-outline" size={22} color={colors.onSurface} />
        </Pressable>
      </View>

      <FlatList
        data={companies}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
            <View style={styles.statRow}>
              <StatCard testID="stat-companies" label="Empresas" value={stats?.total_companies || 0} icon="business" />
              <StatCard testID="stat-active" label="Ativas" value={stats?.active_companies || 0} icon="checkmark-circle" tint={colors.success} />
            </View>
            <View style={styles.statRow}>
              <StatCard testID="stat-users" label="Usuários" value={stats?.total_users || 0} icon="people" />
              <StatCard testID="stat-orders" label="Pedidos" value={stats?.total_orders || 0} icon="receipt" tint={colors.brandPrimary} />
            </View>

            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>Empresas ({companies.length})</Text>
              <Pressable testID="add-company-btn" onPress={() => router.push("/(admin)/new-company" as any)} style={styles.addBtn}>
                <Ionicons name="add" size={18} color={colors.onBrandPrimary} />
                <Text style={styles.addBtnText}>Nova</Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const expired = isExpired(item.license_expires_at);
          return (
            <Pressable
              testID={`company-row-${item.id}`}
              onPress={() => router.push({ pathname: "/(admin)/company/[id]", params: { id: item.id } } as any)}
              style={styles.companyCard}
            >
              <View style={styles.companyIcon}>
                <Ionicons name="storefront" size={22} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.companyName}>{item.name}</Text>
                <Text style={styles.companySub}>{item.segment} · WhatsApp {item.whatsapp}</Text>
                <View style={{ flexDirection: "row", gap: spacing.xs, marginTop: 6 }}>
                  <Tag label={item.plan.toUpperCase()} bg={colors.brandTertiary} fg={colors.onBrandTertiary} />
                  <Tag
                    label={expired ? "EXPIRADO" : item.active ? "ATIVO" : "INATIVO"}
                    bg={expired || !item.active ? "#FDECEA" : "#E8F8ED"}
                    fg={expired || !item.active ? colors.error : colors.success}
                  />
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="business-outline" size={48} color={colors.muted} />
            <Text style={styles.emptyText}>Nenhuma empresa cadastrada</Text>
          </View>
        }
      />
    </View>
  );
}

function StatCard({ label, value, icon, tint, testID }: any) {
  return (
    <View testID={testID} style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: (tint || colors.brandPrimary) + "22" }]}>
        <Ionicons name={icon} size={18} color={tint || colors.brandPrimary} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Tag({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: bg }}>
      <Text style={{ color: fg, fontSize: 10, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.md },
  hello: { color: colors.muted, fontSize: 13, fontWeight: "500" },
  title: { color: colors.onSurface, fontSize: 24, fontWeight: "800", marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  statRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  stat: { flex: 1, backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  statIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  statValue: { color: colors.onSurface, fontSize: 22, fontWeight: "800" },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 2, fontWeight: "500" },
  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill },
  addBtnText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 13 },
  companyCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  companyIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  companyName: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  companySub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyText: { color: colors.muted, fontSize: 14 },
});
