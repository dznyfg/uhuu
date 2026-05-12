import { useEffect, useMemo, useState } from 'react'
import type {
  ConfiguracaoAplicacao,
  EstadoAplicacao,
  EstadoConexao,
  PedidoLista,
  RegistroFilaImpressao,
  TipoFilaImpressao
} from '../electron/servicos/tipos'

const configuracaoPadrao: ConfiguracaoAplicacao = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  nomeImpressora: '',
  larguraPapelMm: 80,
  tamanhoFonteBasePx: 15,
  espacamentoLinha: 1.35,
  espacamentoItensPx: 8,
  intervaloPollingSegundos: 5,
  copias: 1,
  autoImpressao: true,
  tema: 'sistema'
}

const estadoPadrao: EstadoAplicacao = {
  fila: [],
  pedidos: [],
  impressoras: [],
  conexao: {
    conectado: false,
    mensagem: 'Inicializando...',
    ultimaAtualizacao: new Date().toISOString()
  },
  configuracao: configuracaoPadrao,
  logs: []
}

type MensagemTopo = {
  tipo: 'sucesso' | 'erro' | 'aviso'
  texto: string
}

type TelaAtiva = 'pedidos' | 'configuracoes'

const formatarDataHora = (valor?: string | null) => {
  if (!valor) return '-'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return '-'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(data)
}

const formatarMoeda = (valor?: number | null) =>
  `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`

const classeBadgeStatus = (status: string) => {
  if (status === 'pendente') return 'bg-amber-100 text-amber-900 border-amber-200'
  if (status === 'processando') return 'bg-blue-100 text-blue-900 border-blue-200'
  if (status === 'impresso') return 'bg-green-100 text-green-900 border-green-200'
  if (status === 'erro') return 'bg-red-100 text-red-900 border-red-200'
  return 'bg-zinc-100 text-zinc-700 border-zinc-200'
}

const classeBadgeConexao = (conexao: EstadoConexao) =>
  conexao.conectado
    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
    : 'bg-red-100 text-red-700 border-red-200'

const classeMensagemTopo = (tipo: MensagemTopo['tipo']) => {
  if (tipo === 'sucesso') return 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
  if (tipo === 'erro') return 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300'
  return 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
}

const largurasPapelSugeridas = [58, 80, 90, 112]

const normalizarTipoEntrega = (tipo?: string | null) =>
  String(tipo || '').trim().toLowerCase()

const obterNumeroMesa = (pedido: Pick<PedidoLista, 'mesa' | 'mesa_numero'>) => {
  const valorMesa = pedido.mesa_numero ?? pedido.mesa
  if (valorMesa === null || valorMesa === undefined) return null
  const numero = Number(valorMesa)
  if (!Number.isFinite(numero)) return null
  return Math.trunc(numero)
}

const formatarTipoEntrega = (pedido: PedidoLista) => {
  const tipo = normalizarTipoEntrega(pedido.tipo_entrega)
  const mesa = obterNumeroMesa(pedido)
  const comanda = pedido.comanda ? Number(pedido.comanda) : null

  if (tipo === 'local' || tipo === 'no local') {
    if (comanda && Number.isFinite(comanda)) return `Comanda ${Math.trunc(comanda)}`
    return mesa ? `Mesa ${mesa}` : 'No local'
  }

  if (tipo === 'retirada' || tipo === 'balcao') return 'Retirada'
  if (tipo === 'entrega') return 'Entrega'
  return pedido.tipo_entrega || '-'
}

/* ─── Ícones SVG ─── */
const IconeEngrenagem = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" aria-hidden="true">
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.6" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const IconeVoltar = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" aria-hidden="true">
    <path d="M14 6 8 12l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const IconeConexao = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5" aria-hidden="true">
    <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const IconeImpressora = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" aria-hidden="true">
    <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="6" y="14" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.6" />
  </svg>
)

const IconeTicket = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" aria-hidden="true">
    <path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 0 0-2 2v3a2 2 0 1 1 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 1 1 0-4V7a2 2 0 0 0-2-2H5Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const IconeRaio = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" aria-hidden="true">
    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const classeInput = 'w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-bordo-500/40 focus:border-bordo-500 transition-all'
const classeLabel = 'block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5'
const classeSecao = 'py-5 space-y-4'
const classeTituloSecao = 'text-sm font-semibold mb-3 flex items-center gap-2 text-zinc-700 dark:text-zinc-300'

export default function App() {
  const [estado, setEstado] = useState<EstadoAplicacao>(estadoPadrao)
  const [configuracaoLocal, setConfiguracaoLocal] = useState<ConfiguracaoAplicacao>(configuracaoPadrao)
  const [salvandoConfiguracao, setSalvandoConfiguracao] = useState(false)
  const [processandoFila, setProcessandoFila] = useState(false)
  const [mensagemTopo, setMensagemTopo] = useState<MensagemTopo | null>(null)
  const [telaAtiva, setTelaAtiva] = useState<TelaAtiva>('pedidos')

  useEffect(() => {
    let cancelado = false
    const removerInscricao = window.topLanchesImpressao.aoAtualizarEstado((estadoRecebido) => {
      if (cancelado) return
      setEstado(estadoRecebido)
      setConfiguracaoLocal(estadoRecebido.configuracao)
    })

    window.topLanchesImpressao.obterEstadoInicial().then((estadoInicial) => {
      if (cancelado) return
      setEstado(estadoInicial)
      setConfiguracaoLocal(estadoInicial.configuracao)
    })

    return () => {
      cancelado = true
      removerInscricao()
    }
  }, [])

  useEffect(() => {
    const tema = configuracaoLocal.tema
    const elementoHtml = document.documentElement

    if (tema === 'escuro') {
      elementoHtml.classList.add('dark')
      return
    }

    if (tema === 'claro') {
      elementoHtml.classList.remove('dark')
      return
    }

    const prefereEscuro = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (prefereEscuro) {
      elementoHtml.classList.add('dark')
    } else {
      elementoHtml.classList.remove('dark')
    }
  }, [configuracaoLocal.tema])

  const pedidosRecentes = useMemo(() => estado.pedidos.slice(0, 60), [estado.pedidos])
  const filaOrdenada = useMemo(() => estado.fila.slice(0, 120), [estado.fila])
  const filaAtiva = useMemo(
    () => estado.fila.filter((item) => item.status === 'pendente' || item.status === 'processando').length,
    [estado.fila]
  )

  const atualizarMensagem = (tipo: MensagemTopo['tipo'], texto: string) => {
    setMensagemTopo({ tipo, texto })
    window.setTimeout(() => {
      setMensagemTopo((atual) => {
        if (atual?.texto !== texto) return atual
        return null
      })
    }, 3200)
  }

  const salvarConfiguracao = async () => {
    setSalvandoConfiguracao(true)
    try {
      const configuracaoSalva = await window.topLanchesImpressao.salvarConfiguracao(configuracaoLocal)
      setConfiguracaoLocal(configuracaoSalva)
      atualizarMensagem('sucesso', 'Configuracoes salvas com sucesso.')
      await window.topLanchesImpressao.atualizarPainel()
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'Falha ao salvar configuracoes.'
      atualizarMensagem('erro', mensagem)
    } finally {
      setSalvandoConfiguracao(false)
    }
  }

  const atualizarImpressoras = async () => {
    try {
      await window.topLanchesImpressao.atualizarImpressoras()
      atualizarMensagem('sucesso', 'Lista de impressoras atualizada.')
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'Falha ao carregar impressoras.'
      atualizarMensagem('erro', mensagem)
    }
  }

  const imprimirManual = async (pedidoId: string, tipo: TipoFilaImpressao) => {
    try {
      const resultado = await window.topLanchesImpressao.imprimirManual(pedidoId, tipo)

      if (resultado.sucesso) {
        atualizarMensagem('sucesso', `Pedido ${pedidoId.slice(0, 8)} enviado para impressao (${tipo}).`)
        return
      }

      if (resultado.duplicado) {
        atualizarMensagem('aviso', 'Esse pedido ja esta em processamento na fila de impressao.')
        return
      }

      atualizarMensagem('erro', resultado.erro || 'Nao foi possivel enfileirar a impressao.')
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'Falha ao solicitar impressao manual.'
      atualizarMensagem('erro', mensagem)
    }
  }

  const atualizarPainel = async () => {
    try {
      await window.topLanchesImpressao.atualizarPainel()
      atualizarMensagem('sucesso', 'Painel atualizado.')
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'Falha ao atualizar painel.'
      atualizarMensagem('erro', mensagem)
    }
  }

  const processarFilaAgora = async () => {
    setProcessandoFila(true)
    try {
      await window.topLanchesImpressao.processarFilaAgora()
      atualizarMensagem('sucesso', 'Processamento manual da fila iniciado.')
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'Falha ao processar fila.'
      atualizarMensagem('erro', mensagem)
    } finally {
      setProcessandoFila(false)
    }
  }

  const reimprimirRegistro = async (idFila: string) => {
    try {
      const resultado = await window.topLanchesImpressao.reimprimirFila(idFila)
      if (resultado.sucesso) {
        atualizarMensagem('sucesso', 'Registro reenviado para impressao.')
        return
      }
      atualizarMensagem('erro', resultado.erro || 'Falha ao reenviar registro para impressao.')
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'Falha na reimpressao do registro.'
      atualizarMensagem('erro', mensagem)
    }
  }

  /* ─── Preview do ticket ─── */
  const ticketPreview = useMemo(() => {
    const pedido = pedidosRecentes[0]
    if (!pedido) return null
    const mesa = pedido.mesa_numero ?? pedido.mesa
    const comanda = pedido.comanda
    const itens = pedido.itens_pedido || []
    const subtotalItens = itens.reduce((a, i) => a + (i.subtotal || 0), 0)
    const taxaEntrega = Number(pedido.taxa_entrega || 0)
    const taxaServico = Number(pedido.taxa_servico || 0)
    const total = Number(pedido.total ?? subtotalItens + taxaEntrega + taxaServico)

    return { pedido, mesa, comanda, itens, subtotalItens, taxaEntrega, taxaServico, total }
  }, [pedidosRecentes])

  const renderizarTelaPedidos = () => (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Pedidos Recentes
        </h2>
        <button
          type="button"
          onClick={atualizarPainel}
          className="text-xs font-semibold text-bordo-600 dark:text-dourado-400 hover:underline"
        >
          Atualizar
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {pedidosRecentes.length === 0 && (
          <p className="text-sm text-zinc-500 col-span-full text-center py-12">Nenhum pedido encontrado.</p>
        )}

        {pedidosRecentes.map((pedido: PedidoLista) => (
          <div key={pedido.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 shadow-cartao hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="font-bold text-sm text-bordo-700 dark:text-dourado-400">#{pedido.numero_pedido || pedido.id.slice(0, 8)}</p>
              <span className="text-[10px] uppercase rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 font-bold tracking-wide">{pedido.status || 'pendente'}</span>
            </div>

            <p className="text-sm font-semibold">{pedido.nome_cliente || 'Cliente'}</p>
            <p className="text-xs text-zinc-500 mt-1">{formatarTipoEntrega(pedido)} • {formatarMoeda(pedido.total)}</p>
            {Number(pedido.taxa_servico || 0) > 0 && (
              <p className="text-[10px] text-zinc-400 mt-0.5">Taxa serviço: {formatarMoeda(pedido.taxa_servico)}</p>
            )}
            <p className="text-xs text-zinc-400">{formatarDataHora(pedido.created_at)}</p>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => imprimirManual(pedido.id, 'cozinha')}
                className="flex-1 rounded-lg bg-bordo-700 hover:bg-bordo-600 text-white text-xs font-bold px-2 py-2 transition-colors shadow-sm"
              >
                🍳 Cozinha
              </button>
              <button
                type="button"
                onClick={() => imprimirManual(pedido.id, 'cliente')}
                className="flex-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white text-xs font-bold px-2 py-2 transition-colors shadow-sm"
              >
                🧾 Cliente
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )

  const renderizarTelaConfiguracoes = () => (
    <section className="grid gap-4 xl:grid-cols-[440px_1fr]">
      <div className="space-y-3">
        {/* ── Painel único de configurações ── */}
        <article className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-cartao divide-y divide-zinc-100 dark:divide-zinc-800">

          {/* Conexão */}
          <div className={classeSecao + ' px-5'}>
            <p className={classeTituloSecao}>
              <IconeConexao /> Conexão Supabase
            </p>
            <div className="space-y-3">
              <div>
                <label className={classeLabel}>URL do projeto</label>
                <input
                  type="text"
                  value={configuracaoLocal.supabaseUrl}
                  onChange={(evento) => setConfiguracaoLocal((atual) => ({ ...atual, supabaseUrl: evento.target.value }))}
                  className={classeInput}
                  placeholder="https://seu-projeto.supabase.co"
                />
              </div>
              <div>
                <label className={classeLabel}>Chave anon</label>
                <input
                  type="password"
                  value={configuracaoLocal.supabaseAnonKey}
                  onChange={(evento) => setConfiguracaoLocal((atual) => ({ ...atual, supabaseAnonKey: evento.target.value }))}
                  className={classeInput}
                  placeholder="Cole a chave anon"
                />
              </div>
            </div>
          </div>

          {/* Impressora */}
          <div className={classeSecao + ' px-5'}>
            <p className={classeTituloSecao}>
              <IconeImpressora /> Impressora
            </p>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={classeLabel + ' !mb-0'}>Dispositivo</label>
                  <button
                    type="button"
                    onClick={atualizarImpressoras}
                    className="text-xs font-medium text-bordo-600 dark:text-bordo-400 hover:underline"
                  >
                    Atualizar lista
                  </button>
                </div>
                <select
                  value={configuracaoLocal.nomeImpressora}
                  onChange={(evento) => setConfiguracaoLocal((atual) => ({ ...atual, nomeImpressora: evento.target.value }))}
                  className={classeInput + ' cursor-pointer'}
                >
                  <option value="">Selecione uma impressora</option>
                  {estado.impressoras.map((impressora) => (
                    <option key={impressora} value={impressora}>{impressora}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={classeLabel}>Largura do papel</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {largurasPapelSugeridas.map((largura) => {
                    const ativo = Number(configuracaoLocal.larguraPapelMm) === largura
                    return (
                      <button
                        key={largura}
                        type="button"
                        onClick={() => setConfiguracaoLocal((atual) => ({ ...atual, larguraPapelMm: largura }))}
                        className={`px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors ${ativo
                            ? 'bg-bordo-700 text-white border-bordo-700'
                            : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-bordo-400'
                          }`}
                      >
                        {largura}mm
                      </button>
                    )
                  })}
                </div>
                <input
                  type="number"
                  min={48}
                  max={120}
                  value={configuracaoLocal.larguraPapelMm}
                  onChange={(evento) => setConfiguracaoLocal((atual) => ({
                    ...atual,
                    larguraPapelMm: Number(evento.target.value || atual.larguraPapelMm || 80)
                  }))}
                  className={classeInput}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={classeLabel}>Cópias</label>
                  <input
                    type="number"
                    min={1}
                    value={configuracaoLocal.copias}
                    onChange={(evento) => setConfiguracaoLocal((atual) => ({
                      ...atual,
                      copias: Math.max(1, Number(evento.target.value || 1))
                    }))}
                    className={classeInput}
                  />
                </div>
                <div>
                  <label className={classeLabel}>Tema</label>
                  <select
                    value={configuracaoLocal.tema}
                    onChange={(evento) => {
                      const tema = evento.target.value === 'claro' || evento.target.value === 'escuro'
                        ? evento.target.value
                        : 'sistema'
                      setConfiguracaoLocal((atual) => ({ ...atual, tema }))
                    }}
                    className={classeInput + ' cursor-pointer'}
                  >
                    <option value="sistema">Sistema</option>
                    <option value="claro">Claro</option>
                    <option value="escuro">Escuro</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Ticket */}
          <div className={classeSecao + ' px-5'}>
            <p className={classeTituloSecao}>
              <IconeTicket /> Parâmetros do Ticket
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={classeLabel}>Fonte (px)</label>
                <input
                  type="number"
                  min={10}
                  max={24}
                  value={configuracaoLocal.tamanhoFonteBasePx}
                  onChange={(evento) => setConfiguracaoLocal((atual) => ({
                    ...atual,
                    tamanhoFonteBasePx: Number(evento.target.value || atual.tamanhoFonteBasePx || 15)
                  }))}
                  className={classeInput}
                />
              </div>
              <div>
                <label className={classeLabel}>Altura linha</label>
                <input
                  type="number"
                  min={1}
                  max={2.2}
                  step={0.05}
                  value={configuracaoLocal.espacamentoLinha}
                  onChange={(evento) => setConfiguracaoLocal((atual) => ({
                    ...atual,
                    espacamentoLinha: Number(evento.target.value || atual.espacamentoLinha || 1.35)
                  }))}
                  className={classeInput}
                />
              </div>
              <div>
                <label className={classeLabel}>Esp. itens (px)</label>
                <input
                  type="number"
                  min={0}
                  max={24}
                  value={configuracaoLocal.espacamentoItensPx}
                  onChange={(evento) => setConfiguracaoLocal((atual) => ({
                    ...atual,
                    espacamentoItensPx: Number(evento.target.value || atual.espacamentoItensPx || 8)
                  }))}
                  className={classeInput}
                />
              </div>
            </div>
          </div>

          {/* Automação */}
          <div className={classeSecao + ' px-5'}>
            <p className={classeTituloSecao}>
              <IconeRaio /> Automação
            </p>
            <div className="space-y-3">
              <div>
                <label className={classeLabel}>Intervalo de polling (segundos)</label>
                <input
                  type="number"
                  min={2}
                  value={configuracaoLocal.intervaloPollingSegundos}
                  onChange={(evento) => setConfiguracaoLocal((atual) => ({
                    ...atual,
                    intervaloPollingSegundos: Math.max(2, Number(evento.target.value || 2))
                  }))}
                  className={classeInput}
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={configuracaoLocal.autoImpressao}
                  onChange={(evento) => setConfiguracaoLocal((atual) => ({ ...atual, autoImpressao: evento.target.checked }))}
                  className="w-4 h-4 rounded border-zinc-300 text-bordo-600 focus:ring-bordo-500 cursor-pointer accent-bordo-700"
                />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Impressão automática da fila</span>
              </label>
            </div>
          </div>
        </article>

        {/* ── Botão salvar ── */}
        <button
          type="button"
          disabled={salvandoConfiguracao}
          onClick={salvarConfiguracao}
          className="w-full rounded-lg bg-bordo-700 hover:bg-bordo-600 disabled:opacity-60 px-4 py-2.5 text-white text-sm font-semibold transition-colors"
        >
          {salvandoConfiguracao ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </div>

      {/* ─── Coluna Direita: Preview + Fila + Logs ─── */}
      <div className="space-y-4">
        {/* ── Preview do Ticket ── */}
        {ticketPreview && (
          <article className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-cartao overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <IconeTicket /> Preview do Ticket
              </h2>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Último pedido</span>
            </div>
            <div className="p-5 flex justify-center">
              <div
                className="bg-white border-2 border-dashed border-zinc-300 rounded-lg p-5 font-mono text-xs leading-relaxed text-zinc-900"
                style={{ width: `${Math.min(380, Math.max(240, configuracaoLocal.larguraPapelMm * 3.2))}px`, fontSize: `${Math.max(10, configuracaoLocal.tamanhoFonteBasePx * 0.75)}px`, lineHeight: configuracaoLocal.espacamentoLinha }}
              >
                <div className="text-center font-bold text-base mb-1 text-zinc-900">Açaí Caravelas</div>
                <div className="text-center font-bold text-[10px] uppercase tracking-wider mb-2 text-zinc-500">TICKET CLIENTE</div>
                <div className="border-t-2 border-dashed border-zinc-300 my-2" />
                <div className="space-y-0.5 text-zinc-900">
                  <p><b>Pedido:</b> #{ticketPreview.pedido.numero_pedido || ticketPreview.pedido.id.slice(0, 8)}</p>
                  <p><b>Cliente:</b> {ticketPreview.pedido.nome_cliente || 'Cliente'}</p>
                  <p><b>Entrega:</b> {formatarTipoEntrega(ticketPreview.pedido)}</p>
                  {ticketPreview.mesa && <p><b>Mesa:</b> {Number(ticketPreview.mesa)}</p>}
                  {ticketPreview.comanda && <p><b>Comanda:</b> {Number(ticketPreview.comanda)}</p>}
                  <p><b>Data:</b> {formatarDataHora(ticketPreview.pedido.created_at)}</p>
                </div>
                <div className="border-t-2 border-dashed border-zinc-300 my-2" />
                <div className="font-bold mb-1 text-zinc-900">ITENS</div>
                {ticketPreview.itens.length === 0 ? (
                  <p className="italic text-zinc-500">Sem itens</p>
                ) : (
                  <div style={{ marginBottom: `${configuracaoLocal.espacamentoItensPx}px` }}>
                    {ticketPreview.itens.map((item, idx) => (
                      <div key={idx} className="mb-1">
                        <p className="text-zinc-900"><b>{item.quantidade}x</b> {item.nome_item}</p>
                        {(item.item_adicionais || []).map((a, ai) => (
                          <p key={ai} className="pl-4 text-zinc-700">+ {a.quantidade}x {a.nome}</p>
                        ))}
                        {item.observacoes && <p className="pl-4 italic text-zinc-500">OBS: {item.observacoes}</p>}
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t-2 border-dashed border-zinc-300 my-2" />
                <p className="text-zinc-900"><b>Subtotal:</b> {formatarMoeda(ticketPreview.subtotalItens)}</p>
                {ticketPreview.taxaEntrega > 0 && <p className="text-zinc-900"><b>Taxa entrega:</b> {formatarMoeda(ticketPreview.taxaEntrega)}</p>}
                {ticketPreview.taxaServico > 0 && <p className="text-zinc-900"><b>Taxa serviço:</b> {formatarMoeda(ticketPreview.taxaServico)}</p>}
                <p className="font-bold text-sm mt-1 text-zinc-900">TOTAL: {formatarMoeda(ticketPreview.total)}</p>
              </div>
            </div>
          </article>
        )}

        {/* ── Fila de Impressão ── */}
        <article className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-cartao overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm font-bold">Fila de Impressão</h2>
            <button
              type="button"
              onClick={atualizarPainel}
              className="text-[10px] font-bold text-bordo-600 dark:text-dourado-400 hover:underline uppercase tracking-wider"
            >
              Atualizar
            </button>
          </div>

          <div className="overflow-auto max-h-[360px]">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-5 py-2.5">Pedido</th>
                  <th className="py-2.5 pr-2">Tipo</th>
                  <th className="py-2.5 pr-2">Escopo</th>
                  <th className="py-2.5 pr-2">Status</th>
                  <th className="py-2.5 pr-2">Tent.</th>
                  <th className="py-2.5 pr-2">Criado</th>
                  <th className="py-2.5 pr-5">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filaOrdenada.length === 0 && (
                  <tr>
                    <td className="px-5 py-6 text-zinc-500 text-center" colSpan={7}>Nenhum item na fila.</td>
                  </tr>
                )}
                {filaOrdenada.map((registro: RegistroFilaImpressao) => (
                  <tr key={registro.id} className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="px-5 py-2.5 font-mono font-bold">#{registro.pedido_id.slice(0, 8)}</td>
                    <td className="py-2.5 pr-2 uppercase font-bold">{registro.tipo}</td>
                    <td className="py-2.5 pr-2">{registro.escopo === 'itens_novos' ? 'itens novos' : 'pedido completo'}</td>
                    <td className="py-2.5 pr-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold ${classeBadgeStatus(registro.status)}`}>
                        {registro.status}
                      </span>
                    </td>
                    <td className="py-2.5 pr-2">{registro.tentativas || 0}</td>
                    <td className="py-2.5 pr-2">{formatarDataHora(registro.criado_em || registro.created_at)}</td>
                    <td className="py-2.5 pr-5">
                      <button
                        type="button"
                        className="text-[10px] font-bold text-bordo-600 dark:text-dourado-400 hover:underline uppercase tracking-wide"
                        onClick={() => reimprimirRegistro(registro.id)}
                      >
                        Reimprimir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        {/* ── Logs ── */}
        <article className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-cartao overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="text-sm font-bold">Logs de Execução</h2>
          </div>
          <div className="p-5 space-y-2 max-h-[280px] overflow-auto">
            {estado.logs.length === 0 && (
              <p className="text-sm text-zinc-500 text-center py-4">Sem logs recentes.</p>
            )}
            {estado.logs.map((registro) => (
              <div key={registro.id} className="rounded border border-zinc-200 dark:border-zinc-800 p-2.5 text-xs bg-zinc-50 dark:bg-zinc-950">
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-bold uppercase text-[10px] tracking-wide ${registro.nivel === 'erro' ? 'text-red-600' :
                      registro.nivel === 'sucesso' ? 'text-emerald-600' :
                        registro.nivel === 'aviso' ? 'text-amber-600' : 'text-zinc-500'
                    }`}>{registro.nivel}</span>
                  <span className="text-zinc-400 text-[10px]">{formatarDataHora(registro.criadoEm)}</span>
                </div>
                <div className="text-zinc-700 dark:text-zinc-300 mt-1">{registro.mensagem}</div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  )

  return (
    <main className="min-h-screen text-zinc-900 dark:text-zinc-100 p-4 md:p-6">
      <div className="max-w-[1600px] mx-auto space-y-5">
        <header className="flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-bordo-600 dark:text-dourado-400 mb-0.5">
                Açaí Caravelas • Impressão
              </p>
              <h1 className="text-2xl md:text-3xl font-bold">
                {telaAtiva === 'pedidos' ? 'Pedidos em Tempo Real' : 'Configurações'}
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                {telaAtiva === 'pedidos'
                  ? 'Gerencie e imprima tickets dos pedidos recentes.'
                  : 'Conexão, impressora, ticket e automação.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-3 py-1.5 rounded-full border text-xs font-bold ${classeBadgeConexao(estado.conexao)}`}>
                {estado.conexao.conectado ? '● Conectado' : '○ Desconectado'}
              </span>

              {telaAtiva === 'configuracoes' && (
                <button
                  type="button"
                  onClick={processarFilaAgora}
                  disabled={processandoFila}
                  className="px-3 py-2 rounded-lg bg-bordo-700 hover:bg-bordo-600 disabled:opacity-60 text-white text-xs font-bold transition-colors shadow-sm"
                >
                  {processandoFila ? 'Processando...' : '⚡ Processar Fila'}
                </button>
              )}

              <button
                type="button"
                onClick={() => setTelaAtiva((atual) => atual === 'pedidos' ? 'configuracoes' : 'pedidos')}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                {telaAtiva === 'pedidos' ? (
                  <>
                    <IconeEngrenagem />
                    Configurações
                  </>
                ) : (
                  <>
                    <IconeVoltar />
                    Voltar aos pedidos
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
            <span>{estado.conexao.mensagem}</span>
            <span>•</span>
            <span>Atualizado em {formatarDataHora(estado.conexao.ultimaAtualizacao)}</span>
            <span>•</span>
            <span>Fila ativa: {filaAtiva}</span>
          </div>

          {mensagemTopo && (
            <div className={`rounded-lg border px-4 py-2.5 text-sm font-semibold ${classeMensagemTopo(mensagemTopo.tipo)}`}>
              {mensagemTopo.texto}
            </div>
          )}
        </header>

        {telaAtiva === 'pedidos' ? renderizarTelaPedidos() : renderizarTelaConfiguracoes()}
      </div>
    </main>
  )
}
