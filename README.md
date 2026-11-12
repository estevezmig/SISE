# SISE · Sistemas Secuenciales · Prototipo 0.2

Repositorio didáctico para trabajar con GRAFCET, Ladder y FUP. Se compone de:

- **Editor**: copia compilada de [GrafcetMaker](https://github.com/AronLenvig/GrafcetMaker), de Aron Ingi Lenvig y colaboradores (licencia MIT), sin modificar el motor de simulación. Se descarga desde el commit `997dbb026488087252ca473d8828fbb43a957493` durante el despliegue.
- **Conversor genérico LD/FBD**: desarrollo experimental independiente de SISE para diagramas GRAFCET en archivos `.grafcet.json` v4.

**AVISO IMPORTANTE: el conversor NO es funcional para controlar un PLC y está pendiente de depuración y validación.** Los esquemas son representaciones didácticas, no archivos importables en LOGO!, TIA Portal ni ningún PLC. Es imprescindible contrastar simultaneidad, transiciones transitorias, acciones memorizadas y temporizadores con IEC 60848 y las condiciones del autómata.

## Funciones del conversor 0.2

- Secuencias de un solo GRAFCET parcial, con una etapa inicial.
- Divergencias y convergencias alternativas (OR) y paralelas (AND).
- Receptividades booleanas (`AND`, `OR`, `NOT`), flancos `↑`, `↓`, `RE`, `FE`, temporizadores por etapa (`10s/X0`) y comparaciones sencillas (`Count >= 100`).
- Acciones continuas y acciones memorizadas al activar, desactivar o detectar evento; `MOVE`, `ADD`, `SUB` sencillos.
- Etapas calculadas a partir de un estado previo, con marcas de transición y estado siguiente, presentado en dibujos SVG Ladder y FUP.
- Exportación SVG, impresión/PDF y lista lógica ilustrativa.

**Limitaciones conocidas:** no convierte macroetapas, forzados, varios GRAFCET relacionados ni expresiones numéricas complejas; el dibujo no implementa los bloques de TON/comparación/flanco reales del PLC, solo representa sus señales y parámetros. No se ha verificado aún la ejecución equivalente al motor GRAFCET del autor.

## Ejemplos y pruebas

`ejemplo_semaforo.grafcet.json` y `ejemplo_taladrado.grafcet.json` reproducen las etapas, condiciones y acciones documentadas en los ejemplos originales GrafcetMaker mediante la estructura pública v4. No son archivos exportados desde el editor original.

`ejemplo_paralelo.grafcet.json` ejercita una divergencia y convergencia AND. Ejecutar las comprobaciones con:

```sh
node tests/test-converter.js
```

## Despliegue

`.github/workflows/pages.yml` construye una copia fija de GrafcetMaker con `npm ci && npm run build`, copia la licencia original y publica `/editor/`, `/convertidor/` y la portada mediante GitHub Pages. `scripts/inject_auth.py` incorpora un **acceso por contraseña de interfaz** en las páginas del editor; el conversor usa el mismo archivo `auth.js`.

La contraseña JavaScript **no constituye una barrera de seguridad real**: al ser un repositorio público, el código fuente es visible. No usarla para guardar datos sensibles.

Para probar localmente el conversor, utilizar un servidor estático (por ejemplo `python -m http.server`) y abrir `convertidor/`.