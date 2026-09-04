# Big Data

CRM con enfoque en análisis de datos de ventas. Aplicación 100% frontend construida con React, TypeScript y Vite: procesa archivos CSV, los perfila estadísticamente y genera un panel con métricas y gráficas interactivas.

## Stack

- **React 19** + **TypeScript** + **Vite** (con React Compiler habilitado)
- **react-router-dom** — rutas protegidas y layout de dashboard
- **recharts** — gráficas del panel
- **papaparse** — parseo y análisis de CSV
- **lucide-react** — iconografía

## Funcionalidades

- **Landing** pública con presentación del producto.
- **Login / Registro** con verificación por código OTP (flujo demo en `localStorage`, incluye cuenta demo `demo@bigdata.io` / `demo123`).
- **Procesar Datos**: carga CSV por arrastre, detección automática de tipos (numérico, fecha, categórico, booleano), roles semánticos de columnas (fecha, ingresos, categoría…) y pipeline visual de proceso.
- **Panel General**: KPIs, evolución temporal mensual, tipos de dato, valores faltantes, histograma y ranking de categorías.
- **Limpieza de Datos**: tabla paginada con búsqueda global, eliminación de duplicados y relleno de faltantes (mediana / moda). Cada limpieza genera una versión nueva trazable.
- **Almacén local**: datasets persistidos en IndexedDB con historial para revincular sin reprocesar.

## Scripts

```bash
npm install     # instalar dependencias
npm run dev     # servidor de desarrollo
npm run build   # build de producción (tsc -b && vite build)
npm run lint    # eslint
npm run preview # previsualizar el build
```

## Estructura

```
src/
├── components/    # Logo, guards de rutas
├── context/       # AuthContext (sesión/OTP) y DataContext (dataset/historial)
├── layouts/       # DashboardLayout (sidebar + topbar)
├── lib/           # csvAnalyzer (perfilado/limpieza) y datasetStore (IndexedDB)
└── pages/         # Landing, Login, Verify y páginas del dashboard
```

> Los datos de autenticación se guardan sin cifrar en `localStorage`: es un proyecto demo, no usar credenciales reales.
