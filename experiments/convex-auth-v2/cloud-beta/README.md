# Beta preview

Second isolated backend for the [two-preview OAuth proof](../cloud/TWO-PREVIEWS.md).
Source is derived by `PROOF_TARGET=beta node cloud/prepare.mjs` from the parent
experiment. Deployment identity/expiry are in `deployment.json`; credentials and
derived Convex files are ignored. This is not Kino's dev or production backend.
