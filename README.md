# MacroMind

MacroMind es una aplicación móvil personal para registrar comidas, revisar estimaciones visuales y entender calorías, macronutrientes, peso y objetivos. Los datos del usuario se guardan localmente.

## Arquitectura

- `app/`: pantallas y navegación Expo Router.
- `src/components/`: componentes visuales compartidos.
- `src/database/`: SQLite nativo, adaptador web, migraciones y repositorios.
- `src/services/`: cálculo nutricional, objetivos, estadísticas, IA, respaldos y fuentes externas.
- `backend/`: servidor Node sin base de datos remota. Guarda las claves de OpenRouter y USDA únicamente en el servidor.
- `tests/`: pruebas unitarias de reglas de negocio, persistencia web, esquemas y servicios.

La app usa Expo SDK 57, React Native 0.86, Expo Router, TypeScript estricto y `expo-sqlite`. En Android/iOS usa SQLite nativo; en web usa el adaptador local basado en `localStorage`.

## Requisitos

- Node.js 22.13 o posterior para Expo SDK 57.
- npm.
- Expo Go compatible para la primera prueba en Android/iOS, o una development build si el entorno lo requiere.
- Para iOS local: macOS y Xcode. Como alternativa, EAS Build requiere una cuenta Expo.

## Ejecutar la app

```powershell
npm install
Copy-Item .env.example .env
npm run start
```

Comandos directos:

```powershell
npm run android
npm run ios
npm run web
```

La primera apertura inicializa las migraciones locales. No borres la base de datos si necesitas conservar el historial.

## Usuarios y acceso local

Cada persona crea su propio usuario y contraseña desde la pantalla de acceso. Al volver a abrir MacroMind se solicita iniciar sesión; no se activa automáticamente el último usuario. Desde **Perfil** se puede cerrar sesión para que entre otra persona.

Cada cuenta tiene su propio perfil, objetivos con fecha, comidas, ingredientes asociados y pesajes. La migración SQLite v7 convierte el perfil y los registros existentes en una cuenta pendiente de configurar sin reiniciar ni borrar datos; en la pantalla de acceso aparece la opción **Configurar acceso a mi historial anterior**.

Las cuentas son locales al dispositivo. No existe recuperación de contraseña ni sincronización entre teléfonos porque el proyecto mantiene SQLite/localStorage y no usa un servicio remoto de autenticación. El respaldo JSON conserva las cuentas y sus hashes, pero nunca contraseñas en texto plano.

## Configuración de IA y fuentes nutricionales

Edita `backend/.env` en el ordenador que ejecuta el backend:

```dotenv
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=tu_clave_real
OPENROUTER_MODEL=google/gemma-4-26b-a4b-it:free
USDA_API_KEY=tu_clave_data_gov
OPENFOODFACTS_USER_AGENT=MacroMind/1.0 (tu-correo@example.com)
```

Nunca pongas estas claves en `.env` del cliente ni en variables `EXPO_PUBLIC_*`. Reinicia el backend después de cambiar sus variables.

## Ejecutar el backend

```powershell
cd backend
npm install
npm run dev
```

Comprueba:

```powershell
Invoke-RestMethod http://localhost:8787/health
```

Rutas principales:

- `POST /analyze`: análisis visual mediante OpenRouter.
- `GET /nutrition/search?q=chicken%20cooked&preparation=cooked`: USDA FoodData Central.
- `GET /nutrition/barcode/3017620422003`: Open Food Facts.

USDA se consulta desde el backend y los resultados se validan antes de mostrarse. Open Food Facts se usa principalmente para productos con código de barras. Las coincidencias ambiguas se revisan manualmente y los datos solo se guardan después de confirmar la comida.

## Probar desde un teléfono físico

1. Conecta el ordenador y el teléfono a la misma red local.
2. Averigua la IP LAN del ordenador con `ipconfig`.
3. Inicia el backend en el ordenador.
4. Copia `.env.example` a `.env` en la raíz y configura:

```dotenv
EXPO_PUBLIC_DEMO_MODE=false
EXPO_PUBLIC_ANALYSIS_API_URL=http://192.168.1.25:8787
```

5. Sustituye la IP por la de tu ordenador y reinicia Metro:

```powershell
npx expo start -c
```

`localhost` desde el teléfono apunta al teléfono, no al ordenador. El firewall debe permitir el puerto 8787. Para una red externa hace falta un backend HTTPS protegido; no expongas el servidor HTTP local directamente a internet.

El modo demo se activa con `EXPO_PUBLIC_DEMO_MODE=true` y devuelve datos ficticios claramente etiquetados. No representa una respuesta real de OpenRouter.

## Respaldos

En Configuración puedes exportar e importar un JSON versionado con perfil, objetivos, comidas, alimentos y pesajes. La importación valida el archivo y pide confirmación antes de reemplazar datos. Las fotografías se conservan como rutas locales y no se incluyen como blobs.

## Validación

```powershell
npm test
npm run typecheck
npm run lint
npx expo export --platform web
cd backend
npm run typecheck
```

Para revisar la configuración Expo:

```powershell
npx expo config --type public
npx expo-doctor
```

La prueba en un dispositivo físico debe comprobar cámara, galería, permisos, persistencia SQLite y conexión al backend. La prueba web no sustituye esa validación nativa.

## Build de prueba

Para la primera prueba, usa Expo Go si los módulos incluidos en el SDK son suficientes. Si necesitas una build nativa:

```powershell
npx expo prebuild --clean
npx expo run:android
```

`android/` e `ios/` son directorios generados por CNG; no se editan manualmente. Para EAS, configura una cuenta y ejecuta `npx eas-cli@latest build:configure` antes de solicitar una build. No se publican aplicaciones ni se generan costes desde este repositorio.

## Limitaciones conocidas

- El análisis visual estima porciones; no mide gramos ni ingredientes ocultos con exactitud.
- El backend no tiene autenticación de usuario y el rate limit en memoria está pensado para uso personal.
- Los datos permanecen en el dispositivo y no se sincronizan entre teléfonos.
- Las metas son estimaciones generales, no recomendaciones médicas.

## Uso diario sin PowerShell

La aplicacion instalada no necesita Expo ni un backend ejecutandose en este ordenador para las funciones locales: usuarios locales, perfil, comidas manuales, historial, estadisticas, peso y respaldos funcionan en el dispositivo. El analisis visual y las consultas USDA/Open Food Facts requieren internet y un backend HTTPS desplegado.

### Desplegar el backend

El backend incluye `backend/Dockerfile` y puede desplegarse en un proveedor que ejecute contenedores o Node.js. Configura en el servicio, nunca en el cliente, `AI_PROVIDER`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `USDA_API_KEY`, `OPENFOODFACTS_USER_AGENT`, `ALLOWED_ORIGIN`, `TRUST_PROXY=true` si el proveedor entrega `x-forwarded-for`, y los limites de solicitudes. Comprueba `https://TU-DOMINIO/health` antes de compilar la app. El repositorio no contiene una URL de produccion ni despliega el servicio automaticamente.

### Compilar un APK de prueba

Con una cuenta Expo/EAS y una URL HTTPS real:

```powershell
npx eas-cli@latest login
npx eas-cli@latest env:set --name EXPO_PUBLIC_DEMO_MODE --value false --environment preview --visibility plaintext
npx eas-cli@latest env:set --name EXPO_PUBLIC_ANALYSIS_API_URL --value https://TU-DOMINIO --environment preview --visibility plaintext
npx eas-cli@latest build --profile preview --platform android
```

Descarga el APK indicado por EAS e instalalo en Android. Para una compilacion de tienda usa `npx eas-cli@latest build --profile production --platform android`; ese perfil genera normalmente un AAB. No uses la IP LAN ni `localhost` en una compilacion instalada fuera de la red local. Para iOS se necesita una cuenta Apple y firma mediante EAS.