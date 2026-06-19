export const FLUXO_VENDA_PASSOS = [
  {
    passo: 1,
    titulo: "Cliente",
    descricao: "Cadastre ou escolha quem está comprando.",
    href: "/clientes",
  },
  {
    passo: 2,
    titulo: "Venda",
    descricao: "Registre produtos. O sistema gera o nº da ordem (#).",
    href: "/vendas/nova",
  },
  {
    passo: 3,
    titulo: "Recebimento",
    descricao: "Registre dinheiro, PIX ou cheque na tela Financeiro.",
    href: "/financeiro/novo",
  },
] as const;

export const CHEQUES_HEADER =
  "Ao salvar, o valor abate o saldo do cliente na hora (como dinheiro ou PIX). Vincule à venda quando houver parcela em aberto.";
