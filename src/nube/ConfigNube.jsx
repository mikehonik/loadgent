import { useState } from "react";
import { guardarConfig } from "./nube.js";

export function ConfigNube({ onListo }) {
  const [url, setUrl] = useState("");
  const [llave, setLlave] = useState("");
  const [error, setError] = useState("");

  const enviar = (e) => {
    e.preventDefault();
    if (!url.trim().startsWith("https://") || !llave.trim()) {
      setError("Pega la URL del proyecto (empieza con https://) y la llave anon.");
      return;
    }
    guardarConfig({ url, llave });
    onListo();
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#EEF1F5", fontFamily: "system-ui, sans-serif" }}>
      <form onSubmit={enviar} style={{ background: "#fff", borderRadius: 12, padding: 32, width: 420, boxShadow: "0 2px 12px rgba(0,0,0,.08)" }}>
        <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Configurar DarnelCube 3D</h1>
        <p style={{ fontSize: 13, color: "#5B6B7B", margin: "0 0 20px" }}>
          Solo se hace una vez, en este navegador. Copia estos dos datos desde tu proyecto de Supabase:
          Settings → API.
        </p>
        <label style={{ display: "block", fontSize: 13, color: "#5B6B7B", marginBottom: 12 }}>
          <span style={{ display: "block", marginBottom: 4 }}>Project URL</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxxx.supabase.co"
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #DCE2E8", fontSize: 14 }} />
        </label>
        <label style={{ display: "block", fontSize: 13, color: "#5B6B7B", marginBottom: 16 }}>
          <span style={{ display: "block", marginBottom: 4 }}>anon public key</span>
          <input value={llave} onChange={(e) => setLlave(e.target.value)} placeholder="eyJhbGciOi..."
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #DCE2E8", fontSize: 14 }} />
        </label>
        {error && <p style={{ color: "#B3261E", fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <button type="submit" style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "none", background: "#14213D", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          Guardar y continuar
        </button>
      </form>
    </div>
  );
}
