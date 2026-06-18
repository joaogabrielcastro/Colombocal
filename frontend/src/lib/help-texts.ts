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
    descricao: "Abra a venda e registre dinheiro, PIX ou cheque.",
    href: "/vendas",
  },
] as const;
