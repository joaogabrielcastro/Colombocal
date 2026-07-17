import { redirect } from "next/navigation";

/** Alias amigável → Contas a receber (relatório financeiro). */
export default function ContasAReceberPage() {
  redirect("/relatorios/financeiro");
}
