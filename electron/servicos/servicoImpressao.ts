import { BrowserWindow } from 'electron'
import { gerarCssTicket, gerarHtmlTicketParaImpressao } from './formatadorTicket'
import { ConfiguracaoAplicacao, DadosTicketImpressao } from './tipos'

const aguardarMs = (tempoMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, tempoMs)
  })

export class ServicoImpressao {
  private obterJanelaPrincipal: () => BrowserWindow | null

  constructor(obterJanelaPrincipal: () => BrowserWindow | null) {
    this.obterJanelaPrincipal = obterJanelaPrincipal
  }

  async obterImpressorasDisponiveis(): Promise<string[]> {
    const janela = this.obterJanelaPrincipal()
    if (!janela) {
      return []
    }

    const impressoras = await janela.webContents.getPrintersAsync()
    return impressoras
      .map((impressora) => impressora.name)
      .filter((nome) => nome && nome.trim().length > 0)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }

  async imprimir(
    dadosTicket: DadosTicketImpressao,
    configuracao: ConfiguracaoAplicacao
  ): Promise<{ sucesso: boolean; erro?: string }> {
    if (!configuracao.nomeImpressora) {
      return { sucesso: false, erro: 'Nenhuma impressora foi configurada.' }
    }

    const htmlTicket = gerarHtmlTicketParaImpressao(dadosTicket)
    const cssTicket = gerarCssTicket(configuracao)

    for (let copiaAtual = 1; copiaAtual <= configuracao.copias; copiaAtual += 1) {
      const resultado = await this.imprimirCopiaSilenciosa(
        htmlTicket,
        cssTicket,
        configuracao.nomeImpressora
      )

      if (!resultado.sucesso) {
        return resultado
      }
    }

    return { sucesso: true }
  }

  private async carregarHtmlTicket(
    janelaImpressao: BrowserWindow,
    htmlTicket: string
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Tempo esgotado ao preparar o ticket para impressao.'))
      }, 15000)

      const limpar = () => {
        clearTimeout(timeout)
        janelaImpressao.webContents.removeListener('did-finish-load', aoCarregar)
        janelaImpressao.webContents.removeListener('did-fail-load', aoFalhar)
      }

      const aoCarregar = () => {
        limpar()
        resolve()
      }

      const aoFalhar = (_evento: Electron.Event, _codigo: number, descricao: string) => {
        limpar()
        reject(new Error(descricao || 'Falha ao carregar o ticket para impressao.'))
      }

      janelaImpressao.webContents.once('did-finish-load', aoCarregar)
      janelaImpressao.webContents.once('did-fail-load', aoFalhar)

      const urlHtml = `data:text/html;charset=utf-8,${encodeURIComponent(htmlTicket)}`
      void janelaImpressao.loadURL(urlHtml).catch((erro) => {
        limpar()
        reject(erro instanceof Error ? erro : new Error('Falha ao carregar o ticket para impressao.'))
      })
    })
  }

  private async imprimirCopiaSilenciosa(
    htmlTicket: string,
    cssTicket: string,
    nomeImpressora: string
  ): Promise<{ sucesso: boolean; erro?: string }> {
    const janelaImpressao = new BrowserWindow({
      show: false,
      width: 700,
      height: 1000,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    try {
      await this.carregarHtmlTicket(janelaImpressao, htmlTicket)
      await janelaImpressao.webContents.insertCSS(cssTicket)
      await janelaImpressao.webContents.executeJavaScript('document.fonts.ready', true)
      await aguardarMs(200)

      const impressoComSucesso = await new Promise<boolean>((resolve) => {
        janelaImpressao.webContents.print(
          {
            silent: true,
            printBackground: false,
            deviceName: nomeImpressora,
            margins: {
              marginType: 'none'
            }
          },
          (sucesso, erro) => {
            if (!sucesso && erro) {
              console.error('[Impressao] Falha ao imprimir:', erro)
            }
            resolve(sucesso)
          }
        )
      })

      if (!impressoComSucesso) {
        return {
          sucesso: false,
          erro: `Falha ao imprimir na impressora "${nomeImpressora}".`
        }
      }

      return { sucesso: true }
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'Erro desconhecido ao imprimir.'
      return { sucesso: false, erro: mensagem }
    } finally {
      if (!janelaImpressao.isDestroyed()) {
        janelaImpressao.destroy()
      }
    }
  }
}
