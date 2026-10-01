// Unidad de medida del usuario disponible en toda la pantalla, sin pasarla de componente en componente.
// Uso: const u = useUnidades(); u.fL(600) → "600 mm" o "23.62 in". Ver src/unidades.js.
import { createContext, useContext } from "react";
import { unidadesDe } from "../unidades.js";

const Contexto = createContext(unidadesDe("metrico"));
export const ProveedorUnidades = Contexto.Provider;
export const useUnidades = () => useContext(Contexto);
