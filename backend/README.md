# Backend de MacroMind

Backend HTTP pequeño y sin base de datos. Mantiene `OPENROUTER_API_KEY` solo en el servidor y recibe una imagen como data URL para llamar a OpenRouter mediante Chat Completions.

## Desarrollo local

```powershell
cd backend
Copy-Item .env.example .env
# Edita .env y coloca tu clave real solo en el ordenador que ejecuta este proceso
npm install
npm run dev
```

Comprueba `http://localhost:8787/health`. En un teléfono, `localhost` apunta al teléfono: usa la IP LAN del ordenador, por ejemplo `http://192.168.1.25:8787`, y configura `EXPO_PUBLIC_ANALYSIS_API_URL` con esa dirección. Ambos dispositivos deben estar en la misma red y el firewall debe permitir el puerto.

Para usarlo fuera de casa, despliega el proceso detrás de HTTPS en un proveedor que admita Node o usa un túnel seguro de desarrollo. Revisa el coste del hosting, el tráfico de imágenes y las políticas de la cuenta antes de publicar la URL.

El backend no registra imágenes ni cuerpos de petición. El límite de tamaño es 8 MB, hay timeout de 45 segundos y un límite de peticiones en memoria por IP. Para producción conviene usar un proxy HTTPS y un rate limiter persistente.

Configura `AI_PROVIDER=openrouter`, `OPENROUTER_API_KEY` y `OPENROUTER_MODEL`. El modelo gratuito recomendado es `google/gemma-4-26b-a4b-it:free`. OpenRouter admite entrada multimodal para este modelo; aun así, la cuota gratuita puede limitar o rechazar solicitudes. El backend no cambia silenciosamente a un modelo de pago.

## Fuentes nutricionales

La IA visual sigue utilizando OpenRouter y Gemma. Las búsquedas nutricionales se realizan desde este backend:

- USDA FoodData Central: configura `USDA_API_KEY` en `backend/.env`. La clave nunca se envía al móvil. El endpoint local es `GET /nutrition/search?q=arroz&preparation=cooked`.
- Open Food Facts: se consulta principalmente por código de barras con `GET /nutrition/barcode/12345678`. Configura `OPENFOODFACTS_USER_AGENT` con un identificador de aplicación y contacto.

USDA requiere una clave de data.gov y aplica límites por IP; sus datos están publicados bajo CC0 y se debe atribuir FoodData Central. Open Food Facts solicita un User-Agent identificable, limita las búsquedas y advierte que sus datos pueden estar incompletos o ser incorrectos. Consulta [USDA FoodData Central](https://fdc.nal.usda.gov/api-guide/) y [Open Food Facts API](https://openfoodfacts.github.io/openfoodfacts-server/api/) antes de desplegar.

Los resultados solo se guardan en SQLite después de que el usuario selecciona o corrige la coincidencia y confirma la comida. Los alimentos guardados incluyen fuente, identificador externo, código de barras y estado de preparación; así funcionan como caché local sin conexión. Una coincidencia ambigua no se sustituye automáticamente.

## Despliegue del backend

El backend no guarda datos personales ni contiene una base remota. `Dockerfile` compila TypeScript y arranca `dist/index.js`. Publicalo detras de HTTPS en un proveedor de tu eleccion y configura las variables de entorno del servicio. Usa `ALLOWED_ORIGIN` con el origen web concreto cuando corresponda; las apps nativas no dependen de CORS. Activa `TRUST_PROXY=true` solo detras de un proxy que controles. El rate limit es local a cada instancia y no sustituye autenticacion o un gateway si se expone a terceros.

Comprobaciones de despliegue:

```powershell
npm run typecheck
npm run build
npm start
Invoke-RestMethod http://localhost:8787/health
```

El endpoint `/analyze` acepta imagenes base64 de hasta el limite configurado y `/nutrition/search` y `/nutrition/barcode` consultan proveedores externos con timeout y cache temporal en memoria. No registres cuerpos de solicitudes, imagenes ni variables de entorno.