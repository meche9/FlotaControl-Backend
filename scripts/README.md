# Despliegue de FlotaControl

`deploy.sh` publica en producción el último commit de `main` de cada app, usando la API de Coolify.

## Requisitos

- Bash con `curl` (Linux, macOS o Git Bash en Windows).
- Un token de Coolify con permisos **deploy** y **read**:
  1. Entrar a https://panel.mflotacontrol.duckdns.org
  2. **Keys & Tokens → API tokens → Create**, marcar solo `deploy` y `read`.
  3. Guardarlo en un archivo `.coolify-token` junto al script, o exportarlo como `COOLIFY_TOKEN`.
     Nunca subirlo a git.

## Uso

```bash
./deploy.sh              # extractor, backend y frontend, en ese orden
./deploy.sh backend      # solo una app: backend | frontend | extractor
./deploy.sh all --force  # reconstruye sin usar la caché de build
```

El script espera a que cada deploy termine, comprueba que la app responda y se detiene en el primer error.

## Base de datos

No hace falta correr migraciones a mano: el backend ejecuta `prisma db push` al arrancar y
sincroniza las tablas con `prisma/schema`.

- Cambios que solo agregan (tablas, columnas con valor por defecto, índices) se aplican solos.
- Si un cambio **borraría datos** (quitar o renombrar columnas, cambiar tipos), Prisma lo rechaza,
  el backend no arranca y el script lo informa. En ese caso hay que ajustar el esquema o migrar
  los datos antes de volver a desplegar.
