import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { useAuth } from "@/src/auth";

export default function Login() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState(role === "admin" ? "admin@delivery.com" : "");
  const [password, setPassword] = useState(role === "admin" ? "Admin@12345" : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = role === "admin" ? "Administrador" : role === "company" ? "Lojista" : "Cliente";
  const canRegister = role === "customer";

  const onSubmit = async () => {
    if (!email || !password) {
      setError("Preencha email e senha");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      setError(e.message || "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.back} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>

        <View style={{ marginTop: spacing.xl }}>
          <Text style={styles.title}>Entrar como</Text>
          <Text style={styles.heading}>{title}</Text>
        </View>

        <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={20} color={colors.muted} />
            <TextInput
              testID="email-input"
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={colors.muted}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.muted} />
            <TextInput
              testID="password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="Senha"
              placeholderTextColor={colors.muted}
              secureTextEntry
              style={styles.input}
            />
          </View>
          {error && <Text testID="login-error" style={styles.error}>{error}</Text>}

          <Pressable testID="login-submit-btn" onPress={onSubmit} disabled={loading} style={[styles.primary, loading && { opacity: 0.7 }]}>
            {loading ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryText}>Entrar</Text>}
          </Pressable>

          {canRegister && (
            <Pressable testID="go-register-btn" onPress={() => router.push("/register" as any)} style={styles.secondary}>
              <Text style={styles.secondaryText}>Criar conta de cliente</Text>
            </Pressable>
          )}
        </View>

        {role === "admin" && (
          <View style={styles.hint}>
            <Text style={styles.hintText}>Login administrativo padrão pré-preenchido para testes.</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: spacing.xl },
  back: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  title: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  heading: { color: colors.onSurface, fontSize: 32, fontWeight: "800", marginTop: spacing.xs },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md,
    borderWidth: 1, borderColor: colors.border, height: 54,
  },
  input: { flex: 1, color: colors.onSurface, fontSize: 16 },
  primary: { backgroundColor: colors.brandPrimary, height: 54, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  primaryText: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: "700" },
  secondary: { height: 54, borderRadius: radius.md, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  secondaryText: { color: colors.onSurface, fontSize: 15, fontWeight: "600" },
  error: { color: colors.error, fontSize: 14, textAlign: "center" },
  hint: { marginTop: spacing.xl, padding: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.md },
  hintText: { color: colors.onBrandTertiary, fontSize: 13 },
});
