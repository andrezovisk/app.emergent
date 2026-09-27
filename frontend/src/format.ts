export function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function statusLabel(s: string) {
  const map: Record<string, string> = {
    placed: "Recebido",
    confirmed: "Confirmado",
    preparing: "Preparando",
    delivered: "Entregue",
    cancelled: "Cancelado",
  };
  return map[s] || s;
}
