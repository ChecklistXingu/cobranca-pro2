import mongoose from "mongoose";

// Cache global para evitar múltiplas conexões
declare global {
  // eslint-disable-next-line no-var
  var _mongooseConn: Promise<typeof mongoose> | null;
}

let cached = global._mongooseConn;

export async function connectDB(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI não definida no ambiente");
  }

  if (cached) {
    return cached;
  }

  if (!cached) {
    console.log("[MongoDB] Iniciando conexão ao banco de dados...");
    cached = mongoose.connect(uri, {
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
