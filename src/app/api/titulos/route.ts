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
    const tipo = searchParams.get("tipo");
    const dataRefInicio = searchParams.get("dataRefInicio");
    const dataRefFim = searchParams.get("dataRefFim");
    const view = searchParams.get("view") ?? "list";
    const paginated = searchParams.has("paginated");
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const rawPageSize = Number(searchParams.get("pageSize") ?? "200");
    const pageSize = Math.min(500, Math.max(10, Number.isNaN(rawPageSize) ? 200 : rawPageSize));
    const skip = (page - 1) * pageSize;

    const query: Record<string, unknown> = {};
    if (status && status !== "TODOS") query.status = status;
    if (clienteId) query.clienteId = clienteId;
    if (tipo && tipo !== "TODOS") query.tipoImportacao = tipo;

    if (dataRefInicio || dataRefFim) {
      const range: Record<string, Date> = {};
      if (dataRefInicio) {
        const start = new Date(dataRefInicio);
        if (!Number.isNaN(start.getTime())) {
          start.setHours(0, 0, 0, 0);
          range.$gte = start;
        }
      }
      if (dataRefFim) {
        const end = new Date(dataRefFim);
        if (!Number.isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          range.$lte = end;
        }
      }
      if (Object.keys(range).length) {
        query.dataReferenciaImportacao = range;
      }
    }

    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { numeroNF: regex },
        { numeroTitulo: regex },
      ];
    }

    const projections: Record<string, number> | undefined = view === "full" ? undefined : {
      clienteId: 1,
      numeroNF: 1,
      numeroTitulo: 1,
      valorPrincipal: 1,
      juros: 1,
      total: 1,
      diasAtraso: 1,
      status: 1,
      chaveMatch: 1,
      ultimoDisparo: 1,
      tipoImportacao: 1,
      dataReferenciaImportacao: 1,
      vencimento: 1,
      createdAt: 1,
    };

    if (paginated) {
      const [titulos, total] = await Promise.all([
        Titulo.find(query, projections)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(pageSize)
          .lean(),
        Titulo.countDocuments(query),
      ]);

      const titulosTransformados = titulos.map((t: any) => ({
        ...t,
        id: String(t._id),
        clienteId: String(t.clienteId),
        valorPrincipal: Number(t.valorPrincipal || 0),
        juros: Number(t.juros || 0),
        total: Number(t.total || 0),
        diasAtraso: Number(t.diasAtraso || 0),
        _id: undefined,
      }));

      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      return NextResponse.json({
        items: titulosTransformados,
        meta: {
          total,
          page,
          pageSize,
          totalPages,
          hasMore: page < totalPages,
        },
      });
    }

    const titulos = await Titulo.find(query, projections)
      .sort({ createdAt: -1 })
      .lean();

    const titulosTransformados = titulos.map((t: any) => ({
      ...t,
      id: String(t._id),
      clienteId: String(t.clienteId),
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
