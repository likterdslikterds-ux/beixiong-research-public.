# Web Deep Research Request: Beixiong Ozon Listing Tool

Use this repository as a GitHub-connected research input for ChatGPT Web Deep Research.

## Goal

Analyze how this browser-extension-style tool appears to support an automatic Ozon listing workflow.

The output should help the Ozon ERP orchestrator decide what to learn from Beixiong, what to ignore, and how to assign follow-up work to:

- `beixiong-research-public`: research / deobfuscation / capability-chain evidence
- `source-plugin-v2`: source capture, shape groups, source payload, Ozon schema, listing draft
- `maestro-canvas-v030-lab`: editable media suite / image draft layer

## Main Questions

1. What is the end-to-end product flow?

```text
source capture
-> SKU / image selection
-> field extraction or normalization
-> Ozon category / attribute mapping
-> AI text / OCR / VLM / prompt use
-> image generation or image enhancement
-> product draft / payload
-> upload or export boundary
```

2. Which modules appear to own each stage?

Focus on evidence from filenames, imports, function names, UI text, payload builders, adapters, and workflow controllers.

3. How are references and prompts likely compiled?

Separate:

- product facts
- OCR / VLM / text candidates
- source images
- generated-image references
- style/layout references
- Ozon/category schema context
- user-selected images
- provider-specific request payloads

4. What provider/API surfaces are visible?

Look for DashScope, OpenAI-compatible image APIs, OSS upload, Ozon API, category recommendation, uploader, and store import/export paths.

5. What does the tool automate, and what still looks manual?

Identify likely automatic steps, user confirmation points, editable fields, review screens, and error/preflight boundaries.

6. What can Ozon ERP reuse conceptually without copying implementation?

Return concepts, object boundaries, data contracts, workflow stages, prompt/reference strategies, and UI flow lessons. Do not recommend copying closed-source implementation directly.

## Required Output Format

Please produce a structured report with:

```text
1. Executive summary
2. Evidence map: file/path -> observed responsibility
3. End-to-end workflow hypothesis
4. Data model / payload hypothesis
5. Prompt + reference-image workflow hypothesis
6. Image generation / media workflow hypothesis
7. Ozon schema / category / attribute handling hypothesis
8. Upload/export/preflight boundary
9. Manual review and risk points
10. What Ozon ERP should copy as concepts
11. What Ozon ERP should not copy
12. Open questions for local Codex branch analysis
```

## Safety And Boundaries

- Do not attempt to bypass login, authorization, payment, rate limits, or platform protections.
- Do not extract or publish credentials, cookies, tokens, full headers, account identifiers, or private operational data.
- Do not perform real Ozon/1688/51 writes.
- Treat findings as research evidence, not proof that Ozon ERP already has the same capability.

## Handoff Back To Codex

When the Web report is ready, save or paste it back to the Ozon ERP orchestrator.

The local orchestrator should ingest it as external research evidence and convert useful parts into:

- `receipt`
- `cross_project_data_packet`
- follow-up task packet for `beixiong-research-public`
- follow-up task packet for `source-plugin-v2`
- follow-up boundary task for `maestro-canvas-v030-lab`
