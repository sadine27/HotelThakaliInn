import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/* `tsc --noEmit` was the whole check for a long time, and it is blind to the one
   class of bug that actually ships in a React codebase: a hook that lies. A
   setState in an effect, a dependency array missing the thing it reads — both
   typecheck perfectly and both cause a render loop or a stale screen.

   Not eslint-config-next, deliberately. On Next 15 it pins react-hooks v5,
   which predates set-state-in-effect — the rule this is being installed for —
   and its next/no-img-element would fire on components/Img.tsx, where the raw
   <img> is the documented way an R2 photo gets served. A meta-config whose
   rules have to be argued with is worse than the three packages it replaced. */
export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      ".wrangler/**",
      ".vinext/**",
      ".ds/**",
      ".next/**",
      "public/**",
      /* Vendored third-party bundles — minified chartjs/fullcalendar and
         friends. 1,254 of the first run's 1,355 errors came from these four
         files, none of them ours to fix. A linter that reports someone else's
         minified output is a linter nobody runs. */
      "assets/**",
      /* Generated: 15,292 lines of Cloudflare binding types nobody wrote. */
      "worker-configuration.d.ts",
    ],
  },
  ...tseslint.configs.recommended,
  /* `configs.flat[...]`, not `configs["recommended-latest"]`. The top-level
     names are still the eslintrc shape, where `plugins` is an array of strings;
     ESLint 10 takes only the flat shape and rejects the other outright. */
  reactHooks.configs.flat["recommended-latest"],
  {
    /* The check scripts are plain Node, run by hand and by `npm run check`.
       They are not part of the bundle and have no React in them. */
    files: ["scripts/**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
  },
];
