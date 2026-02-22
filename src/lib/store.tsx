"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Cliente, Titulo, Recebimento, Disparo, Template } from "@/types";
import { mockClientes, mockTitulos, mockRecebimentos, mockDisparos, mockTemplates } from "@/lib/mock/data";
import { simpleId } from "@/lib/utils";

interface Toast { id: number; message: string; type: "success" | "error" | "info"; }

interface Store {
  clientes: Cliente[];
  setClientes: (fn: (prev: Cliente[]) => Cliente[]) => void;
  titulos: Titulo[];
  setTitulos: (fn: (prev: Titulo[]) => Titulo[]) => void;
  recebimentos: Recebimento[];
  setRecebimentos: (fn: (prev: Recebimento[]) => Recebimento[]) => void;
  disparos: Disparo[];
  setDisparos: (fn: (prev: Disparo[]) => Disparo[]) => void;
  templates: Template[];
  setTemplates: (fn: (prev: Template[]) => Template[]) => void;
  toasts: Toast[];
  addToast: (message: string, type?: Toast["type"]) => void;
  getCliente: (id: string) => Cliente;
}

const StoreCtx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [clientes, setClientesState] = useState<Cliente[]>(mockClientes);
  const [titulos, setTitulosState] = useState<Titulo[]>(mockTitulos);
  const [recebimentos, setRecebimentosState] = useState<Recebimento[]>(mockRecebimentos);
  const [disparos, setDisparosState] = useState<Disparo[]>(mockDisparos);
  const [templates, setTemplatesState] = useState<Template[]>(mockTemplates);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: Toast["type"] = "success") => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  };

  const getCliente = (id: string) => clientes.find(c => c.id === id) ?? { id, nome: "—", telefone: "—" };

  return (
    <StoreCtx.Provider value={{
      clientes, setClientes: (fn) => setClientesState(fn),
      titulos, setTitulos: (fn) => setTitulosState(fn),
      recebimentos, setRecebimentos: (fn) => setRecebimentosState(fn),
      disparos, setDisparos: (fn) => setDisparosState(fn),
      templates, setTemplates: (fn) => setTemplatesState(fn),
      toasts, addToast, getCliente,
    }}>
      {children}
      {/* TOAST */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl min-w-[260px]"
            style={{ background: t.type === "success" ? "#10B981" : t.type === "error" ? "#EF4444" : "#1E293B" }}>
            {t.type === "success" && <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7"/></svg>}
            {t.message}
          </div>
        ))}
      </div>
    </StoreCtx.Provider>
  );
}

export function useStore(): Store {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be inside StoreProvider");
  return ctx;
}
