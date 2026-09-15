import { redirect } from "next/navigation";

/** Hub Fiscal → Notas fiscais */
export default function FiscalIndexPage() {
  redirect("/fiscal/notas");
}
