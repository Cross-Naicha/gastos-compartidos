# Gastos compartidos

Aplicación estática para reuniones: personas, gastos, reparto en partes iguales o por consumo, comparación de distribuciones y mensajes de WhatsApp.

## Usar

Abrí `index.html` o visitá https://cross-naicha.github.io/gastos-compartidos/ . Calculá las distribuciones y elegí **Generar QR y enlace**. Si hay dos resultados, seleccioná cuál compartir.

El QR abre `consulta.html` con una copia comprimida de la reunión dentro del fragmento del enlace (`#r=...`). Incluye participantes, gastos, reparto y transferencias elegidas. No usa una base de datos ni servicios externos para generar el QR. Si la cuenta es demasiado grande para un QR legible, permite compartir el enlace.

La consulta muestra transferencias, gastos y consumos. Cada participante puede elegir su nombre, escribir su alias y preparar mensajes de WhatsApp a quienes deban transferirle. Elegir un nombre no verifica identidad.

## Privacidad y conservación

- La página de edición conserva la reunión en `localStorage`, como la utilidad original.
- **La página de consulta no usa cookies, localStorage, sessionStorage, IndexedDB ni service workers.** Identidad y alias viven únicamente en memoria y campos de la página; se limpian al recargar, cambiar de persona o volver desde el historial.
- El enlace sigue conteniendo la reunión. El navegador puede conservar el enlace en su historial y almacenar los archivos públicos en caché; esto no puede evitarse desde una página estática. La página no persiste identidad ni alias.
- Cualquiera con el QR o enlace puede ver los datos. No hay autenticación ni sincronización. Los datos del fragmento no forman parte de la petición HTTP a GitHub Pages; los destinatarios pueden compartir o modificar su copia.
- WhatsApp se abre solo al pulsar el enlace correspondiente. El usuario elige al destinatario y confirma el envío.
- Una modificación de gastos requiere generar un enlace nuevo.

## Archivos

- `index.html`, `resolver_gastos.html`, `resolver_gastos.css`, `resolver_gastos.js`: editor.
- `consulta.html`, `consulta.js`: consulta sin almacenamiento.
- `gastos-core.js`: cálculos compartidos.
- `gastos-share.js`: formato, validación y compresión de la reunión.
- `vendor/`: qrcode-generator 2.0.4 y lz-string 1.5.0, con sus licencias.

No requiere instalar dependencias para usar la app. Para servirla localmente: `python -m http.server 5175`. Para comprobar lógica y enlaces: `node --test tests/*.test.cjs`.

## Publicación

GitHub Pages sirve la rama `main`, carpeta raíz. `.nojekyll` permite servir los archivos directamente. No se publican los datos del notebook original ni reuniones de prueba.
