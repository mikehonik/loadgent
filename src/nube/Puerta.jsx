import { useEffect, useState } from "react";
import { configGuardada, sesionActual, alCambiarSesion } from "./nube.js";
import { ConfigNube } from "./ConfigNube.jsx";
import { Login } from "./Login.jsx";

// Envuelve <App/>: sin configurar Supabase, pide la URL y la llave; sin sesión, pide entrar;
// con sesión, deja pasar y le da al hijo el usuario y una función para cerrar sesión.
export function Puerta({ children }) {
  const [config, setConfig] = useState(() => configGuardada());
  const [usuario, setUsuario] = useState(undefined); // undefined = todavía no se sabe

  useEffect(() => {
    if (!config) { setUsuario(null); return; }
    let vivo = true;
    sesionActual().then((u) => { if (vivo) setUsuario(u); });
    const quitar = alCambiarSesion((u) => vivo && setUsuario(u));
    return () => { vivo = false; quitar(); };
  }, [config]);

  if (!config) return <ConfigNube onListo={() => setConfig(configGuardada())} />;
  if (usuario === undefined) return null; // un instante, mientras se sabe si ya había sesión
  if (!usuario) return <Login onEntrar={setUsuario} />;
  return children(usuario);
}
