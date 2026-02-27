import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Titulo } from "@/lib/models";

// GET /api/titulos
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const clienteId = searchParams.get("clienteId");
    const search = searchParams.get("search");

    const query: Record<string, unknown> = {};
    if (status && status !== "TODOS") query.status = status;
    if (clienteId) query.clienteId = clienteId;

    let titulos = await Titulo.find(query)
      .populate("clienteId", "nome telefone documento")
      .sort({ createdAt: -1 })
      .lean();

    // Filtro por busca (nome do cliente ou NF)
    if (search) {
      titulos = titulos.filter((t: any) =>
        t.numeroNF?.includes(search) ||
        t.numeroTitulo?.includes(search) ||
        (t.clienteId as any)?.nome?.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Transformar _id para id e clienteId._id para clienteId
    const titulosTransformados = titulos.map((t: any) => ({
      ...t,
      id: String(t._id),
      clienteId: typeof t.clienteId === 'object' ? String(t.clienteId._id) : String(t.clienteId),
      valorPrincipal: Number(t.valorPrincipal || 0),
      juros: Number(t.juros || 0),
      total: Number(t.total || 0),
      diasAtraso: Number(t.diasAtraso || 0),
      _id: undefined,
    }));

    return NextResponse.json(titulosTransformados);
  } catch (err) {
    console.error("[GET /api/titulos] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro ao buscar títulos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/titulos
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();

    const required = ["clienteId", "numeroNF", "valorPrincipal", "total"];
    for (const field of required) {
      if (body[field] === undefined || body[field] === "") {
        return NextResponse.json({ error: `Campo obrigatório: ${field}` }, { status: 400 });
      }
    }

    const chaveMatch = body.chaveMatch || `${body.numeroNF}__${Number(body.valorPrincipal).toFixed(2)}`;
    const titulo = await Titulo.create({ ...body, chaveMatch });
    return NextResponse.json(titulo, { status: 201 });
  } catch (err) {
    console.error("[POST /api/titulos] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro ao criar título";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
