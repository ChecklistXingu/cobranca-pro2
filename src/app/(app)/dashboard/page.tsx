"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { brl, fmtDate } from "@/lib/utils";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const lineData = [
  { dia: "01/02", recebido: 12000, aberto: 85000 },
  { dia: "05/02", recebido: 18000, aberto: 78000 },
  { dia: "10/02", recebido: 6300, aberto: 71700 },
  { dia: "15/02", recebido: 8750, aberto: 62950 },
  { dia: "20/02", recebido: 0, aberto: 62950 },
];

const barData = [
  { faixa: "0–7d", valor: 5600, fill: "#F59E0B" },
  { faixa: "8–15d", valor: 7344, fill: "#F97316" },
  { faixa: "16–30d", valor: 29369, fill: "#EF4444" },
  { faixa: "30+d", valor: 66624, fill: "#991B1B" },
];

export default function DashboardPage() {
  const { titulos, getCliente, disparos } = useStore();

  const stats = useMemo(() => {
    const emAberto = titulos.filter(t => t.status === "ABERTO").reduce((a, t) => a + t.total, 0);
    const vencidos = titulos.filter(t => t.status === "VENCIDO").reduce((a, t) => a + t.total, 0);
    const recebido = titulos.filter(t => t.status === "RECEBIDO").reduce((a, t) => a + t.total, 0);
    const total = titulos.reduce((a, t) => a + t.total, 0);
    const taxa = total > 0 ? ((recebido / total) * 100).toFixed(1) : "0.0";
    const disparosEnviados = disparos.filter(d => d.status === "ENVIADO").length;

    const donutData = [
      { name: "Aberto", value: emAberto, color: "#3B82F6" },
      { name: "Vencido", value: vencidos, color: "#EF4444" },
      { name: "Recebido", value: recebido, color: "#10B981" },
      { name: "Negociado", value: titulos.filter(t => t.status === "NEGOCIADO").reduce((a, t) => a + t.total, 0), color: "#8B5CF6" },
    ];

    const topAtraso = [...titulos].filter(t => t.diasAtraso > 0).sort((a, b) => b.total - a.total).slice(0, 5);

    return { emAberto, vencidos, recebido, taxa, disparosEnviados, donutData, topAtraso };
  }, [titulos, disparos]);

  const kpis = [
    { label: "Em Aberto", value: brl(stats.emAberto), color: "#1D4ED8", bg: "#EFF6FF", icon: "📋" },
    { label: "Total Vencido", value: brl(stats.vencidos), color: "#B91C1C", bg: "#FEF2F2", icon: "⚠️" },
    { label: "Recebido no mês", value: brl(stats.recebido), color: "#065F46", bg: "#ECFDF5", icon: "✅" },
    { label: "Taxa Recuperação", value: `${stats.taxa}%`, color: "#6D28D9", bg: "#F5F3FF", icon: "📈" },
    { label: "Títulos totais", value: titulos.length, color: "#0369A1", bg: "#F0F9FF", icon: "🗂" },
    { label: "Disparos enviados", value: stats.disparosEnviados, color: "#92400E", bg: "#FFFBEB", icon: "💬" },
  ];

  return (
    <div style={{ maxWidth: 1300 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0 }}>Dashboard</h1>
        <p style={{ color: "#64748B", fontSize: 13, marginTop: 4 }}>Visão geral da carteira de cobrança — Fevereiro 2026</p>
      </div>

      {/* KPI CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 14, marginBottom: 24 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #F1F5F9" }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{k.icon}</div>
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* CHARTS ROW 1 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, marginBottom: 16 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #F1F5F9" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A", marginBottom: 16 }}>Evolução da Carteira (Fev/2026)</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "#94A3B8" }} />
              <YAxis tickFormatter={v => `${(Number(v)/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "#94A3B8" }} />
              <Tooltip formatter={(v) => brl(Number(v))} />
              <Legend />
              <Line type="monotone" dataKey="recebido" stroke="#10B981" strokeWidth={2.5} dot={false} name="Recebido" />
              <Line type="monotone" dataKey="aberto" stroke="#3B82F6" strokeWidth={2.5} dot={false} name="Em aberto" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: "#fff", borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #F1F5F9" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A", marginBottom: 16 }}>Status dos Títulos</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={stats.donutData} innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                {stats.donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(v) => brl(Number(v))} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {stats.donutData.map(d => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, display: "inline-block" }} />
                <span style={{ color: "#64748B" }}>{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CHARTS ROW 2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #F1F5F9" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A", marginBottom: 16 }}>Atrasos por Faixa (R$)</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="faixa" tick={{ fontSize: 11, fill: "#94A3B8" }} />
              <YAxis tickFormatter={v => `${(Number(v)/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "#94A3B8" }} />
              <Tooltip formatter={(v) => brl(Number(v))} />
              <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                {barData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: "#fff", borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #F1F5F9" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A", marginBottom: 14 }}>Top Atrasos</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {stats.topAtraso.map((t, i) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "#F8FAFC" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: i < 2 ? "#FEE2E2" : "#FEF3C7", color: i < 2 ? "#B91C1C" : "#92400E", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getCliente(t.clienteId).nome}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>{t.diasAtraso}d em atraso</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#B91C1C", whiteSpace: "nowrap" }}>{brl(t.total)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
