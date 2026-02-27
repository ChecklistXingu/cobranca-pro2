import mongoose from "mongoose";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global._mongooseCache ?? { conn: null, promise: null };
global._mongooseCache = cached;

export async function connectDB(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI não definida no ambiente");
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    console.log("[MongoDB] Iniciando conexão ao banco de dados...");
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 30_000,
    }).then((mongooseInstance) => {
      console.log("[MongoDB] Conexão estabelecida com sucesso!");
      cached.conn = mongooseInstance;
      return mongooseInstance;
    }).catch((error) => {
      console.error("[MongoDB] Erro ao conectar:", error);
      cached.promise = null;
      throw error;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export async function warmupDB() {
  try {
    await connectDB();
  } catch (error) {
    console.error("[MongoDB] Falha ao aquecer conexão", error);
  }
}
