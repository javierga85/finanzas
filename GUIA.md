# Mis Finanzas: guía de instalación paso a paso

Tiempo estimado: **20–30 minutos**, solo la primera vez.

## Cómo funciona (en 30 segundos)

```
┌─────────────────────────┐        ┌──────────────────────────────┐
│ Repo PÚBLICO "finanzas" │        │ Repo PRIVADO "finanzas-datos"│
│ solo el CÓDIGO de la app│        │ solo tus DATOS (data.json)   │
│ → GitHub Pages lo publica│       │ → nadie más puede verlo      │
└───────────┬─────────────┘        └──────────────┬───────────────┘
            │ abres la web                         │ la app lee/escribe con tu token
            ▼                                      ▼
   📱 Móvil  y  💻 PC  ── PIN propio en cada dispositivo ── datos sincronizados
```

- El **código** es público, pero no lleva ni un solo dato tuyo.
- Tus **datos** viven en un repositorio **privado** y, en cada dispositivo, se guardan **cifrados con tu PIN**.
- El **token** (la "llave" de GitHub) también se guarda cifrado con el PIN.

---

## PASO 1 · Crear la cuenta de GitHub (si no la tienes)

1. Entra en **https://github.com/signup**.
2. Usa tu **email personal** (no el de CEVA).
3. Elige un nombre de usuario. Será parte de la dirección de tu app: `https://TU-USUARIO.github.io/finanzas/`.
4. Confirma el email.
5. Recomendado: activa la verificación en dos pasos (foto de perfil → **Settings** → **Password and authentication**).

## PASO 2 · Crear el repositorio de la APP (público)

1. Arriba a la derecha pulsa **＋** → **New repository**.
2. **Repository name**: `finanzas`
3. Marca **Public**. GitHub Pages es gratis solo en repos públicos, y aquí no hay datos tuyos.
4. Pulsa **Create repository**.
5. En la página del repo vacío, pulsa el enlace **"uploading an existing file"**.
6. **Descomprime** `finanzas-app.zip` en tu PC. Abre la carpeta `finanzas-app` y **selecciona todo su contenido**: `index.html`, `styles.css`, `sw.js`, `manifest.webmanifest`, `GUIA.md` y las carpetas `js`, `vendor` e `icons`.
7. **Arrástralo** a la zona de subida de GitHub.
   ⚠️ Arrastra el **contenido**, no la carpeta `finanzas-app` entera: `index.html` tiene que quedar en la raíz del repo.
8. Abajo, pulsa **Commit changes**.

## PASO 3 · Publicar la app con GitHub Pages

1. Dentro del repo `finanzas`, ve a **Settings** (pestaña de arriba).
2. En el menú izquierdo, entra en **Pages**.
3. En **Build and deployment** → **Source**, elige **Deploy from a branch**.
4. En **Branch**, elige `main` y la carpeta `/ (root)`, y pulsa **Save**.
5. Espera 1–2 minutos y recarga la página. Arriba aparecerá: *"Your site is live at `https://TU-USUARIO.github.io/finanzas/`"*.
6. Guarda esa dirección: **es tu app**.

## PASO 4 · Crear el repositorio de los DATOS (privado)

1. **＋** → **New repository**.
2. **Repository name**: `finanzas-datos`
3. Marca **Private** 🔒 (muy importante).
4. **Create repository** → enlace **"uploading an existing file"**.
5. Arrastra el fichero **`data.json`** que te he generado desde tu Excel (809 movimientos, reglas, histórico 2015‑2025 y el cuadro de la hipoteca).
6. **Commit changes**.

## PASO 5 · Crear el token (la llave para que la app use tus datos)

1. Foto de perfil (arriba a la derecha) → **Settings**.
2. Abajo del todo, en el menú izquierdo: **Developer settings**.
3. **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
4. Rellena:
   - **Token name**: `App finanzas`
   - **Expiration**: *Custom* → la fecha máxima que permita (unos 12 meses). Apúntate en el calendario renovarlo.
   - **Repository access**: **Only select repositories** → elige **`finanzas-datos`** (solo ese).
   - **Permissions** → **Repository permissions** → **Contents** → **Read and write**. *(Metadata: Read-only se añade solo.)*
5. **Generate token** y **cópialo ya** (empieza por `github_pat_…`). GitHub no te lo volverá a enseñar.
   - Si lo pierdes: genera otro y pégalo en la app (Ajustes).

## PASO 6 · Primer arranque en el PC

1. Abre `https://TU-USUARIO.github.io/finanzas/` en Chrome o Edge.
2. **Crea tu PIN** (4–6 dígitos) y repítelo.
3. En la bienvenida, pulsa **1 · Conectar con GitHub**.
4. Rellena los campos:
   - **Usuario de GitHub**: tu usuario
   - **Repositorio privado**: `finanzas-datos`
   - **Fichero**: `data.json`
   - **Token**: pega el `github_pat_…`
5. Pulsa **Probar y guardar** → **Usar los de GitHub**.
6. Listo: arriba verás **● Sincronizado** en verde.
7. (Opcional) Instálala como aplicación: en Chrome/Edge, icono **⊕ Instalar** a la derecha de la barra de direcciones.

## PASO 7 · Instalar en el móvil

**Android (Chrome)**
1. Abre la dirección de tu app.
2. Menú **⋮** → **Instalar aplicación** (o **Añadir a pantalla de inicio**).

**iPhone (Safari, tiene que ser Safari)**
1. Abre la dirección de tu app.
2. Botón **Compartir** (cuadrado con flecha) → **Añadir a pantalla de inicio**.

Después:
3. Abre la app desde el icono 💶.
4. Crea un PIN. Puede ser distinto del del PC.
5. **Conectar con GitHub** con los mismos datos y el mismo token. Para no teclearlo, mándatelo a ti mismo por un canal seguro y bórralo después.

---

## Uso mensual: cargar los movimientos del banco

1. En la web de **BBVA** → tu cuenta → **Movimientos** → elige fechas → **Descargar** → **Excel**.
2. En la app: pestaña **Movimientos** → **⬆︎ Importar extracto** → elige el fichero.
3. Se abre **Revisar importación**:
   - Los conceptos conocidos ya vienen **clasificados** (reglas = tu antigua hoja SideTables).
   - La nómina y la hipoteca se asignan **al mes siguiente** automáticamente (como hacías a mano).
   - Los **posibles repetidos** (misma F.Valor + Concepto + Movimiento + Importe que uno ya guardado) aparecen **desmarcados** con la etiqueta **R**.
   - Escribe el **Concepto 2** y corrige el grupo o el mes si hace falta.
4. Pulsa **Importar seleccionados**. Se sincroniza solo con GitHub.
5. Si algo quedó **Sin clasificar**: tócalo → elige el subgrupo → **Crear regla**. La próxima vez se clasificará solo.

## Préstamos nuevos (cómo está resuelto)

Cada préstamo es una ficha con: **nombre**, **subgrupo vinculado** (donde caen sus cuotas en Movimientos), **capital**, **lo pagado antes de tener movimientos** y su **cuadro de amortización**.

1. Pestaña **Préstamos** → **＋ Préstamo**.
2. En **Subgrupo**, elige uno existente o **＋ Crear subgrupo nuevo** (por ejemplo, `Préstamo coche`). Se añade a *Gasto mensual fijo* y aparece en la Tabla y en los gráficos.
3. Añade el cuadro de una de estas dos formas:
   - **📄 Importar Excel/CSV** del banco. Necesita las columnas *Fecha* y *Letra/Cuota*, o *Intereses* + *Principal*.
   - **🧮 Generar (sistema francés)**: capital, TIN, nº de cuotas y fecha de la 1ª cuota.
4. Crea una **regla** para el concepto del cargo del banco → subgrupo del préstamo.

A partir de ahí, la app calcula sola las cuotas faltantes, la fecha de fin y el gráfico Pagado vs Pendiente.

## Seguridad: lo que conviene saber

- **¿Olvidaste el PIN?** En la pantalla de bloqueo: *¿Olvidaste el PIN?* → borra los datos **de ese dispositivo**. Tus datos siguen en GitHub; vuelve a conectar y listo.
- **Bloqueo automático**: por defecto, a los 5 minutos en segundo plano (Ajustes).
- **Copia extra**: Ajustes → **Exportar copia (.json)**. Además, GitHub guarda el historial de cada cambio de `data.json` (pestaña *History*).
- **Conflictos**: si cambias datos en el móvil sin conexión y a la vez en el PC, la app te preguntará qué versión conservar.

## Actualizar la app en el futuro

Cuando te pase una versión nueva: repo `finanzas` → **Add file** → **Upload files** → arrastra los ficheros nuevos → **Commit**. Los dispositivos la cogen solos la próxima vez que abras la app con conexión. Tus datos no se tocan.
