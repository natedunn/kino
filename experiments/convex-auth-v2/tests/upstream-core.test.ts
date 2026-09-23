// Run the pinned upstream lifecycle regression suite unchanged. This exercises
// actual component functions in convex-test and real JWT signing, not deployment
// authorization or an end-to-end application login.
// @vitest-environment edge-runtime
import '../.upstream/packages/core/src/components/core/core.test.ts';
