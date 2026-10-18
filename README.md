# ¿Qué vemos?

App web para el móvil para decidir qué ver entre Oswaldo, Ana y Ángela. Incluye:

- una lista personal por persona,
- una lista común con votos («me apetece») y comentarios,
- un asistente que propone títulos según el plan,
- lo más visto de la semana en España,
- carátulas y dónde ver cada título.

## Puesta en marcha (unos 10 minutos)

### 1. Supabase (listas y comentarios compartidos)
1. Entra en https://supabase.com y crea una cuenta gratuita.
2. Pulsa **New project**. El nombre puede ser `quevemos` y la región **West EU**. Apunta la contraseña que te pide; no la necesitarás en la app.
3. Cuando termine de crearse, ve a **SQL Editor → New query**.
4. Pega todo el contenido de `supabase.sql`. Cambia `1234` por vuestro PIN de 4 cifras y pulsa **Run**.
5. Ve a **Project Settings → API** y copia:
   - **Project URL**, que termina en `.supabase.co`,
   - la clave **anon public**.

### 2. TMDB (carátulas y dónde verlo)
1. Crea una cuenta gratuita en https://www.themoviedb.org/signup y confirma el correo.
2. Ve a **Ajustes → API → Crear → Developer** y acepta las condiciones. En la web de la aplicación puedes poner la dirección de GitHub Pages.
3. Copia la **Clave de la API**, que tiene 32 letras y números.

### 3. Configuración
Rellena `config.js` con los tres valores. La clave anon de Supabase puede ser pública: las tablas están cerradas y todo pasa por funciones que exigen el PIN.

### 4. En el móvil
Abre el enlace e instálala:
- **iPhone:** Compartir → «Añadir a pantalla de inicio».
- **Android:** menú ⋮ → «Instalar aplicación».

## Actualizar lo más visto
`data/trends.json` guarda el top de cada plataforma. Una tarea programada de Claude lo actualiza cada lunes. El apartado «Recién estrenadas» y las propuestas del asistente salen en directo de TMDB.

## Cambiar el PIN
En Supabase → SQL Editor ejecuta:

```sql
update app_secret set pin_hash = extensions.crypt('NUEVO', extensions.gen_salt('bf')) where id = 1;
```

Esta app usa la API de TMDB pero no está avalada ni certificada por TMDB. Los datos de dónde ver cada título son de JustWatch.
