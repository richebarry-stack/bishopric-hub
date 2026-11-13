// Lets Node's test runner load our TypeScript files, which import each other
// without the ".ts" extension (the way Vite and Wrangler expect).
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) return next(`${specifier}.ts`, context);
    throw err;
  }
}
