"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";

export default function FreteFeatureGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { freteEnabled, loading } = useTenantFeatures();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !freteEnabled) {
      router.replace("/");
    }
  }, [loading, freteEnabled, router]);

  if (loading || !freteEnabled) return null;
  return <>{children}</>;
}
