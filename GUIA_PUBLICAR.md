# DarnelCube 3D · cómo se publica y cómo se actualiza

DarnelCube 3D vive en tres lugares:

| Dónde | Qué hace |
|---|---|
| **GitHub** (`mikehonik/darnel_cube`) | Guarda el código. Es la fuente de todo. |
| **Cloudflare Pages** | Toma el código de GitHub, lo compila y lo publica en el link que usa la gente. Se actualiza solo cada vez que cambia GitHub. |
| **Supabase** | Guarda los usuarios, el maestro de cada uno y sus escenarios. |

Las secciones 1 a 3 solo se hacen una vez. La sección 4 (publicar un cambio) es la que se repite.

---

## 1. Supabase (una sola vez)

1. En **supabase.com**, crea un proyecto (por ejemplo `darnelcube`) en la región más cercana.
2. **SQL Editor → New query**. Pega y corre (*Run*), en este orden, el contenido de:
   1. `supabase_setup.sql` (proyecto guardado por usuario)
   2. `supabase_escenarios.sql` (varios escenarios con nombre por usuario)
   3. `supabase_maestro.sql` (maestro permanente por usuario)

   Los tres se pueden volver a correr sin borrar nada.
3. **Settings → API**. Anota el **Project URL** y la **anon public key**. No son secretos: están
   hechos para ir en la página. Lo que protege los datos son las reglas que crean los SQL, y cada
   usuario solo ve lo suyo.

### Dar de alta usuarios

**Authentication → Users → Add user → Create new user**, con el correo de la persona y una
contraseña temporal. No hay registro abierto: solo entra quien se agregue aquí.

---

## 2. GitHub (una sola vez)

El repositorio es `github.com/mikehonik/darnel_cube`. Se recomienda dejarlo **privado**
(Settings → General → Danger Zone → Change visibility): tiene la lógica de cubicaje calibrada con
datos reales de Darnel. Cloudflare sigue publicando igual con el repositorio privado.

El archivo `.env` (llaves locales de Supabase) nunca se sube: `.gitignore` lo excluye.

---

## 3. Cloudflare Pages (una sola vez)

1. En **dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git**, autoriza
   GitHub y elige `darnel_cube`.
2. Configuración de compilación:
   - **Framework preset:** Vite (o ninguno)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. En **Settings → Environment variables** agrega:
   - `VITE_SUPABASE_URL` = el Project URL del paso 1
   - `VITE_SUPABASE_ANON_KEY` = la anon public key del paso 1

   Con estas dos variables, nadie tiene que pegar las llaves de Supabase al abrir la app: entra
   directo a la pantalla de correo y contraseña.
4. **Save and Deploy**. En 1 o 2 minutos queda el link (algo como `darnelcube.pages.dev`).

Cloudflare guarda cada publicación. Si una versión sale mal, en **Deployments** puedes regresar a
la anterior con **Rollback**, sin tocar el código.

---

## 4. Publicar un cambio (cada vez)

### 4.1 Subir el número de versión

La versión se ve arriba, junto al nombre (por ejemplo **v1.1.0**), y sale en el Excel de
resultados y en el instructivo de carga. Así, cuando alguien reporta algo, sabemos qué versión
tenía.

Antes de subir un cambio, edita dos archivos:

1. **`package.json`**, el campo `"version"`:
   - Corrección pequeña (un error, un texto): `1.1.0` → `1.1.1`
   - Funcionalidad nueva: `1.1.0` → `1.2.0`
   - Cambio grande que cambia la forma de trabajar: `1.1.0` → `2.0.0`
2. **`src/version.js`**, la lista `NOVEDADES`: agrega arriba una entrada con la versión, la fecha
   y lo que cambió, escrito para quien usa la herramienta. Se muestra en **Ayuda → Novedades**
   (también se llega con un clic en el número de versión).

Además del número, cada publicación lleva un **código de build** que cambia solo (el commit que
compiló Cloudflare). Se ve al pasar el mouse sobre la versión y al pie del instructivo. Si alguien
olvida subir el número, el código de build igual dice exactamente qué código está publicado.

### 4.2 Subir los archivos a GitHub

Desde la página del repositorio: **Add file → Upload files**, arrastra los archivos o carpetas que
cambiaron (GitHub respeta las carpetas y reemplaza los que ya existen), escribe un mensaje que diga
qué cambió y presiona **Commit changes**.

Windows no arrastra archivos que empiezan con punto (como `.gitignore`). Si hace falta cambiar uno,
créalo o edítalo desde GitHub con **Add file → Create new file**.

### 4.3 Revisar que se publicó

En Cloudflare → tu proyecto → **Deployments**, el último debe decir **Success**. Si dice
**Failed**, el sitio se queda con la versión anterior (el usuario no ve nada roto) y el log de ahí
dice por qué falló. Abre el link y confirma que arriba aparece el número de versión nuevo.

### 4.4 Publicar la nota de versión (recomendado)

En GitHub → **Releases → Draft a new release**, crea una etiqueta con el número (por ejemplo
`v1.2.0`), pega las mismas novedades de `src/version.js` y publica. Queda el historial de qué salió
en cada versión, útil para avisarle al equipo.

---

## Unidades de medida

Cada usuario elige arriba **mm · kg** o **in · lb**, y la app lo recuerda en su cuenta. Por dentro todo se
guarda y se calcula en milímetros y kilogramos, así que el maestro en la nube es el mismo para todos: el
equipo de EE.UU. lo ve en pulgadas y el de México en milímetros. Los archivos que se suben pueden venir en
cualquier unidad: se elige en Maestro («Unidades de los archivos que subes») o se detecta por el encabezado
de cada columna, por ejemplo «Largo (in)» o «Peso (lb)».

---

## 5. Si algo no prende

- **"Failed to fetch" al entrar:** revisa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en
  Cloudflare (sin espacios de más). Después de cambiarlas, hay que volver a publicar
  (Deployments → Retry deployment).
- **"Correo o contraseña incorrectos":** verifica el correo exacto en Supabase → Authentication → Users.
- **Pantalla blanca:** revisa en Cloudflare → Deployments que el último diga Success. Si falló,
  el log dice por qué; mientras tanto puedes hacer **Rollback** a la versión anterior.
- **La versión nueva no aparece:** recarga con Ctrl+F5; el navegador a veces guarda la anterior.
- **El primer intento del día falla después de una semana sin uso:** Supabase pausa los proyectos
  gratuitos tras 7 días sin actividad. Entra al panel de Supabase para reactivarlo, o reintenta a
  los 30 segundos.

---

## Para programadores

- `npm run dev` abre la app local; `npm test` corre las pruebas (Vitest); `npm run build` compila a `dist/`.
- `npm run html` genera `dist/DarnelCube3D.html`, un solo archivo que se abre sin servidor. El PDF de paletizado carga jsPDF bajo demanda, así que solo funciona en la versión web (la publicada en Cloudflare).
- La versión la inyecta `vite.config.js` al compilar (`__VERSION__` de `package.json` y
  `__BUILD__` de `CF_PAGES_COMMIT_SHA` o de git). Se lee en `src/version.js`.
