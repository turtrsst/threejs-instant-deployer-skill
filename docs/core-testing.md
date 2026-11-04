# Core Jest tests and X-Ray success-manifest contract

## Run

```bash
npm ci
npm test       # builds TypeScript/templates, runs node:test, then native-ESM Jest
npm run check # typecheck + the same complete test command (used by CI)

# Focused runs, after building:
npm run build
npm run test:node
npm run test:jest
```

Jest and @types/jest are development dependencies, pinned by package-lock.json. Package configuration uses transform:{} and testEnvironment:node, with testMatch restricted to tests/deployer-core.test.js. Existing .test.mjs files remain owned by node:test; neither runner silently skips/replaces the other. Jest uses node --experimental-vm-modules and --runInBand for native ESM and bounded worker use. Node may print the expected experimental VM modules warning. Runtime dependencies are not transpiled/mocked by Babel for these tests.

The existing CI already runs npm ci and npm run check on Node 20/22/24, so the new Jest suite participates without a second independent workflow. A focused runner uses generated dist; rebuild after Vite overwrites dist, or use npm test/check which rebuild first.

## Real production math, not duplicate test utilities

The tests import normalizeBBox, dimensions, xrayIntrospect and manifest validation from dist/glbSurgeon. Fixtures are real in-memory glTF-Transform Document/Accessor/Primitive/Mesh/Material/Node/Scene objects. They do not copy a calculateNormalizationMetrics function or use MockBox3, so regressions in the real center/bounds implementation fail the tests.

Covered cases:

- Height 4 fitted to 1.5 returns .375, measured from actual getBounds.
- A contain fit uses the tightest nonzero target dimension, preserves aspect ratio and returns a uniform scale vector.
- 1/3 is not rounded to .3333; tiny positive heights are not replaced with a guessed height 1.
- Negative/nonfinite/all-zero/wrong-length target sizes fail. Flat geometry cannot fulfill a height-only fit; empty/no-scene inputs reject.
- Asymmetric floating and negative-Y boxes become bottom-center: minY≈0 and centerX/centerZ≈0, not just a Y-only offset calculation.
- Normalization is idempotent and preserves real animation/channel/target objects.
- Production X-Ray records/metadata validate; status-only errors, NaN/Infinity/nonpositive scale, malformed envelopes/arrays/records, flags and alias/vector inconsistencies reject.

Normalization translates the asset to bottom-center without baking recommendedScale into geometry. The returned dimensions remain measured model dimensions; the runtime applies computed recommendedScale. A zero target axis means unconstrained. Bounds are **rest-pose bounds**, not a guarantee every animated frame remains above the floor. Tests preserving animation channels are not visual/native animation playback certification.

## Manifest schema is part of production

mcp-server/glbSurgeon/manifestSchema.ts exports:

- XRayManifestSchema: Zod success-output schema.
- validateXRayManifest(unknown): {isValid:boolean, errors:string[]}.
- assertXRayManifest(unknown): throws an actionable path/message error on invalid output.
- XRaySuccessManifest: inferred TypeScript type.

The exports are available from the package root. scoutAndProcess validates its assembled output before writing the output GLB or returning success. File and data-URI pipeline integration tests still exercise the real output. The schema is not just a detached testing mock.

Required core fields are status:'success', nonempty matchedAssetId, finite positive recommendedScale and an xray object with boolean hasAnimations plus meshes/materials/animations arrays. Records use the actual structured production format:

```json
{
  "status": "success",
  "matchedAssetId": "BarramundiFish",
  "recommendedScale": 0.25,
  "xray": {
    "hasAnimations": false,
    "meshes": [{"index":0,"name":"FishMesh_geo","primitives":1}],
    "materials": [{
      "index":0,"name":"FishMat","roughness":0.3,"metalness":0.4,
      "alphaMode":"OPAQUE","doubleSided":false,
      "isTranslucentOrTransmission":false
    }],
    "animations": []
  }
}
```

The draft's string mesh names and material-name/roughness-only objects are not full production records. Optional node/skin arrays, flags, dimensions/target/fit/pivot/scale-vector fields are checked when present. Animation presence and skin presence flags must match their arrays; channelsCount matches channels; the scale vector matches uniform recommendedScale. Additional provider/license/pipeline metadata is retained for compatibility, not silently discarded.

Errors are always array entries, including a bad status. The draft's errors.status assignment would leave errors.length at zero for a status-only failure; the dedicated regression test prevents that false positive.

This schema validates **success metadata**, not error-response JSON, licensing truth, arbitrary glTF binary safety, semantic relevance, GPU shader validity or a full simulation preset. It is not a hostile-content sandbox or general resource-exhaustion defense. Keep existing provider, byte-budget, decoder and isolated-worker policies.

## Verification and release caveats

The focused Jest suite has 28 cases; the retained node:test suite has 195 at the time this module was added. Production build/package checks remain separate. Those counts are not actual browser WebGL rendering, real-device FPS/audio or live provider/CDN end-to-end certification.

Dependency audit during addition reported 20 advisories in the full tree (1 low, 18 moderate, 1 high), including one high in the production Zod dependency. Remaining findings are in the Jest development/transitive tree. npm's suggested fixes include major-version changes/downgrades; no blind npm audit fix --force was applied. See SECURITY.md and rerun npm audit / npm audit --omit=dev before release. Passing tests does not mean zero vulnerabilities or authorization to publish/push.
