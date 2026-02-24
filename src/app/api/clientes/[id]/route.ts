import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Cliente } from "@/lib/models";

// PATCH /api/clientes/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    const body = await req.json();

    const cliente = await Cliente.findByIdAndUpdate(
      params.id,
      { $set: body },
      { new: true }
    );

    if (!cliente) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(cliente);
  } catch (err) {
    console.error("[PATCH /api/clientes/[id]] Erro:", err);
    const message =
      err instanceof Error ? err.message : "Erro ao atualizar cliente";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

