import { useState } from "react";
import { iniciarSesion, borrarConfig, usaConfigDeEntorno } from "./nube.js";
import { idiomaActual, guardarIdioma, traducirPantalla } from "../i18n/index.js";
import { SelectorIdioma } from "../ui/controles.jsx";

export function Login({ onEntrar }) {
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [idioma, setIdioma] = useState(idiomaActual());
  const cambiarIdioma = (l) => { guardarIdioma(l); setIdioma(idiomaActual()); traducirPantalla(); };

  const enviar = async (e) => {
    e.preventDefault();
    setError(""); setCargando(true);
    try {
      const u = await iniciarSesion(correo, contrasena);
      onEntrar(u);
    } catch (err) {
      setError(err.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : "No se pudo iniciar sesión: " + err.message);
    }
    setCargando(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#EEF1F5", fontFamily: "system-ui, sans-serif" }}>
      <form onSubmit={enviar} style={{ background: "#fff", borderRadius: 12, padding: 32, width: 380, boxShadow: "0 2px 12px rgba(0,0,0,.08)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 0 20px" }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>DarnelCube 3D</h1>
          <SelectorIdioma idioma={idioma} onCambiar={cambiarIdioma} oscuro={false} />
        </div>
        <label style={{ display: "block", fontSize: 13, color: "#5B6B7B", marginBottom: 12 }}>
          <span style={{ display: "block", marginBottom: 4 }}>Correo</span>
          <input type="email" required value={correo} onChange={(e) => setCorreo(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #DCE2E8", fontSize: 14 }} />
        </label>
        <label style={{ display: "block", fontSize: 13, color: "#5B6B7B", marginBottom: 16 }}>
          <span style={{ display: "block", marginBottom: 4 }}>Contraseña</span>
          <input type="password" required value={contrasena} onChange={(e) => setContrasena(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #DCE2E8", fontSize: 14 }} />
        </label>
        {error && <p style={{ color: "#B3261E", fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <button type="submit" disabled={cargando} style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "none", background: "#14213D", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: cargando ? .7 : 1 }}>
          {cargando ? "Entrando…" : "Entrar"}
        </button>
        {!usaConfigDeEntorno() && (
          <p style={{ fontSize: 12, color: "#9AA9B8", marginTop: 16, textAlign: "center" }}>
            <button type="button" onClick={() => { borrarConfig(); window.location.reload(); }} style={{ background: "none", border: "none", color: "#9AA9B8", textDecoration: "underline", cursor: "pointer", fontSize: 12 }}>
              Cambiar la conexión de Supabase
            </button>
          </p>
        )}
      </form>
    </div>
  );
}
