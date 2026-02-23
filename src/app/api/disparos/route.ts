import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Disparo, Titulo, Cliente } from "@/lib/models";
import { enviarMensagem } from "@/lib/zapi";
import { buildMensagemCobranca } from "@/lib/mensagem";

// GET /api/disparos  ← Lista todos os disparos
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const query = status ? { status } : {};
    const disparos = await Disparo.find(query)
      .populate("clienteId", "nome telefone")
      .populate("tituloId", "numeroNF total diasAtraso")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(disparos);
  } catch (err) {
    console.error("[GET /api/disparos] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro ao buscar disparos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/disparos  ← Envia disparo via Z-API
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { tituloId, template: templateNome } = body;

    if (!tituloId || !templateNome) {
      return NextResponse.json(
        { error: "tituloId e template são obrigatórios" },
        { status: 400 }
      );
    }

    // Busca título e cliente
    const titulo = await Titulo.findById(tituloId).lean() as any;
    if (!titulo) {
      return NextResponse.json({ error: "Título não encontrado" }, { status: 404 });
    }

    const cliente = await Cliente.findById(titulo.clienteId).lean() as any;
    if (!cliente) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    if (!cliente.telefone) {
      return NextResponse.json({ error: "Cliente sem telefone cadastrado" }, { status: 400 });
    }

    // Monta mensagem usando o mesmo template do frontend
    const mensagem = buildMensagemCobranca(
      [{
        numeroNF: titulo.numeroNF,
        numeroTitulo: titulo.numeroTitulo,
        vencimento: titulo.vencimento,
        valorPrincipal: titulo.valorPrincipal,
        juros: titulo.juros,
        total: titulo.total,
        diasAtraso: titulo.diasAtraso,
      }],
      cliente.nome,
      templateNome
    );

    // Cria registro PENDENTE no banco
    const disparo = await Disparo.create({
      clienteId: cliente._id,
      tituloId: titulo._id,
      status: "PENDENTE",
      template: templateNome,
      mensagemEnviada: mensagem,
    });

    // Envia via Z-API
    const resultado = await enviarMensagem(cliente.telefone, mensagem);

    // Atualiza status do disparo com resultado
    const novoStatus = resultado.success ? "ENVIADO" : "FALHOU";
    await Disparo.findByIdAndUpdate(disparo._id, {
      status: novoStatus,
      resposta: resultado.success
        ? `zaapId: ${resultado.zaapId}`
        : resultado.error,
    });

    // Atualiza data do último disparo no título
    if (resultado.success) {
      await Titulo.findByIdAndUpdate(tituloId, { ultimoDisparo: new Date() });
    }

    return NextResponse.json({
      ok: resultado.success,
      status: novoStatus,
      disparo: disparo._id,
      zaapId: resultado.zaapId,
      error: resultado.error,
    }, { status: resultado.success ? 200 : 422 });

  } catch (err) {
    console.error("[POST /api/disparos] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro interno ao disparar mensagem";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
