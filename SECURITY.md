# Security

Do not publish secrets or exploit payloads in public issues. For private reports use GitHub private vulnerability reporting if enabled; otherwise request a private contact from the maintainer without disclosing exploit details.

Run processing of unknown models in an isolated worker with filesystem, memory, CPU and outbound-network limits. This developer tool is not a hostile-content sandbox. Local input and MCP outputDir have the authority of the Node process. Hugging Face redirects are bounded and restricted to HTTPS huggingface.co, hf.co and cloudfront.net domains/subdomains; no auth headers are forwarded. Per-file metadata is a publisher declaration, not a guarantee of ownership. Review provenance before redistribution.

HTTPS/timeout/size/path checks reduce accidental exposure but do not make arbitrary provider/CDN metadata safe. Use trusted API endpoints and don't put credentials into query strings, manifests, or generated browser code. Visual ranking explicitly sends thumbnails/query to your configured vision service.

## Dependency audit snapshot — 2026-11-04

Adding native-ESM Jest testing reported 20 npm audit advisories (1 low, 18 moderate, 1 high). `npm audit --omit=dev` reported one high in the existing direct Zod 3 dependency: [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), oversized constrained-collection validation can exhaust memory. The audit recommends Zod >=4.6.6, a major migration requiring API/SDK compatibility review. Jest development/transitive dependencies account for the remaining findings; some automatic recommendations are major downgrades, not a safe blanket fix. No forced major migration/override was applied as part of the test addition.

Re-run audits before release and resolve/assess advisories separately. Do not advertise this checkout as vulnerability-free. Schema tests and byte checks are not a hostile-content sandbox; continue bounding input/process memory/CPU and isolating untrusted processing.
