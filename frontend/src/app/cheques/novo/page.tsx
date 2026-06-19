import { redirect } from "next/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ChequesNovoRedirectPage({ searchParams }: Props) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string" && value) params.set(key, value);
  }
  const qs = params.toString();
  redirect(qs ? `/financeiro/novo?${qs}` : "/financeiro/novo");
}
