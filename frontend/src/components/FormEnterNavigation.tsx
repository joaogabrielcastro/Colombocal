"use client";

import { useEffect } from "react";
import { handleFormEnterNavigation } from "@/lib/formEnterNavigation";

/** Enter em formulários avança para o próximo campo em vez de enviar. */
export default function FormEnterNavigation() {
  useEffect(() => {
    document.addEventListener("keydown", handleFormEnterNavigation, true);
    return () =>
      document.removeEventListener("keydown", handleFormEnterNavigation, true);
  }, []);
  return null;
}
