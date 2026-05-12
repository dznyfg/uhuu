/// <reference types="vite/client" />

import type { ConfiguracaoAplicacao, EstadoAplicacao, TipoFilaImpressao } from '../electron/servicos/tipos'

declare global {
  interface Window {
    topLanchesImpressao: {
      obterEstadoInicial: () => Promise<EstadoAplicacao>
      salvarConfiguracao: (novaConfiguracaoParcial: Partial<ConfiguracaoAplicacao>) => Promise<ConfiguracaoAplicacao>
      atualizarImpressoras: () => Promise<string[]>
      atualizarPainel: () => Promise<boolean>
      imprimirManual: (
        pedidoId: string,
        tipo: TipoFilaImpressao
      ) => Promise<{ sucesso: boolean; duplicado: boolean; erro?: string }>
      reimprimirFila: (idFila: string) => Promise<{ sucesso: boolean; erro?: string }>
      processarFilaAgora: () => Promise<boolean>
      aoAtualizarEstado: (callback: (estado: EstadoAplicacao) => void) => () => void
    }
  }
}

export {}
