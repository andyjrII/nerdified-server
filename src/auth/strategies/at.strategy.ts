import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
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
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.AT_SECRET_KEY,
    });
  }

  validate(payload: JwtPayload) {
    return payload;
  }
}
