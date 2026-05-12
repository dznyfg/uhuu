import { BrowserWindow } from 'electron'
import { gerarHtmlTicket } from './formatadorTicket'
import { ConfiguracaoAplicacao, DadosTicketImpressao } from './tipos'

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

    const htmlTicket = gerarHtmlTicket(dadosTicket, configuracao)

    for (let copiaAtual = 1; copiaAtual <= configuracao.copias; copiaAtual += 1) {
      const resultado = await this.imprimirCopiaSilenciosa(
        htmlTicket,
        configuracao.nomeImpressora
      )

      if (!resultado.sucesso) {
        return resultado
      }
    }

    return { sucesso: true }
  }

  private async imprimirCopiaSilenciosa(
    htmlTicket: string,
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
      const urlHtml = `data:text/html;charset=UTF-8,${encodeURIComponent(htmlTicket)}`
      await janelaImpressao.loadURL(urlHtml)

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
