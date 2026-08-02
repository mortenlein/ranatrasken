// Stand-in for the declarations `npx expo start` generates into expo-env.d.ts,
// so `tsc --noEmit` also passes on a fresh checkout.
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}
declare module '*.css';
