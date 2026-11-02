/** JWT de prueba con fecha de expiración (en segundos); la firma no es válida. */
export function fakeJwt(expSeconds: number | null): string {
  const b64 = (value: object) =>
    btoa(JSON.stringify(value))
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  const payload = expSeconds === null ? {} : { exp: expSeconds };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}