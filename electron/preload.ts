import { contextBridge, ipcRenderer } from 'electron'
import { ConfiguracaoAplicacao, EstadoAplicacao, TipoFilaImpressao } from './servicos/tipos'

const apiSegura = {
  obterEstadoInicial: () => ipcRenderer.invoke('app:obter-estado-inicial') as Promise<EstadoAplicacao>,
  salvarConfiguracao: (novaConfiguracaoParcial: Partial<ConfiguracaoAplicacao>) =>
    ipcRenderer.invoke('app:salvar-configuracao', novaConfiguracaoParcial) as Promise<ConfiguracaoAplicacao>,
  atualizarImpressoras: () => ipcRenderer.invoke('app:atualizar-impressoras') as Promise<string[]>,
  atualizarPainel: () => ipcRenderer.invoke('app:atualizar-painel') as Promise<boolean>,
  imprimirManual: (pedidoId: string, tipo: TipoFilaImpressao) =>
    ipcRenderer.invoke('fila:imprimir-manual', pedidoId, tipo) as Promise<{ sucesso: boolean; duplicado: boolean; erro?: string }>,
  reimprimirFila: (idFila: string) =>
    ipcRenderer.invoke('fila:reimprimir', idFila) as Promise<{ sucesso: boolean; erro?: string }>,
  processarFilaAgora: () => ipcRenderer.invoke('fila:processar-agora') as Promise<boolean>,
  aoAtualizarEstado: (callback: (estado: EstadoAplicacao) => void) => {
    const listener = (_evento: Electron.IpcRendererEvent, estado: EstadoAplicacao) => {
      callback(estado)
    }

    ipcRenderer.on('estado:atualizado', listener)

    return () => {
      ipcRenderer.removeListener('estado:atualizado', listener)
    }
  }
}

contextBridge.exposeInMainWorld('topLanchesImpressao', apiSegura)
