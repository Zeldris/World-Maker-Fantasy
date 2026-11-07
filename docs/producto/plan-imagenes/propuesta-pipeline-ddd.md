# Propuesta: pipeline de assets con IA (DDD) — SIN REVISAR

**Apuntado:** 2026-11-07, a petición de la usuaria, para revisarlo en otro momento.
**Estado:** propuesta sin revisar. **No es un roadmap ni entra en ningún hito**: nada de aquí se implementa hasta que
la usuaria lo revise y lo apruebe (y, mientras duren las pruebas de juego, no se abren tareas nuevas).
El texto de abajo es el que dio la usuaria, tal cual; solo se han añadido bloques de código y tablas en Markdown para
que se lea bien.

**Para cruzarlo al revisar** (lo que ya hay en el repo):

- [`roadmap-imagenes.md`](../roadmap-imagenes.md): el roadmap vigente del generador (`image-generator/`, `sd-cli` con
  FLUX.2 klein en la Deck, `abrir.sh`).
- [`plan-imagenes/`](.): auditorías (`auditoria-generador.md`, `auditoria-datos.md`, `auditoria-lore-admin.md`),
  `guia-visual-mundo.md`, `encargo-tarkor.md` e investigaciones de estilo y control de forma.
- `image-generator/`: `estilo/`, `fichas/`, `lora/`, `prompts/`, `scripts/` e `interfaz/`.
- `.mcp.json`: los servidores MCP actuales.

---

## TARKOR — DDD IMPLEMENTATION PLAN FOR THE AI ASSET GENERATION PIPELINE

Project: World-Maker-Fantasy (Tarkor)
Domain: Helek Sirik
Document type: Technical architecture and implementation plan
Methodology: Domain-Driven Design (DDD)
Status: Proposed architecture
Priority: 2D Assets → MCP Integration → Illustrations → Experimental 3D

---

### 0. INSTRUCTIONS FOR CLAUDE CODE

Work within the existing World-Maker-Fantasy repository.

Before modifying any files:

1. Read "AGENTS.md", "CLAUDE.md", and the existing agent documentation.
2. Review the current roadmap and development log.
3. Inspect the actual contents of "image-generator/" and "voice-generator/".
4. Inspect ".mcp.json" and all existing MCP server configurations.
5. Analyze the current grid, tileset, zone, and object rendering systems.
6. Inspect the existing object catalog and all 53 fauna species.
7. Locate canonical lore sources in "rpgtarkor/" and "canon-opencode/".
8. Identify the existing interfaces between the frontend, game engine, Prisma, and PostgreSQL.
9. Review existing tests and repository coding conventions.

Never assume that paths, dimensions, interfaces, configurations, or contracts described in this document already exist. Verify everything against the repository.

Mandatory architectural constraints

- Do not create a new game.
- Do not replace Tarkor's existing game engine.
- Do not modify simulation rules.
- Do not introduce generative AI dependencies into the game runtime.
- Do not modify canonical lore automatically.
- Do not generate assets directly into production.
- Do not introduce mandatory cloud services.
- Do not require Ollama to execute graphical asset generators.
- Do not allow an AI agent to approve its own generated assets.
- Do not modify existing contracts without justification.
- Preserve Windows and Linux compatibility.
- Keep Steam Deck performance as a target.
- Preserve all existing automated tests.
- The game must continue working when every AI service is disabled.

Core philosophy:

THE ENGINE DECIDES. THE AI NARRATES. THE CANON GOVERNS THE ASSETS.

---

### 1. DOMAIN VISION AND OBJECTIVES

#### 1.1. Objective

Build a reproducible, local-first AI asset production pipeline that generates, validates, tracks, and integrates visual assets into the existing Tarkor game.

The pipeline must understand the existing game structure and canonical lore rather than generate generic fantasy content.

It must support:

- Inventory objects.
- Equipment icons.
- Fauna sprites.
- Character sprites.
- Terrain tiles.
- Environmental objects.
- Tilesets.
- Animated sprites.
- Character portraits.
- Regional illustrations.
- Narrative illustrations.
- Experimental 3D models.

#### 1.2. Existing project context

Tarkor currently includes:

- 9 factions.
- 9 classes.
- 31 specializations.
- 53 fauna species.
- 245 objects.
- A deterministic simulation engine.
- Grid-based world representation.
- Local LLM inference through Ollama.
- React 19, TypeScript, Vite and Tailwind 4.
- Node.js, Fastify 5, TypeScript and Prisma 6.
- PostgreSQL and pgvector.
- Tauri v2 and Rust.
- Vitest and Playwright.
- Existing "image-generator/" and "voice-generator/" directories.
- Existing agent infrastructure using MCP.

These systems are authoritative. The asset pipeline must integrate with them.

---

### 2. DOMAIN-DRIVEN DESIGN: BOUNDED CONTEXTS

Organize the asset pipeline into independent bounded contexts.

#### 2.1. Canon Context

Responsibility: Provide authoritative lore and entity information.

Sources:

- "rpgtarkor/"
- "canon-opencode/"
- Existing object catalog.
- Existing fauna definitions.
- Existing faction definitions.
- Existing regional definitions.
- Existing world and grid specifications.

Responsibilities:

- Resolve canonical entity IDs.
- Retrieve authoritative descriptions.
- Identify allowed visual characteristics.
- Identify regional constraints.
- Provide approved visual references.
- Track canonical source revisions.

Rules:

- Canonical sources are read-only for the generation pipeline.
- Generated assets cannot modify lore.
- AI-generated descriptions cannot become canonical facts automatically.
- Canonical changes require the existing human review and approval process.

#### 2.2. Asset Specification Context

Responsibility: Define what a valid Tarkor asset must look like technically and semantically.

Core concepts:

- AssetSpecification
- AssetType
- VisualStyle
- Palette
- GridConstraint
- AnchorConstraint
- AnimationSpecification
- MaterialSpecification

Supported asset types:

- "item_icon"
- "equipment_sprite"
- "creature_sprite"
- "character_sprite"
- "terrain_tile"
- "tileset"
- "building"
- "environment_illustration"
- "character_portrait"
- "animated_sprite"
- "model_3d"

The specification must be independent of the image-generation provider.

A provider must never determine the official dimensions, identity, or canonical properties of an asset.

#### 2.3. Asset Generation Context

Responsibility: Generate candidate assets through interchangeable local providers.

Initial providers:

1. Bilta-Gilata1.
2. Game Builder MCP, subject to repository and interface verification.
3. Existing image-generator implementation.
4. ComfyUI for realistic illustrations.

Future experimental providers:

- TRELLIS.2.
- AssetFurnace.

The generation context must:

- Receive a validated AssetSpecification.
- Retrieve approved references.
- Build generation prompts.
- Select the provider.
- Execute generation.
- Record parameters.
- Store candidate files.
- Return generation metadata.

Generation must not directly modify production assets.

#### 2.4. Asset Validation Context

Responsibility: Determine whether a generated asset complies with Tarkor requirements.

Validation layers:

1. Technical validation.
2. Grid and dimensional validation.
3. Palette validation.
4. Visual consistency validation.
5. Canonical consistency validation.
6. Licensing and provenance validation.

The validator must operate independently of the generation provider.

Deterministic validation must be preferred whenever possible.

AI-based visual similarity can provide supporting evidence but cannot override deterministic rules or canonical authority.

#### 2.5. Asset Approval Context

Responsibility: Manage the human approval process.

Asset states:

- "PENDING"
- "GENERATING"
- "VALIDATING"
- "REJECTED"
- "CANDIDATE"
- "APPROVED"
- "INTEGRATED"
- "ARCHIVED"

Rules:

- Failed validation cannot produce an approved asset.
- A candidate requires human review.
- Approval must be auditable.
- Approved assets must be immutable by default.
- Replacing an approved asset must create a new version.
- Rejected assets must retain their validation reports and provenance.

#### 2.6. Asset Catalog Context

Responsibility: Connect approved visual assets with existing game entities.

It must not create duplicate game entities.

It must reference existing canonical identifiers for:

- Objects.
- Fauna.
- Characters.
- Factions.
- Regions.
- Terrain types.
- Buildings.

The asset catalog must remain separate from the deterministic simulation domain.

---

### 3. DOMAIN MODEL

#### 3.1. Core entities

**Asset**

Represents the stable identity of a visual resource.

Suggested attributes:

- "id"
- "canonicalEntityId"
- "assetType"
- "currentVersion"
- "status"
- "createdAt"
- "updatedAt"

**AssetSpecification**

Defines the requirements for generating an asset.

Suggested attributes:

- "assetId"
- "specificationVersion"
- "width"
- "height"
- "gridWidth"
- "gridHeight"
- "anchor"
- "paletteId"
- "visualStyleId"
- "transparency"
- "animationFrames"
- "allowedMaterials"
- "canonicalConstraints"

Actual dimensions must be extracted from the existing project. Do not assume a 32-pixel tile size.

**AssetGeneration**

Represents one generation attempt.

Suggested attributes:

- "generationId"
- "assetId"
- "provider"
- "providerVersion"
- "modelVersion"
- "modelHash"
- "seed"
- "promptHash"
- "parameters"
- "inputReferenceHashes"
- "outputHash"
- "createdAt"

**AssetValidation**

Stores validation results.

Suggested attributes:

- "validationId"
- "generationId"
- "technicalStatus"
- "paletteStatus"
- "gridStatus"
- "canonStatus"
- "licenseStatus"
- "validationReport"
- "createdAt"

**AssetApproval**

Stores human approval decisions.

Suggested attributes:

- "approvalId"
- "assetId"
- "generationId"
- "decision"
- "reviewer"
- "comments"
- "createdAt"

**AssetProvenance**

Tracks the origin and licensing of every asset.

Suggested attributes:

- "assetId"
- "provider"
- "modelLicense"
- "codeLicense"
- "trainingDataPolicy"
- "outputLicense"
- "modelHash"
- "promptHash"
- "inputHashes"
- "outputHash"
- "dependencyLicenses"

---

### 4. AGGREGATES AND DOMAIN INVARIANTS

#### 4.1. Asset Aggregate

The Asset aggregate owns:

- Asset identity.
- Specification versions.
- Generation attempts.
- Validation results.
- Approval history.
- Integration state.

Only approved generations may become integrated assets.

#### 4.2. AssetSpecification Aggregate

The specification is the authoritative contract for generation.

Invariants:

- Every asset must have a valid specification.
- Every specification must reference a valid asset type.
- Grid constraints must be compatible with the existing game renderer.
- Palettes must reference registered palette versions.
- Canonical entity IDs must exist when the asset represents a canonical entity.
- Provider-specific parameters cannot override canonical constraints.

#### 4.3. Generation Aggregate

Invariants:

- Every generation must reference a valid specification version.
- Every generation must record its provider.
- Every generation must record its seed when supported.
- Every generation must preserve prompt and input hashes.
- Failed generation attempts must be recorded.
- No generation can automatically become approved.

#### 4.4. Validation Aggregate

Invariants:

- Validation must reference an existing generation.
- Technical failures prevent approval.
- Missing provenance prevents approval.
- Unresolved licensing prevents publication.
- Canonical violations prevent approval.
- Human approval is mandatory.

---

### 5. PROPOSED REPOSITORY STRUCTURE

First inspect the existing repository and adapt this structure to its conventions.

Do not move existing files unnecessarily.

```text
image-generator/
│
├── providers/
│   ├── bilta-gilata1/
│   ├── game-builder/
│   ├── comfyui/
│   └── existing/
│
├── specifications/
│   ├── sprite.schema.json
│   ├── tileset.schema.json
│   ├── creature.schema.json
│   ├── illustration.schema.json
│   └── model3d.schema.json
│
├── canon/
│   ├── visual-style.md
│   ├── palettes/
│   ├── factions/
│   ├── species/
│   └── regions/
│
├── validation/
│   ├── dimensions.py
│   ├── palette.py
│   ├── transparency.py
│   ├── spritesheet.py
│   ├── grid.py
│   ├── canon.py
│   ├── provenance.py
│   └── licensing.py
│
├── mcp/
│   ├── server.py
│   └── tools/
│
├── manifests/
│   └── examples/
│
├── generated/
│   ├── candidates/
│   ├── approved/
│   └── rejected/
│
└── tests/
    ├── test_dimensions.py
    ├── test_palette.py
    ├── test_grid.py
    ├── test_provenance.py
    └── test_fallback.py
```

Production assets must follow the existing project's asset directory conventions.

The proposed "generated/" directory must not become an uncontrolled production asset directory.

---

### 6. PROVIDER ARCHITECTURE

Use a provider abstraction.

Suggested conceptual interface:

```ts
interface AssetGenerationProvider {
  readonly id: string;

  isAvailable(): Promise<boolean>;

  generate(
    specification: AssetSpecification,
    context: GenerationContext
  ): Promise<GenerationResult>;
}
```

This is a proposed interface. Adapt it to existing TypeScript/Python boundaries and repository conventions.

The provider abstraction must allow replacement without modifying the domain model.

#### 6.1. Bilta-Gilata1

Repository:

https://github.com/Abd196-bit/bilta-gilata1

Priority: FIRST IMPLEMENTATION.

Purpose:

- Pixel-art sprites.
- Inventory icons.
- Equipment.
- Fauna.
- Tilesets.
- Environmental objects.

Integration:

- Isolated Python environment.
- Local CLI or API.
- MLX on supported Apple Silicon hardware.
- CUDA on supported NVIDIA hardware.
- Fixed model versions.
- Fixed palette versions.
- Explicit seeds.
- Generation manifests.

Do not assume that a seed guarantees identical output across different hardware backends or model versions.

The adapter must invoke the actual documented interface of the installed version.

Verify code, model-weight, dependency, and output licensing independently.

#### 6.2. Game Builder MCP

Purpose:

- Code-aware image prompt preparation.
- Understanding game layouts.
- Potential headless testing.

Investigate the actual repository and interfaces before integration.

Expected capabilities to verify:

- "image_prompt"
- "scaffold_game"
- "playtest_game"

Recommended use:

- Evaluate "image_prompt" as a prompt preparation tool.
- Evaluate "playtest_game" as an additional testing capability.
- Avoid "scaffold_game" in the production Tarkor workflow unless a concrete need is demonstrated.

Do not invent installation commands or MCP tool names.

If the official server does not expose the necessary functionality, implement a small local adapter.

#### 6.3. ComfyUI

Repository:

https://github.com/comfyanonymous/ComfyUI

Purpose:

- Realistic illustrations.
- Character portraits.
- Regional illustrations.
- Narrative scenes.
- High-quality visual references.

Use fixed workflows and pinned models.

Do not make ComfyUI mandatory for pixel-art generation or game execution.

#### 6.4. TRELLIS.2

Repository:

https://github.com/microsoft/TRELLIS.2

Priority: EXPERIMENTAL 3D.

Purpose:

- Image-to-3D.
- PBR materials.
- Selected objects and environmental assets.

Constraints:

- NVIDIA GPU requirements.
- Approximately 24 GB VRAM target for the documented workflow.
- Linux/CUDA dependency.
- Heavy dependencies.
- Individual dependency and model licensing review.

Do not make TRELLIS.2 a required development dependency.

#### 6.5. AssetFurnace

Repository:

https://github.com/Bingeljell/image-to-3dlab

Priority: EXPERIMENTAL.

Purpose:

- Image-to-3D pipeline.
- Mesh processing.
- Rigging.
- Basic animations.
- GLB export.

Investigate backend selection and licensing.

Do not assume that humanoid auto-rigging works correctly for quadrupeds or all 53 fauna species.

Keep it isolated from the production asset pipeline until validated.

#### 6.6. NodeTool

Repository:

https://github.com/nodetool-ai/nodetool

Decision: DO NOT INTEGRATE AS TARKOR'S GAME ENGINE.

Reasons:

- Tarkor already has its own engine.
- Duplicates existing game responsibilities.
- Introduces another creative project environment.
- AGPL-3.0 licensing requires additional consideration.

It may be evaluated independently as an external creative tool, but it must not become a mandatory Tarkor runtime dependency.

---

### 7. MCP ARCHITECTURE

Extend the existing MCP configuration without breaking current servers.

Potential tools:

| MCP tool | Responsibility |
| --- | --- |
| "get_asset_spec" | Retrieve asset requirements |
| "get_canon_context" | Retrieve authoritative lore |
| "prepare_image_prompt" | Build canonical generation prompts |
| "generate_image_candidate" | Invoke a generation provider |
| "validate_image_candidate" | Validate generated output |
| "get_asset_provenance" | Retrieve generation history |
| "list_asset_candidates" | List pending assets |
| "approve_asset" | Record human approval |
| "reject_asset" | Record rejection |

Important:

- "approve_asset" must be a controlled human operation.
- Agents must not bypass validation.
- Generation tools must not write to production directories.
- MCP server failure must not affect the game runtime.
- Every operation must be auditable.

#### 7.1. .mcp.json

Inspect the current configuration first.

Add only verified server commands.

Do not replace existing Playwright configuration.

Do not commit credentials, absolute user-specific paths, or machine-specific secrets.

If Bilta-Gilata1 only provides a CLI, expose it through a local MCP adapter.

---

### 8. GENERATION WORKFLOW

Expected workflow:

```text
1. Agent receives asset request
          |
          v
2. Resolve canonical entity
          |
          v
3. Retrieve AssetSpecification
          |
          v
4. Retrieve approved references
          |
          v
5. Prepare deterministic prompt
          |
          v
6. Select generation provider
          |
          v
7. Generate candidate
          |
          v
8. Store generation metadata
          |
          v
9. Run deterministic validation
          |
          v
10. Run visual/canonical validation
          |
          v
11. Human review
          |
          +---- REJECT
          |
          v
12. APPROVE
          |
          v
13. Integrate into asset catalog
          |
          v
14. Package approved asset
```

No asset may skip these stages.

---

### 9. VALIDATION RULES

#### 9.1. Technical validation

Check:

- Image format.
- Actual dimensions.
- Transparency.
- Maximum file size.
- Color count.
- Frame count.
- Frame alignment.
- Anchor position.
- Sprite boundaries.
- Invalid or empty frames.

#### 9.2. Grid validation

Read actual grid dimensions and rendering contracts from the existing game code.

Check:

- Tile dimensions.
- Sprite occupancy.
- Anchor points.
- Collision compatibility.
- Layering constraints.
- Multi-cell object occupancy.
- Grid alignment.

Do not introduce new grid dimensions without an existing game-engine requirement.

#### 9.3. Palette validation

Create versioned visual palettes.

Examples:

- "tarkor-natural-v1"
- "tarkor-stone-v1"
- "tarkor-metal-v1"
- "tarkor-fauna-v1"
- "tarkor-ui-v1"

These are proposed identifiers, not existing project assets.

Validate:

- Allowed colors.
- Maximum color count.
- Contrast.
- Material consistency.
- Regional palette compatibility.
- Faction-specific visual restrictions.

#### 9.4. Canonical validation

For fauna:

- Species ID must exist.
- Anatomy must match documentation.
- Color patterns must be compatible.
- Region must be valid.
- Documented variations must be respected.
- No invented canonical traits.

For objects:

- Object ID must exist.
- Material must be compatible.
- Category must be correct.
- Shape must match the documented object.
- Visual representation must not invent game functionality.

For factions:

- Symbols.
- Colors.
- Clothing.
- Armor.
- Heraldry.
- Cultural conventions.

The canonical source is authoritative.

#### 9.5. Visual consistency

Use approved reference assets.

Potential local tools:

- CLIP-compatible image embeddings.
- Local visual similarity models.
- Image comparison.
- Palette distance.
- Silhouette comparison.

These tools provide supporting scores, not canonical approval.

#### 9.6. Human review

Human review is mandatory before publication.

The reviewer must be able to inspect:

- Candidate image.
- Canonical source.
- Specification.
- Validation report.
- Provider.
- Model version.
- Generation parameters.
- License information.

---

### 10. DATABASE AND PERSISTENCE

Do not store generated PNG or GLB files as PostgreSQL blobs.

Store files in the project's existing filesystem-based asset storage.

Use PostgreSQL and Prisma for metadata, relationships, approval history, and provenance.

Proposed conceptual models:

- "Asset"
- "AssetGeneration"
- "AssetSpecification"
- "AssetProvenance"
- "AssetValidation"
- "AssetApproval"

Before implementing Prisma models:

1. Inspect the current schema.
2. Check for existing asset-related entities.
3. Reuse existing domain concepts where appropriate.
4. Avoid duplicate identifiers.
5. Avoid unnecessary migrations.

The asset domain must remain separate from deterministic gameplay simulation.

---

### 11. PROVENANCE AND REPRODUCIBILITY

Every generated asset must have a provenance manifest.

Example:

```json
{
  "asset_id": "fauna.berig.example",
  "generation_id": "gen-000001",
  "provider": "bilta-gilata1",
  "provider_version": "PINNED_VERSION",
  "model_hash": "sha256:...",
  "prompt_hash": "sha256:...",
  "seed": 123456,
  "spec_version": "1",
  "palette_version": "tarkor-natural-v1",
  "canon_revision": "COMMIT_HASH",
  "input_hashes": [],
  "output_hash": "sha256:...",
  "licenses": {
    "code": "REVIEWED_LICENSE",
    "model": "REVIEW_REQUIRED",
    "dependencies": [],
    "output": "REVIEW_REQUIRED"
  },
  "validation": {
    "technical": "passed",
    "palette": "passed",
    "canon": "pending",
    "human_approval": "pending"
  }
}
```

Record:

- Provider version.
- Model version.
- Model hash.
- Prompt hash.
- Seed.
- Generation parameters.
- Input reference hashes.
- Canonical revision.
- Specification version.
- Palette version.
- Output hash.
- License information.

Reproducibility requirements:

1. Configuration reproducibility.
2. Environment reproducibility.
3. Artifact identity.

Do not promise identical output across different hardware backends.

Once an asset is approved, preserve and version the exact output.

Never regenerate approved assets automatically during a game session or normal build.

---

### 12. LICENSING POLICY

Tarkor currently uses:

- Code: MIT.
- Lore, art, maps and voices: CC BY-NC-SA 4.0.
- Third-party components: Their respective licenses.

Track separately:

- Code license.
- Model license.
- Model-weight license.
- Training-data policy.
- Dependency licenses.
- Output license.
- Commercial-use permissions.
- Redistribution permissions.

Specific considerations:

**Bilta-Gilata1**

Verify the CLI, underlying models, model weights, dependencies, and generated output conditions independently.

**TRELLIS.2**

MIT does not automatically cover every dependency or encoder.

**AssetFurnace**

Apache-2.0 for the project does not automatically cover all underlying generation backends.

Review Hunyuan3D's community license and territorial restrictions, particularly because Tarkor is developed and distributed in the EU.

**NodeTool**

AGPL-3.0. Avoid incorporating its code into Tarkor unless there is a specific legal and architectural justification.

Never assume that the license of a generator automatically determines the license of its output.

Unresolved licensing information must block publication.

---

### 13. PERFORMANCE AND STEAM DECK

Generation is a development-time activity.

The final game must not require:

- Python.
- CUDA.
- Ollama.
- Bilta-Gilata1.
- ComfyUI.
- TRELLIS.2.
- MCP servers.
- Internet access.

The game receives only approved, optimized assets.

For future 3D assets, enforce:

- Polygon budgets.
- LOD.
- Texture compression.
- Material limits.
- Independent collision meshes.
- Memory budgets.
- Draw-call budgets.
- Real hardware testing.

The 3D pipeline must remain experimental until it demonstrates measurable benefits.

---

### 14. DEVELOPMENT PHASES

#### PHASE A — VISUAL CONTRACT

Priority: CRITICAL.

Tasks:

1. Inspect current rendering architecture.
2. Identify actual grid dimensions.
3. Identify sprite dimensions.
4. Identify anchor conventions.
5. Identify current asset naming conventions.
6. Define initial visual styles.
7. Define versioned palettes.
8. Define JSON specifications.
9. Implement deterministic validation.

Deliverables:

- Asset specifications.
- Visual style documentation.
- Palette definitions.
- Technical validators.
- Unit tests.

Acceptance criteria:

- Invalid dimensions are rejected.
- Invalid palettes are rejected.
- Incorrect transparency is rejected.
- Invalid grid occupancy is rejected.
- No gameplay code is modified.

#### PHASE B — BILTA-GILATA1 INTEGRATION

Priority: HIGH.

Tasks:

1. Verify repository and license.
2. Verify model availability and licensing.
3. Create isolated Python environment.
4. Pin model and dependency versions.
5. Implement provider adapter.
6. Implement generation manifests.
7. Generate initial test assets.
8. Validate outputs.
9. Test execution without Ollama.

Deliverables:

- Bilta provider.
- Local generation interface.
- Provenance manifests.
- Test suite.
- Sample approved assets.

Acceptance criteria:

- Assets are generated locally.
- Seeds and parameters are recorded.
- Provider failures do not affect the game.
- Ollama is optional.
- Existing tests continue passing.

#### PHASE C — MCP INTEGRATION

Priority: HIGH.

Tasks:

1. Inspect existing MCP architecture.
2. Verify Game Builder MCP repository and tool schemas.
3. Add a local asset MCP server.
4. Expose specification retrieval.
5. Expose canonical context retrieval.
6. Expose candidate generation.
7. Expose validation.
8. Expose controlled approval.
9. Preserve Playwright integration.

Deliverables:

- MCP server.
- Updated ".mcp.json".
- Agent documentation.
- Integration tests.

Acceptance criteria:

- Agents can request and generate candidates.
- Agents cannot bypass validation.
- Agents cannot modify canonical lore.
- Agents cannot automatically approve assets.

#### PHASE D — VISUAL PRODUCTION

Priority: MEDIUM.

Initial asset batch:

1. One inventory object.
2. One equipment item.
3. One fauna species.
4. One tree.
5. One terrain tile.
6. One animated creature.

Evaluate:

- Technical quality.
- Style consistency.
- Canon compliance.
- Generation time.
- Failure rate.
- Human correction effort.

Acceptance criteria:

- All approved assets pass technical validation.
- All assets have provenance.
- No invalid assets enter production.
- Assets work in the actual Tarkor interface.

#### PHASE E — REALISTIC ILLUSTRATIONS

Priority: MEDIUM.

Investigate ComfyUI.

Create a separate workflow for:

- Regional illustrations.
- Character portraits.
- Narrative scenes.
- Environmental concept art.

Keep this visual pipeline separate from pixel-art production.

Both visual styles must represent the same canonical world.

Acceptance criteria:

- Local execution.
- Pinned workflows and models.
- Reference consistency.
- Provenance tracking.
- Licensing review.

#### PHASE F — EXPERIMENTAL 3D

Priority: LOW.

Investigate:

- TRELLIS.2.
- AssetFurnace.
- GLB export.
- Mesh optimization.
- Rigging.
- Animation.
- LOD.
- Steam Deck performance.

Initial experiments:

1. One static inventory object.
2. One environmental object.
3. One building.
4. One humanoid model.

Do not attempt full fauna production initially.

Acceptance criteria:

- Successful GLB import.
- Valid geometry.
- Valid materials.
- Performance budgets respected.
- Licensing verified.
- No runtime dependency on generation tools.

---

### 15. TESTING STRATEGY

Maintain the existing test suite.

Add tests for:

- Specification validation.
- Dimension validation.
- Palette validation.
- Grid compatibility.
- Sprite transparency.
- Animation frame alignment.
- Canonical entity resolution.
- Missing entity rejection.
- Provenance completeness.
- Licensing validation.
- Provider failures.
- MCP failures.
- Ollama unavailable.
- Missing generation backend.
- Approved asset immutability.
- Production integration.

Important regression test:

The game must start, simulate, save, load, and render using only existing approved assets, with all AI generation services disabled.

No changes to deterministic simulation outcomes are allowed.

---

### 16. ACCEPTANCE METRICS

Initial targets:

| Metric | Target |
| --- | --- |
| Assets complying with dimensions | 100% |
| Assets with provenance | 100% |
| Assets with canonical IDs | 100% |
| Published assets violating palette | 0 |
| Published assets with unresolved licenses | 0 |
| Approved assets with human review | 100% |
| Game dependency on generation services | 0 |
| Simulation changes caused by asset generation | 0 |
| Existing tests preserved | 100% |

Additionally:

- Track generation failure rate.
- Track average generation time.
- Track human correction time.
- Track rejected asset reasons.
- Track output size.
- Track Steam Deck memory and rendering costs.

---

### 17. ARCHITECTURAL DECISIONS

The following decisions are proposed as binding architectural constraints once approved.

**ADR-001 — Provider independence**

The domain model must not depend on any particular generation model or provider.

**ADR-002 — Canonical authority**

Canonical lore is authoritative and read-only for generation workflows.

**ADR-003 — Human approval**

AI-generated candidates cannot approve themselves.

**ADR-004 — Local-first**

Generation must work locally without mandatory cloud services.

**ADR-005 — Ollama independence**

Ollama can help prepare prompts but is not a mandatory graphical generation dependency.

**ADR-006 — Runtime isolation**

No image or 3D generation dependencies in the distributed game.

**ADR-007 — Deterministic validation**

Technical constraints must be enforced by deterministic validators.

**ADR-008 — Provenance**

Every generated asset must have traceable origin and licensing information.

**ADR-009 — 2D first**

Pixel-art and 2D production have priority over 3D.

**ADR-010 — Experimental 3D**

TRELLIS.2 and AssetFurnace remain isolated until hardware, licensing, and performance requirements are satisfied.

**ADR-011 — Existing engine preservation**

No replacement of Tarkor's simulation or rendering architecture without a separately approved architectural decision.

---

### 18. FIRST IMPLEMENTATION TASK

Create:

"ASSET-01 — Deterministic Asset Specification and Validation"

Scope:

1. Inspect the existing asset pipeline.
2. Inspect grid and rendering contracts.
3. Inspect the canonical object catalog.
4. Inspect all 53 fauna definitions.
5. Identify actual sprite and tileset requirements.
6. Create the first AssetSpecification schema.
7. Define the first versioned visual palette.
8. Implement deterministic PNG validation.
9. Implement grid and transparency validation.
10. Implement a provenance manifest.
11. Add automated tests.
12. Document the integration points for Bilta-Gilata1.

Do not implement TRELLIS.2, AssetFurnace, NodeTool, or a new game engine in this task.

Do not modify canonical lore.

Do not change gameplay simulation.

Do not introduce unnecessary dependencies.

Definition of Done

The task is complete when:

- The existing asset architecture is documented.
- Actual grid dimensions have been verified.
- The first asset contract exists.
- The validator works independently of AI.
- Automated tests cover the new functionality.
- The provenance manifest is generated.
- Existing project tests pass.
- The game works with all generation providers disabled.
- No canonical lore or gameplay rules have changed.

---

### 19. FINAL ARCHITECTURAL PRINCIPLE

Tarkor must remain a deterministic, local-first RPG.

The AI asset pipeline is a development and content-production subsystem, not part of the simulation engine.

The engine owns game truth.

The canon owns world truth.

The asset specification owns visual constraints.

The generation models propose visual representations.

The validators enforce technical and canonical requirements.

Humans approve final content.

The resulting assets are versioned, reproducible, traceable, and packaged independently of the generation infrastructure.

THE WORLD OF HELEK SIRIK DEFINES WHAT CAN EXIST. AI ONLY HELPS US REPRESENT IT.
