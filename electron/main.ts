import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Store from 'electron-store'
import { ServicoImpressao } from './servicos/servicoImpressao'
import { ServicoFilaImpressao } from './servicos/servicoFilaImpressao'
import { ConfiguracaoAplicacao, EstadoAplicacao } from './servicos/tipos'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const configuracaoPadrao: ConfiguracaoAplicacao = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
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

const armazenamento = new Store<{ configuracao: ConfiguracaoAplicacao }>({
  name: 'acai-caravelas-impressao-configuracoes',
  defaults: {
    configuracao: configuracaoPadrao
  }
})

let janelaPrincipal: BrowserWindow | null = null
let servicoFila: ServicoFilaImpressao | null = null

const normalizarConfiguracao = (
  configuracaoAtual: ConfiguracaoAplicacao,
  novaConfiguracaoParcial: Partial<ConfiguracaoAplicacao>
): ConfiguracaoAplicacao => {
  const merged = {
    ...configuracaoAtual,
    ...novaConfiguracaoParcial
  }

  const normalizarNumero = (valor: unknown, fallback: number) => {
    const numero = Number(valor)
    return Number.isFinite(numero) ? numero : fallback
  }

  const limitar = (valor: number, minimo: number, maximo: number) =>
    Math.min(Math.max(valor, minimo), maximo)

  const mergedLegado = merged as Record<string, unknown>
  const larguraLegada = typeof mergedLegado.larguraPapel === 'string'
    ? Number.parseFloat(mergedLegado.larguraPapel)
    : NaN
  const larguraNormalizada = normalizarNumero(
    mergedLegado.larguraPapelMm ?? larguraLegada,
    80
  )

  return {
    ...merged,
    supabaseUrl: (merged.supabaseUrl || '').trim(),
    supabaseAnonKey: (merged.supabaseAnonKey || '').trim(),
    nomeImpressora: (merged.nomeImpressora || '').trim(),
    larguraPapelMm: limitar(larguraNormalizada, 48, 120),
    tamanhoFonteBasePx: limitar(normalizarNumero(mergedLegado.tamanhoFonteBasePx, 15), 10, 24),
    espacamentoLinha: limitar(normalizarNumero(mergedLegado.espacamentoLinha, 1.35), 1, 2.2),
    espacamentoItensPx: limitar(normalizarNumero(mergedLegado.espacamentoItensPx, 8), 0, 24),
    intervaloPollingSegundos: Math.max(2, Number(merged.intervaloPollingSegundos || 5)),
    copias: Math.max(1, Number(merged.copias || 1)),
    autoImpressao: Boolean(merged.autoImpressao),
    tema: merged.tema === 'claro' || merged.tema === 'escuro' ? merged.tema : 'sistema'
  }
}

const obterConfiguracaoAtual = (): ConfiguracaoAplicacao => {
  const configuracaoPersistida = armazenamento.get('configuracao') as Partial<ConfiguracaoAplicacao>
  return normalizarConfiguracao(configuracaoPadrao, configuracaoPersistida)
}

let estadoAtual: EstadoAplicacao = {
  fila: [],
  pedidos: [],
  impressoras: [],
  conexao: {
    conectado: false,
    mensagem: 'Inicializando aplicacao...',
    ultimaAtualizacao: new Date().toISOString()
  },
  configuracao: obterConfiguracaoAtual(),
  logs: []
}

const enviarEstadoParaRenderer = (estadoParcial: Partial<EstadoAplicacao>) => {
  estadoAtual = {
    ...estadoAtual,
    ...estadoParcial
  }

  if (janelaPrincipal && !janelaPrincipal.isDestroyed()) {
    janelaPrincipal.webContents.send('estado:atualizado', estadoAtual)
  }
}

const criarJanelaPrincipal = () => {
  const caminhoIconeDesenvolvimento = join(process.cwd(), 'public', 'icon.ico')
  const caminhoIconePacote = join(process.resourcesPath, 'icon.ico')

  const icone = existsSync(caminhoIconePacote)
    ? caminhoIconePacote
    : (existsSync(caminhoIconeDesenvolvimento) ? caminhoIconeDesenvolvimento : undefined)

  janelaPrincipal = new BrowserWindow({
    width: 1366,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    title: 'Açaí Caravelas Impressao',
    icon: icone,
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })

  janelaPrincipal.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  janelaPrincipal.webContents.on('will-navigate', (evento, url) => {
    if (url !== janelaPrincipal?.webContents.getURL()) {
      evento.preventDefault()
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    janelaPrincipal.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    janelaPrincipal.loadFile(join(__dirname, '../dist/index.html'))
  }

  janelaPrincipal.on('closed', () => {
    janelaPrincipal = null
  })
}

const registrarIpc = () => {
  ipcMain.handle('app:obter-estado-inicial', async () => estadoAtual)

  ipcMain.handle('app:salvar-configuracao', async (_, novaConfiguracaoParcial: Partial<ConfiguracaoAplicacao>) => {
    const configuracaoAtual = armazenamento.get('configuracao')
    const configuracaoNormalizada = normalizarConfiguracao(configuracaoAtual, novaConfiguracaoParcial)

    armazenamento.set('configuracao', configuracaoNormalizada)
    estadoAtual.configuracao = configuracaoNormalizada

    if (servicoFila) {
      await servicoFila.atualizarConfiguracao(configuracaoNormalizada)
    }

    enviarEstadoParaRenderer({ configuracao: configuracaoNormalizada })
    return configuracaoNormalizada
  })

  ipcMain.handle('app:atualizar-impressoras', async () => {
    if (!servicoFila) return []
    const impressoras = await servicoFila.carregarImpressorasDisponiveis()
    enviarEstadoParaRenderer({ impressoras })
    return impressoras
  })

  ipcMain.handle('app:atualizar-painel', async () => {
    if (!servicoFila) return false
    await servicoFila.atualizarPedidosEFila()
    return true
  })

  ipcMain.handle('fila:imprimir-manual', async (_, pedidoId: string, tipo: 'cozinha' | 'cliente') => {
    if (!servicoFila) {
      return { sucesso: false, duplicado: false, erro: 'Servico de fila nao inicializado.' }
    }
    return servicoFila.enfileirarImpressaoManual(pedidoId, tipo)
  })

  ipcMain.handle('fila:reimprimir', async (_, idFila: string) => {
    if (!servicoFila) {
      return { sucesso: false, erro: 'Servico de fila nao inicializado.' }
    }
    return servicoFila.reimprimirRegistroFila(idFila)
  })

  ipcMain.handle('fila:processar-agora', async () => {
    if (!servicoFila) return false
    await servicoFila.processarFilaAgora()
    return true
  })
}

app.whenReady().then(async () => {
  criarJanelaPrincipal()

  const servicoImpressao = new ServicoImpressao(() => janelaPrincipal)
  const configuracaoInicial = obterConfiguracaoAtual()
  armazenamento.set('configuracao', configuracaoInicial)

  servicoFila = new ServicoFilaImpressao(
    configuracaoInicial,
    servicoImpressao,
    {
      onAtualizarEstado: (estadoParcial) => {
        enviarEstadoParaRenderer(estadoParcial)
      },
      onLog: () => {
        // O log completo já é publicado em onAtualizarEstado.
      }
    }
  )

  estadoAtual.configuracao = configuracaoInicial
  enviarEstadoParaRenderer({ configuracao: configuracaoInicial })

  registrarIpc()

  const impressoras = await servicoFila.carregarImpressorasDisponiveis()
  enviarEstadoParaRenderer({ impressoras })

  await servicoFila.iniciar()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      criarJanelaPrincipal()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  if (servicoFila) {
    await servicoFila.parar()
    servicoFila = null
  }
})
