# CrimeMap CABA — Explorador Predictivo de Delitos

Aplicación web estática para visualizar barrios de la Ciudad Autónoma de Buenos Aires y consultar estimaciones estadísticas sobre el tipo de delito más probable según una matriz de predicciones precalculada.

## Objetivo académico

El proyecto busca presentar de forma clara y visual los resultados de un modelo supervisado de clasificación entrenado sobre datos históricos de delitos de CABA. La aplicación está pensada para una entrega universitaria simple de ejecutar, prolija y compatible con GitHub Pages.

## Tecnologías utilizadas

- HTML5
- CSS3
- JavaScript vanilla
- [Leaflet](https://leafletjs.com/) para el mapa interactivo
- [OpenStreetMap](https://www.openstreetmap.org/) como mapa base
- [Turf.js](https://turfjs.org/) para detección punto-en-polígono
- [Chart.js](https://www.chartjs.org/) para gráficos de importancia de variables

## Estructura del proyecto

```text
/
├── index.html
├── styles.css
├── app.js
├── README.md
├── assets/
└── data/
    ├── barrios_caba.geojson
    ├── matriz_predicciones.json
    ├── metricas_modelo.json
    └── feature_importance.json
```

## Cómo ejecutar localmente

1. Abrí la carpeta del proyecto en VS Code.
2. Ejecutá la app con una extensión como `Live Server`.
3. Abrí `index.html` desde ese servidor local.

La app usa `fetch()` para cargar archivos JSON, por lo que conviene ejecutarla desde un servidor estático local en lugar de abrir el archivo con protocolo `file://`.

## Cómo publicar en GitHub Pages

1. Subí el contenido del proyecto a un repositorio de GitHub.
2. En `Settings > Pages`, elegí la rama principal y la carpeta raíz (`/root`).
3. Guardá la configuración.
4. GitHub Pages publicará el sitio como una web estática sin necesidad de backend.

## Cómo funciona la matriz de predicciones

La app no ejecuta el modelo en vivo. En cambio:

1. El usuario hace clic en un punto del mapa.
2. La app detecta en qué barrio y comuna cae el punto usando el GeoJSON oficial.
3. El navegador calcula el contexto temporal actual:
   - `mes_num`
   - `dia_num`
   - `fin_semana`
   - `franja`
   - `turno`
4. Con esos datos se consulta `./data/matriz_predicciones.json`.
5. Si no hay coincidencia exacta, la app aplica fallbacks progresivos:
   - `barrio + comuna + franja + turno`
   - `barrio + comuna + turno`
   - `barrio + comuna`

## Aclaración metodológica

El modelo Random Forest fue entrenado previamente en Python utilizando variables temporales y geográficas del dataset de delitos. Debido a que GitHub Pages permite publicar únicamente sitios estáticos, se generó una matriz de predicciones precalculada. La aplicación consulta dicha matriz en función del barrio, comuna, mes, día, franja horaria y turno seleccionados o inferidos desde el mapa.

## Variables del modelo

Variables crudas utilizadas:

- `franja`
- `comuna`
- `mes_num`
- `dia_num`
- `fin_semana`
- `uso_arma_bin`
- `uso_moto_bin`
- `barrio`
- `turno`

Variables transformadas para el entrenamiento:

- `franja`
- `comuna`
- `mes_num`
- `dia_num`
- `fin_semana`
- `uso_arma_bin`
- `uso_moto_bin`
- `barrio_encoded`
- `turno_encoded`

Variable objetivo:

- `tipo`

## Archivos de datos

- `./data/barrios_caba.geojson`: polígonos oficiales de barrios de CABA obtenidos del dataset [Barrios](https://data.buenosaires.gob.ar/dataset/barrios) de Buenos Aires Data.
- `./data/matriz_predicciones.json`: matriz precalculada con el resultado del modelo.
- `./data/metricas_modelo.json`: archivo opcional con accuracy, precision, recall y f1-score.
- `./data/feature_importance.json`: archivo opcional con importancia de variables.

Si los archivos opcionales no existen o están vacíos, la aplicación sigue funcionando y simplemente oculta esas secciones.

## Consideraciones éticas e interpretativas

Esta aplicación no predice hechos futuros individuales ni garantiza la ocurrencia de un delito.

La estimación debe interpretarse únicamente como una referencia estadística basada en patrones históricos del dataset analizado.

Texto mostrado en la app:

> Esta predicción representa una estimación estadística basada en patrones históricos del dataset. No implica certeza ni predice eventos individuales.
