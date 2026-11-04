# Federated Scout: routing and source contracts

## Routing

- `auto` (default) and `all` (compatibility alias): search all eligible sources concurrently. Every result needs positive lexical relevance. For static property words (`rock`, `stone`, `mossy`, `wood`, `driftwood`, `plant`, `furniture`) Poly Haven receives a small +0.5 preference on the shared lexical score. There is no unconditional base score for arbitrary Hugging Face files.
- `polyhaven`: static CC0, no key. `--animated` excludes it rather than lowering its rank and silently returning a static asset.
- `sketchfab`: requires `SKETCHFAB_TOKEN` in the environment; search uses `downloadable=true&license=cc0`, adds `animated=true` when requested, and rechecks returned license/animation metadata. Age-restricted entries are excluded. Download revalidates CC0 via model details and then `/v3/models/{uid}/download`. A direct `glb.url` is required; archive-only downloads fail and may trigger fallback.
- `objaverse`: aggregate selector for `openpbr` plus `objaverse-hf`; it does not claim Khronos assets originate in Objaverse.
- `openpbr`: curated Khronos glTF-Sample-Assets direct GLBs, no key. This informal connector name is not an implementation of the MaterialX OpenPBR standard. IDs are canonical upstream directory names (e.g. `Fox`, not `FoxAnimated`).
- `objaverse-hf`: bounded Hugging Face public GLB discovery with per-asset provenance. No auth token used.

Search failures become warnings; a remaining provider can still succeed. The ranked list is tried in order (maximum five). HTTP errors, non-GLB payloads, no animation, processing errors, or byte-budget errors can trigger the next candidate. If none succeed, the command exits nonzero with accumulated explanations. File mode writes only the successful GLB; datauri mode writes no GLB. `--manifest` explicitly writes the JSON in either mode. Alternatives are metadata candidates, not guarantees that every alternative will download/process successfully.

`--animated` is a hard requirement for nonempty animation channels in the downloaded document, checked before and after optimization. It does not infer motion from words like “swim” and it does not generate animations. Keyword matching cannot guarantee realism or a semantically appropriate animation clip; use X-Ray review and optional vision ranking. Static Barramundi is never a fallback for an animated fish request.

## License policy and registry evidence

Default allows CC0 only. `--allow-non-cc0` explicitly permits the recognized licenses in HF metadata and all reviewed license entries of the curated registry. It never relaxes Sketchfab's CC0 filter. Preserve `legal[]`, `licenseEvidence`, and `source` from the manifest with redistributed assets; custom terms still need manual review. These tools do not provide legal advice or independently prove metadata ownership.

Registry metadata reviewed against Khronos upstream on 2026-11-03:

| ID | Animation | Component license/attribution |
|---|---|---|
| BarramundiFish | No | CC0-1.0, Microsoft (2017) |
| Fox | Survey/Walk/Run | CC0 model PixelMannen; CC-BY-4.0 rig/animation tomkranis and glTF conversion @AsoboStudio/@scurest |
| AnisotropyBarnLamp | No | CC-BY-4.0, Eric Chadwick / Wayfair LLC (2023) |
| IridescenceLamp | No | CC-BY-4.0, Eric Chadwick / Wayfair LLC (2022) |
| MosquitoInAmber | No | CC-BY-4.0, Loic Norgeot / Sketchfab |
| DragonAttenuation | No | Stanford Graphics custom terms for dragon/conversion, CC0 cloth backdrop Adobe |

For each ID, authoritative metadata is `https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/<ID>/metadata.json`. The connector records that evidence URL and the component notices. The registry is a reviewed snapshot, not a guarantee future upstream `main` content will never change. Inspect upstream terms before commercial distribution. GLB paths were checked via GitHub contents API; not all direct provider endpoints were end-to-end network tested in this environment.

## Hugging Face metadata contract

The Hub API searches **repository metadata**, not individual geometry semantics across the entire Objaverse dataset. Queries are `<query> glb` against `/api/datasets` and `/api/models`, up to four repos per kind. For each repo we request details for an immutable `sha` then the first recursive tree page (at most 100 entries). Private, gated, unsupported, or unlicensed repos are skipped with warnings. This deliberately conservative connector may return no results even though a suitable model exists somewhere on the Hub.

A supported public repository must contain a root file `asset-metadata.json`:

```json
{
  "assets": [
    {
      "path": "objects/fish.glb",
      "name": "Tropical Fish",
      "tags": ["fish", "aquatic"],
      "animated": true,
      "license": "cc0-1.0",
      "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/legalcode",
      "source": "https://example.org/original-asset-page",
      "attribution": "Original author; source and any conversion credit"
    }
  ]
}
```

`path` must refer to a file in the returned tree, end in `.glb`, be nonempty and traversal-safe, and be no larger than **35,000,000 bytes**. URLs for downloads are derived from the trusted repo/revision/path, not accepted from metadata. Metadata is capped at 1 MiB and the first 100 asset records are examined. The repository card license is **never** used as proof that all Objaverse objects are CC0.

Accepted per-file identifiers: `cc0` / `cc0-1.0` by default; `cc-by-4.0`, `mit`, `apache-2.0` only with `--allow-non-cc0` plus nonempty attribution. Every accepted record needs HTTPS source and license evidence links. Noncommercial, no-derivatives, unknown, missing, or custom HF licenses are rejected. `animated:true` is required in metadata for animated search and subsequently checked against actual GLB channels. A publisher's declaration is not independent ownership verification.

Resolve links are pinned to the repository SHA, preserving reproducibility. Signed CDN redirects are followed at most five times with a strict HTTPS/domain allowlist and without forwarding credentials. The normal 128 MiB streamed download cap also applies. HTML errors and Git LFS pointer files cannot pass the binary GLB magic check. On disk, HF IDs are sanitized, truncated, and suffixed with a hash to avoid path traversal/collisions. Source IDs remain intact in the JSON manifest.

Bio-Motion is a separate runtime fallback: scout may suggest `bioMotion.preset` for a static organism, but never relaxes `--animated` or fabricates animation channels. See [Bio-Motion](bio-motion.md).

## Manifest additions (backward compatible)

Existing `assetId`, `savedPath`, `recommendedScale`, top-level X-Ray arrays, budget and dimensions remain. New fields:

- `selectedProvider`: `local`, `polyhaven`, `sketchfab`, `openpbr`, or `objaverse-hf`.
- `matchedAssetId`: alias for `assetId`.
- `routing`, `requireAnimated`: requested policy.
- `legal[]`: license URL and attribution per component when supplied by source; `licenseEvidence`, immutable HF `revision`.
- `requiredExtensions`: application loader/material feature requirements; retained KTX2 produces a warning.
- `xray`: full arrays plus `hasAnimations` and `hasSkeletalRig`.
- `animations[].channelsCount`: alias for `channels`.
- `skins[].jointsCount`, `sampleBoneNames` (first eight), and full `bones` list.
- `materials[].isTranslucentOrTransmission`: transparency/transmission signal for PBR review.
- `alternativeCandidates[]`: up to three other relevant candidates with provider, ID, name, animation state, source and license.

Rest-pose bounds cannot guarantee that animated limbs/tails never extend past a target box. `--target-height` means vertical height only, not fish length. No estimated “meters” fields are added because glTF source coordinates do not prove real-world dimensions.
