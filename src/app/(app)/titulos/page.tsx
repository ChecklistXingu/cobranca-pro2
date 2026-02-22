"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { brl, fmtDate } from "@/lib/utils";
import type { Titulo } from "@/types";

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; bg: string; color: string; dot: string }> = {
    ABERTO: { label: "Aberto", bg: "#DBEAFE", color: "#1D4ED8", dot: "#3B82F6" },
    VENCIDO: { label: "Vencido", bg: "#FEE2E2", color: "#B91C1C", dot: "#EF4444" },
    RECEBIDO: { label: "Recebido", bg: "#D1FAE5", color: "#065F46", dot: "#10B981" },
    NEGOCIADO: { label: "Negociado", bg: "#EDE9FE", color: "#5B21B6", dot: "#8B5CF6" },
    CANCELADO: { label: "Cancelado", bg: "#F3F4F6", color: "#374151", dot: "#9CA3AF" },
  };
  const c = cfg[status] ?? cfg.ABERTO;
  return (
    <span style={{ background: c.bg, color: c.color, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, display: "inline-block" }} />
      {c.label}
    </span>
  );
}

function Modal({ open, onClose, title, children, width = 520 }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: number }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div style={{ position: "relative", background: "#fff", borderRadius: 16, boxShadow: "0 25px 50px rgba(0,0,0,0.18)", width, maxWidth: "90vw", maxHeight: "90vh", overflowY: "auto", padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#0F172A" }}>{title}</div>
          <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "#64748B", display: "flex" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", border: "1px solid #E2E8F0", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#334155", outline: "none", background: "#fff", boxSizing: "border-box" };

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 5, display: "block" }}>{label}</label>
      {children}
    </div>
  );
}

function BaixarModal({ open, titulo, onClose, onConfirm }: { open: boolean; titulo: Titulo | null; onClose: () => void; onConfirm: (data: { valorRecebido: string; data: string; forma: string; observacao: string; parcial: boolean }) => void }) {
  const [form, setForm] = useState({ valorRecebido: "", data: new Date().toISOString().split("T")[0], forma: "PIX", observacao: "", parcial: false });
  if (!open || !titulo) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.valorRecebido) return;
    onConfirm(form);
    setForm({ valorRecebido: "", data: new Date().toISOString().split("T")[0], forma: "PIX", observacao: "", parcial: false });
  };

  return (
    <Modal open={open} onClose={onClose} title="Lançar Recebimento" width={480}>
      <div style={{ marginBottom: 14, background: "#F8FAFC", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
        <div style={{ fontWeight: 600, color: "#0F172A" }}>{titulo.numeroNF}</div>
        <div style={{ color: "#64748B" }}>Total: <strong style={{ color: "#0F172A" }}>{brl(titulo.total)}</strong></div>
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <FormField label="Valor Recebido (R$)">
          <input type="number" step="0.01" placeholder={String(titulo.total)} value={form.valorRecebido} onChange={e => setForm(p => ({ ...p, valorRecebido: e.target.value }))} required style={inputStyle} />
        </FormField>
        <FormField label="Data do Recebimento">
          <input type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} required style={inputStyle} />
        </FormField>
        <FormField label="Forma de Pagamento">
          <select value={form.forma} onChange={e => setForm(p => ({ ...p, forma: e.target.value }))} style={inputStyle}>
            {["PIX", "DINHEIRO", "BOLETO", "TRANSFERENCIA", "OUTRO"].map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </FormField>
        <FormField label="Observação (opcional)">
          <input type="text" value={form.observacao} onChange={e => setForm(p => ({ ...p, observacao: e.target.value }))} style={inputStyle} placeholder="Ex: comprovante enviado" />
        </FormField>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155", cursor: "pointer" }}>
          <input type="checkbox" checked={form.parcial} onChange={e => setForm(p => ({ ...p, parcial: e.target.checked }))} />
          Recebimento parcial (manter como VENCIDO)
        </label>
        <button type="submit" style={{ background: "#1E40AF", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          Confirmar Recebimento
        </button>
      </form>
    </Modal>
  );
}

export default function TitulosPage() {
  const { titulos, setTitulos, getCliente, addToast } = useStore();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("TODOS");
  const [filterFaixa, setFilterFaixa] = useState("TODAS");
  const [detailTitulo, setDetailTitulo] = useState<Titulo | null>(null);
  const [disparoTitulo, setDisparoTitulo] = useState<Titulo | null>(null);
  const [baixarTitulo, setBaixarTitulo] = useState<Titulo | null>(null);

  const filtered = useMemo(() => titulos.filter(t => {
    const c = getCliente(t.clienteId);
    const matchSearch = !search || c.nome.toLowerCase().includes(search.toLowerCase()) || t.numeroNF.includes(search) || (t.numeroTitulo ?? "").includes(search);
    const matchStatus = filterStatus === "TODOS" || t.status === filterStatus;
    const matchFaixa = filterFaixa === "TODAS" || (
      filterFaixa === "0-7" ? t.diasAtraso > 0 && t.diasAtraso <= 7 :
      filterFaixa === "8-15" ? t.diasAtraso >= 8 && t.diasAtraso <= 15 :
      filterFaixa === "16-30" ? t.diasAtraso >= 16 && t.diasAtraso <= 30 :
      filterFaixa === "30+" ? t.diasAtraso > 30 : true
    );
    return matchSearch && matchStatus && matchFaixa;
  }), [titulos, search, filterStatus, filterFaixa, getCliente]);

  const handleBaixar = (data: { valorRecebido: string; parcial: boolean }) => {
    if (!baixarTitulo) return;
    const novoStatus = (!data.parcial && parseFloat(data.valorRecebido) >= baixarTitulo.total) ? "RECEBIDO" as const : baixarTitulo.status;
    setTitulos(prev => prev.map(t => t.id === baixarTitulo.id ? { ...t, status: novoStatus } : t));
    addToast(novoStatus === "RECEBIDO" ? "Título baixado como RECEBIDO! ✅" : "Recebimento parcial lançado.");
    setBaixarTitulo(null);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0 }}>Títulos</h1>
          <p style={{ color: "#64748B", fontSize: 13, marginTop: 2 }}>{filtered.length} títulos encontrados</p>
        </div>
      </div>

      {/* FILTERS */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "6px 12px", flex: 1, minWidth: 200, maxWidth: 300 }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "#94A3B8" }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente, NF..." style={{ border: "none", outline: "none", fontSize: 13, background: "none", width: "100%", color: "#334155" }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ border: "1px solid #E2E8F0", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#334155", background: "#fff", outline: "none" }}>
          <option value="TODOS">Todos os status</option>
          {["ABERTO", "VENCIDO", "RECEBIDO", "NEGOCIADO", "CANCELADO"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterFaixa} onChange={e => setFilterFaixa(e.target.value)} style={{ border: "1px solid #E2E8F0", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#334155", background: "#fff", outline: "none" }}>
          <option value="TODAS">Todas as faixas</option>
          <option value="0-7">0–7 dias</option>
          <option value="8-15">8–15 dias</option>
          <option value="16-30">16–30 dias</option>
          <option value="30+">30+ dias</option>
        </select>
      </div>

      {/* TABLE */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                {["Cliente", "Telefone", "Nº NF", "Nº Título", "Valor Principal", "Juros", "Total", "Atraso", "Status", "Último Disparo", "Ações"].map(h => (
                  <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontWeight: 700, color: "#475569", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, idx) => {
                const c = getCliente(t.clienteId);
                return (
                  <tr key={t.id} style={{ borderBottom: "1px solid #F1F5F9", background: idx % 2 === 0 ? "#fff" : "#FAFBFC" }}>
                    <td style={{ padding: "11px 14px", fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap" }}>{c.nome}</td>
                    <td style={{ padding: "11px 14px", color: "#64748B", whiteSpace: "nowrap" }}>{c.telefone}</td>
                    <td style={{ padding: "11px 14px", fontFamily: "monospace", color: "#1D4ED8", fontSize: 12, whiteSpace: "nowrap" }}>{t.numeroNF}</td>
                    <td style={{ padding: "11px 14px", color: "#64748B", whiteSpace: "nowrap" }}>{t.numeroTitulo ?? "—"}</td>
                    <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>{brl(t.valorPrincipal)}</td>
                    <td style={{ padding: "11px 14px", color: t.juros > 0 ? "#B91C1C" : "#94A3B8", whiteSpace: "nowrap" }}>{brl(t.juros)}</td>
                    <td style={{ padding: "11px 14px", fontWeight: 700, whiteSpace: "nowrap" }}>{brl(t.total)}</td>
                    <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                      {t.diasAtraso > 0 ? <span style={{ color: t.diasAtraso > 30 ? "#B91C1C" : t.diasAtraso > 15 ? "#EA580C" : "#D97706", fontWeight: 600 }}>{t.diasAtraso}d</span> : <span style={{ color: "#10B981" }}>—</span>}
                    </td>
                    <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}><StatusBadge status={t.status} /></td>
                    <td style={{ padding: "11px 14px", color: "#94A3B8", fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(t.ultimoDisparo)}</td>
                    <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => setDetailTitulo(t)} style={{ background: "#EFF6FF", color: "#1D4ED8", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Ver</button>
                        <button onClick={() => setDisparoTitulo(t)} style={{ background: "#ECFDF5", color: "#065F46", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Disparar</button>
                        {t.status !== "RECEBIDO" && <button onClick={() => setBaixarTitulo(t)} style={{ background: "#F5F3FF", color: "#5B21B6", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Baixar</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Nenhum título encontrado</div>}
      </div>

      {/* DETAIL MODAL */}
      <Modal open={!!detailTitulo} onClose={() => setDetailTitulo(null)} title="Detalhes do Título" width={480}>
        {detailTitulo && (() => {
          const c = getCliente(detailTitulo.clienteId);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[["Cliente", c.nome], ["Telefone", c.telefone ?? "—"], ["Nº NF", detailTitulo.numeroNF], ["Nº Título", detailTitulo.numeroTitulo ?? "—"], ["Valor Principal", brl(detailTitulo.valorPrincipal)], ["Juros", brl(detailTitulo.juros)], ["Total", brl(detailTitulo.total)], ["Dias em atraso", detailTitulo.diasAtraso > 0 ? `${detailTitulo.diasAtraso} dias` : "Em dia"], ["Chave Match", detailTitulo.chaveMatch]].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #F8FAFC" }}>
                  <span style={{ color: "#64748B", fontSize: 13 }}>{l}</span>
                  <span style={{ color: "#334155", fontWeight: 500, fontSize: 13, fontFamily: l === "Chave Match" ? "monospace" : undefined }}>{v}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}><StatusBadge status={detailTitulo.status} /></div>
            </div>
          );
        })()}
      </Modal>

      {/* DISPARO MODAL */}
      <Modal open={!!disparoTitulo} onClose={() => setDisparoTitulo(null)} title="Simular Disparo WhatsApp" width={460}>
        {disparoTitulo && (() => {
          const c = getCliente(disparoTitulo.clienteId);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: 14, fontSize: 13, color: "#166534", lineHeight: 1.7 }}>
                Olá, <strong>{c.nome}</strong>! 👋<br />
                Identificamos o título <strong>{disparoTitulo.numeroNF}</strong> com vencimento em atraso de <strong>{disparoTitulo.diasAtraso} dias</strong>.<br />
                Valor total: <strong>{brl(disparoTitulo.total)}</strong><br />
                Entre em contato para regularizar. 🙏
              </div>
              <div style={{ fontSize: 12, color: "#64748B" }}>Será enviado para: <strong>{c.telefone}</strong></div>
              <button onClick={() => { addToast("Disparo simulado com sucesso!"); setDisparoTitulo(null); }} style={{ background: "#16A34A", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                Enviar via Z-API (Simulado)
              </button>
            </div>
          );
        })()}
      </Modal>

      <BaixarModal open={!!baixarTitulo} titulo={baixarTitulo} onClose={() => setBaixarTitulo(null)} onConfirm={handleBaixar as Parameters<typeof BaixarModal>[0]["onConfirm"]} />
    </div>
  );
}
