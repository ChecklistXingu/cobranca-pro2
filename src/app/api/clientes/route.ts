import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Cliente } from "@/lib/models";

// GET /api/clientes
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";

    const query = search
      ? { nome: { $regex: search, $options: "i" } }
      : {};

    const clientes = await Cliente.find(query).sort({ nome: 1 }).lean();
    return NextResponse.json(clientes);
  } catch (err) {
    console.error("[GET /api/clientes] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro ao buscar clientes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/clientes
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();

    if (!body.nome) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    const cliente = await Cliente.create(body);
    return NextResponse.json(cliente, { status: 201 });
  } catch (err) {
    console.error("[POST /api/clientes] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro ao criar cliente";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
