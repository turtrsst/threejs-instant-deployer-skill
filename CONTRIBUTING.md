# Contributing

Use Node >=20.19, `npm ci`, and `npm run check`. Commit source and package-lock, not dist/node_modules or downloaded assets. Add offline fixtures generated at test time; do not copy third-party models without licensing evidence. Avoid API calls in default tests. `npm run test:live` is optional and requires access to provider hosts. Run `npm run build` after modifying TypeScript before invoking source CLI wrappers against an existing dist directory.

Pull requests should describe user impact, tests run, limitations, and license implications. New providers must verify license and relevance, reject unsafe resources, and support mock tests. Never include tokens or giant binary fixtures. For browser changes verify model fallback, grounding, scaling, animation, disposal, and matching addon versions.
