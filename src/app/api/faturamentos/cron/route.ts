import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Disparo, Faturamento } from "@/lib/models";
import { enviarMensagem } from "@/lib/zapi";

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const agora = new Date();

    const pendentes = await Faturamento.find({
      statusLembrete: "PENDENTE",
      lembreteAgendadoPara: { $lte: agora },
    }).lean();

    let enviados = 0;
    let falhas = 0;

    for (const f of pendentes as any[]) {
      const valorFmt = Number(f.valor || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
      const dataVencFmt = new Date(f.dataVencimento).toLocaleDateString("pt-BR");

      const mensagem = [
        "Olá, aqui é da empresa Força Agrícola tudo bem? :)",
        "",
        `Passando para lembrar que o boleto referente à sua compra no valor de ${valorFmt} vence em ${dataVencFmt}.`,
        "",
        "A nota fiscal e o boleto já foram enviados anteriormente, mas, se precisar de uma nova via, é só nos avisar.",
        "",
        "Estamos à disposição.",
        "",
        "Atenciosamente,",
        "Equipe Financeira",
      ].join("\n");

      const telefone = String(f.telefone || "");
      const resultado = await enviarMensagem(telefone, mensagem);

      const sucesso = resultado.success;
      if (sucesso) enviados++;
      else falhas++;

      await Faturamento.findByIdAndUpdate(f._id, {
        statusLembrete: sucesso ? "ENVIADO" : "FALHOU",
      });

      await Disparo.create({
        clienteId: f.clienteId ?? undefined,
        tituloId: null,
        tipo: "FATURAMENTO_LEMBRETE",
        status: sucesso ? "ENVIADO" : "FALHOU",
        template: "FaturamentoLembrete",
        mensagemEnviada: mensagem,
        resposta: sucesso
          ? `zaapId: ${resultado.zaapId}`
          : resultado.error,
      });
    }

    return NextResponse.json({
      ok: true,
      processados: pendentes.length,
      enviados,
      falhas,
    });
  } catch (err) {
    console.error("[GET /api/faturamentos/cron] Erro:", err);
    const message =
      err instanceof Error ? err.message : "Erro ao processar faturamentos pendentes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

