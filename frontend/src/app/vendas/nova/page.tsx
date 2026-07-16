"use client";
import { Suspense } from "react";
import { FormPageSkeleton } from "@/components/ui/skeletons";
import { NovaVendaForm } from "@/features/vendas/components/NovaVendaForm";

export default function NovaVendaPage() {
  return (
    <Suspense fallback={<FormPageSkeleton />}>
      <NovaVendaForm />
    </Suspense>
  );
}
