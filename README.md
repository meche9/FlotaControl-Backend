# FlotaControl - Backend

API NestJS + Prisma (MySQL) del sistema FleetFlow.

## Puesta en marcha

```bash
pnpm install
cp .env.example .env        # completar DATABASE_URL, JWT_SECRET y SEED_ADMIN_*
pnpm db:push                # crea/actualiza tablas (incluye refresh_tokens y usuarios.token_version)
pnpm db:seed                # roles base + administrador inicial
pnpm start:dev
```

> Los usuarios creados antes de este cambio tienen la contraseña guardada en texto plano y no podrán
> iniciar sesión: use "¿Olvidó su contraseña?" o que un administrador les asigne una nueva
> (`PATCH /api/v1/usuarios/:id` con `password`).

## Autenticación y seguridad (OWASP Top 10)

Todas las rutas requieren `Authorization: Bearer <accessToken>` salvo las marcadas con `@Public()`:

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/api/v1/auth/login` | Público (5/min por IP) | Devuelve `accessToken` (15 min) y deja el refresh token en la cookie httpOnly `ff_rt` |
| POST | `/api/v1/auth/refresh` | Cookie + Origin permitido | Rota el refresh token y emite un nuevo access token |
| POST | `/api/v1/auth/logout` | Cookie + Origin permitido | Revoca la sesión y borra la cookie |
| POST | `/api/v1/auth/forgot-password` | Público (3/min por IP) | Envía el enlace de restablecimiento por correo (respuesta idéntica exista o no el email) |
| POST | `/api/v1/auth/reset-password` | Público (5/min por IP) | Cambia la contraseña con el token del enlace y cierra todas las sesiones |
| GET | `/api/v1/auth/profile` | Autenticado | Perfil del usuario |
| * | `/api/v1/usuarios` | Rol Administrador / Super Admin | Gestión de usuarios |
| * | `/api/v1/vehiculos`, `/api/v1/conductores` | Autenticado | CRUD |

- **A01 Control de acceso**: guard JWT global + `@Roles()`; en cada petición se verifica en BD que el usuario siga activo y que su `tokenVersion` coincida (cambiar la contraseña invalida los tokens al instante). Los endpoints de cookie validan el `Origin` (CSRF).
- **A02 Criptografía**: contraseñas con bcrypt (12 rondas); tokens de reset y refresh guardados solo como hash SHA-256; JWT HS256 con `iss`/`aud` y algoritmo fijo; `passwordHash` nunca sale de la API.
- **A04/A07 Autenticación**: mensajes genéricos y tiempo constante (sin enumeración de usuarios), bloqueo de 15 min tras 5 intentos, rate limit por IP, política de contraseñas (8-64, mayúscula, minúscula, número y símbolo), refresh tokens opacos con rotación y detección de reutilización, expiración absoluta de sesión.
- **A05 Configuración**: variables de entorno validadas al arrancar (la app no inicia con un `JWT_SECRET` débil), Helmet, CORS restringido por `CORS_ORIGINS`, `ValidationPipe` con whitelist.
- **A09 Registro**: login fallido/exitoso, bloqueos, reutilización de tokens y restablecimientos se registran sin datos sensibles.

En desarrollo sin `SMTP_HOST`, el enlace de restablecimiento se imprime en la consola del servidor (nunca en la respuesta HTTP).

## Pruebas

```bash
pnpm test        # unitarias (AuthService y guards)
pnpm test:e2e    # flujo HTTP completo de autenticación (sin necesidad de MySQL)
```

---

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

To add it to this project:

```bash
$ pnpm install @nestjs/observe
```

Then follow the [setup guide](https://docs.nestjs.com/observability/overview) - it takes a single import and an app key.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
