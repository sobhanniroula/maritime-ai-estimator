// Tell TypeScript that importing a .css file is valid.
// Next.js's bundler (webpack) handles the actual loading;
// TypeScript just needs to know the import won't blow up at runtime.
declare module "*.css";
