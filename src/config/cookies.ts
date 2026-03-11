import { CookieOptions } from "express";

export const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  // Access token cookie: 30 días de duración (el JWT interno expira antes)
  maxAge: 60 * 60 * 24 * 30 * 1000,
};

export const refreshTokenCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  // Refresh token cookie: 7 días
  maxAge: 60 * 60 * 24 * 7 * 1000,
  // Path restringido: la cookie solo se envía al endpoint de refresh,
  // reduciendo la superficie de exposición del token.
  path: "/auth/refresh",
};
