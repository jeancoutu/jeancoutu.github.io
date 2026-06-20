# TODO: Shorten Shared Meal Plan URLs

## Goal

Reduce the size of shared meal plan URLs while keeping the app completely serverless.

## Current Behavior

The app serializes the meal plan as JSON and encodes it directly into the URL, resulting in long share links.

Example:

```ts
const encoded = btoa(JSON.stringify(plan));
```

## Desired Behavior

Compress the serialized plan before adding it to the URL.

### Implementation

1. Install `lz-string`.

```bash
npm install lz-string
```

2. Replace the current share URL generation with:

```ts
import { compressToEncodedURIComponent } from "lz-string";

const encoded = compressToEncodedURIComponent(
  JSON.stringify(plan)
);
```

3. Replace the import logic with:

```ts
import { decompressFromEncodedURIComponent } from "lz-string";

const json = decompressFromEncodedURIComponent(encoded);

if (json) {
  const plan = JSON.parse(json);
}
```

4. Keep the URL parameter name short:

```text
?p=<compressed-data>
```

instead of:

```text
?plan=<large-json-data>
```

## Acceptance Criteria

* Existing functionality still works.
* Shared URLs are significantly shorter.
* Import/export remains fully client-side.
* No backend is introduced.
* Invalid or corrupted URLs are handled gracefully.
* Unit tests (if present) are updated.
