import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";

type Section = { icon: string; title: string; body: string[] };

const CUSTOMER: Section[] = [
  { icon: "hand-right", title: "1. Criar sua conta", body: [
    "Na tela inicial toque em Sou Cliente.",
    "Toque em Criar conta de cliente e informe nome, telefone (opcional), email e senha (mínimo 6 caracteres).",
    "Você já entra automaticamente após o cadastro.",
  ]},
  { icon: "storefront", title: "2. Descobrir lojas", body: [
    "A home mostra todas as lojas ativas próximas a você.",
    "Use as categorias no topo (Tudo, Comida, Mercado, Farmácia, Bebidas) para filtrar.",
    "Cada card mostra tempo de entrega e taxa. Toque para abrir o cardápio.",
  ]},
  { icon: "cart", title: "3. Montar o pedido", body: [
    "Dentro da loja, toque no botão + ao lado de cada produto para adicionar ao carrinho.",
    "Um botão flutuante aparece embaixo mostrando quantos itens você tem.",
    "Ao trocar de loja o carrinho é limpo automaticamente para evitar mistura de pedidos.",
  ]},
  { icon: "logo-whatsapp", title: "4. Finalizar via WhatsApp", body: [
    "Abra o carrinho, informe endereço, forma de pagamento (Dinheiro, Cartão, PIX) e observações.",
    "Toque em Enviar pedido via WhatsApp. O app abrirá o WhatsApp com o pedido formatado direto para a loja.",
    "Basta apertar enviar no WhatsApp — a loja recebe todos os detalhes prontos.",
  ]},
  { icon: "receipt", title: "5. Acompanhar pedidos", body: [
    "No topo direito da home toque no ícone de recibo para ver o histórico.",
    "Cada pedido mostra loja, total, itens e status atual (Recebido, Confirmado, Preparando, Entregue).",
  ]},
];

const COMPANY: Section[] = [
  { icon: "log-in", title: "1. Acessar seu painel", body: [
    "Na tela inicial toque em Sou Lojista e informe o email e senha que o administrador cadastrou para você.",
    "Se ainda não recebeu, procure o administrador da plataforma.",
  ]},
  { icon: "stats-chart", title: "2. Painel principal (Dashboard)", body: [
    "Ao entrar você vê 4 indicadores: pedidos hoje, faturamento total, total de pedidos e quantidade de produtos.",
    "Um banner mostra seu plano atual (Mensal, Trimestral, Semestral ou Anual) e a data de expiração.",
    "Use puxar para atualizar (pull-to-refresh) para recarregar os dados.",
  ]},
  { icon: "pricetags", title: "3. Cadastro de produtos", body: [
    "Toque na aba Produtos e depois em Adicionar produto.",
    "Informe nome, descrição, preço, categoria e URL da imagem (opcional).",
    "Toque em um produto para editar, ativar/desativar ou excluir.",
    "Produtos inativos não aparecem para o cliente.",
  ]},
  { icon: "list-circle", title: "4. Receber e avançar pedidos", body: [
    "Todos os pedidos aparecem na aba Pedidos. Você também recebe o pedido formatado no seu WhatsApp.",
    "Toque em um pedido para avançar o status: Recebido → Confirmado → Preparando → Entregue.",
    "O cliente vê a atualização em tempo real no app.",
  ]},
  { icon: "code-slash", title: "5. Integração com seu ERP (API)", body: [
    "Na aba Produtos toque em Integração ERP para ver sua chave (X-API-Key) e a documentação.",
    "Endpoints principais: POST /api/erp/products/bulk (importa produtos), GET /api/erp/orders (baixa pedidos), PATCH /api/erp/orders/{id}/status (atualiza status).",
    "Use o campo external_id nos produtos para o ERP fazer upsert (cria se novo, atualiza se existir).",
    "Funciona com qualquer ERP: online ou offline (basta enviar via HTTPS quando conectar).",
  ]},
  { icon: "shield-checkmark", title: "6. Sobre sua licença", body: [
    "As licenças são gerenciadas pelo administrador da plataforma nos planos Mensal, Trimestral, Semestral e Anual.",
    "Quando faltar poucos dias entre em contato com o administrador para renovar.",
    "Se a licença expirar, sua loja fica automaticamente oculta para os clientes até a renovação.",
  ]},
];

const ADMIN: Section[] = [
  { icon: "key", title: "1. Seu login administrativo", body: [
    "Use o email e senha administrativos fornecidos pela plataforma (padrão inicial: admin@delivery.com / Admin@12345).",
    "Recomendamos trocar a senha padrão no primeiro acesso via banco de dados ou endpoint de perfil.",
    "Apenas administradores enxergam este painel.",
  ]},
  { icon: "stats-chart", title: "2. Visão geral do painel", body: [
    "Você vê 4 KPIs: total de empresas, empresas ativas, total de usuários e total de pedidos da plataforma.",
    "Abaixo, a lista de empresas cadastradas com plano, status (Ativo / Inativo / Expirado) e informações de contato.",
  ]},
  { icon: "business", title: "3. Cadastrar nova empresa", body: [
    "Toque em Nova no topo da lista.",
    "Preencha: nome, segmento (comida/mercado/farmácia/bebidas/outro), WhatsApp com DDI+DDD, endereço, taxa de entrega, pedido mínimo.",
    "Crie o proprietário/lojista: nome, email e senha inicial — ele usará esses dados para acessar o painel dele.",
    "Escolha o plano/licença: Mensal (30d), Trimestral (90d), Semestral (180d) ou Anual (365d).",
    "Toque em Criar empresa. O lojista já pode fazer login em seguida.",
  ]},
  { icon: "shield-checkmark", title: "4. Liberar e renovar licenças", body: [
    "Toque em uma empresa para ver os detalhes.",
    "No bloco Licença estão os 4 botões: Mensal +30d, Trimestral +90d, Semestral +180d, Anual +365d.",
    "Cada toque adiciona os dias ao vencimento atual (se estiver expirado, começa a contar de hoje) e atualiza o plano.",
    "Empresas expiradas ficam ocultas para clientes automaticamente até a renovação.",
  ]},
  { icon: "toggle", title: "5. Ativar / desativar empresa", body: [
    "No detalhe da empresa há o botão vermelho Desativar / verde Ativar.",
    "Desativar mantém os dados mas oculta a loja dos clientes imediatamente.",
    "Ideal para pausas temporárias ou para bloquear inadimplentes.",
  ]},
  { icon: "trash", title: "6. Excluir empresa", body: [
    "No topo do detalhe, ícone de lixeira remove a empresa, usuários (dono) e todos os produtos dela.",
    "Ação irreversível. Use com cautela.",
  ]},
  { icon: "code-slash", title: "7. Integração ERP (para todas as empresas)", body: [
    "Cada empresa recebe automaticamente uma chave X-API-Key ao ser criada.",
    "O lojista vê essa chave no painel dele (Integração ERP) e pode regenerar quando quiser.",
    "Não é necessária configuração adicional pelo administrador.",
  ]},
];

type RoleKey = "customer" | "company" | "admin";

const TITLES: Record<RoleKey, string> = {
  customer: "Manual do Cliente",
  company: "Manual do Lojista",
  admin: "Manual do Administrador",
};

const CONTENT: Record<RoleKey, Section[]> = {
  customer: CUSTOMER,
  company: COMPANY,
  admin: ADMIN,
};

export default function Manual() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role: initial } = useLocalSearchParams<{ role?: string }>();
  const startRole = (["customer", "company", "admin"].includes(initial as string) ? initial : "customer") as RoleKey;
  const [role, setRole] = useState<RoleKey>(startRole);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Manual de uso</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 40 }}>
        <View style={styles.heroCard}>
          <View style={styles.heroLogo}>
            <Ionicons name="bicycle" size={26} color={colors.onBrandPrimary} />
          </View>
          <Text style={styles.heroTitle}>Bem-vindo ao Consumidor</Text>
          <Text style={styles.heroSub}>
            Plataforma multi-empresa de delivery com pedidos direto no WhatsApp. Escolha abaixo o manual que combina com você.
          </Text>
        </View>

        <View style={styles.tabs}>
          {(["customer", "company", "admin"] as RoleKey[]).map((r) => (
            <Pressable
              key={r}
              testID={`manual-tab-${r}`}
              onPress={() => setRole(r)}
              style={[styles.tab, role === r && styles.tabActive]}
            >
              <Text style={[styles.tabText, role === r && styles.tabTextActive]}>
                {r === "customer" ? "Cliente" : r === "company" ? "Lojista" : "Admin"}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{TITLES[role]}</Text>

        {CONTENT[role].map((s, idx) => (
          <View key={idx} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Ionicons name={s.icon as any} size={18} color={colors.brandPrimary} />
              </View>
              <Text style={styles.cardTitle}>{s.title}</Text>
            </View>
            {s.body.map((b, i) => (
              <View key={i} style={styles.bullet}>
                <View style={styles.dot} />
                <Text style={styles.bulletText}>{b}</Text>
              </View>
            ))}
          </View>
        ))}

        {role === "company" && (
          <Pressable
            testID="open-erp-doc-btn"
            onPress={() => router.push("/(company)/erp" as any)}
            style={styles.actionCard}
          >
            <Ionicons name="code-slash" size={22} color={colors.onBrandPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Ver documentação ERP e minha chave</Text>
              <Text style={styles.actionSub}>Endpoints, exemplos e API Key</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.onBrandPrimary} />
          </Pressable>
        )}

        {role === "admin" && (
          <View style={styles.tipCard}>
            <Ionicons name="bulb" size={18} color={colors.warning} />
            <Text style={styles.tipText}>
              Dica: Após criar uma empresa, envie o email e a senha do lojista pelo WhatsApp para ele. Ele pode trocar a senha depois via suporte.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: colors.onSurface },
  heroCard: { backgroundColor: colors.surfaceInverse, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, marginBottom: spacing.lg },
  heroLogo: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  heroTitle: { color: colors.onSurfaceInverse, fontSize: 22, fontWeight: "800" },
  heroSub: { color: "rgba(255,255,255,0.75)", fontSize: 14, lineHeight: 20 },
  tabs: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, padding: 4, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  tab: { flex: 1, height: 38, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  tabActive: { backgroundColor: colors.brandPrimary },
  tabText: { color: colors.onSurface, fontWeight: "700", fontSize: 13 },
  tabTextActive: { color: colors.onBrandPrimary },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface, marginBottom: spacing.md },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  cardIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "800", color: colors.onSurface },
  bullet: { flexDirection: "row", gap: spacing.sm, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brandPrimary, marginTop: 8 },
  bulletText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 20 },
  actionCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.brandPrimary, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.sm },
  actionTitle: { color: colors.onBrandPrimary, fontSize: 15, fontWeight: "800" },
  actionSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2 },
  tipCard: { flexDirection: "row", gap: spacing.sm, backgroundColor: "#FFF4D6", borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm, borderWidth: 1, borderColor: "#FFE699" },
  tipText: { flex: 1, color: "#7A5B00", fontSize: 13, lineHeight: 19 },
});
