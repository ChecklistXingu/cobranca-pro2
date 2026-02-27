/**
 * Script para remover o índice problemático 'id_1' da coleção clientes
 * Execute com: node scripts/remove-id-index.js
 */

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('[Migration] ❌ MONGODB_URI não definida!');
  console.error('[Migration] Execute: set MONGODB_URI=sua_string_de_conexao');
  process.exit(1);
}

async function removeIndex() {
  try {
    console.log('[Migration] Conectando ao MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('[Migration] Conectado com sucesso!');

    const db = mongoose.connection.db;
    const collection = db.collection('clientes');

    // Lista todos os índices
    const indexes = await collection.indexes();
    console.log('[Migration] Índices existentes:', indexes.map(i => i.name));

    // Verifica se o índice id_1 existe
    const hasIdIndex = indexes.some(i => i.name === 'id_1');
    
    if (hasIdIndex) {
      console.log('[Migration] Removendo índice id_1...');
      await collection.dropIndex('id_1');
      console.log('[Migration] ✅ Índice id_1 removido com sucesso!');
    } else {
      console.log('[Migration] ℹ️  Índice id_1 não encontrado (já foi removido ou nunca existiu)');
    }

    await mongoose.disconnect();
    console.log('[Migration] Desconectado do MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('[Migration] ❌ Erro:', error);
    process.exit(1);
  }
}

removeIndex();
