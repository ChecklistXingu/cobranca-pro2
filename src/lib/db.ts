import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI não definida no .env.local");
}

// Cache global para evitar múltiplas conexões em dev (hot reload)
declare global {
  // eslint-disable-next-line no-var
  var _mongooseConn: typeof mongoose | null;
}

let cached = global._mongooseConn;

export async function connectDB(): Promise<typeof mongoose> {
  if (cached) return cached;

  try {
    console.log("[MongoDB] Conectando ao banco de dados...");
    cached = await mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
    console.log("[MongoDB] Conexão estabelecida com sucesso!");
    global._mongooseConn = cached;
    return cached;
  } catch (error) {
    console.error("[MongoDB] Erro ao conectar:", error);
    throw error;
  }
}
