# Super administrador Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Panel de Elikar en `admin.grabix.elikarsystems.com` para operar talleres y entrar como dueño con control total, sin publicar al servidor.

**Architecture:** La misma API Nest y la misma app Angular. El super administrador tiene tabla, token y rutas `/api/admin` propias. Entrar como dueño emite el JWT del dueño con `soporte`, y el guard lo trata como dueño saltándose suscripción, correo y eliminación programada. El taller bloqueado no deja entrar al equipo.

**Tech Stack:** NestJS 11, TypeORM, Angular 20 standalone, Tailwind v4, JWT 7 días.

**No desplegar.** No SSH, no Contabo, no `docker compose` de producción.

---

### Task 1: API de administración

**Files:** `backend/src/entities/index.ts`, `backend/src/common/sesion.ts`, `backend/src/common/bitacora.service.ts`, `backend/src/common/auth.guard.ts`, `backend/src/auth/auth.service.ts`, `backend/src/admin/*`, `backend/src/app.module.ts`, `.env.example`

- [ ] Reglas puras con prueba Jest: alargar plazo, renovar, impedir desactivar al propio o al último.
- [ ] Entidades `SuperAdmin`, `AdminBitacora`, `talleres.bloqueado`.
- [ ] Token `tipo: 'superadmin'` solo en `/api/admin`. Token con `soporte` opera el taller y no entra a `/api/admin`.
- [ ] Login del taller rechaza cuenta bloqueada. Bitácora del taller anota `Soporte Grabix` con `usuarioId` null.
- [ ] Bootstrap del primer admin si la tabla está vacía.

### Task 2: Panel Angular

**Files:** `frontend/src/app/core/*`, `frontend/src/app/app.routes.ts`, `frontend/src/app/pages/admin-*.ts`, `frontend/src/app/shell.ts`

- [ ] Host `admin.` usa la raíz como listado y `/entrar` como acceso. En local el panel está en `/admin`.
- [ ] `app.` y la landing mandan `/admin` a `https://admin.grabix.elikarsystems.com`.
- [ ] Ficha con datos, suscripción, usuarios y correos. Entrar como dueño guarda el token anterior, abre `/app` y la barra vuelve al panel sin perder `grabix.admin.token`.

### Task 3: Proxy

**Files:** `deploy/nginx-grabix.conf`, `deploy/Caddyfile`, `docker-compose.prod.yml`, `.env.produccion.example`

- [ ] El host `admin.grabix.elikarsystems.com` apunta al mismo `web`. CORS lo incluye. Variables `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD` documentadas. No se ejecuta el despliegue.
