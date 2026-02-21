## Limitation 1 
There is also a second limitation:

Diff classification currently compares only:
internalId, partNumber, revision, description, quantity, supplier, parentPath, position
See classification.service.ts (line 160)
So Color and Cost are not yet part of diff fields.