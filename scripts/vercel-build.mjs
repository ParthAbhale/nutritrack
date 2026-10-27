// Builds NutriTrack as ONE Vercel project (web + API) using the Build Output API:
//   .vercel/output/static/                 -> the Vite client
//   .vercel/output/functions/api.func/     -> the Express API as a single serverless function
//   .vercel/output/config.json             -> routing (/api/*, /health* -> function; everything else -> SPA)
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '.vercel', 'output');
const fn = join(out, 'functions', 'api.func');
const bundleRel = 'server/dist/vercel.mjs';

rmSync(out, { recursive: true, force: true });
mkdirSync(fn, { recursive: true });

// 1. Client
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const r = spawnSync(npm, ['run', 'build', '-w', 'client'], { cwd: root, stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);
cpSync(join(root, 'client', 'dist'), join(out, 'static'), { recursive: true });

// 2. API bundle: our code + @nutritrack/shared are bundled; third-party packages stay external.
const serverPkg = JSON.parse(readFileSync(join(root, 'server', 'package.json'), 'utf8'));
const deps = Object.keys(serverPkg.dependencies).filter((d) => d !== '@nutritrack/shared');
await build({
  entryPoints: [join(root, 'server/src/vercel.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: join(fn, bundleRel),
  sourcemap: true,
  external: deps,
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: 'info',
});

// 3. Copy the runtime dependency closure (including native argon2 prebuilds) next to the bundle.
const copied = [];
const seen = new Set();
const inside = (p) => copied.some((c) => p === c || p.startsWith(c + sep));

function resolvePkg(name, from) {
  for (let dir = from; ; dir = dirname(dir)) {
    const cand = join(dir, 'node_modules', name);
    if (existsSync(join(cand, 'package.json'))) return realpathSync(cand);
    if (dir === dirname(dir)) return null;
  }
}

function addPackage(name, from) {
  const dir = resolvePkg(name, from);
  if (!dir || seen.has(dir)) return;
  seen.add(dir);
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  if (!inside(dir)) {
    cpSync(dir, join(fn, relative(root, dir)), { recursive: true, dereference: true });
    copied.push(dir);
  }
  for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies })) addPackage(dep, dir);
}
for (const dep of deps) addPackage(dep, join(root, 'server'));

writeFileSync(
  join(fn, '.vc-config.json'),
  JSON.stringify({ runtime: 'nodejs22.x', handler: bundleRel, launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration: 30 }, null, 2),
);

// 3b. A package.json so Node treats the copied packages normally.
writeFileSync(join(fn, 'package.json'), JSON.stringify({ type: 'module' }));

// 4. Routing
writeFileSync(
  join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/(?:api|health)(?:/.*)?$', dest: '/api' },
        {
          src: '/(.*)',
          headers: {
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'X-Frame-Options': 'DENY',
            'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
          },
          continue: true,
        },
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);
console.log(`Vercel output ready: ${relative(root, out)} (${copied.length} package folders copied)`);
