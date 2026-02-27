import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Cliente, Titulo } from "@/lib/models";

// POST /api/importar  ← Recebe carteira parseada do frontend e salva no MongoDB
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { clientes: clientesPayload, titulos: titulosPayload, dataReferencia } = await req.json();

    if (!Array.isArray(clientesPayload) || !Array.isArray(titulosPayload)) {
      return NextResponse.json({ error: "Payload inválido: esperado { clientes[], titulos[] }" }, { status: 400 });
    }

    const clienteIdMap = new Map<string, string>(); // frontendId → mongoId

    // Salva clientes (upsert por nome + telefone para evitar duplicatas)
    const clientesSalvos = [];
    for (const c of clientesPayload) {
      const existing = await Cliente.findOne({
        nome: c.nome,
        telefone: c.telefone || { $exists: false },
      });

      if (existing) {
        clienteIdMap.set(c.id, String(existing._id));
        clientesSalvos.push(existing);
      } else {
        const novo = await Cliente.create({ nome: c.nome, telefone: c.telefone });
        clienteIdMap.set(c.id, String(novo._id));
        clientesSalvos.push(novo);
      }
    }

    // Salva títulos (evita duplicata por chaveMatch)
    const titulosSalvos = [];
    let duplicados = 0;
    for (const t of titulosPayload) {
      const mongoClienteId = clienteIdMap.get(t.clienteId);
      if (!mongoClienteId) continue;

      const existing = await Titulo.findOne({ chaveMatch: t.chaveMatch });
      if (existing) {
        duplicados++;
        continue;
      }

      const referenciaDate = t.dataReferenciaImportacao
        ? new Date(t.dataReferenciaImportacao)
        : dataReferencia
        ? new Date(dataReferencia)
        : undefined;
      const tipoImportacao = t.tipoImportacao ?? (t.diasAtraso > 0 ? "TITULO" : "LEMBRETE");

      const novo = await Titulo.create({
        clienteId: mongoClienteId,
        numeroNF: t.numeroNF,
        numeroTitulo: t.numeroTitulo,
        vencimento: t.vencimento || null,
        valorPrincipal: t.valorPrincipal,
        juros: t.juros,
        total: t.total,
        diasAtraso: t.diasAtraso,
        status: t.status,
        chaveMatch: t.chaveMatch,
        tipoImportacao,
        dataReferenciaImportacao: referenciaDate,
      });
      titulosSalvos.push(novo);
    }

    return NextResponse.json({
      ok: true,
      clientesSalvos: clientesSalvos.length,
      titulosSalvos: titulosSalvos.length,
      duplicados,
    }, { status: 201 });

  } catch (err) {
    console.error("[POST /api/importar] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro ao importar dados";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/importar?data=YYYY-MM-DD  ← Remove títulos e clientes importados em data específica
export async function DELETE(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const data = searchParams.get("data");

    if (!data) {
      return NextResponse.json({ error: "Parâmetro 'data' é obrigatório (formato: YYYY-MM-DD)" }, { status: 400 });
    }

    // Converter data para range (início e fim do dia)
    const dataInicio = new Date(data);
    dataInicio.setHours(0, 0, 0, 0);
    
    const dataFim = new Date(data);
    dataFim.setHours(23, 59, 59, 999);

    // Deletar títulos criados nessa data
    const resultTitulos = await Titulo.deleteMany({
      createdAt: { $gte: dataInicio, $lte: dataFim }
    });

    // Deletar clientes criados nessa data que não têm mais títulos
    const clientesComTitulos = await Titulo.distinct("clienteId");
    const resultClientes = await Cliente.deleteMany({
      createdAt: { $gte: dataInicio, $lte: dataFim },
      _id: { $nin: clientesComTitulos }
    });

    console.log(`[DELETE /api/importar] Removidos ${resultTitulos.deletedCount} títulos e ${resultClientes.deletedCount} clientes da data ${data}`);

    return NextResponse.json({
      ok: true,
      deletedTitulos: resultTitulos.deletedCount,
      deletedClientes: resultClientes.deletedCount,
    });

  } catch (err) {
    console.error("[DELETE /api/importar] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro ao limpar dados";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
