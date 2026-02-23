// API routes para o novo frontend Cobrança Pro
import express from 'express';
import { getDb } from './utils/db';
import { ObjectId } from 'mongodb';
import { sendWhatsapp } from './utils/zapi';

export function setupCobrancaProRoutes(app: express.Application) {
  // GET /api/titulos - lista todos os títulos
  app.get('/api/titulos', async (req, res) => {
    try {
      const db = getDb();
      const titulos = await db.collection('titles').find({}).toArray();
      res.json(titulos.map(t => ({ ...t, id: t._id?.toString() })));
    } catch (e: any) {
      console.error('[GET /api/titulos] erro:', e);
      res.status(500).json({ error: e?.message || 'Erro ao buscar títulos' });
    }
  });

  // POST /api/titulos - cria múltiplos títulos (importação)
  app.post('/api/titulos', async (req, res) => {
    try {
      const { clientes, titulos } = req.body;
      if (!clientes || !titulos || !Array.isArray(clientes) || !Array.isArray(titulos)) {
        return res.status(400).json({ error: 'Clientes e titulos devem ser arrays' });
      }

      const db = getDb();
      
      // Upsert de clientes
      for (const cliente of clientes) {
        await db.collection('customers').updateOne(
          { nome: cliente.nome, telefone: cliente.telefone },
          { $set: cliente },
          { upsert: true }
        );
      }

      // Inserir títulos
      const result = await db.collection('titles').insertMany(titulos);
      
      res.json({ 
        ok: true, 
        insertedCount: result.insertedCount,
        message: `${result.insertedCount} títulos importados com sucesso`
      });
    } catch (e: any) {
      console.error('[POST /api/titulos] erro:', e);
      res.status(500).json({ error: e?.message || 'Erro ao importar títulos' });
    }
  });

  // DELETE /api/titulos?data=YYYY-MM-DD - limpa títulos por data
  app.delete('/api/titulos', async (req, res) => {
    try {
      const { data } = req.query;
      if (!data || typeof data !== 'string') {
        return res.status(400).json({ error: 'Parâmetro data obrigatório' });
      }

      const db = getDb();
      const startOfDay = new Date(data + 'T00:00:00.000Z');
      const endOfDay = new Date(data + 'T23:59:59.999Z');
      
      const result = await db.collection('titles').deleteMany({
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      });

      res.json({ ok: true, deletedCount: result.deletedCount });
    } catch (e: any) {
      console.error('[DELETE /api/titulos] erro:', e);
      res.status(500).json({ error: e?.message || 'Erro ao limpar títulos' });
    }
  });

  // GET /api/clientes - lista todos os clientes
  app.get('/api/clientes', async (req, res) => {
    try {
      const db = getDb();
      const clientes = await db.collection('customers').find({}).toArray();
      res.json(clientes.map(c => ({ ...c, id: c._id?.toString() })));
    } catch (e: any) {
      console.error('[GET /api/clientes] erro:', e);
      res.status(500).json({ error: e?.message || 'Erro ao buscar clientes' });
    }
  });

  // POST /api/clientes - cria um cliente
  app.post('/api/clientes', async (req, res) => {
    try {
      const { nome, telefone } = req.body;
      if (!nome?.trim()) {
        return res.status(400).json({ error: 'Nome obrigatório' });
      }

      const db = getDb();
      const result = await db.collection('customers').insertOne({
        nome: nome.trim(),
        telefone: telefone?.trim() || null,
        createdAt: new Date()
      });

      const cliente = await db.collection('customers').findOne({ _id: result.insertedId });
      res.json({ ...cliente, id: cliente._id?.toString() });
    } catch (e: any) {
      console.error('[POST /api/clientes] erro:', e);
      res.status(500).json({ error: e?.message || 'Erro ao criar cliente' });
    }
  });

  // GET /api/disparos - lista todos os disparos
  app.get('/api/disparos', async (req, res) => {
    try {
      const db = getDb();
      const disparos = await db.collection('messages').find({}).toArray();
      res.json(disparos.map(d => ({ ...d, id: d._id?.toString() })));
    } catch (e: any) {
      console.error('[GET /api/disparos] erro:', e);
      res.status(500).json({ error: e?.message || 'Erro ao buscar disparos' });
    }
  });

  // POST /api/disparos - envia mensagem via Z-API
  app.post('/api/disparos', async (req, res) => {
    try {
      const { tituloId, template } = req.body;
      if (!tituloId || !template) {
        return res.status(400).json({ error: 'tituloId e template obrigatórios' });
      }

      const db = getDb();
      
      // Buscar título e cliente
      const titulo = await db.collection('titles').findOne({ _id: new ObjectId(tituloId) });
      if (!titulo) {
        return res.status(404).json({ error: 'Título não encontrado' });
      }

      const cliente = await db.collection('customers').findOne({ nome: titulo.customerName });
      if (!cliente?.telefone) {
        return res.status(400).json({ error: 'Cliente não possui telefone' });
      }

      // Enviar mensagem via Z-API
      const messageBody = buildMessageTemplate(template, titulo, cliente);
      const result = await sendWhatsapp(cliente.telefone, messageBody);

      // Registrar disparo
      await db.collection('messages').insertOne({
        tituloId: titulo._id,
        customerId: cliente._id,
        phone: cliente.telefone,
        template,
        message: messageBody,
        status: result.ok ? 'sent' : 'failed',
        error: result.ok ? null : result.error,
        sentAt: new Date()
      });

      res.json({ ok: result.ok, error: result.error });
    } catch (e: any) {
      console.error('[POST /api/disparos] erro:', e);
      res.status(500).json({ error: e?.message || 'Erro ao enviar mensagem' });
    }
  });

  // GET /api/recebimentos - lista todos os recebimentos
  app.get('/api/recebimentos', async (req, res) => {
    try {
      const db = getDb();
      const recebimentos = await db.collection('receipts').find({}).toArray();
      res.json(recebimentos.map(r => ({ ...r, id: r._id?.toString() })));
    } catch (e: any) {
      console.error('[GET /api/recebimentos] erro:', e);
      res.status(500).json({ error: e?.message || 'Erro ao buscar recebimentos' });
    }
  });

  // POST /api/recebimentos - lança um recebimento
  app.post('/api/recebimentos', async (req, res) => {
    try {
      const { tituloId, valorRecebido, forma, data, observacao, parcial } = req.body;
      
      if (!tituloId || !valorRecebido || !forma || !data) {
        return res.status(400).json({ error: 'Campos obrigatórios faltando' });
      }

      const db = getDb();
      
      // Buscar título
      const titulo = await db.collection('titles').findOne({ _id: new ObjectId(tituloId) });
      if (!titulo) {
        return res.status(404).json({ error: 'Título não encontrado' });
      }

      // Inserir recebimento
      await db.collection('receipts').insertOne({
        tituloId: titulo._id,
        valorRecebido: Number(valorRecebido),
        forma,
        data: new Date(data),
        observacao: observacao || null,
        parcial: Boolean(parcial),
        createdAt: new Date()
      });

      // Atualizar status do título
      const novoStatus = (!parcial && Number(valorRecebido) >= Number(titulo.total)) ? 'RECEBIDO' : titulo.status;
      await db.collection('titles').updateOne(
        { _id: titulo._id },
        { $set: { status: novoStatus, receivedAt: new Date() } }
      );

      res.json({ ok: true, message: 'Recebimento lançado com sucesso' });
    } catch (e: any) {
      console.error('[POST /api/recebimentos] erro:', e);
      res.status(500).json({ error: e?.message || 'Erro ao lançar recebimento' });
    }
  });

  // Helper para construir mensagem de template
  function buildMessageTemplate(template: string, titulo: any, cliente: any): string {
    const templates: Record<string, string> = {
      'Vencido': `Olá ${cliente.nome}! Identificamos um título em aberto:\n\n📄 NF: ${titulo.invoiceNumber || titulo.numeroNF}\n💰 Valor: R$ ${Number(titulo.total).toFixed(2)}\n📅 Vencimento: ${new Date(titulo.dueDate).toLocaleDateString('pt-BR')}\n\nPor favor, regularize sua situação.`,
      'Cobrança': `Prezado(a) ${cliente.nome},\n\nVerificamos pendência financeira:\n\n• Título: ${titulo.invoiceNumber || titulo.numeroNF}\n• Valor: R$ ${Number(titulo.total).toFixed(2)}\n• Vencimento: ${new Date(titulo.dueDate).toLocaleDateString('pt-BR')}\n\nEntre em contato para negociação.`,
      'Negociação': `${cliente.nome}, seu título ${titulo.invoiceNumber || titulo.numeroNF} no valor de R$ ${Number(titulo.total).toFixed(2)} venceu em ${new Date(titulo.dueDate).toLocaleDateString('pt-BR')}. Gostaria de negociar?`
    };
    
    return templates[template] || templates['Vencido'];
  }
}
