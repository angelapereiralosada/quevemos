# ¿Qué vemos?

App web para el móvil para que Oswaldo, Ana y Ángela decidan qué ver.

- **Descubrir:** carátulas para deslizar. A la derecha, «Me apetece»; a la izquierda, «Paso»; hacia arriba, «A todos». La app aprende los gustos de cada uno a partir de lo que guarda, ve o descarta, y mezcla títulos parecidos a lo que os gustó, lo que les apetece a los demás y el top de la semana. Cuando a los tres os apetece lo mismo, hay *match* y se añade sola a «Todos».
- **Pregúntale a la IA:** un chat con Claude que conoce vuestras listas y comentarios.
- **Top:** lo más visto esta semana en España en cada plataforma.
- **Mi lista** y **Todos**. En «Todos» están las propuestas para ver juntos, con comentarios.

## Puesta en marcha

### 1. Supabase: listas y comentarios compartidos
1. Crea una cuenta en https://supabase.com y pulsa **New project**. Ponle de nombre `quevemos` y elige la región **West EU (Ireland)**.
2. Ve a **SQL Editor → New query** y pega todo `supabase.sql`. Cambia `1234` por vuestro PIN de 4 cifras y pulsa **Run**.
3. Ve a **Project Settings → API** y copia la **Project URL** y la clave **anon public**. Si solo ves «Publishable key», copia esa.

### 2. Chat con IA (Claude)
1. Crea una cuenta en https://console.anthropic.com. Añade saldo en **Billing**; con 5 € hay para muchísimas consultas. Después ve a **API Keys → Create Key** y copia la clave (empieza por `sk-ant-`).
2. En Supabase ve a **Edge Functions → Secrets**, añade uno llamado `ANTHROPIC_API_KEY` y pega la clave como valor.
3. Ve a **Edge Functions → Deploy a new function → Via Editor**. Ponle de nombre `recomendar`, pega el contenido de `supabase/functions/recomendar/index.ts` y pulsa **Deploy**.
4. En los ajustes de la función, desactiva **Verify JWT** (el PIN ya protege el acceso) y guarda.

### 3. Configuración
Rellena `config.js` con la Project URL y la clave anon. La clave de TMDB ya está puesta.

## Lo más visto
`data/trends.json` guarda el top semanal de cada plataforma en España y se actualiza cada lunes.

## Cambiar el PIN
En Supabase → SQL Editor ejecuta:

```sql
update app_secret set pin_hash = extensions.crypt('NUEVO', extensions.gen_salt('bf')) where id = 1;
```

Esta app usa la API de TMDB pero no está avalada ni certificada por TMDB. Los datos de dónde ver cada título son de JustWatch.
