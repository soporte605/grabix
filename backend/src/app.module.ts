import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { CorreoModule } from './correo/correo.service';
import { CatalogoModule } from './catalogo/catalogo.module';
import { AuthGuard } from './common/auth.guard';
import { BitacoraModule } from './common/bitacora.service';
import { CostosInterceptor } from './common/costos.interceptor';
import { DocumentosModule } from './documentos/documentos.module';
import { ENTIDADES, Sucursal, Taller, Usuario } from './entities';
import { OrganizacionModule } from './organizacion/organizacion.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '3306', 10),
      username: process.env.DB_USER ?? 'grabix',
      password: process.env.DB_PASSWORD ?? 'grabix',
      database: process.env.DB_NAME ?? 'grabix',
      entities: ENTIDADES,
      charset: 'utf8mb4',
      timezone: 'Z',
      dateStrings: ['DATE'],
      // En desarrollo el esquema se sincroniza solo; en producción usar migraciones.
      synchronize: process.env.DB_SYNC === 'true',
    }),
    TypeOrmModule.forFeature([Usuario, Taller, Sucursal]),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'cambia-este-secreto',
      signOptions: { expiresIn: '7d' },
    }),
    BitacoraModule,
    CorreoModule,
    CatalogoModule,
    OrganizacionModule,
    AuthModule,
    DocumentosModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: CostosInterceptor },
  ],
})
export class AppModule {}
