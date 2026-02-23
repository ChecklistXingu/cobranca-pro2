import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI não definida no .env.local");
}

// Cache global para evitar múltiplas conexões
declare global {
  // eslint-disable-next-line no-var
  var _mongooseConn: Promise<typeof mongoose> | null;
}

let cached = global._mongooseConn;

export async function connectDB(): Promise<typeof mongoose> {
  if (cached) {
    return cached;
  }

  if (!cached) {
    console.log("[MongoDB] Iniciando conexão ao banco de dados...");
    cached = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    }).then((mongoose) => {
      console.log("[MongoDB] Conexão estabelecida com sucesso!");
      return mongoose;
    }).catch((error) => {
      console.error("[MongoDB] Erro ao conectar:", error);
      cached = null; // Reset cache on error
      throw error;
    });
    
    global._mongooseConn = cached;
  }

  return cached;
}
