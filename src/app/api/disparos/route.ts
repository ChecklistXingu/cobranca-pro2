import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Disparo, Titulo, Cliente } from "@/lib/models";
import { enviarMensagem, enviarDocumento } from "@/lib/zapi";
import { buildMensagemCobranca } from "@/lib/mensagem";
import { Types } from "mongoose";

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

    // Transformar para formato esperado pelo frontend
    const disparosTransformados = disparos.map((d: any) => {
      const clienteObj = d.clienteId && typeof d.clienteId === "object" ? d.clienteId : null;
      const tituloObj = d.tituloId && typeof d.tituloId === "object" ? d.tituloId : null;

      return {
        id: String(d._id),
        clienteId: clienteObj ? String(clienteObj._id) : (d.clienteId ? String(d.clienteId) : ""),
        clienteNome: clienteObj?.nome ?? "",
        clienteTelefone: clienteObj?.telefone ?? "",
        tituloId: tituloObj ? String(tituloObj._id) : (d.tituloId ? String(d.tituloId) : ""),
        numeroNF: tituloObj?.numeroNF ?? "",
        totalTitulo: tituloObj ? Number(tituloObj.total || 0) : 0,
      status: d.status,
      template: d.template,
      resposta: d.resposta || '',
      data: d.createdAt,
      };
    });

    return NextResponse.json(disparosTransformados);
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
    const { tituloId, chaveMatch, template: templateNome, anexos } = body;

    if ((!tituloId && !chaveMatch) || !templateNome) {
      return NextResponse.json(
        { error: "tituloId (ou chaveMatch) e template são obrigatórios" },
        { status: 400 }
      );
    }

    // Busca título e cliente
    let titulo: any = null;

    if (tituloId && Types.ObjectId.isValid(String(tituloId))) {
      titulo = await Titulo.findById(tituloId).lean() as any;
    }

    if (!titulo && chaveMatch) {
      titulo = await Titulo.findOne({ chaveMatch: String(chaveMatch) }).lean() as any;
    }

    if (!titulo && tituloId && !Types.ObjectId.isValid(String(tituloId))) {
      titulo = await Titulo.findOne({ chaveMatch: String(tituloId) }).lean() as any;
    }

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

    // Envia texto via Z-API
    const resultadoTexto = await enviarMensagem(cliente.telefone, mensagem);

    // Envia anexos (documentos), se houver
    const anexosArray: Array<{
      document: string;
      fileName?: string;
      caption?: string;
      extension?: string;
    }> = Array.isArray(anexos) ? anexos.slice(0, 5) : [];

    const resultadosDocs = [];
    if (resultadoTexto.success && anexosArray.length > 0) {
      for (let i = 0; i < anexosArray.length; i++) {
        const anexo = anexosArray[i];
        const ext =
          (anexo.extension || "pdf").toLowerCase().replace(/^\./, "") || "pdf";
        const r = await enviarDocumento(cliente.telefone, anexo.document, {
          fileName:
            anexo.fileName ||
            `anexo-${i + 1}.${ext}`,
          caption: anexo.caption,
          extension: ext,
        });
        resultadosDocs.push(r);
      }
    }

    const todosDocsOk =
      resultadosDocs.length === 0 ||
      resultadosDocs.every((r) => r.success);
    const sucessoGeral = resultadoTexto.success && todosDocsOk;

    // Atualiza status do disparo com resultado
    const novoStatus = sucessoGeral ? "ENVIADO" : "FALHOU";
    await Disparo.findByIdAndUpdate(disparo._id, {
      status: novoStatus,
      resposta: sucessoGeral
        ? `texto OK (zaapId: ${resultadoTexto.zaapId})${
            resultadosDocs.length
              ? `; docs: ${resultadosDocs.filter((r) => r.success).length}/${
                  resultadosDocs.length
                } OK`
              : ""
          }`
        : resultadoTexto.error ||
          resultadosDocs.find((r) => !r.success)?.error ||
          "Falha ao enviar mensagem/documentos",
    });

    // Atualiza data do último disparo no título
    if (sucessoGeral) {
      await Titulo.findByIdAndUpdate(titulo._id, { ultimoDisparo: new Date() });
    }

    return NextResponse.json({
      ok: sucessoGeral,
      status: novoStatus,
      disparo: disparo._id,
      zaapId: resultadoTexto.zaapId,
      error: sucessoGeral
        ? undefined
        : resultadoTexto.error ||
          resultadosDocs.find((r) => !r.success)?.error,
    }, { status: sucessoGeral ? 200 : 422 });

  } catch (err) {
    console.error("[POST /api/disparos] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro interno ao disparar mensagem";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
