import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Cliente, Disparo, Faturamento } from "@/lib/models";
import { enviarMensagem, enviarDocumento } from "@/lib/zapi";

function parseDateToBRT(dateStr: string, hour: number, minute = 0) {
  // Cria uma data no horário de Brasília (UTC-3) a partir de YYYY-MM-DD
  const base = `${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-03:00`;
  return new Date(base);
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const dia = searchParams.get("dia"); // opcional: filtrar por dia de faturamento (YYYY-MM-DD)

    const query: Record<string, unknown> = {};
    if (dia) {
      const inicio = parseDateToBRT(dia, 0);
      const fim = parseDateToBRT(dia, 23, 59);
      query.dataFaturamento = { $gte: inicio, $lte: fim };
    }

    const faturamentos = await Faturamento.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const mapped = faturamentos.map((f: any) => ({
      ...f,
      id: String(f._id),
      _id: undefined,
    }));

    return NextResponse.json(mapped);
  } catch (err) {
    console.error("[GET /api/faturamentos] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro ao buscar faturamentos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();

    const {
      nome,
      telefone,
      dataFaturamento,
      dataVencimento,
      valor,
      agendarEmDias = 0,
      anexos,
    } = body;

    if (!nome || !telefone || !dataFaturamento || !dataVencimento || valor === undefined) {
      return NextResponse.json(
        { error: "Campos obrigatórios: nome, telefone, dataFaturamento, dataVencimento, valor" },
        { status: 400 }
      );
    }

    const phone = String(telefone);
    const valorNumber = Number(valor);
    if (!valorNumber || Number.isNaN(valorNumber)) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }

    // Normalizar datas
    const dataFat = new Date(dataFaturamento);
    const dataVenc = new Date(dataVencimento);

    if (dataVenc.getTime() < dataFat.getTime()) {
      return NextResponse.json({ error: "Data de vencimento não pode ser anterior ao faturamento" }, { status: 400 });
    }

    // Tenta vincular a um Cliente existente pelo nome/telefone (opcional)
    const clienteExistente = await Cliente.findOne({
      nome,
      telefone,
    }).lean<{ _id: string } | null>();

    const clienteId = clienteExistente?._id;

    // Calcula data de lembrete agendado
    const dias = Math.max(0, Math.min(30, Number(agendarEmDias) || 0));
    let lembreteAgendadoPara: Date | undefined;
    let statusLembrete: "PENDENTE" | "ENVIADO" | "FALHOU" | "DESATIVADO" = "DESATIVADO";

    if (dias > 0) {
      const baseStr = new Date(dataFaturamento).toISOString().split("T")[0]!;
      const base = parseDateToBRT(baseStr, 9); // 09:00 BRT
      base.setDate(base.getDate() + dias);
      lembreteAgendadoPara = base;
      statusLembrete = "PENDENTE";
    }

    // Cria registro de faturamento
    const faturamento = await Faturamento.create({
      clienteId,
      nome,
      telefone: phone,
      dataFaturamento: dataFat,
      dataVencimento: dataVenc,
      valor: valorNumber,
      agendarEmDias: dias,
      lembreteAgendadoPara,
      statusLembrete,
    });

    // Monta mensagem de faturamento
    const valorFmt = valorNumber.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const dataVencFmt = dataVenc.toLocaleDateString("pt-BR");

    const mensagem = [
      "Olá, aqui é da empresa Força Agrícola :)",
      "",
      "Obrigado pela sua compra!",
      "",
      `Informamos que o pagamento vence em ${dataVencFmt}, no valor de ${valorFmt}.`,
      "Segue em anexo a nota fiscal e o boleto.",
      "",
      "Ficamos à disposição em caso de dúvidas.",
      "",
      "Atenciosamente,",
      "Equipe Financeira",
    ].join("\n");

    // Envia mensagem inicial e anexos
    const resultadoTexto = await enviarMensagem(phone, mensagem);

    const anexosArray: Array<{
      document: string;
      fileName?: string;
      extension?: string;
    }> = Array.isArray(anexos) ? anexos.slice(0, 5) : [];

    const resultadosDocs = [];
    if (resultadoTexto.success && anexosArray.length > 0) {
      for (let i = 0; i < anexosArray.length; i++) {
        const anexo = anexosArray[i];
        const ext = (anexo.extension || "pdf").toLowerCase().replace(/^\./, "") || "pdf";
        const r = await enviarDocumento(phone, anexo.document, {
          fileName: anexo.fileName || `faturamento-${i + 1}.${ext}`,
          extension: ext,
        });
        resultadosDocs.push(r);
      }
    }

    const todosDocsOk =
      resultadosDocs.length === 0 ||
      resultadosDocs.every((r) => r.success);
    const sucessoGeral = resultadoTexto.success && todosDocsOk;

    // Cria registro de disparo
    await Disparo.create({
      clienteId: clienteId ?? undefined,
      tituloId: null,
      tipo: "FATURAMENTO_INSTANTANEO",
      status: sucessoGeral ? "ENVIADO" : "FALHOU",
      template: "Faturamento",
      mensagemEnviada: mensagem,
      resposta: sucessoGeral
        ? `texto OK (zaapId: ${resultadoTexto.zaapId})${
            resultadosDocs.length
              ? `; docs: ${resultadosDocs.filter((r) => r.success).length}/${resultadosDocs.length} OK`
              : ""
          }`
        : resultadoTexto.error ||
          resultadosDocs.find((r) => !r.success)?.error ||
          "Falha ao enviar mensagem/documentos",
    });

    return NextResponse.json(
      {
        ok: sucessoGeral,
        faturamentoId: faturamento._id,
        statusLembrete,
      },
      { status: sucessoGeral ? 200 : 422 }
    );
  } catch (err) {
    console.error("[POST /api/faturamentos] Erro:", err);
    const message = err instanceof Error ? err.message : "Erro ao registrar faturamento";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

