"use client";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { FormPageSkeleton } from "@/components/ui/skeletons";
import { NovaVendaForm } from "../../nova/page";

function EditarVendaInner() {
  const { id } = useParams<{ id: string }>();
  return <NovaVendaForm editId={id} />;
}

export default function EditarVendaPage() {
  return (
    <Suspense fallback={<FormPageSkeleton />}>
      <EditarVendaInner />
    </Suspense>
  );
}
