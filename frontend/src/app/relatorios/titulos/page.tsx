import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** URL legada → hub unificado Contas a receber (visão por título). */
export default async function RelatorioTitulosRedirectPage({ searchParams }: Props) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  params.set("visao", "titulos");
  for (const [key, value] of Object.entries(sp)) {
    if (key === "visao") continue;
    if (typeof value === "string" && value) params.set(key, value);
  }
  redirect(`/relatorios/financeiro?${params.toString()}`);
}
