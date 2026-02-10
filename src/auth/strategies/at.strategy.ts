import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { Request } from 'express';
import { UserRole } from '@prisma/client';

export type JwtPayload = {
  sub: number;
  email: string;
  role: UserRole;
};

@Injectable()
export class ATStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          return req?.cookies?.['access_token'] ?? null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: process.env.AT_SECRET_KEY,
    });
  }

  validate(payload: JwtPayload) {
    return payload;
  }
}
