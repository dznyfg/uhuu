import { ConfiguracaoAplicacao, DadosTicketImpressao, ItemTicket, PedidoTicket } from './tipos'

const formatarMoeda = (valor: number) =>
  `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`

const formatarFormaPagamento = (forma?: string | null) => {
  const chave = String(forma || '').trim().toLowerCase()

  if (chave === 'pix') return 'PIX'
  if (chave === 'dinheiro') return 'Dinheiro'
  if (chave === 'credito' || chave === 'cartao credito' || chave === 'cartão crédito' || chave === 'cartao de credito' || chave === 'cartão de crédito') return 'Cartao de Credito'
  if (chave === 'debito' || chave === 'cartao debito' || chave === 'cartão débito' || chave === 'cartao de debito' || chave === 'cartão de débito') return 'Cartao de Debito'
  if (chave === 'cartao' || chave === 'cartão') return 'Cartao'
  if (chave === 'dividido') return 'Dividido'

  return String(forma || '')
}

const escaparHtml = (valor?: string | number | null) => {
  const texto = String(valor ?? '')

  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

const formatarDataHora = (valor?: string | null) => {
  if (!valor) return '-'

  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return '-'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(data)
}

const normalizarTipoEntrega = (valor?: string | null) => String(valor || '').trim().toLowerCase()

const obterNumeroMesa = (pedido: PedidoTicket) => {
  const mesa = pedido.mesa_numero ?? pedido.mesa
  if (mesa === null || mesa === undefined) return null
  const numero = Number(mesa)
  if (!Number.isFinite(numero)) return null
  return Math.trunc(numero)
}

const obterNumeroComanda = (pedido: PedidoTicket) => {
  const comanda = pedido.comanda
  if (comanda === null || comanda === undefined) return null
  const numero = Number(comanda)
  if (!Number.isFinite(numero)) return null
  return Math.trunc(numero)
}

const formatarEntrega = (pedido: PedidoTicket) => {
  const tipo = normalizarTipoEntrega(pedido.tipo_entrega)
  if (tipo === 'local' || tipo === 'no local') {
    const comanda = obterNumeroComanda(pedido)
    if (comanda) return `No local - Comanda ${comanda}`
    return 'No local'
  }
  if (tipo === 'retirada' || tipo === 'balcao') return 'Retirada'
  if (tipo === 'entrega') return 'Entrega'
  return pedido.tipo_entrega || '-'
}

const montarItensHtml = (itens: ItemTicket[]) => {
  if (itens.length === 0) {
    return '<p class="texto-vazio">Sem itens para impressao.</p>'
  }

  return itens
    .map((item) => {
      const adicionais = (item.item_adicionais || [])
        .map((adicional) => `<div class="adicional">+ ${adicional.quantidade}x ${escaparHtml(adicional.nome)}</div>`)
        .join('')

      const observacoes = item.observacoes
        ? `<div class="observacao">OBS: ${escaparHtml(item.observacoes)}</div>`
        : ''

      return `
        <div class="item">
          <div class="linha-principal">
            <span class="quantidade">${item.quantidade}x</span>
            <span class="nome-item">${escaparHtml(item.nome_item)}</span>
          </div>
          ${adicionais}
          ${observacoes}
        </div>
      `
    })
    .join('')
}

const montarPagamentosHtml = (pedido: PedidoTicket) => {
  const formaPagamentoPrincipal = formatarFormaPagamento(pedido.forma_pagamento)
  const pagamentosDivididos = (pedido.pagamentos_divididos || [])
    .filter((pagamento) => Number.isFinite(Number(pagamento?.valor)))
    .filter((pagamento) => Number(pagamento.valor) > 0)

  if (formaPagamentoPrincipal.toLowerCase() === 'dividido' && pagamentosDivididos.length > 0) {
    const linhasDivisao = pagamentosDivididos
      .map((pagamento) => `
        <div class="linha">
          <span class="label">- ${escaparHtml(formatarFormaPagamento(pagamento.forma_pagamento))}:</span>
          ${formatarMoeda(Number(pagamento.valor))}
        </div>
      `)
      .join('')

    return `
      <div class="linha"><span class="label">Pagamento:</span> Dividido</div>
      <div class="linha"><span class="label">Divisao:</span></div>
      ${linhasDivisao}
    `
  }

  if (formaPagamentoPrincipal) {
    return `<div class="linha"><span class="label">Pagamento:</span> ${escaparHtml(formaPagamentoPrincipal)}</div>`
  }

  return ''
}

const limitarNumero = (valor: unknown, minimo: number, maximo: number, fallback: number) => {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return fallback
  return Math.min(Math.max(numero, minimo), maximo)
}

const calcularMetricasTicket = (configuracao: ConfiguracaoAplicacao) => {
  const larguraPapelMm = limitarNumero(configuracao.larguraPapelMm, 48, 120, 80)
  const tamanhoFonteBasePx = limitarNumero(configuracao.tamanhoFonteBasePx, 10, 24, 15)
  const espacamentoLinha = limitarNumero(configuracao.espacamentoLinha, 1, 2.2, 1.35)
  const espacamentoItensPx = limitarNumero(configuracao.espacamentoItensPx, 0, 24, 8)
  const recuoDetalhesPx = Math.round(Math.max(30, tamanhoFonteBasePx * 2.8))
  const larguraQuantidadePx = Math.round(Math.max(26, tamanhoFonteBasePx * 2.1))
  const fonteTituloPx = Math.round(tamanhoFonteBasePx * 1.45)
  const fonteSubtituloPx = Math.round(tamanhoFonteBasePx * 0.9)
  const paddingLateralMm = Math.min(4.5, Math.max(2.2, larguraPapelMm * 0.045))

  return {
    larguraPapelMm,
    tamanhoFonteBasePx,
    espacamentoLinha,
    espacamentoItensPx,
    recuoDetalhesPx,
    larguraQuantidadePx,
    fonteTituloPx,
    fonteSubtituloPx,
    paddingLateralMm
  }
}

export const gerarCssTicket = (configuracao: ConfiguracaoAplicacao) => {
  const metricas = calcularMetricasTicket(configuracao)
  const {
    larguraPapelMm,
    tamanhoFonteBasePx,
    espacamentoLinha,
    espacamentoItensPx,
    recuoDetalhesPx,
    larguraQuantidadePx,
    fonteTituloPx,
    fonteSubtituloPx,
    paddingLateralMm
  } = metricas

  return `
    @page {
      size: ${larguraPapelMm}mm auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
    }
    html,
    body {
      margin: 0;
      width: ${larguraPapelMm}mm;
      max-width: ${larguraPapelMm}mm;
    }
    body {
      padding: ${paddingLateralMm}mm;
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #000;
      background: #fff;
      font-size: ${tamanhoFonteBasePx}px;
      line-height: ${espacamentoLinha};
    }
    .ticket {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
      display: block;
    }
    .cabecalho {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin-bottom: ${Math.max(5, Math.round(tamanhoFonteBasePx * 0.45))}px;
    }
    .titulo {
      font-size: ${fonteTituloPx}px;
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: 0.2px;
      word-break: break-word;
      width: 100%;
      text-align: center;
      margin: 0 auto;
    }
    .subtitulo {
      font-size: ${fonteSubtituloPx}px;
      font-weight: 700;
      margin-top: ${Math.max(2, Math.round(tamanhoFonteBasePx * 0.18))}px;
      line-height: 1.2;
      width: 100%;
      text-align: center;
    }
    .divisor {
      border-top: 2px dashed #111;
      margin: ${Math.max(6, Math.round(tamanhoFonteBasePx * 0.5))}px 0;
    }
    .linha {
      margin-bottom: ${Math.max(2, Math.round(tamanhoFonteBasePx * 0.25))}px;
      word-break: break-word;
    }
    .label {
      font-weight: 700;
    }
    .item {
      margin-bottom: ${espacamentoItensPx}px;
    }
    .linha-principal {
      display: flex;
      gap: ${Math.max(4, Math.round(tamanhoFonteBasePx * 0.35))}px;
      align-items: flex-start;
    }
    .quantidade {
      font-weight: 700;
      min-width: ${larguraQuantidadePx}px;
      line-height: 1.2;
    }
    .nome-item {
      font-weight: 700;
      flex: 1;
      line-height: 1.2;
      word-break: break-word;
    }
    .adicional {
      padding-left: ${recuoDetalhesPx}px;
      font-size: ${Math.max(11, Math.round(tamanhoFonteBasePx * 0.92))}px;
      word-break: break-word;
    }
    .observacao {
      padding-left: ${recuoDetalhesPx}px;
      font-size: ${Math.max(10, Math.round(tamanhoFonteBasePx * 0.86))}px;
      font-style: italic;
      word-break: break-word;
    }
    .rodape {
      text-align: center;
      margin-top: ${Math.max(8, Math.round(tamanhoFonteBasePx * 0.65))}px;
      font-size: ${Math.max(10, Math.round(tamanhoFonteBasePx * 0.86))}px;
      color: #333;
    }
    .total {
      font-size: ${Math.round(tamanhoFonteBasePx * 1.22)}px;
      font-weight: 700;
    }
    .texto-vazio {
      font-style: italic;
      color: #555;
    }
  `
}

const montarConteudoTicket = (dados: DadosTicketImpressao) => {
  const pedido = dados.pedido
  const numeroMesa = obterNumeroMesa(pedido)
  const numeroComanda = obterNumeroComanda(pedido)
  const itens = pedido.itens_pedido || []

  const totalItens = itens.reduce((acumulador, item) => acumulador + item.subtotal, 0)
  const taxaEntrega = Number(pedido.taxa_entrega || 0)
  const taxaServico = Number(pedido.taxa_servico || 0)
  const totalPedido = Number(
    pedido.total ?? (dados.tipo === 'cliente' ? totalItens + taxaEntrega + taxaServico : totalItens)
  )

  return `
    <div class="ticket">
      <header class="cabecalho">
        <div class="titulo">Açaí Caravelas</div>
        <div class="subtitulo">${dados.tipo === 'cozinha' ? 'TICKET COZINHA' : 'TICKET CLIENTE'}</div>
        <div class="subtitulo">${dados.escopo === 'itens_novos' ? 'NOVOS ITENS' : 'PEDIDO COMPLETO'}</div>
      </header>

      <div class="divisor"></div>

      <div class="linha"><span class="label">Pedido:</span> #${escaparHtml((pedido.numero_pedido || '').toString() || pedido.id.slice(0, 8))}</div>
      <div class="linha"><span class="label">Cliente:</span> ${escaparHtml(pedido.nome_cliente || 'Cliente')}</div>
      <div class="linha"><span class="label">Entrega:</span> ${escaparHtml(formatarEntrega(pedido))}</div>
      ${numeroMesa ? `<div class="linha"><span class="label">Mesa:</span> ${escaparHtml(numeroMesa)}</div>` : ''}
      ${numeroComanda ? `<div class="linha"><span class="label">Comanda:</span> ${escaparHtml(numeroComanda)}</div>` : ''}
      <div class="linha"><span class="label">Telefone:</span> ${escaparHtml(pedido.telefone || '-')}</div>
      <div class="linha"><span class="label">Endereco:</span> ${escaparHtml(pedido.endereco || '-')}</div>
      <div class="linha"><span class="label">Bairro:</span> ${escaparHtml(pedido.bairro || '-')}</div>
      <div class="linha"><span class="label">Data:</span> ${escaparHtml(formatarDataHora(pedido.created_at))}</div>

      <div class="divisor"></div>

      <div class="linha"><span class="label">ITENS</span></div>
      ${montarItensHtml(itens)}

      <div class="divisor"></div>

      <div class="linha"><span class="label">Subtotal:</span> ${formatarMoeda(totalItens)}</div>
      ${taxaEntrega > 0 ? `<div class="linha"><span class="label">Taxa:</span> ${formatarMoeda(taxaEntrega)}</div>` : ''}
      ${taxaServico > 0 ? `<div class="linha"><span class="label">Taxa serviço:</span> ${formatarMoeda(taxaServico)}</div>` : ''}
      <div class="linha total">TOTAL: ${formatarMoeda(totalPedido)}</div>

      ${montarPagamentosHtml(pedido)}
      ${pedido.troco_para ? `<div class="linha"><span class="label">Troco para:</span> ${formatarMoeda(Number(pedido.troco_para))}</div>` : ''}
      ${pedido.observacoes ? `<div class="linha"><span class="label">Obs geral:</span> ${escaparHtml(pedido.observacoes)}</div>` : ''}

      <div class="rodape">
        Impresso em ${escaparHtml(formatarDataHora(new Date().toISOString()))}
      </div>
    </div>
  `
}

export const gerarHtmlTicketParaImpressao = (dados: DadosTicketImpressao) => {
  const conteudo = montarConteudoTicket(dados)

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
</head>
<body>
${conteudo}
</body>
</html>`
}

export const gerarHtmlTicket = (
  dados: DadosTicketImpressao,
  configuracao: ConfiguracaoAplicacao
) => {
  const css = gerarCssTicket(configuracao)
  const conteudo = montarConteudoTicket(dados)

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <style>${css}</style>
</head>
<body>
${conteudo}
</body>
</html>`
}

export const htmlTicketContemCssVisivel = (html: string) =>
  /<style[\s>]/i.test(html) || /@page\s*\{/.test(html) || /\.ticket\s*\{/.test(html)
