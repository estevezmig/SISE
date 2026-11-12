# SISE · GRAFCET → Ladder y FUP

## Estado: prototipo 0.1 (12 noviembre 2026)

**No es una versión compilada ni integrada de GrafcetMaker.** Este paquete define cómo desplegar una **copia real** de GrafcetMaker, compilada desde su código fuente MIT, y añade al sitio un **conversor independiente** que puede importar archivos `.grafcet.json` de GrafcetMaker.

La publicación se configura mediante `.github/workflows/pages.yml` en el repositorio `estevezmig/SISE`. La compilación se ejecuta en GitHub Actions. Para habilitar el sitio público, puede ser necesario activar **Settings > Pages > Source: GitHub Actions**. El resultado del despliegue debe comprobarse en la pestaña Actions.

## Estructura

- `index.html`: portal SISE.
- `convertidor/index.html`, `app.js`, `converter-core.js`: interfaz y motor de conversión; sin servidor ni dependencias externas.
- `ejemplo_secuencia.grafcet.json`: ejemplo compatible con el esquema de GrafcetMaker v4.
- `ejemplo_ladder.svg`, `ejemplo_fup.svg`, `ejemplo_logica.txt`: resultado del ejemplo.
- `.github/workflows/pages.yml`: descarga **GrafcetMaker** desde https://github.com/AronLenvig/GrafcetMaker, fija la revisión `997dbb026488087252ca473d8828fbb43a957493`, compila con Node 22 y publica el resultado como `editor/` junto a este conversor en `convertidor/`.

## Cómo probar sin publicar

Abre `convertidor/index.html` en un navegador moderno. Pulsa **Cargar ejemplo**, o importa desde GrafcetMaker un archivo `.grafcet.json` versión 4. Puedes alternar entre Ladder y FUP, exportar ambos en SVG, copiar la lógica o imprimir a PDF. Al abrir mediante `file://` algunas funciones del navegador (p. ej., portapapeles) pueden estar restringidas; con servidor web funcionan mejor.

El enlace «Abrir editor GRAFCET» espera que la web esté publicada bajo `/editor/`; en la copia local puedes utilizar https://www.grafcet.org/es/.

## Qué admite este primer conversor

- Un único GRAFCET parcial; exactamente una etapa inicial.
- Secuencia lineal simple, con o sin retorno a la etapa inicial (sin ramas).
- Señales booleanas y condiciones `AND`, `OR`, `NOT` con paréntesis (además de constantes 1/0).
- Acciones continuas sobre salidas BOOL.
- Transiciones evaluadas y memorizadas antes de actualizar etapas, etapas implementadas como memorias reset-dominantes y pulso `INIT` de primer ciclo.

**No admite**: divergencias/convergencias Y/O, macroetapas, acciones memorizadas, eventos, flancos RE/FE, temporizadores, contadores, comparaciones numéricas, múltiples grafcets, órdenes de forzado o importación PLC directa. Cuando el archivo utiliza alguna de esas características, la conversión se **bloquea** y muestra un error; no se inventa equivalencia.

La salida Ladder/FUP es **gráfica y didáctica**, no código directamente ejecutable en LOGO! o S7-1200. Debe verificarse la equivalencia secuencial en el autómata de destino (incluido orden de redes, first scan, valores iniciales y prioridad S/R) antes de uso real.

## Desarrollo futuro

1. Verificar el build de GrafcetMaker en GitHub Pages de SISE y probar editor y conversor.
2. Añadir integración directa «Exportar a Ladder/FUP» al menú del editor original, reutilizando su modelo de proyecto.
3. Añadir ramas Y/O con semántica IEC 60848 y pruebas de equivalencia por trazas.
4. Añadir temporizadores, contadores y acciones memorizadas, seguidos de exportadores específicos LOGO! y TIA Portal.

## Licencias

GrafcetMaker (autor Aron Ingi Lenvig y colaboradores) se distribuye bajo licencia **MIT**. El workflow incluye su `LICENSE` en la publicación del editor. Código fuente original: https://github.com/AronLenvig/GrafcetMaker. **Este repositorio no contiene copias de ese código**; lo obtiene durante el despliegue y conserva los avisos de licencia.

## Pruebas

Ejecuta `node tests/test-converter.js` (Node 22). Prueba las estructuras de salida y las condiciones no soportadas. Aún faltan pruebas end-to-end de navegador y validación contra la ejecución del editor original.