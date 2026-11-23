# Route characterization

Baseline: `e216db18ade2a5ffa66aff9dc3096e207251a918`. Source blob: `a4a5abdcaae344252fba26c600406829c4e98bce`.

- Explicit route table entries: **247**
- Distinct named handler functions: **137**
- Six separately handled pre-dispatch endpoints are documented in the route inventory script: `/health`, `/config.js`, `/backend/lib/*`, `/shared/*`, `/store/:id`, and `/track`.

The server dispatcher rate-limits before route dispatch, but does not apply a universal session/authentication middleware. Each handler or delegated capability must establish its own authentication, authorization, tenant/resource scope, validation and idempotency behavior. Handler exceptions map to `e.statusCode || 500`; unmatched GET requests may fall through to static serving; unmatched non-GET requests return 404.

The JSON file preserves each original route regex, method, handler reference and source line. It is the verified route index, not yet the completed per-handler security and persistence characterization. Do not extract route modules based on URL prefixes. The remaining characterization must trace every handler into its actual store function and transaction/invariant boundary. The historical 35 heuristic-unclassified entries are not presumed defective; retain the prior manual distinction of 30 routes needing better labels and five intentional inline/static handlers.
