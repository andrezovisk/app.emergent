import React, { createContext, useContext, useState, useMemo, useCallback } from "react";

export type CartItem = {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string | null;
};

type Ctx = {
  companyId: string | null;
  items: CartItem[];
  add: (companyId: string, item: Omit<CartItem, "quantity">) => void;
  inc: (product_id: string) => void;
  dec: (product_id: string) => void;
  remove: (product_id: string) => void;
  clear: () => void;
  subtotal: number;
  count: number;
};

const CartCtx = createContext<Ctx>({} as any);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);

  const add = useCallback((cid: string, item: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      // if new store, replace
      if (companyId && companyId !== cid) {
        setCompanyId(cid);
        return [{ ...item, quantity: 1 }];
      }
      if (!companyId) setCompanyId(cid);
      const idx = prev.findIndex((p) => p.product_id === item.product_id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
        return copy;
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }, [companyId]);

  const inc = useCallback((id: string) => {
    setItems((prev) => prev.map((p) => (p.product_id === id ? { ...p, quantity: p.quantity + 1 } : p)));
  }, []);

  const dec = useCallback((id: string) => {
    setItems((prev) =>
      prev
        .map((p) => (p.product_id === id ? { ...p, quantity: p.quantity - 1 } : p))
        .filter((p) => p.quantity > 0)
    );
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((p) => p.product_id !== id));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setCompanyId(null);
  }, []);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.price * i.quantity, 0), [items]);
  const count = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  return (
    <CartCtx.Provider value={{ companyId, items, add, inc, dec, remove, clear, subtotal, count }}>
      {children}
    </CartCtx.Provider>
  );
}

export function useCart() {
  return useContext(CartCtx);
}
