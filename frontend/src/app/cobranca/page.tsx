import { redirect } from "next/navigation";

/** Cobrança foi descontinuada; mantém URL antiga sem quebrar favoritos. */
export default function CobrancaPage() {
  redirect("/");
}
