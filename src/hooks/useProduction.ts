import { useContext } from "react";

import { ProductionContext, type ProductionContextValue } from "@/context/ProductionContext";

export function useProduction(): ProductionContextValue {
  const context = useContext(ProductionContext);
  if (!context) throw new Error("useProduction deve ser usado dentro de ProductionProvider");
  return context;
}
