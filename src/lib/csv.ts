import type { Carteira, Cliente, Titulo } from "@/types";

function norm(s: string) { return (s ?? "").toString().trim(); }
function normKey(s: string) { return norm(s).toLowerCase().replace(/\s+/g, " "); }
function digitsOnly(s: string) { return norm(s).replace(/\D/g, ""); }
function simpleId(prefix = "id") { return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`; }

function parseBRL(input: string): number {
  const s = norm(input);
  if (!s) return 0;
  const hasComma = s.includes(",");
  const cleaned = s.replace(/\s/g, "");
  if (hasComma) {
    const v = Number(cleaned.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(v) ? v : 0;
  }
  const v = Number(cleaned);
  return Number.isFinite(v) ? v : 0;
}

function safeInt(input: string): number {
  const v = Number(norm(input).replace(",", "."));
  return Number.isFinite(v) ? Math.trunc(v) : 0;
}

function pick(row: Record<string, string>, candidates: string[]): string {
  const keys = Object.keys(row);
  const map = new Map<string, string>();
  keys.forEach(k => map.set(normKey(k), k));
  for (const c of candidates) {
    const k = map.get(normKey(c));
    if (k) return row[k] ?? "";
  }
  for (const k of keys) {
    const nk = normKey(k);
    if (candidates.some(c => nk.includes(normKey(c)))) return row[k] ?? "";
  }
  return "";
}

export interface ParsedRow {
  nome: string;
  telefone?: string;
  numeroNF?: string;
  numeroTitulo?: string;
  valorPrincipal: number;
  juros: number;
  total: number;
  diasAtraso: number;
}

export function parseCsvText(csvText: string): ParsedRow[] {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map(h => h.trim());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => (row[h] = (cols[idx] ?? "").trim()));
    rows.push(row);
  }

  return rows.map(r => {
    const nome = pick(r, ["nome", "cliente", "razao social", "razão social"]);
    const telefone = pick(r, ["telefone", "celular", "whatsapp"]);
    const numeroNF = pick(r, ["numero_nf", "numero nf", "número nf", "nf", "nota fiscal"]);
    const numeroTitulo = pick(r, ["numero_titulo", "numero do titulo", "número do título", "titulo", "duplicata"]);
    const valorPrincipal = parseBRL(pick(r, ["valor_principal", "valor principal", "valor nf", "valor"]));
    const juros = parseBRL(pick(r, ["juros", "valor juros", "juros (r$)"]));
    const total = parseBRL(pick(r, ["total", "valor total", "total (r$)"]));
    const diasAtraso = safeInt(pick(r, ["dias_atraso", "dias em atraso", "dias atraso", "atraso"]));

    return {
      nome: norm(nome),
      telefone: telefone || undefined,
      numeroNF: norm(numeroNF) || undefined,
      numeroTitulo: norm(numeroTitulo) || undefined,
      valorPrincipal,
      juros,
      total: total || (valorPrincipal + juros),
      diasAtraso,
    };
  }).filter(p => p.nome && (p.numeroNF || p.numeroTitulo));
}

export function buildCarteiraFromRows(rows: ParsedRow[]): Carteira {
  const clientesMap = new Map<string, Cliente>();
  const titulos: Titulo[] = [];

  for (const r of rows) {
    const clienteKey = `${normKey(r.nome)}__${digitsOnly(r.telefone ?? "")}`;
    const cliente: Cliente = clientesMap.get(clienteKey) ?? (() => {
      const c: Cliente = { id: simpleId("cli"), nome: r.nome, telefone: r.telefone };
      clientesMap.set(clienteKey, c);
      return c;
    })();

    const numTitulosRaw = r.numeroTitulo ? r.numeroTitulo.split(/[;,|]/).map(s => s.trim()).filter(Boolean) : [undefined];

    for (const nt of numTitulosRaw) {
      const numeroNF = r.numeroNF || "NF-N/D";
      const chaveMatch = `${numeroNF}__${r.valorPrincipal.toFixed(2)}`;

      titulos.push({
        id: simpleId("tit"),
        clienteId: cliente.id,
        numeroNF,
        numeroTitulo: nt,
        valorPrincipal: r.valorPrincipal,
        juros: r.juros,
        total: r.total,
        diasAtraso: r.diasAtraso,
        status: r.diasAtraso > 0 ? "VENCIDO" : "ABERTO",
        chaveMatch,
        createdAt: new Date().toISOString(),
        ultimoDisparo: null,
      });
    }
  }

  return { clientes: Array.from(clientesMap.values()), titulos };
}
