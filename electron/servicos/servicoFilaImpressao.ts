import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { ServicoImpressao } from './servicoImpressao'
import {
  ConfiguracaoAplicacao,
  DadosTicketImpressao,
  EntradaLog,
  EscopoFilaImpressao,
  EstadoAplicacao,
  EstadoConexao,
  ItemTicket,
  PedidoLista,
  PedidoTicket,
  RegistroFilaImpressao,
  TipoFilaImpressao
} from './tipos'

type CallbacksServicoFila = {
  onAtualizarEstado: (estadoParcial: Partial<EstadoAplicacao>) => void
  onLog: (entrada: EntradaLog) => void
}

const LIMITE_LOGS = 250
const LIMITE_PEDIDOS = 120
const LIMITE_FILA = 180

const gerarIdentificadorLog = () => randomUUID()

const paraNumero = (valor: unknown) => Number(valor || 0)

const paraTexto = (valor: unknown) => {
  if (valor === null || valor === undefined) return null
  return String(valor)
}

const paraInteiro = (valor: unknown) => {
  if (valor === null || valor === undefined || valor === '') return null
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return null
  return Math.trunc(numero)
}

const mapearAdicionais = (valor: unknown): ItemTicket['item_adicionais'] => {
  if (!Array.isArray(valor)) return []

  return valor.map((adicional) => {
    const registro = (adicional || {}) as Record<string, unknown>
    return {
      nome: String(registro.nome || 'Adicional'),
      preco: paraNumero(registro.preco),
      quantidade: paraNumero(registro.quantidade || 1)
    }
  })
}

const mapearItensPedido = (valor: unknown): ItemTicket[] => {
  if (!Array.isArray(valor)) return []

  return valor.map((item) => {
    const registro = (item || {}) as Record<string, unknown>
    return {
      nome_item: String(registro.nome_item || registro.nome_produto || 'Item'),
      quantidade: paraNumero(registro.quantidade || 1),
      preco_unitario: paraNumero(registro.preco_unitario),
      subtotal: paraNumero(registro.subtotal),
      observacoes: paraTexto(registro.observacoes),
      item_adicionais: mapearAdicionais(registro.item_adicionais)
    }
  })
}

const mapearPagamentosDivididos = (valor: unknown): PedidoTicket['pagamentos_divididos'] => {
  if (!Array.isArray(valor)) return []

  return valor
    .map((pagamento) => {
      const registro = (pagamento || {}) as Record<string, unknown>
      return {
        forma_pagamento: String(registro.forma_pagamento || ''),
        valor: paraNumero(registro.valor)
      }
    })
    .filter((pagamento) => pagamento.forma_pagamento && pagamento.valor > 0)
}

const mapearPedido = (valor: unknown): PedidoLista => {
  const registro = (valor || {}) as Record<string, unknown>
  const mesasRelacionadasRaw = registro.mesas
  const mesasRelacionadas = Array.isArray(mesasRelacionadasRaw)
    ? (mesasRelacionadasRaw[0] as Record<string, unknown> || {})
    : ((mesasRelacionadasRaw || {}) as Record<string, unknown>)
  const mesaNumeroRelacionada = paraInteiro(mesasRelacionadas.numero)
  const mesaDireta = paraInteiro(registro.mesa)

  return {
    id: String(registro.id || ''),
    numero_pedido: registro.numero_pedido ? Number(registro.numero_pedido) : null,
    nome_cliente: paraTexto(registro.nome_cliente),
    telefone: paraTexto(registro.telefone),
    tipo_entrega: paraTexto(registro.tipo_entrega),
    mesa: mesaDireta ?? mesaNumeroRelacionada,
    comanda: paraInteiro(registro.comanda),
    mesa_id: paraTexto(registro.mesa_id),
    mesa_numero: mesaNumeroRelacionada ?? mesaDireta,
    endereco: paraTexto(registro.endereco),
    bairro: paraTexto(registro.bairro),
    observacoes: paraTexto(registro.observacoes),
    status: paraTexto(registro.status),
    subtotal: paraNumero(registro.subtotal),
    taxa_entrega: paraNumero(registro.taxa_entrega),
    taxa_servico: paraNumero(registro.taxa_servico),
    total: paraNumero(registro.total),
    created_at: paraTexto(registro.created_at),
    forma_pagamento: paraTexto(registro.forma_pagamento),
    pagamentos_divididos: mapearPagamentosDivididos(registro.pagamentos_pedido || registro.pagamentos_divididos),
    troco_para: registro.troco_para ? Number(registro.troco_para) : null,
    itens_pedido: mapearItensPedido(registro.itens_pedido)
  }
}

const mapearRegistroFila = (valor: unknown): RegistroFilaImpressao => {
  const registro = (valor || {}) as Record<string, unknown>

  return {
    id: String(registro.id || ''),
    pedido_id: String(registro.pedido_id || ''),
    tipo: (registro.tipo as TipoFilaImpressao) || 'cozinha',
    status: (registro.status as RegistroFilaImpressao['status']) || 'pendente',
    escopo: (registro.escopo as EscopoFilaImpressao) || 'pedido_completo',
    itens_snapshot: mapearItensPedido(registro.itens_snapshot),
    pedido_snapshot: (registro.pedido_snapshot as Partial<PedidoTicket>) || null,
    tentativas: paraNumero(registro.tentativas || 0),
    erro_mensagem: paraTexto(registro.erro_mensagem),
    erro: paraTexto(registro.erro),
    criado_em: paraTexto(registro.criado_em),
    created_at: paraTexto(registro.created_at),
    processado_em: paraTexto(registro.processado_em),
    impresso_em: paraTexto(registro.impresso_em),
    origem: paraTexto(registro.origem),
    hash_evento: paraTexto(registro.hash_evento)
  }
}

const compararFila = (a: RegistroFilaImpressao, b: RegistroFilaImpressao) => {
  const dataA = a.criado_em || a.created_at || ''
  const dataB = b.criado_em || b.created_at || ''

  if (dataA > dataB) return -1
  if (dataA < dataB) return 1
  return a.id.localeCompare(b.id)
}

const montarHashEvento = (
  pedidoId: string,
  tipo: TipoFilaImpressao,
  escopo: EscopoFilaImpressao,
  origem: string,
  semente?: string
) => {
  const carga = JSON.stringify({ pedidoId, tipo, escopo, origem, semente: semente || '' })
  let hash = 0
  for (let indice = 0; indice < carga.length; indice += 1) {
    hash = ((hash << 5) - hash) + carga.charCodeAt(indice)
    hash |= 0
  }
  return `${pedidoId}:${tipo}:${escopo}:${Math.abs(hash).toString(16)}`
}

export class ServicoFilaImpressao {
  private supabase: SupabaseClient | null = null

  private canalFila: RealtimeChannel | null = null

  private canalPedidos: RealtimeChannel | null = null

  private timerPolling: NodeJS.Timeout | null = null

  private emProcessamento = new Set<string>()

  private filaCache: RegistroFilaImpressao[] = []

  private pedidosCache: PedidoLista[] = []

  private logsCache: EntradaLog[] = []

  private configuracao: ConfiguracaoAplicacao

  private estadoConexao: EstadoConexao = {
    conectado: false,
    mensagem: 'Aguardando configuracao do Supabase',
    ultimaAtualizacao: new Date().toISOString()
  }

  private servicoImpressao: ServicoImpressao

  private callbacks: CallbacksServicoFila

  constructor(
    configuracao: ConfiguracaoAplicacao,
    servicoImpressao: ServicoImpressao,
    callbacks: CallbacksServicoFila
  ) {
    this.configuracao = configuracao
    this.servicoImpressao = servicoImpressao
    this.callbacks = callbacks
  }

  obterEstadoAtual(): Partial<EstadoAplicacao> {
    return {
      fila: this.filaCache,
      pedidos: this.pedidosCache,
      conexao: this.estadoConexao,
      logs: this.logsCache,
      configuracao: this.configuracao
    }
  }

  async atualizarConfiguracao(configuracao: ConfiguracaoAplicacao): Promise<void> {
    const credenciaisMudaram =
      configuracao.supabaseUrl !== this.configuracao.supabaseUrl ||
      configuracao.supabaseAnonKey !== this.configuracao.supabaseAnonKey

    this.configuracao = configuracao
    this.callbacks.onAtualizarEstado({ configuracao: this.configuracao })

    if (credenciaisMudaram) {
      await this.reconectarSupabase()
    } else if (this.timerPolling) {
      this.reiniciarPolling()
    }
  }

  async iniciar(): Promise<void> {
    await this.reconectarSupabase()
    this.reiniciarPolling()
  }

  async parar(): Promise<void> {
    this.pararPolling()
    await this.desconectarCanaisRealtime()
    this.supabase = null
    this.atualizarConexao(false, 'Servico de impressao encerrado')
  }

  async carregarImpressorasDisponiveis(): Promise<string[]> {
    return this.servicoImpressao.obterImpressorasDisponiveis()
  }

  async enfileirarImpressaoManual(
    pedidoId: string,
    tipo: TipoFilaImpressao
  ): Promise<{ sucesso: boolean; duplicado: boolean; erro?: string }> {
    if (!this.supabase) {
      return {
        sucesso: false,
        duplicado: false,
        erro: 'Supabase nao conectado. Configure URL e chave anon.'
      }
    }

    const escopo: EscopoFilaImpressao = 'pedido_completo'
    const hashEvento = montarHashEvento(pedidoId, tipo, escopo, 'electron_manual')

    const { error } = await this.supabase
      .from('fila_impressao')
      .insert({
        pedido_id: pedidoId,
        tipo,
        status: 'pendente',
        escopo,
        origem: 'electron_manual',
        hash_evento: hashEvento
      })

    if (error) {
      if (error.code === '23505') {
        return { sucesso: false, duplicado: true }
      }
      return { sucesso: false, duplicado: false, erro: error.message }
    }

    this.adicionarLog('sucesso', `Pedido ${pedidoId.slice(0, 8)} enfileirado para ${tipo}.`)
    await this.processarFilaAgora()
    return { sucesso: true, duplicado: false }
  }

  async reimprimirRegistroFila(idFila: string): Promise<{ sucesso: boolean; erro?: string }> {
    if (!this.supabase) {
      return { sucesso: false, erro: 'Supabase nao conectado.' }
    }

    const { data, error } = await this.supabase
      .from('fila_impressao')
      .select('pedido_id, tipo, escopo, itens_snapshot, pedido_snapshot')
      .eq('id', idFila)
      .single()

    if (error || !data) {
      return { sucesso: false, erro: error?.message || 'Registro nao encontrado.' }
    }

    const tipo = (data.tipo || 'cozinha') as TipoFilaImpressao
    const escopo = (data.escopo || 'pedido_completo') as EscopoFilaImpressao

    const { error: erroInsert } = await this.supabase
      .from('fila_impressao')
      .insert({
        pedido_id: data.pedido_id,
        tipo,
        status: 'pendente',
        escopo,
        itens_snapshot: data.itens_snapshot || null,
        pedido_snapshot: data.pedido_snapshot || null,
        origem: 'electron_reimpressao',
        hash_evento: montarHashEvento(
          data.pedido_id,
          tipo,
          escopo,
          'electron_reimpressao',
          `${Date.now()}`
        )
      })

    if (erroInsert) {
      return { sucesso: false, erro: erroInsert.message }
    }

    this.adicionarLog('sucesso', `Reimpressao solicitada para registro ${idFila.slice(0, 8)}.`)
    await this.processarFilaAgora()
    return { sucesso: true }
  }

  async processarFilaAgora(): Promise<void> {
    await this.carregarFila()
    await this.processarFilaPendente(true)
  }

  async atualizarPedidosEFila(): Promise<void> {
    await Promise.all([
      this.carregarFila(),
      this.carregarPedidos()
    ])
  }

  private async reconectarSupabase(): Promise<void> {
    const { supabaseUrl, supabaseAnonKey } = this.configuracao

    if (!supabaseUrl || !supabaseAnonKey) {
      this.supabase = null
      this.atualizarConexao(false, 'Informe SUPABASE_URL e SUPABASE_ANON_KEY para conectar.')
      return
    }

    this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })

    this.atualizarConexao(true, 'Conectando ao Supabase...')

    await this.desconectarCanaisRealtime()
    await this.atualizarPedidosEFila()
    await this.conectarCanaisRealtime()

    this.atualizarConexao(true, 'Conectado em tempo real com a fila de impressao.')
    this.adicionarLog('sucesso', 'Realtime conectado. Aguardando eventos de impressao.')

    if (this.configuracao.autoImpressao) {
      await this.processarFilaPendente(false)
    }
  }

  private async conectarCanaisRealtime(): Promise<void> {
    if (!this.supabase) return

    this.canalFila = this.supabase
      .channel(`fila-impressao-electron-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fila_impressao' },
        async (payload) => {
          const evento = payload.eventType
          this.adicionarLog('info', `Evento fila_impressao: ${evento}.`)
          await this.carregarFila()

          const registroNovo = payload.new as Record<string, unknown>
          const statusNovo = String(registroNovo.status || '')
          if (
            this.configuracao.autoImpressao &&
            (evento === 'INSERT' || (evento === 'UPDATE' && statusNovo === 'pendente'))
          ) {
            await this.processarFilaPendente(false)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.adicionarLog('sucesso', 'Canal realtime da fila ativo.')
        }
      })

    this.canalPedidos = this.supabase
      .channel(`pedidos-electron-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos' },
        async () => {
          await this.carregarPedidos()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'itens_pedido' },
        async () => {
          await this.carregarPedidos()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'item_adicionais' },
        async () => {
          await this.carregarPedidos()
        }
      )
      .subscribe()
  }

  private async desconectarCanaisRealtime(): Promise<void> {
    if (!this.supabase) {
      this.canalFila = null
      this.canalPedidos = null
      return
    }

    const cancelamentos: Promise<'ok' | 'error' | 'timed out'>[] = []

    if (this.canalFila) {
      cancelamentos.push(this.supabase.removeChannel(this.canalFila))
      this.canalFila = null
    }

    if (this.canalPedidos) {
      cancelamentos.push(this.supabase.removeChannel(this.canalPedidos))
      this.canalPedidos = null
    }

    if (cancelamentos.length > 0) {
      await Promise.allSettled(cancelamentos)
    }
  }

  private reiniciarPolling(): void {
    this.pararPolling()

    const intervalo = Math.max(2, this.configuracao.intervaloPollingSegundos)
    this.timerPolling = setInterval(async () => {
      if (!this.supabase) {
        return
      }

      await this.atualizarPedidosEFila()

      if (this.configuracao.autoImpressao) {
        await this.processarFilaPendente(false)
      }
    }, intervalo * 1000)
  }

  private pararPolling(): void {
    if (this.timerPolling) {
      clearInterval(this.timerPolling)
      this.timerPolling = null
    }
  }

  private async carregarFila(): Promise<void> {
    if (!this.supabase) {
      this.filaCache = []
      this.callbacks.onAtualizarEstado({ fila: this.filaCache })
      return
    }

    const { data, error } = await this.supabase
      .from('fila_impressao')
      .select('id, pedido_id, tipo, status, escopo, itens_snapshot, pedido_snapshot, tentativas, erro_mensagem, erro, criado_em, created_at, processado_em, impresso_em, origem, hash_evento')
      .order('criado_em', { ascending: false })
      .limit(LIMITE_FILA)

    if (error) {
      this.adicionarLog('erro', `Erro ao carregar fila: ${error.message}`)
      return
    }

    this.filaCache = (data || []).map((item) => mapearRegistroFila(item)).sort(compararFila)
    this.callbacks.onAtualizarEstado({ fila: this.filaCache })
  }

  private async carregarPedidos(): Promise<void> {
    if (!this.supabase) {
      this.pedidosCache = []
      this.callbacks.onAtualizarEstado({ pedidos: this.pedidosCache })
      return
    }

    const { data, error } = await this.supabase
      .from('pedidos')
      .select(`
        *,
        itens_pedido (
          id,
          nome_item,
          nome_produto,
          quantidade,
          preco_unitario,
          subtotal,
          observacoes,
          item_adicionais (
            id,
            nome,
            preco,
            quantidade
          )
        ),
        pagamentos_pedido (
          forma_pagamento,
          valor
        )
      `)
      .order('created_at', { ascending: false })
      .limit(LIMITE_PEDIDOS)

    if (error) {
      this.adicionarLog('erro', `Erro ao carregar pedidos: ${error.message}`)
      return
    }

    const pedidosMapeados = (data || []).map((pedido) => mapearPedido(pedido))
    this.pedidosCache = await this.preencherNumerosMesa(pedidosMapeados)
    this.callbacks.onAtualizarEstado({ pedidos: this.pedidosCache })
  }

  private async processarFilaPendente(forcarProcessamento = false): Promise<void> {
    if (!this.supabase || (!this.configuracao.autoImpressao && !forcarProcessamento)) {
      return
    }

    const { data, error } = await this.supabase
      .from('fila_impressao')
      .select(`
        id,
        pedido_id,
        tipo,
        status,
        escopo,
        itens_snapshot,
        pedido_snapshot,
        tentativas,
        erro_mensagem,
        erro,
        origem,
        hash_evento,
        criado_em,
        created_at,
        pedidos:pedido_id (
          *,
          itens_pedido (
            id,
            nome_item,
            nome_produto,
            quantidade,
            preco_unitario,
            subtotal,
            observacoes,
            item_adicionais (
              id,
              nome,
              preco,
              quantidade
            )
          ),
          pagamentos_pedido (
            forma_pagamento,
            valor
          )
        )
      `)
      .eq('status', 'pendente')
      .order('criado_em', { ascending: true })
      .limit(20)

    if (error) {
      this.adicionarLog('erro', `Erro ao buscar pendencias: ${error.message}`)
      return
    }

    for (const registroRaw of data || []) {
      const registro = mapearRegistroFila(registroRaw)

      if (this.emProcessamento.has(registro.id)) {
        continue
      }

      this.emProcessamento.add(registro.id)
      try {
        await this.processarRegistroFila(registro, registroRaw)
      } finally {
        this.emProcessamento.delete(registro.id)
      }
    }

    await this.carregarFila()
  }

  private async processarRegistroFila(
    registro: RegistroFilaImpressao,
    registroBruto: Record<string, unknown>
  ): Promise<void> {
    if (!this.supabase) return

    if (!this.configuracao.nomeImpressora) {
      this.adicionarLog('aviso', 'Impressora nao configurada. Processamento pausado.')
      return
    }

    const { data: itemClaim, error: erroClaim } = await this.supabase
      .from('fila_impressao')
      .update({
        status: 'processando',
        processado_em: new Date().toISOString(),
        erro_mensagem: null,
        erro: null
      })
      .eq('id', registro.id)
      .eq('status', 'pendente')
      .select('id')

    if (erroClaim) {
      this.adicionarLog(
        'erro',
        `Falha ao reservar item ${registro.id.slice(0, 8)} da fila: ${erroClaim.message}`
      )
      return
    }

    if (!itemClaim || itemClaim.length === 0) {
      // Outro worker/instancia já reservou o mesmo item.
      return
    }

    const pedidoBanco = mapearPedido(registroBruto.pedidos)
    const pedidoCache = this.pedidosCache.find((pedido) => pedido.id === pedidoBanco.id || pedido.id === registro.pedido_id)
    const pedidoComMesa = {
      ...pedidoBanco,
      mesa: pedidoBanco.mesa ?? pedidoCache?.mesa ?? null,
      mesa_numero: pedidoBanco.mesa_numero ?? pedidoCache?.mesa_numero ?? pedidoCache?.mesa ?? null,
      mesa_id: pedidoBanco.mesa_id || pedidoCache?.mesa_id || null
    }
    const pedidoParaImpressao = this.construirPedidoParaImpressao(registro, pedidoComMesa)

    if (!pedidoParaImpressao) {
      await this.marcarErro(registro, 'Pedido nao encontrado para impressao.')
      return
    }

    const dadosTicket: DadosTicketImpressao = {
      tipo: registro.tipo,
      escopo: registro.escopo || 'pedido_completo',
      pedido: pedidoParaImpressao
    }

    const resultadoImpressao = await this.servicoImpressao.imprimir(dadosTicket, this.configuracao)

    if (!resultadoImpressao.sucesso) {
      await this.marcarErro(registro, resultadoImpressao.erro || 'Erro de impressao desconhecido.')
      return
    }

    await this.supabase
      .from('fila_impressao')
      .update({
        status: 'impresso',
        impresso_em: new Date().toISOString(),
        erro_mensagem: null,
        erro: null
      })
      .eq('id', registro.id)
      .eq('status', 'processando')

    const descricaoEscopo = registro.escopo === 'itens_novos' ? 'itens novos' : 'pedido completo'
    this.adicionarLog(
      'sucesso',
      `Impresso pedido ${registro.pedido_id.slice(0, 8)} (${registro.tipo} - ${descricaoEscopo}).`
    )
  }

  private construirPedidoParaImpressao(
    registro: RegistroFilaImpressao,
    pedidoBanco: PedidoLista
  ): PedidoTicket | null {
    if (!pedidoBanco.id && !registro.pedido_snapshot?.id) {
      return null
    }

    const pedidoSnapshot = registro.pedido_snapshot || null
    const origemConferencia =
      Boolean(pedidoSnapshot?.origem_conferencia) ||
      String(registro.origem || '').startsWith('admin_conferencia_')

    const normalizarTexto = (valor: unknown) => {
      if (valor === null || valor === undefined) return null
      const texto = String(valor).trim()
      return texto ? texto : null
    }

    const normalizarNumeroOpcional = (valor: unknown) => {
      if (valor === null || valor === undefined || valor === '') return null
      const numero = Number(valor)
      if (!Number.isFinite(numero)) return null
      return numero
    }

    const escolherTexto = (valorBanco: unknown, valorSnapshot: unknown, fallback: string | null = null) => {
      const prioritario = origemConferencia ? valorSnapshot : valorBanco
      const secundario = origemConferencia ? valorBanco : valorSnapshot
      return normalizarTexto(prioritario) || normalizarTexto(secundario) || fallback
    }

    const escolherNumeroOpcional = (valorBanco: unknown, valorSnapshot: unknown) => {
      const prioritario = origemConferencia ? valorSnapshot : valorBanco
      const secundario = origemConferencia ? valorBanco : valorSnapshot
      return normalizarNumeroOpcional(prioritario) ?? normalizarNumeroOpcional(secundario)
    }

    const escolherNumero = (valorBanco: unknown, valorSnapshot: unknown, fallback = 0) =>
      escolherNumeroOpcional(valorBanco, valorSnapshot) ?? fallback

    const escolherPagamentosDivididos = (valorBanco: unknown, valorSnapshot: unknown) => {
      const pagamentosBanco = mapearPagamentosDivididos(valorBanco) || []
      const pagamentosSnapshot = mapearPagamentosDivididos(valorSnapshot) || []

      if (origemConferencia) {
        return pagamentosSnapshot.length > 0 ? pagamentosSnapshot : pagamentosBanco
      }

      return pagamentosBanco.length > 0 ? pagamentosBanco : pagamentosSnapshot
    }

    const valorMesaBanco = pedidoBanco.mesa ?? pedidoBanco.mesa_numero
    const valorMesaSnapshot = pedidoSnapshot?.mesa ?? pedidoSnapshot?.mesa_numero
    const mesaSelecionada = escolherNumeroOpcional(valorMesaBanco, valorMesaSnapshot)
    const comandaSelecionada = escolherNumeroOpcional(pedidoBanco.comanda, pedidoSnapshot?.comanda)
    const numeroPedido = escolherNumeroOpcional(pedidoBanco.numero_pedido, pedidoSnapshot?.numero_pedido)

    const dadosBase: PedidoTicket = {
      id: pedidoBanco.id || registro.pedido_id,
      numero_pedido: numeroPedido === null ? null : Math.trunc(numeroPedido),
      nome_cliente: escolherTexto(pedidoBanco.nome_cliente, pedidoSnapshot?.nome_cliente, 'Cliente'),
      telefone: escolherTexto(pedidoBanco.telefone, pedidoSnapshot?.telefone),
      tipo_entrega: escolherTexto(pedidoBanco.tipo_entrega, pedidoSnapshot?.tipo_entrega),
      mesa: mesaSelecionada === null ? null : Math.trunc(mesaSelecionada),
      comanda: comandaSelecionada === null ? null : Math.trunc(comandaSelecionada),
      mesa_id: escolherTexto(pedidoBanco.mesa_id, pedidoSnapshot?.mesa_id),
      mesa_numero: mesaSelecionada === null ? null : Math.trunc(mesaSelecionada),
      endereco: escolherTexto(pedidoBanco.endereco, pedidoSnapshot?.endereco),
      bairro: escolherTexto(pedidoBanco.bairro, pedidoSnapshot?.bairro),
      observacoes: escolherTexto(pedidoBanco.observacoes, pedidoSnapshot?.observacoes),
      created_at: escolherTexto(pedidoBanco.created_at, pedidoSnapshot?.created_at),
      subtotal: escolherNumero(pedidoBanco.subtotal, pedidoSnapshot?.subtotal, 0),
      taxa_entrega: escolherNumero(pedidoBanco.taxa_entrega, pedidoSnapshot?.taxa_entrega, 0),
      taxa_servico: escolherNumero(pedidoBanco.taxa_servico, pedidoSnapshot?.taxa_servico, 0),
      total: escolherNumero(pedidoBanco.total, pedidoSnapshot?.total, 0),
      forma_pagamento: escolherTexto(pedidoBanco.forma_pagamento, pedidoSnapshot?.forma_pagamento),
      pagamentos_divididos: escolherPagamentosDivididos(
        pedidoBanco.pagamentos_divididos,
        pedidoSnapshot?.pagamentos_divididos
      ),
      troco_para: escolherNumeroOpcional(pedidoBanco.troco_para, pedidoSnapshot?.troco_para),
      origem_conferencia: origemConferencia,
      modo_taxa_conferencia: pedidoSnapshot?.modo_taxa_conferencia || null,
      itens_pedido: []
    }

    if (registro.escopo === 'itens_novos' && (registro.itens_snapshot || []).length > 0) {
      const itensNovos = mapearItensPedido(registro.itens_snapshot)
      return {
        ...dadosBase,
        subtotal: itensNovos.reduce((acumulador, item) => acumulador + item.subtotal, 0),
        total: itensNovos.reduce((acumulador, item) => acumulador + item.subtotal, 0),
        taxa_entrega: 0,
        taxa_servico: 0,
        itens_pedido: itensNovos
      }
    }

    const itensSnapshotCompletos = mapearItensPedido(registro.itens_snapshot)
    const itensBanco = mapearItensPedido(pedidoBanco.itens_pedido)
    const itensCompletos = origemConferencia
      ? (itensSnapshotCompletos.length > 0 ? itensSnapshotCompletos : itensBanco)
      : (itensBanco.length > 0 ? itensBanco : itensSnapshotCompletos)

    return {
      ...dadosBase,
      itens_pedido: itensCompletos
    }
  }

  private async preencherNumerosMesa(pedidos: PedidoLista[]): Promise<PedidoLista[]> {
    if (!this.supabase || pedidos.length === 0) return pedidos

    const mesaIds = Array.from(new Set(
      pedidos
        .filter((pedido) => pedido.mesa === null || pedido.mesa === undefined)
        .filter((pedido) => pedido.mesa_numero === null || pedido.mesa_numero === undefined)
        .map((pedido) => pedido.mesa_id)
        .filter((mesaId): mesaId is string => Boolean(mesaId))
    ))

    if (mesaIds.length === 0) return pedidos

    const { data, error } = await this.supabase
      .from('mesas')
      .select('id, numero')
      .in('id', mesaIds)

    if (error || !data) {
      return pedidos
    }

    const numeroPorMesaId = new Map<string, number>()
    for (const mesaRaw of data) {
      const mesa = (mesaRaw || {}) as Record<string, unknown>
      const id = String(mesa.id || '')
      const numero = paraInteiro(mesa.numero)
      if (!id || numero === null) continue
      numeroPorMesaId.set(id, numero)
    }

    return pedidos.map((pedido) => {
      if ((pedido.mesa !== null && pedido.mesa !== undefined) || (pedido.mesa_numero !== null && pedido.mesa_numero !== undefined) || !pedido.mesa_id) {
        return pedido
      }

      const numeroMesa = numeroPorMesaId.get(pedido.mesa_id)
      if (numeroMesa === undefined) return pedido

      return {
        ...pedido,
        mesa: numeroMesa,
        mesa_numero: numeroMesa
      }
    })
  }

  private async marcarErro(registro: RegistroFilaImpressao, mensagemErro: string): Promise<void> {
    if (!this.supabase) return

    const tentativas = (registro.tentativas || 0) + 1

    await this.supabase
      .from('fila_impressao')
      .update({
        status: 'erro',
        tentativas,
        erro_mensagem: mensagemErro,
        erro: mensagemErro
      })
      .eq('id', registro.id)

    this.adicionarLog(
      'erro',
      `Falha ao imprimir pedido ${registro.pedido_id.slice(0, 8)}: ${mensagemErro}`
    )
  }

  private adicionarLog(nivel: EntradaLog['nivel'], mensagem: string): void {
    const entrada: EntradaLog = {
      id: gerarIdentificadorLog(),
      nivel,
      mensagem,
      criadoEm: new Date().toISOString()
    }

    this.logsCache = [entrada, ...this.logsCache].slice(0, LIMITE_LOGS)
    this.callbacks.onLog(entrada)
    this.callbacks.onAtualizarEstado({ logs: this.logsCache })
  }

  private atualizarConexao(conectado: boolean, mensagem: string): void {
    this.estadoConexao = {
      conectado,
      mensagem,
      ultimaAtualizacao: new Date().toISOString()
    }

    this.callbacks.onAtualizarEstado({ conexao: this.estadoConexao })
  }
}
