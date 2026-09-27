import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { useAuth } from "@/src/auth";

export default function Register() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { registerCustomer } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!name || !email || !password) {
      setError("Preencha todos os campos obrigatórios");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await registerCustomer(email.trim(), password, name.trim(), phone.trim() || undefined);
    } catch (e: any) {
      setError(e.message || "Erro ao criar conta");
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
          <Text style={styles.title}>Bem-vindo</Text>
          <Text style={styles.heading}>Criar conta</Text>
        </View>

        <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>
          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={20} color={colors.muted} />
            <TextInput testID="name-input" value={name} onChangeText={setName} placeholder="Nome completo" placeholderTextColor={colors.muted} style={styles.input} />
          </View>
          <View style={styles.inputWrap}>
            <Ionicons name="call-outline" size={20} color={colors.muted} />
            <TextInput testID="phone-input" value={phone} onChangeText={setPhone} placeholder="Telefone (opcional)" placeholderTextColor={colors.muted} style={styles.input} keyboardType="phone-pad" />
          </View>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={20} color={colors.muted} />
            <TextInput testID="email-input" value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colors.muted} style={styles.input} autoCapitalize="none" keyboardType="email-address" />
          </View>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.muted} />
            <TextInput testID="password-input" value={password} onChangeText={setPassword} placeholder="Senha (min 6 chars)" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} />
          </View>
          {error && <Text testID="register-error" style={styles.error}>{error}</Text>}

          <Pressable testID="register-submit-btn" onPress={onSubmit} disabled={loading} style={[styles.primary, loading && { opacity: 0.7 }]}>
            {loading ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryText}>Criar conta</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: spacing.xl },
  back: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  title: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  heading: { color: colors.onSurface, fontSize: 32, fontWeight: "800", marginTop: spacing.xs },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, height: 54 },
  input: { flex: 1, color: colors.onSurface, fontSize: 16 },
  primary: { backgroundColor: colors.brandPrimary, height: 54, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  primaryText: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: "700" },
  error: { color: colors.error, fontSize: 14, textAlign: "center" },
});
