export type TipoFilaImpressao = 'cozinha' | 'cliente'
export type EscopoFilaImpressao = 'pedido_completo' | 'itens_novos'
export type StatusFilaImpressao = 'pendente' | 'processando' | 'impresso' | 'erro'

export type AdicionalTicket = {
  nome: string
  preco: number
  quantidade: number
}

export type ItemTicket = {
  nome_item: string
  quantidade: number
  preco_unitario: number
  subtotal: number
  observacoes?: string | null
  item_adicionais?: AdicionalTicket[]
}

export type PagamentoDivididoTicket = {
  forma_pagamento: string
  valor: number
}

export type PedidoTicket = {
  id: string
  numero_pedido?: number | null
  nome_cliente?: string | null
  telefone?: string | null
  tipo_entrega?: string | null
  mesa?: number | null
  comanda?: number | null
  mesa_id?: string | null
  mesa_numero?: number | null
  endereco?: string | null
  bairro?: string | null
  observacoes?: string | null
  created_at?: string | null
  subtotal?: number | null
  taxa_entrega?: number | null
  taxa_servico?: number | null
  total?: number | null
  forma_pagamento?: string | null
  pagamentos_divididos?: PagamentoDivididoTicket[]
  troco_para?: number | null
  origem_conferencia?: boolean | null
  modo_taxa_conferencia?: 'com_taxa' | 'sem_taxa' | null
  itens_pedido: ItemTicket[]
}

export type RegistroFilaImpressao = {
  id: string
  pedido_id: string
  tipo: TipoFilaImpressao
  status: StatusFilaImpressao
  escopo?: EscopoFilaImpressao | null
  itens_snapshot?: ItemTicket[] | null
  pedido_snapshot?: Partial<PedidoTicket> | null
  tentativas?: number | null
  erro_mensagem?: string | null
  erro?: string | null
  criado_em?: string | null
  created_at?: string | null
  processado_em?: string | null
  impresso_em?: string | null
  origem?: string | null
  hash_evento?: string | null
}

export type PedidoLista = {
  id: string
  numero_pedido?: number | null
  nome_cliente?: string | null
  telefone?: string | null
  tipo_entrega?: string | null
  mesa?: number | null
  comanda?: number | null
  mesa_id?: string | null
  mesa_numero?: number | null
  endereco?: string | null
  bairro?: string | null
  observacoes?: string | null
  status?: string | null
  subtotal?: number | null
  taxa_entrega?: number | null
  taxa_servico?: number | null
  total?: number | null
  created_at?: string | null
  forma_pagamento?: string | null
  pagamentos_divididos?: PagamentoDivididoTicket[]
  troco_para?: number | null
  itens_pedido?: ItemTicket[]
}

export type ConfiguracaoAplicacao = {
  supabaseUrl: string
  supabaseAnonKey: string
  nomeImpressora: string
  larguraPapelMm: number
  tamanhoFonteBasePx: number
  espacamentoLinha: number
  espacamentoItensPx: number
  intervaloPollingSegundos: number
  copias: number
  autoImpressao: boolean
  tema: 'claro' | 'escuro' | 'sistema'
}

export type EstadoConexao = {
  conectado: boolean
  mensagem: string
  ultimaAtualizacao: string
}

export type EntradaLog = {
  id: string
  nivel: 'info' | 'sucesso' | 'erro' | 'aviso'
  mensagem: string
  criadoEm: string
}

export type EstadoAplicacao = {
  fila: RegistroFilaImpressao[]
  pedidos: PedidoLista[]
  impressoras: string[]
  conexao: EstadoConexao
  configuracao: ConfiguracaoAplicacao
  logs: EntradaLog[]
}

export type DadosTicketImpressao = {
  tipo: TipoFilaImpressao
  escopo: EscopoFilaImpressao
  pedido: PedidoTicket
}
