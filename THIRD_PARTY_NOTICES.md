# Third-party notices

This repository's original code is MIT (see LICENSE). Installed dependencies retain their respective licenses; see the installed package LICENSE files and package-lock.json for exact versions.

- glTF Transform (core/extensions/functions): MIT, Don McCurdy and contributors.
- meshoptimizer: MIT, Arseny Kapoulkine and contributors.
- Three.js (demo and generated import references): MIT, Three.js authors.
- Draco (draco3dgltf): Apache-2.0, Google.
- Sharp: Apache-2.0; bundled libvips and codecs have their own notices distributed with Sharp.
- Babel, parse5, TypeScript, Zod, Vite and Model Context Protocol SDK: their upstream open-source licenses apply.

Poly Haven assets are CC0; keep source URLs for provenance. Sketchfab search/download is restricted by this tool to CC0 assets; provider terms and API authentication rules still apply. Locally supplied models require independent license verification. Optional Khronos registry assets have per-component licenses, including CC-BY-4.0 and Stanford Graphics terms; see `mcp-server/searchProviders/openPbr.ts` and upstream metadata.json for attribution/license URLs. Hugging Face discovery requires per-asset license metadata and does not infer rights from a repository card. Preserve the manifest/legal notices alongside downloaded models; license metadata is evidence to review, not legal advice.

No third-party model is bundled here: demo/test assets are generated from a synthetic box with named material and animation. CDN use does not transfer ownership of the referenced libraries or models.
