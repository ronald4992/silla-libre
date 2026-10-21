# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

## Inicio de sesión con Google

El acceso con Google se configura en Firebase; no requiere claves de Google
adicionales en el código:

1. En Firebase Console, abre **Authentication → Sign-in method** y habilita
   **Google**.
2. En **Authentication → Settings → Authorized domains**, añade el dominio
   donde publicarás la aplicación. Para desarrollo local, autoriza
   `localhost` si no aparece en la lista.
3. Copia la configuración de la aplicación web de Firebase a
   `silla-libre/.env.local` usando como guía `silla-libre/.env.example`.
4. Desde la raíz del repositorio, ejecuta `npm run dev` y usa **Continuar con
   Google** en la ventana de acceso.

Google está habilitado para cuentas de comensal. Las cuentas de restaurante
siguen utilizando su registro con los datos y el certificado requeridos.

## Desplegar en Netlify

La configuración de [`netlify.toml`](../netlify.toml) establece la aplicación
`silla-libre/` como base del build, ejecuta `npm run build` y publica `dist`.
Conecta el repositorio en Netlify y deja que use esta configuración. El archivo
`public/_redirects` permite que las rutas de la aplicación, como
`/perfil/usuario`, carguen correctamente al abrirlas o recargarlas directamente.
Configura en Netlify las variables de entorno `VITE_FIREBASE_*` necesarias
antes del despliegue.

## Desplegar en Cloudflare Pages

Este repositorio contiene un workspace npm en la raíz y la aplicación Vite en
`silla-libre/`. Al crear el proyecto de Pages, configura:

- **Root directory:** `silla-libre`
- **Build command:** `npm run build`
- **Build output directory:** `dist`

Si usas el detector de aplicaciones de Cloudflare desde VS Code, abre
`silla-libre.code-workspace` con **File → Open Workspace from File...** y vuelve
a ejecutar la detección. Ese workspace coloca la aplicación (`silla-libre/`)
como directorio raíz activo, en vez de la raíz del workspace npm.

No uses la raíz del repositorio como directorio de la aplicación: Cloudflare
intentará detectar el workspace y mostrará el error de detección. En los ajustes
de variables de entorno de Pages, configura las variables `VITE_FIREBASE_*`
que necesite el proyecto (ver `silla-libre/.env.example`). El servidor Node.js
de `silla-libre/servidor/` no forma parte del build estático de Pages; debe
desplegarse por separado si se usa.
