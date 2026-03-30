import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { readFileSync } from 'fs';

const workerCode = () => {
  return {
    name: 'inline-worker',
    resolveId(source) {
      if (source === 'worker-inline') return source;
      return null;
    },
    load(id) {
      if (id === 'worker-inline') {
        return `export default "inline"`;
      }
      return null;
    }
  };
};

export default [
  // Main SDK bundle
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'esm',
        sourcemap: true,
      },
      {
        file: 'dist/index.cjs',
        format: 'cjs',
        sourcemap: true,
      },
    ],
    plugins: [
      resolve(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: 'dist',
      }),
    ],
    external: ['pyodide'],
  },
  // Worker bundle (separate file)
  {
    input: 'src/worker/stats-worker.ts',
    output: {
      file: 'dist/stats-worker.js',
      format: 'iife',
      sourcemap: true,
    },
    plugins: [
      resolve(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
    ],
    external: [],
  },
];
