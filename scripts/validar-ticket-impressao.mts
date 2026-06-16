import {
  gerarCssTicket,
  gerarHtmlTicketParaImpressao,
  htmlTicketContemCssVisivel
} from '../electron/servicos/formatadorTicket.ts'
import { ConfiguracaoAplicacao, DadosTicketImpressao } from '../electron/servicos/tipos.ts'

const configuracaoPadrao: ConfiguracaoAplicacao = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  nomeImpressora: 'TESTE',
  autoImpressao: true,
  copias: 1,
  intervaloPollingSegundos: 5,
  larguraPapelMm: 80,
  tamanhoFonteBasePx: 15,
  espacamentoLinha: 1.35,
  espacamentoItensPx: 8
}

const dadosExemplo: DadosTicketImpressao = {
  tipo: 'cozinha',
  escopo: 'pedido_completo',
  pedido: {
    id: '701-teste',
    numero_pedido: 701,
    nome_cliente: 'raimundo',
    telefone: '63999999999',
    tipo_entrega: 'entrega',
    endereco: 'Casa do Raimundo',
    bairro: 'Morada do Port',
    created_at: '2026-06-15T21:43:00.000Z',
    subtotal: 15,
    taxa_entrega: 2,
    taxa_servico: 0,
    total: 17,
    forma_pagamento: 'pix',
    observacoes: 'ca',
    itens_pedido: [
      {
        nome_item: 'Açaí na garrafa com Nutella',
        quantidade: 1,
        preco_unitario: 15,
        subtotal: 15,
        item_adicionais: []
      }
    ]
  }
}

const html = gerarHtmlTicketParaImpressao(dadosExemplo, configuracaoPadrao)
const css = gerarCssTicket(configuracaoPadrao)

const falhas: string[] = []

if (htmlTicketContemCssVisivel(html)) {
  falhas.push('HTML de impressao ainda contem CSS visivel')
}

if (!html.includes('Açaí Caravelas')) {
  falhas.push('HTML de impressao nao contem cabecalho do ticket')
}

if (!html.includes('Açaí na garrafa com Nutella')) {
  falhas.push('HTML de impressao nao contem item do pedido')
}

if (!html.includes('<br>')) {
  falhas.push('HTML de impressao nao usa quebras de linha explicitas')
}

if (!html.includes('Pedido:</b>')) {
  falhas.push('HTML de impressao nao contem linha de pedido formatada')
}

if (!css.includes('@page')) {
  falhas.push('CSS do ticket nao contem regra @page')
}

if (!css.includes('.ticket')) {
  falhas.push('CSS do ticket nao contem classe .ticket')
}

if (falhas.length > 0) {
  console.error('Validacao falhou:')
  for (const falha of falhas) {
    console.error(`- ${falha}`)
  }
  process.exit(1)
}

console.log('Validacao OK: HTML limpo para impressao termica e CSS separado.')
