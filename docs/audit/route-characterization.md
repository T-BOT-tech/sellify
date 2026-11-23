{
  "baselineCommit": "e216db18ade2a5ffa66aff9dc3096e207251a918",
  "source": {
    "file": "backend/server.js",
    "blob": "a4a5abdcaae344252fba26c600406829c4e98bce"
  },
  "routeCount": 253,
  "explicitRouteCount": 247,
  "distinctNamedHandlerCount": 137,
  "heuristicUnclassifiedEntries": 35,
  "routes": [
    {
      "method": "POST",
      "pattern": "/^\\/integrations\\/payments\\/([^/]+)\\/notifications$/",
      "path": "/integrations/payments/:id/notifications",
      "handler": "handlePaymentProviderNotification",
      "source": {
        "routeLine": 3841,
        "handlerLine": 2239
      },
      "authentication": "public/provider-authenticated path",
      "authorization": "none detected",
      "scope": {
        "tenant": "global/auth/provider",
        "location": "not detected"
      },
      "validationCodes": [
        "PAYMENT_NOTIFICATION_NOT_CONFIGURED",
        "INVALID_PROVIDER_NOTIFICATION"
      ],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [],
      "statusCodes": [
        "400",
        "503"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/auth\\/telegram$/",
      "path": "/auth/telegram",
      "handler": "handleTelegramAuth",
      "source": {
        "routeLine": 3842,
        "handlerLine": 902
      },
      "authentication": "needs-review",
      "authorization": "none detected",
      "scope": {
        "tenant": "global/auth/provider",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getOrCreateUserByTelegram",
        "listUserMemberships",
        "createSession",
        "createAuthChallenge"
      ],
      "statusCodes": [
        "200"
      ],
      "classification": "infrastructure",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/auth\\/migrate-legacy$/",
      "path": "/auth/migrate-legacy",
      "handler": "handleLegacyMigration",
      "source": {
        "routeLine": 3843,
        "handlerLine": 888
      },
      "authentication": "needs-review",
      "authorization": "none detected",
      "scope": {
        "tenant": "global/auth/provider",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenantByApiKey",
        "getOrCreateUserByTelegram",
        "ensureMembership",
        "createSession"
      ],
      "statusCodes": [
        "200",
        "400",
        "401"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/auth\\/country-packs$/",
      "path": "/auth/country-packs",
      "handler": "handleOnboardingCountryOptions",
      "source": {
        "routeLine": 3844,
        "handlerLine": 928
      },
      "authentication": "needs-review",
      "authorization": "none detected",
      "scope": {
        "tenant": "global/auth/provider",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [],
      "statusCodes": [
        "200"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/auth\\/tenants$/",
      "path": "/auth/tenants",
      "handler": "handleCreateTenant",
      "source": {
        "routeLine": 3845,
        "handlerLine": 936
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createTenantForUser"
      ],
      "storeFunctions": [
        "getAuthChallengeForTenantCreation",
        "createTenantForUser",
        "createSession"
      ],
      "statusCodes": [
        "400",
        "401"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/auth\\/tenants$/",
      "path": "/auth/tenants",
      "handler": "handleMyTenants",
      "source": {
        "routeLine": 3846,
        "handlerLine": 978
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "listUserMemberships"
      ],
      "statusCodes": [
        "200"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/auth\\/select-tenant$/",
      "path": "/auth/select-tenant",
      "handler": "handleSelectTenant",
      "source": {
        "routeLine": 3847,
        "handlerLine": 984
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "global/auth/provider",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "authenticateSessionToken",
        "consumeAuthChallenge",
        "listUserMemberships",
        "createSession"
      ],
      "statusCodes": [
        "200",
        "400",
        "401",
        "403"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/auth\\/logout$/",
      "path": "/auth/logout",
      "handler": "handleLogout",
      "source": {
        "routeLine": 3848,
        "handlerLine": 1010
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "global/auth/provider",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "revokeSession"
      ],
      "statusCodes": [
        "200"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/auth\\/pairing$/",
      "path": "/auth/pairing",
      "handler": "handleCreatePairing",
      "source": {
        "routeLine": 3849,
        "handlerLine": 1016
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "global/auth/provider",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "createPairingChallenge"
      ],
      "statusCodes": [
        "201"
      ],
      "classification": "infrastructure",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/auth\\/pair$/",
      "path": "/auth/pair",
      "handler": "handlePairDevice",
      "source": {
        "routeLine": 3850,
        "handlerLine": 1025
      },
      "authentication": "needs-review",
      "authorization": "none detected",
      "scope": {
        "tenant": "global/auth/provider",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "consumePairingChallenge"
      ],
      "storeFunctions": [
        "consumePairingChallenge",
        "createSession"
      ],
      "statusCodes": [
        "200",
        "400",
        "401"
      ],
      "classification": "infrastructure",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/memberships$/",
      "path": "/tenants/:id/memberships",
      "handler": "handleListTenantMemberships",
      "source": {
        "routeLine": 3851,
        "handlerLine": 1048
      },
      "authentication": "session/authentication present",
      "authorization": [
        "membership:membership:role:manage"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "listTenantMemberships"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "infrastructure",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/packs\\/([^/]+)\\/lifecycle$/",
      "path": "/tenants/:id/packs/:id/lifecycle",
      "handler": "handlePackLifecycle",
      "source": {
        "routeLine": 3852,
        "handlerLine": 3230
      },
      "authentication": "session/authentication present",
      "authorization": [
        "pack_lifecycle:pack:lifecycle:view",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [
        "PACK_LIFECYCLE_ACTION_REQUIRED",
        "UNSUPPORTED_PACK_LIFECYCLE_ACTION",
        "PACK_LIFECYCLE_ACTION_STATE_MISMATCH",
        "PACK_UPGRADE_COMMAND_REQUIRED",
        "PACK_RECOVERY_NOT_REQUIRED",
        "PACK_UPGRADE_NOT_AVAILABLE",
        "UNSUPPORTED_PACK_LIFECYCLE_API_STATE"
      ],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "transitionPackLifecycle"
      ],
      "storeFunctions": [
        "getTenant",
        "getPackLifecycle",
        "transitionPackLifecycle"
      ],
      "statusCodes": [
        "200",
        "400",
        "404",
        "405",
        "409"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/packs\\/([^/]+)\\/lifecycle$/",
      "path": "/tenants/:id/packs/:id/lifecycle",
      "handler": "handlePackLifecycle",
      "source": {
        "routeLine": 3853,
        "handlerLine": 3230
      },
      "authentication": "session/authentication present",
      "authorization": [
        "pack_lifecycle:pack:lifecycle:view",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [
        "PACK_LIFECYCLE_ACTION_REQUIRED",
        "UNSUPPORTED_PACK_LIFECYCLE_ACTION",
        "PACK_LIFECYCLE_ACTION_STATE_MISMATCH",
        "PACK_UPGRADE_COMMAND_REQUIRED",
        "PACK_RECOVERY_NOT_REQUIRED",
        "PACK_UPGRADE_NOT_AVAILABLE",
        "UNSUPPORTED_PACK_LIFECYCLE_API_STATE"
      ],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "transitionPackLifecycle"
      ],
      "storeFunctions": [
        "getTenant",
        "getPackLifecycle",
        "transitionPackLifecycle"
      ],
      "statusCodes": [
        "200",
        "400",
        "404",
        "405",
        "409"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/auth\\/membership-role$/",
      "path": "/auth/membership-role",
      "handler": "handleChangeMembershipRole",
      "source": {
        "routeLine": 3854,
        "handlerLine": 1060
      },
      "authentication": "session/authentication present",
      "authorization": [
        "membership:membership:role:manage"
      ],
      "scope": {
        "tenant": "global/auth/provider",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "changeMembershipRole"
      ],
      "statusCodes": [
        "200",
        "400",
        "404"
      ],
      "classification": "infrastructure",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/auth\\/membership-contextual-role$/",
      "path": "/auth/membership-contextual-role",
      "handler": "handleAssignMembershipContextualRole",
      "source": {
        "routeLine": 3855,
        "handlerLine": 1075
      },
      "authentication": "session/authentication present",
      "authorization": [
        "membership:membership:role:manage"
      ],
      "scope": {
        "tenant": "global/auth/provider",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "assignMembershipContextualRole"
      ],
      "statusCodes": [
        "201",
        "404"
      ],
      "classification": "infrastructure",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/auth\\/membership-contextual-role\\/revoke$/",
      "path": "/auth/membership-contextual-role/revoke",
      "handler": "handleRevokeMembershipContextualRole",
      "source": {
        "routeLine": 3856,
        "handlerLine": 1094
      },
      "authentication": "session/authentication present",
      "authorization": [
        "membership:membership:role:manage"
      ],
      "scope": {
        "tenant": "global/auth/provider",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "revokeMembershipContextualRole"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "infrastructure",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/auth\\/invites$/",
      "path": "/auth/invites",
      "handler": "handleCreateInvite",
      "source": {
        "routeLine": 3857,
        "handlerLine": 1039
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "global/auth/provider",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "createInvite"
      ],
      "statusCodes": [
        "201"
      ],
      "classification": "infrastructure",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/auth\\/invites\\/revoke$/",
      "path": "/auth/invites/revoke",
      "handler": "handleRevokeInvite",
      "source": {
        "routeLine": 3858,
        "handlerLine": 1120
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "global/auth/provider",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "revokeInvite"
      ],
      "statusCodes": [
        "200",
        "400"
      ],
      "classification": "infrastructure",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/auth\\/accept-invite$/",
      "path": "/auth/accept-invite",
      "handler": "handleAcceptInvite",
      "source": {
        "routeLine": 3859,
        "handlerLine": 1155
      },
      "authentication": "needs-review",
      "authorization": "none detected",
      "scope": {
        "tenant": "global/auth/provider",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "consumeInvite"
      ],
      "storeFunctions": [
        "getOrCreateUserByTelegram",
        "consumeInvite",
        "createSession"
      ],
      "statusCodes": [
        "200",
        "400",
        "401"
      ],
      "classification": "infrastructure",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/invites$/",
      "path": "/tenants/:id/invites",
      "handler": "handleListInvites",
      "source": {
        "routeLine": 3860,
        "handlerLine": 1113
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "listInvites"
      ],
      "statusCodes": [
        "200"
      ],
      "classification": "infrastructure",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/devices$/",
      "path": "/tenants/:id/devices",
      "handler": "handleListDevices",
      "source": {
        "routeLine": 3861,
        "handlerLine": 1130
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "listDevices"
      ],
      "statusCodes": [
        "200"
      ],
      "classification": "infrastructure",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/auth\\/devices\\/revoke$/",
      "path": "/auth/devices/revoke",
      "handler": "handleRevokeDevice",
      "source": {
        "routeLine": 3862,
        "handlerLine": 1137
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "global/auth/provider",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "revokeDevice"
      ],
      "statusCodes": [
        "200",
        "400"
      ],
      "classification": "infrastructure",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/sync\\/([^/]+)$/",
      "path": "/sync/:id",
      "handler": "handleSync",
      "source": {
        "routeLine": 3863,
        "handlerLine": 1221
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "saveQueuedOrders"
      ],
      "storeFunctions": [
        "getTenant",
        "saveQueuedOrders"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/events\\/([^/]+)$/",
      "path": "/events/:id",
      "handler": "handleSyncEvents",
      "source": {
        "routeLine": 3864,
        "handlerLine": 1176
      },
      "authentication": "session/authentication present",
      "authorization": [
        "customers:customers:manage",
        "inventory:inventory:edit"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "LOCATION_SCOPE_DENIED"
      ],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "processSyncEvent"
      ],
      "storeFunctions": [
        "getTenant",
        "getOrganizationLocation",
        "processSyncEvent"
      ],
      "statusCodes": [
        "200",
        "400",
        "403",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/sync\\/([^/]+)$/",
      "path": "/sync/:id",
      "handler": "handleSyncPull",
      "source": {
        "routeLine": 3865,
        "handlerLine": 1256
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "pullNewOrders"
      ],
      "storeFunctions": [
        "getTenant",
        "pullNewOrders"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/orders\\/([^/]+)$/",
      "path": "/orders/:id",
      "handler": "handleOrdersFeed",
      "source": {
        "routeLine": 3866,
        "handlerLine": 1244
      },
      "authentication": "session/authentication present",
      "authorization": [
        "orders:orders:view"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getOrders"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/service-provider\\/resources$/",
      "path": "/tenants/:id/service-provider/resources",
      "handler": "handleServiceProviderResources",
      "source": {
        "routeLine": 3867,
        "handlerLine": 3650
      },
      "authentication": "session/authentication present",
      "authorization": [
        "service_resource:service:service_resource:view"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "SERVICE_PROVIDER_ASSIGNMENT_REQUIRED",
        "LOCATION_SCOPE_DENIED"
      ],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "listServiceResources",
        "getOrganizationLocation",
        "getServiceResourceAvailability"
      ],
      "statusCodes": [
        "200",
        "403",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/service-provider\\/bookings$/",
      "path": "/tenants/:id/service-provider/bookings",
      "handler": "handleServiceProviderBookings",
      "source": {
        "routeLine": 3868,
        "handlerLine": 3683
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "SERVICE_PROVIDER_ASSIGNMENT_REQUIRED",
        "LOCATION_SCOPE_DENIED"
      ],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "listServiceResources",
        "getOrganizationLocation",
        "listServiceProviderBookings"
      ],
      "statusCodes": [
        "200",
        "403",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/service-resources$/",
      "path": "/tenants/:id/service-resources",
      "handler": "handleServiceResources",
      "source": {
        "routeLine": 3869,
        "handlerLine": 3508
      },
      "authentication": "session/authentication present",
      "authorization": [
        "service_resource:service:service_resource:view",
        "service_resource:service:service_resource:manage",
        "service_resource:service:service_resource:manage",
        "service_resource:service:service_resource:manage"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "LOCATION_SCOPE_DENIED",
        "SERVICE_RESOURCE_NOT_FOUND",
        "IDEMPOTENCY_KEY_REQUIRED"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "createServiceResource",
        "updateServiceResource"
      ],
      "storeFunctions": [
        "getTenant",
        "listServiceResources",
        "getOrganizationLocation",
        "createServiceResource",
        "updateServiceResource"
      ],
      "statusCodes": [
        "200",
        "400",
        "403",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/service-resources$/",
      "path": "/tenants/:id/service-resources",
      "handler": "handleServiceResources",
      "source": {
        "routeLine": 3870,
        "handlerLine": 3508
      },
      "authentication": "session/authentication present",
      "authorization": [
        "service_resource:service:service_resource:view",
        "service_resource:service:service_resource:manage",
        "service_resource:service:service_resource:manage",
        "service_resource:service:service_resource:manage"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "LOCATION_SCOPE_DENIED",
        "SERVICE_RESOURCE_NOT_FOUND",
        "IDEMPOTENCY_KEY_REQUIRED"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "createServiceResource",
        "updateServiceResource"
      ],
      "storeFunctions": [
        "getTenant",
        "listServiceResources",
        "getOrganizationLocation",
        "createServiceResource",
        "updateServiceResource"
      ],
      "statusCodes": [
        "200",
        "400",
        "403",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/service-resources\\/([^/]+)$/",
      "path": "/tenants/:id/service-resources/:id",
      "handler": "handleServiceResources",
      "source": {
        "routeLine": 3871,
        "handlerLine": 3508
      },
      "authentication": "session/authentication present",
      "authorization": [
        "service_resource:service:service_resource:view",
        "service_resource:service:service_resource:manage",
        "service_resource:service:service_resource:manage",
        "service_resource:service:service_resource:manage"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "LOCATION_SCOPE_DENIED",
        "SERVICE_RESOURCE_NOT_FOUND",
        "IDEMPOTENCY_KEY_REQUIRED"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "createServiceResource",
        "updateServiceResource"
      ],
      "storeFunctions": [
        "getTenant",
        "listServiceResources",
        "getOrganizationLocation",
        "createServiceResource",
        "updateServiceResource"
      ],
      "statusCodes": [
        "200",
        "400",
        "403",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/service-resources\\/([^/]+)\\/availability$/",
      "path": "/tenants/:id/service-resources/:id/availability",
      "handler": "handleServiceResourceAvailability",
      "source": {
        "routeLine": 3872,
        "handlerLine": 3613
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "SERVICE_RESOURCE_NOT_FOUND",
        "LOCATION_SCOPE_DENIED",
        "IDEMPOTENCY_KEY_REQUIRED"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "setServiceResourceAvailability"
      ],
      "storeFunctions": [
        "getTenant",
        "listServiceResources",
        "getOrganizationLocation",
        "getServiceResourceAvailability",
        "setServiceResourceAvailability"
      ],
      "statusCodes": [
        "200",
        "400",
        "403",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PUT",
      "pattern": "/^\\/tenants\\/([^/]+)\\/service-resources\\/([^/]+)\\/availability$/",
      "path": "/tenants/:id/service-resources/:id/availability",
      "handler": "handleServiceResourceAvailability",
      "source": {
        "routeLine": 3873,
        "handlerLine": 3613
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "SERVICE_RESOURCE_NOT_FOUND",
        "LOCATION_SCOPE_DENIED",
        "IDEMPOTENCY_KEY_REQUIRED"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "setServiceResourceAvailability"
      ],
      "storeFunctions": [
        "getTenant",
        "listServiceResources",
        "getOrganizationLocation",
        "getServiceResourceAvailability",
        "setServiceResourceAvailability"
      ],
      "statusCodes": [
        "200",
        "400",
        "403",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/orders\\/([^/]+)\\/service-bookings$/",
      "path": "/tenants/:id/orders/:id/service-bookings",
      "handler": "handleServiceBookings",
      "source": {
        "routeLine": 3874,
        "handlerLine": 3716
      },
      "authentication": "session/authentication present",
      "authorization": [
        "service_booking:service:service_booking:view"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "ORDER_NOT_FOUND",
        "LOCATION_SCOPE_DENIED",
        "IDEMPOTENCY_KEY_REQUIRED"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "createServiceBooking",
        "transitionServiceBooking"
      ],
      "storeFunctions": [
        "getTenant",
        "getOrders",
        "getOrganizationLocation",
        "listServiceBookings",
        "createServiceBooking",
        "transitionServiceBooking"
      ],
      "statusCodes": [
        "200",
        "400",
        "403",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/orders\\/([^/]+)\\/service-bookings$/",
      "path": "/tenants/:id/orders/:id/service-bookings",
      "handler": "handleServiceBookings",
      "source": {
        "routeLine": 3875,
        "handlerLine": 3716
      },
      "authentication": "session/authentication present",
      "authorization": [
        "service_booking:service:service_booking:view"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "ORDER_NOT_FOUND",
        "LOCATION_SCOPE_DENIED",
        "IDEMPOTENCY_KEY_REQUIRED"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "createServiceBooking",
        "transitionServiceBooking"
      ],
      "storeFunctions": [
        "getTenant",
        "getOrders",
        "getOrganizationLocation",
        "listServiceBookings",
        "createServiceBooking",
        "transitionServiceBooking"
      ],
      "statusCodes": [
        "200",
        "400",
        "403",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/orders\\/([^/]+)\\/service-bookings\\/([^/]+)$/",
      "path": "/tenants/:id/orders/:id/service-bookings/:id",
      "handler": "handleServiceBookings",
      "source": {
        "routeLine": 3876,
        "handlerLine": 3716
      },
      "authentication": "session/authentication present",
      "authorization": [
        "service_booking:service:service_booking:view"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "ORDER_NOT_FOUND",
        "LOCATION_SCOPE_DENIED",
        "IDEMPOTENCY_KEY_REQUIRED"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "createServiceBooking",
        "transitionServiceBooking"
      ],
      "storeFunctions": [
        "getTenant",
        "getOrders",
        "getOrganizationLocation",
        "listServiceBookings",
        "createServiceBooking",
        "transitionServiceBooking"
      ],
      "statusCodes": [
        "200",
        "400",
        "403",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/orders\\/([^/]+)\\/service-delivery-assessment$/",
      "path": "/tenants/:id/orders/:id/service-delivery-assessment",
      "handler": "handleServiceDeliveryAssessment",
      "source": {
        "routeLine": 3877,
        "handlerLine": 3767
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "IDEMPOTENCY_KEY_REQUIRED"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "recordServiceDeliveryAssessment"
      ],
      "storeFunctions": [
        "getTenant",
        "recordServiceDeliveryAssessment"
      ],
      "statusCodes": [
        "200",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/orders\\/([^/]+)\\/fulfillment$/",
      "path": "/tenants/:id/orders/:id/fulfillment",
      "handler": "handleOrderFulfillment",
      "source": {
        "routeLine": 3878,
        "handlerLine": 3792
      },
      "authentication": "session/authentication present",
      "authorization": [
        "fulfillment:fulfillment:view",
        "logistics:logistics:deliveries:update_assigned",
        "fulfillment:fulfillment:update"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "IDEMPOTENCY_KEY_REQUIRED"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "transitionOrderFulfillment"
      ],
      "storeFunctions": [
        "getTenant",
        "getOrderFulfillment",
        "assertCourierOwnsDelivery",
        "transitionOrderFulfillment"
      ],
      "statusCodes": [
        "200",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/orders\\/([^/]+)\\/delivery-assignment$/",
      "path": "/tenants/:id/orders/:id/delivery-assignment",
      "handler": "handleDeliveryAssignment",
      "source": {
        "routeLine": 3879,
        "handlerLine": 3461
      },
      "authentication": "session/authentication present",
      "authorization": [
        "logistics:logistics:deliveries:view",
        "logistics:logistics:deliveries:update_assigned",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "IDEMPOTENCY_KEY_REQUIRED"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "transitionDeliveryAssignment",
        "assignDeliveryCourier"
      ],
      "storeFunctions": [
        "getTenant",
        "getDeliveryAssignment",
        "assertCourierOwnsDelivery",
        "transitionDeliveryAssignment",
        "assignDeliveryCourier"
      ],
      "statusCodes": [
        "200",
        "400",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/orders\\/([^/]+)\\/delivery-assignment$/",
      "path": "/tenants/:id/orders/:id/delivery-assignment",
      "handler": "handleDeliveryAssignment",
      "source": {
        "routeLine": 3880,
        "handlerLine": 3461
      },
      "authentication": "session/authentication present",
      "authorization": [
        "logistics:logistics:deliveries:view",
        "logistics:logistics:deliveries:update_assigned",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "IDEMPOTENCY_KEY_REQUIRED"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "transitionDeliveryAssignment",
        "assignDeliveryCourier"
      ],
      "storeFunctions": [
        "getTenant",
        "getDeliveryAssignment",
        "assertCourierOwnsDelivery",
        "transitionDeliveryAssignment",
        "assignDeliveryCourier"
      ],
      "statusCodes": [
        "200",
        "400",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/logistics\\/scheduling$/",
      "path": "/tenants/:id/logistics/scheduling",
      "handler": "handleLogisticsScheduling",
      "source": {
        "routeLine": 3881,
        "handlerLine": 3338
      },
      "authentication": "session/authentication present",
      "authorization": [
        "scheduling:logistics:scheduling:view",
        "scheduling:logistics:scheduling:request",
        "scheduling:logistics:scheduling:view"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "LOCATION_SCOPE_DENIED",
        "IDEMPOTENCY_KEY_REQUIRED",
        "SCHEDULING_ACTIVITY_NOT_FOUND",
        "SCHEDULING_STATUS_REQUIRED",
        "SCHEDULING_VERSION_REQUIRED"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "createLogisticsSchedulingActivity",
        "transitionLogisticsSchedulingActivity"
      ],
      "storeFunctions": [
        "getTenant",
        "getOrganizationLocation",
        "listLogisticsSchedulingActivities",
        "getLogisticsSchedulingTimeZone",
        "createLogisticsSchedulingActivity",
        "getLogisticsSchedulingActivity",
        "evaluateLogisticsSchedulingActivity",
        "transitionLogisticsSchedulingActivity"
      ],
      "statusCodes": [
        "200",
        "400",
        "403",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/logistics\\/scheduling$/",
      "path": "/tenants/:id/logistics/scheduling",
      "handler": "handleLogisticsScheduling",
      "source": {
        "routeLine": 3882,
        "handlerLine": 3338
      },
      "authentication": "session/authentication present",
      "authorization": [
        "scheduling:logistics:scheduling:view",
        "scheduling:logistics:scheduling:request",
        "scheduling:logistics:scheduling:view"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "LOCATION_SCOPE_DENIED",
        "IDEMPOTENCY_KEY_REQUIRED",
        "SCHEDULING_ACTIVITY_NOT_FOUND",
        "SCHEDULING_STATUS_REQUIRED",
        "SCHEDULING_VERSION_REQUIRED"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "createLogisticsSchedulingActivity",
        "transitionLogisticsSchedulingActivity"
      ],
      "storeFunctions": [
        "getTenant",
        "getOrganizationLocation",
        "listLogisticsSchedulingActivities",
        "getLogisticsSchedulingTimeZone",
        "createLogisticsSchedulingActivity",
        "getLogisticsSchedulingActivity",
        "evaluateLogisticsSchedulingActivity",
        "transitionLogisticsSchedulingActivity"
      ],
      "statusCodes": [
        "200",
        "400",
        "403",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/logistics\\/scheduling\\/([^/]+)$/",
      "path": "/tenants/:id/logistics/scheduling/:id",
      "handler": "handleLogisticsScheduling",
      "source": {
        "routeLine": 3883,
        "handlerLine": 3338
      },
      "authentication": "session/authentication present",
      "authorization": [
        "scheduling:logistics:scheduling:view",
        "scheduling:logistics:scheduling:request",
        "scheduling:logistics:scheduling:view"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "LOCATION_SCOPE_DENIED",
        "IDEMPOTENCY_KEY_REQUIRED",
        "SCHEDULING_ACTIVITY_NOT_FOUND",
        "SCHEDULING_STATUS_REQUIRED",
        "SCHEDULING_VERSION_REQUIRED"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "createLogisticsSchedulingActivity",
        "transitionLogisticsSchedulingActivity"
      ],
      "storeFunctions": [
        "getTenant",
        "getOrganizationLocation",
        "listLogisticsSchedulingActivities",
        "getLogisticsSchedulingTimeZone",
        "createLogisticsSchedulingActivity",
        "getLogisticsSchedulingActivity",
        "evaluateLogisticsSchedulingActivity",
        "transitionLogisticsSchedulingActivity"
      ],
      "statusCodes": [
        "200",
        "400",
        "403",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/logistics\\/scheduling\\/([^/]+)\\/evaluate$/",
      "path": "/tenants/:id/logistics/scheduling/:id/evaluate",
      "handler": "handleLogisticsScheduling",
      "source": {
        "routeLine": 3884,
        "handlerLine": 3338
      },
      "authentication": "session/authentication present",
      "authorization": [
        "scheduling:logistics:scheduling:view",
        "scheduling:logistics:scheduling:request",
        "scheduling:logistics:scheduling:view"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "LOCATION_SCOPE_DENIED",
        "IDEMPOTENCY_KEY_REQUIRED",
        "SCHEDULING_ACTIVITY_NOT_FOUND",
        "SCHEDULING_STATUS_REQUIRED",
        "SCHEDULING_VERSION_REQUIRED"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "createLogisticsSchedulingActivity",
        "transitionLogisticsSchedulingActivity"
      ],
      "storeFunctions": [
        "getTenant",
        "getOrganizationLocation",
        "listLogisticsSchedulingActivities",
        "getLogisticsSchedulingTimeZone",
        "createLogisticsSchedulingActivity",
        "getLogisticsSchedulingActivity",
        "evaluateLogisticsSchedulingActivity",
        "transitionLogisticsSchedulingActivity"
      ],
      "statusCodes": [
        "200",
        "400",
        "403",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/logistics\\/scheduling\\/([^/]+)\\/transition$/",
      "path": "/tenants/:id/logistics/scheduling/:id/transition",
      "handler": "handleLogisticsScheduling",
      "source": {
        "routeLine": 3885,
        "handlerLine": 3338
      },
      "authentication": "session/authentication present",
      "authorization": [
        "scheduling:logistics:scheduling:view",
        "scheduling:logistics:scheduling:request",
        "scheduling:logistics:scheduling:view"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "LOCATION_SCOPE_DENIED",
        "IDEMPOTENCY_KEY_REQUIRED",
        "SCHEDULING_ACTIVITY_NOT_FOUND",
        "SCHEDULING_STATUS_REQUIRED",
        "SCHEDULING_VERSION_REQUIRED"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "createLogisticsSchedulingActivity",
        "transitionLogisticsSchedulingActivity"
      ],
      "storeFunctions": [
        "getTenant",
        "getOrganizationLocation",
        "listLogisticsSchedulingActivities",
        "getLogisticsSchedulingTimeZone",
        "createLogisticsSchedulingActivity",
        "getLogisticsSchedulingActivity",
        "evaluateLogisticsSchedulingActivity",
        "transitionLogisticsSchedulingActivity"
      ],
      "statusCodes": [
        "200",
        "400",
        "403",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/delivery-assignments$/",
      "path": "/tenants/:id/delivery-assignments",
      "handler": "handleDeliveryAssignmentsList",
      "source": {
        "routeLine": 3886,
        "handlerLine": 3443
      },
      "authentication": "session/authentication present",
      "authorization": [
        "logistics:logistics:deliveries:view"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "listDeliveryAssignments"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/orders\\/([^/]+)\\/delivery-assignment$/",
      "path": "/tenants/:id/orders/:id/delivery-assignment",
      "handler": "handleDeliveryAssignment",
      "source": {
        "routeLine": 3887,
        "handlerLine": 3461
      },
      "authentication": "session/authentication present",
      "authorization": [
        "logistics:logistics:deliveries:view",
        "logistics:logistics:deliveries:update_assigned",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "IDEMPOTENCY_KEY_REQUIRED"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "transitionDeliveryAssignment",
        "assignDeliveryCourier"
      ],
      "storeFunctions": [
        "getTenant",
        "getDeliveryAssignment",
        "assertCourierOwnsDelivery",
        "transitionDeliveryAssignment",
        "assignDeliveryCourier"
      ],
      "statusCodes": [
        "200",
        "400",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/orders\\/([^/]+)\\/fulfillment$/",
      "path": "/tenants/:id/orders/:id/fulfillment",
      "handler": "handleOrderFulfillment",
      "source": {
        "routeLine": 3888,
        "handlerLine": 3792
      },
      "authentication": "session/authentication present",
      "authorization": [
        "fulfillment:fulfillment:view",
        "logistics:logistics:deliveries:update_assigned",
        "fulfillment:fulfillment:update"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "IDEMPOTENCY_KEY_REQUIRED"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "transitionOrderFulfillment"
      ],
      "storeFunctions": [
        "getTenant",
        "getOrderFulfillment",
        "assertCourierOwnsDelivery",
        "transitionOrderFulfillment"
      ],
      "statusCodes": [
        "200",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/catalog\\/([^/]+)$/",
      "path": "/catalog/:id",
      "handler": "handleCatalogGet",
      "source": {
        "routeLine": 3889,
        "handlerLine": 1265
      },
      "authentication": "public/provider-authenticated path",
      "authorization": "none detected",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getCatalog"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/storefront-channels$/",
      "path": "/tenants/:id/storefront-channels",
      "handler": "handleSellerStorefrontChannelsGet",
      "source": {
        "routeLine": 3890,
        "handlerLine": 495
      },
      "authentication": "session/authentication present",
      "authorization": [
        "seller_storefront_channels:settings:configure"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getTelegramStorefrontConfig"
      ],
      "statusCodes": [
        "200"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/storefront-consistency$/",
      "path": "/tenants/:id/storefront-consistency",
      "handler": "handleCrossChannelConsistencyGet",
      "source": {
        "routeLine": 3891,
        "handlerLine": 484
      },
      "authentication": "session/authentication present",
      "authorization": [
        "seller_storefront_channels:settings:configure"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getTelegramStorefrontConfig"
      ],
      "statusCodes": [
        "200"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/telegram-storefront$/",
      "path": "/tenants/:id/telegram-storefront",
      "handler": "handleTelegramStorefrontGet",
      "source": {
        "routeLine": 3892,
        "handlerLine": 504
      },
      "authentication": "session/authentication present",
      "authorization": [
        "telegram_storefront:settings:configure"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getTelegramStorefrontConfig"
      ],
      "statusCodes": [
        "200"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/api\\/telegram-storefront\\/([^/]+)$/",
      "path": "/api/telegram-storefront/:id",
      "handler": "handleTelegramStorefrontPublicGet",
      "source": {
        "routeLine": 3893,
        "handlerLine": 460
      },
      "authentication": "public/provider-authenticated path",
      "authorization": "none detected",
      "scope": {
        "tenant": "public tenant/resource",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getTelegramStorefrontConfig"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/api\\/telegram-storefront\\/([^/]+)\\/buyer-session$/",
      "path": "/api/telegram-storefront/:id/buyer-session",
      "handler": "handleTelegramStorefrontBuyerSession",
      "source": {
        "routeLine": 3894,
        "handlerLine": 536
      },
      "authentication": "public/provider-authenticated path",
      "authorization": "none detected",
      "scope": {
        "tenant": "public tenant/resource",
        "location": "not detected"
      },
      "validationCodes": [
        "TELEGRAM_CREDENTIAL_REQUIRED"
      ],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getTelegramStorefrontConfig",
        "recordAuditEvent"
      ],
      "statusCodes": [
        "200",
        "404",
        "409"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/api\\/telegram-storefront\\/([^/]+)\\/orders\\/([^/]+)\\/service-bookings$/",
      "path": "/api/telegram-storefront/:id/orders/:id/service-bookings",
      "handler": "handleTelegramStorefrontServiceBookings",
      "source": {
        "routeLine": 3895,
        "handlerLine": 691
      },
      "authentication": "public/provider-authenticated path",
      "authorization": "none detected",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [
        "TELEGRAM_ORDER_STATUS_DISABLED",
        "TELEGRAM_BUYER_AUTH_REQUIRED",
        "IDEMPOTENCY_KEY_REQUIRED",
        "SERVICE_BOOKING_ORDER_LINE_INVALID"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "createServiceBooking"
      ],
      "storeFunctions": [
        "getTenant",
        "getTelegramStorefrontConfig",
        "getTelegramBuyerServiceBookings",
        "createServiceBooking",
        "recordAuditEvent"
      ],
      "statusCodes": [
        "200",
        "400",
        "401",
        "403",
        "404",
        "405",
        "409"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/api\\/telegram-storefront\\/([^/]+)\\/orders\\/([^/]+)\\/service-bookings$/",
      "path": "/api/telegram-storefront/:id/orders/:id/service-bookings",
      "handler": "handleTelegramStorefrontServiceBookings",
      "source": {
        "routeLine": 3896,
        "handlerLine": 691
      },
      "authentication": "public/provider-authenticated path",
      "authorization": "none detected",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [
        "TELEGRAM_ORDER_STATUS_DISABLED",
        "TELEGRAM_BUYER_AUTH_REQUIRED",
        "IDEMPOTENCY_KEY_REQUIRED",
        "SERVICE_BOOKING_ORDER_LINE_INVALID"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "createServiceBooking"
      ],
      "storeFunctions": [
        "getTenant",
        "getTelegramStorefrontConfig",
        "getTelegramBuyerServiceBookings",
        "createServiceBooking",
        "recordAuditEvent"
      ],
      "statusCodes": [
        "200",
        "400",
        "401",
        "403",
        "404",
        "405",
        "409"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/api\\/telegram-storefront\\/([^/]+)\\/orders\\/([^/]+)\\/service-feasibility$/",
      "path": "/api/telegram-storefront/:id/orders/:id/service-feasibility",
      "handler": "handleTelegramStorefrontServiceFeasibility",
      "source": {
        "routeLine": 3897,
        "handlerLine": 587
      },
      "authentication": "public/provider-authenticated path",
      "authorization": "none detected",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [
        "TELEGRAM_ORDER_STATUS_DISABLED",
        "TELEGRAM_BUYER_AUTH_REQUIRED"
      ],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getTelegramStorefrontConfig",
        "assessTelegramBuyerServiceFeasibility"
      ],
      "statusCodes": [
        "200",
        "401",
        "403",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/api\\/telegram-storefront\\/([^/]+)\\/orders\\/([^/]+)\\/service-bookings\\/([^/]+)\\/cancel$/",
      "path": "/api/telegram-storefront/:id/orders/:id/service-bookings/:id/cancel",
      "handler": "handleTelegramStorefrontServiceBookingCancel",
      "source": {
        "routeLine": 3898,
        "handlerLine": 625
      },
      "authentication": "public/provider-authenticated path",
      "authorization": "none detected",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [
        "TELEGRAM_ORDER_STATUS_DISABLED",
        "TELEGRAM_BUYER_AUTH_REQUIRED",
        "SERVICE_BOOKING_NOT_FOUND",
        "IDEMPOTENCY_KEY_REQUIRED",
        "SERVICE_BOOKING_VERSION_REQUIRED"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "transitionServiceBooking"
      ],
      "storeFunctions": [
        "getTenant",
        "getTelegramStorefrontConfig",
        "getTelegramBuyerServiceBookings",
        "transitionServiceBooking",
        "recordAuditEvent"
      ],
      "statusCodes": [
        "200",
        "400",
        "401",
        "403",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/api\\/telegram-storefront\\/([^/]+)\\/orders\\/([^/]+)\\/fulfillment$/",
      "path": "/api/telegram-storefront/:id/orders/:id/fulfillment",
      "handler": "handleTelegramStorefrontFulfillment",
      "source": {
        "routeLine": 3899,
        "handlerLine": 794
      },
      "authentication": "public/provider-authenticated path",
      "authorization": "none detected",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [
        "TELEGRAM_FULFILLMENT_DISABLED",
        "TELEGRAM_BUYER_AUTH_REQUIRED"
      ],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getTelegramStorefrontConfig",
        "getTelegramBuyerFulfillmentExperience",
        "recordAuditEvent"
      ],
      "statusCodes": [
        "200",
        "401",
        "403",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/api\\/telegram-storefront\\/([^/]+)\\/orders\\/([^/]+)$/",
      "path": "/api/telegram-storefront/:id/orders/:id",
      "handler": "handleTelegramStorefrontOrder",
      "source": {
        "routeLine": 3900,
        "handlerLine": 825
      },
      "authentication": "public/provider-authenticated path",
      "authorization": "none detected",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [
        "TELEGRAM_ORDER_STATUS_DISABLED"
      ],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getTelegramStorefrontConfig",
        "getMarketplaceOrderTracking"
      ],
      "statusCodes": [
        "200",
        "400",
        "403",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/api\\/telegram-storefront\\/([^/]+)\\/orders$/",
      "path": "/api/telegram-storefront/:id/orders",
      "handler": "handleTelegramStorefrontOrderHistory",
      "source": {
        "routeLine": 3901,
        "handlerLine": 566
      },
      "authentication": "public/provider-authenticated path",
      "authorization": "none detected",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [
        "TELEGRAM_ORDER_STATUS_DISABLED",
        "TELEGRAM_BUYER_AUTH_REQUIRED"
      ],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getTelegramStorefrontConfig",
        "listTelegramBuyerOrders",
        "recordAuditEvent"
      ],
      "statusCodes": [
        "200",
        "401",
        "403",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/telegram-storefront\\/verify$/",
      "path": "/tenants/:id/telegram-storefront/verify",
      "handler": "handleTelegramStorefrontVerify",
      "source": {
        "routeLine": 3902,
        "handlerLine": 514
      },
      "authentication": "session/authentication present",
      "authorization": [
        "telegram_storefront:settings:configure"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "verifyTelegramStorefront"
      ],
      "storeFunctions": [
        "getTenant",
        "verifyTelegramStorefront"
      ],
      "statusCodes": [
        "200"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/telegram-storefront$/",
      "path": "/tenants/:id/telegram-storefront",
      "handler": "handleTelegramStorefrontPatch",
      "source": {
        "routeLine": 3903,
        "handlerLine": 523
      },
      "authentication": "session/authentication present",
      "authorization": [
        "telegram_storefront:settings:configure"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [
        "INVALID_CREDENTIAL_REF"
      ],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertTelegramStorefrontConfig"
      ],
      "storeFunctions": [
        "getTenant",
        "upsertTelegramStorefrontConfig"
      ],
      "statusCodes": [
        "200",
        "400"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/catalog\\/([^/]+)$/",
      "path": "/catalog/:id",
      "handler": "handleCatalogPost",
      "source": {
        "routeLine": 3904,
        "handlerLine": 1286
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "saveCatalog"
      ],
      "storeFunctions": [
        "getTenant",
        "saveCatalog",
        "getCatalog"
      ],
      "statusCodes": [
        "200",
        "400",
        "404",
        "409"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants$/",
      "path": "/tenants",
      "handler": "handleTenantsList",
      "source": {
        "routeLine": 3905,
        "handlerLine": 1343
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "listUserMemberships"
      ],
      "statusCodes": [
        "200"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/customers$/",
      "path": "/tenants/:id/customers",
      "handler": "handleCustomersList",
      "source": {
        "routeLine": 3906,
        "handlerLine": 1353
      },
      "authentication": "session/authentication present",
      "authorization": [
        "customers:customers:view"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "listCustomers"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/customers$/",
      "path": "/tenants/:id/customers",
      "handler": "handleCustomerCreate",
      "source": {
        "routeLine": 3907,
        "handlerLine": 1377
      },
      "authentication": "session/authentication present",
      "authorization": [
        "customers:customers:manage"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "upsertCustomer"
      ],
      "statusCodes": [
        "201",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/customers\\/([^/]+)$/",
      "path": "/tenants/:id/customers/:id",
      "handler": "handleCustomerGet",
      "source": {
        "routeLine": 3908,
        "handlerLine": 1367
      },
      "authentication": "session/authentication present",
      "authorization": [
        "customers:customers:view"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getCustomer"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/customers\\/([^/]+)$/",
      "path": "/tenants/:id/customers/:id",
      "handler": "handleCustomerPatch",
      "source": {
        "routeLine": 3909,
        "handlerLine": 1387
      },
      "authentication": "session/authentication present",
      "authorization": [
        "customers:customers:manage"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "updateCustomer"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/pricing$/",
      "path": "/tenants/:id/b2b/pricing",
      "handler": "handleCustomerPricing",
      "source": {
        "routeLine": 3910,
        "handlerLine": 1397
      },
      "authentication": "session/authentication present",
      "authorization": [
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertCustomerPricing"
      ],
      "storeFunctions": [
        "getTenant",
        "getCustomerPricing",
        "listCustomerPricing",
        "updateCustomerPricing",
        "upsertCustomerPricing"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/pricing$/",
      "path": "/tenants/:id/b2b/pricing",
      "handler": "handleCustomerPricing",
      "source": {
        "routeLine": 3911,
        "handlerLine": 1397
      },
      "authentication": "session/authentication present",
      "authorization": [
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertCustomerPricing"
      ],
      "storeFunctions": [
        "getTenant",
        "getCustomerPricing",
        "listCustomerPricing",
        "updateCustomerPricing",
        "upsertCustomerPricing"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/pricing\\/([^/]+)$/",
      "path": "/tenants/:id/b2b/pricing/:id",
      "handler": "handleCustomerPricing",
      "source": {
        "routeLine": 3912,
        "handlerLine": 1397
      },
      "authentication": "session/authentication present",
      "authorization": [
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertCustomerPricing"
      ],
      "storeFunctions": [
        "getTenant",
        "getCustomerPricing",
        "listCustomerPricing",
        "updateCustomerPricing",
        "upsertCustomerPricing"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/pricing\\/([^/]+)$/",
      "path": "/tenants/:id/b2b/pricing/:id",
      "handler": "handleCustomerPricing",
      "source": {
        "routeLine": 3913,
        "handlerLine": 1397
      },
      "authentication": "session/authentication present",
      "authorization": [
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertCustomerPricing"
      ],
      "storeFunctions": [
        "getTenant",
        "getCustomerPricing",
        "listCustomerPricing",
        "updateCustomerPricing",
        "upsertCustomerPricing"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/capabilities$/",
      "path": "/tenants/:id/supplier-network/capabilities",
      "handler": "handleSupplierNetworkCapabilities",
      "source": {
        "routeLine": 3914,
        "handlerLine": 1420
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_capability:supplier-network:capability:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkCapability"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkCapability",
        "listSupplierNetworkCapabilities",
        "transitionSupplierNetworkCapability",
        "upsertSupplierNetworkCapability"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/capabilities$/",
      "path": "/tenants/:id/supplier-network/capabilities",
      "handler": "handleSupplierNetworkCapabilities",
      "source": {
        "routeLine": 3915,
        "handlerLine": 1420
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_capability:supplier-network:capability:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkCapability"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkCapability",
        "listSupplierNetworkCapabilities",
        "transitionSupplierNetworkCapability",
        "upsertSupplierNetworkCapability"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/capabilities\\/([^/]+)$/",
      "path": "/tenants/:id/supplier-network/capabilities/:id",
      "handler": "handleSupplierNetworkCapabilities",
      "source": {
        "routeLine": 3916,
        "handlerLine": 1420
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_capability:supplier-network:capability:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkCapability"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkCapability",
        "listSupplierNetworkCapabilities",
        "transitionSupplierNetworkCapability",
        "upsertSupplierNetworkCapability"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/capabilities\\/([^/]+)$/",
      "path": "/tenants/:id/supplier-network/capabilities/:id",
      "handler": "handleSupplierNetworkCapabilities",
      "source": {
        "routeLine": 3917,
        "handlerLine": 1420
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_capability:supplier-network:capability:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkCapability"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkCapability",
        "listSupplierNetworkCapabilities",
        "transitionSupplierNetworkCapability",
        "upsertSupplierNetworkCapability"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/capabilities\\/([^/]+)\\/(activate|deactivate)$/",
      "path": "/tenants/:id/supplier-network/capabilities/:id/(activate|deactivate)",
      "handler": "handleSupplierNetworkCapabilities",
      "source": {
        "routeLine": 3918,
        "handlerLine": 1420
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_capability:supplier-network:capability:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkCapability"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkCapability",
        "listSupplierNetworkCapabilities",
        "transitionSupplierNetworkCapability",
        "upsertSupplierNetworkCapability"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/catalog$/",
      "path": "/tenants/:id/supplier-network/catalog",
      "handler": "handleSupplierNetworkCatalog",
      "source": {
        "routeLine": 3919,
        "handlerLine": 1452
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_catalog_listing:supplier-network:catalog:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkCatalogListing"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkCatalogListing",
        "listSupplierNetworkCatalogListings",
        "transitionSupplierNetworkCatalogListing",
        "upsertSupplierNetworkCatalogListing"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/catalog$/",
      "path": "/tenants/:id/supplier-network/catalog",
      "handler": "handleSupplierNetworkCatalog",
      "source": {
        "routeLine": 3920,
        "handlerLine": 1452
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_catalog_listing:supplier-network:catalog:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkCatalogListing"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkCatalogListing",
        "listSupplierNetworkCatalogListings",
        "transitionSupplierNetworkCatalogListing",
        "upsertSupplierNetworkCatalogListing"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/catalog\\/([^/]+)$/",
      "path": "/tenants/:id/supplier-network/catalog/:id",
      "handler": "handleSupplierNetworkCatalog",
      "source": {
        "routeLine": 3921,
        "handlerLine": 1452
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_catalog_listing:supplier-network:catalog:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkCatalogListing"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkCatalogListing",
        "listSupplierNetworkCatalogListings",
        "transitionSupplierNetworkCatalogListing",
        "upsertSupplierNetworkCatalogListing"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/catalog\\/([^/]+)$/",
      "path": "/tenants/:id/supplier-network/catalog/:id",
      "handler": "handleSupplierNetworkCatalog",
      "source": {
        "routeLine": 3922,
        "handlerLine": 1452
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_catalog_listing:supplier-network:catalog:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkCatalogListing"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkCatalogListing",
        "listSupplierNetworkCatalogListings",
        "transitionSupplierNetworkCatalogListing",
        "upsertSupplierNetworkCatalogListing"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/catalog\\/([^/]+)\\/(activate|deactivate)$/",
      "path": "/tenants/:id/supplier-network/catalog/:id/(activate|deactivate)",
      "handler": "handleSupplierNetworkCatalog",
      "source": {
        "routeLine": 3923,
        "handlerLine": 1452
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_catalog_listing:supplier-network:catalog:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkCatalogListing"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkCatalogListing",
        "listSupplierNetworkCatalogListings",
        "transitionSupplierNetworkCatalogListing",
        "upsertSupplierNetworkCatalogListing"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/qualifications$/",
      "path": "/tenants/:id/supplier-network/qualifications",
      "handler": "handleSupplierNetworkQualifications",
      "source": {
        "routeLine": 3924,
        "handlerLine": 1477
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_qualification:supplier-network:qualification:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkQualification"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkQualification",
        "listSupplierNetworkQualifications",
        "transitionSupplierNetworkQualification",
        "upsertSupplierNetworkQualification"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/qualifications$/",
      "path": "/tenants/:id/supplier-network/qualifications",
      "handler": "handleSupplierNetworkQualifications",
      "source": {
        "routeLine": 3925,
        "handlerLine": 1477
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_qualification:supplier-network:qualification:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkQualification"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkQualification",
        "listSupplierNetworkQualifications",
        "transitionSupplierNetworkQualification",
        "upsertSupplierNetworkQualification"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/qualifications\\/([^/]+)$/",
      "path": "/tenants/:id/supplier-network/qualifications/:id",
      "handler": "handleSupplierNetworkQualifications",
      "source": {
        "routeLine": 3926,
        "handlerLine": 1477
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_qualification:supplier-network:qualification:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkQualification"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkQualification",
        "listSupplierNetworkQualifications",
        "transitionSupplierNetworkQualification",
        "upsertSupplierNetworkQualification"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/qualifications\\/([^/]+)$/",
      "path": "/tenants/:id/supplier-network/qualifications/:id",
      "handler": "handleSupplierNetworkQualifications",
      "source": {
        "routeLine": 3927,
        "handlerLine": 1477
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_qualification:supplier-network:qualification:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkQualification"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkQualification",
        "listSupplierNetworkQualifications",
        "transitionSupplierNetworkQualification",
        "upsertSupplierNetworkQualification"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/qualifications\\/([^/]+)\\/(verify|document|revoke)$/",
      "path": "/tenants/:id/supplier-network/qualifications/:id/(verify|document|revoke)",
      "handler": "handleSupplierNetworkQualifications",
      "source": {
        "routeLine": 3928,
        "handlerLine": 1477
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_qualification:supplier-network:qualification:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkQualification"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkQualification",
        "listSupplierNetworkQualifications",
        "transitionSupplierNetworkQualification",
        "upsertSupplierNetworkQualification"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/commercial-terms$/",
      "path": "/tenants/:id/supplier-network/commercial-terms",
      "handler": "handleSupplierNetworkCommercialTerms",
      "source": {
        "routeLine": 3929,
        "handlerLine": 1485
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_commercial_terms:supplier-network:commercial:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkCommercialTerms"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkCommercialTerms",
        "listSupplierNetworkCommercialTerms",
        "transitionSupplierNetworkCommercialTerms",
        "upsertSupplierNetworkCommercialTerms"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/commercial-terms$/",
      "path": "/tenants/:id/supplier-network/commercial-terms",
      "handler": "handleSupplierNetworkCommercialTerms",
      "source": {
        "routeLine": 3930,
        "handlerLine": 1485
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_commercial_terms:supplier-network:commercial:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkCommercialTerms"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkCommercialTerms",
        "listSupplierNetworkCommercialTerms",
        "transitionSupplierNetworkCommercialTerms",
        "upsertSupplierNetworkCommercialTerms"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/commercial-terms\\/([^/]+)$/",
      "path": "/tenants/:id/supplier-network/commercial-terms/:id",
      "handler": "handleSupplierNetworkCommercialTerms",
      "source": {
        "routeLine": 3931,
        "handlerLine": 1485
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_commercial_terms:supplier-network:commercial:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkCommercialTerms"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkCommercialTerms",
        "listSupplierNetworkCommercialTerms",
        "transitionSupplierNetworkCommercialTerms",
        "upsertSupplierNetworkCommercialTerms"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/commercial-terms\\/([^/]+)$/",
      "path": "/tenants/:id/supplier-network/commercial-terms/:id",
      "handler": "handleSupplierNetworkCommercialTerms",
      "source": {
        "routeLine": 3932,
        "handlerLine": 1485
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_commercial_terms:supplier-network:commercial:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkCommercialTerms"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkCommercialTerms",
        "listSupplierNetworkCommercialTerms",
        "transitionSupplierNetworkCommercialTerms",
        "upsertSupplierNetworkCommercialTerms"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/commercial-terms\\/([^/]+)\\/(activate|deactivate)$/",
      "path": "/tenants/:id/supplier-network/commercial-terms/:id/(activate|deactivate)",
      "handler": "handleSupplierNetworkCommercialTerms",
      "source": {
        "routeLine": 3933,
        "handlerLine": 1485
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_commercial_terms:supplier-network:commercial:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkCommercialTerms"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkCommercialTerms",
        "listSupplierNetworkCommercialTerms",
        "transitionSupplierNetworkCommercialTerms",
        "upsertSupplierNetworkCommercialTerms"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/capacities$/",
      "path": "/tenants/:id/supplier-network/capacities",
      "handler": "handleSupplierNetworkCapacities",
      "source": {
        "routeLine": 3934,
        "handlerLine": 1493
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_capacity:supplier-network:capacity:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkCapacity"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkCapacity",
        "listSupplierNetworkCapacities",
        "transitionSupplierNetworkCapacity",
        "upsertSupplierNetworkCapacity"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/capacities$/",
      "path": "/tenants/:id/supplier-network/capacities",
      "handler": "handleSupplierNetworkCapacities",
      "source": {
        "routeLine": 3935,
        "handlerLine": 1493
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_capacity:supplier-network:capacity:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkCapacity"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkCapacity",
        "listSupplierNetworkCapacities",
        "transitionSupplierNetworkCapacity",
        "upsertSupplierNetworkCapacity"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/capacities\\/([^/]+)$/",
      "path": "/tenants/:id/supplier-network/capacities/:id",
      "handler": "handleSupplierNetworkCapacities",
      "source": {
        "routeLine": 3936,
        "handlerLine": 1493
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_capacity:supplier-network:capacity:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkCapacity"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkCapacity",
        "listSupplierNetworkCapacities",
        "transitionSupplierNetworkCapacity",
        "upsertSupplierNetworkCapacity"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/capacities\\/([^/]+)$/",
      "path": "/tenants/:id/supplier-network/capacities/:id",
      "handler": "handleSupplierNetworkCapacities",
      "source": {
        "routeLine": 3937,
        "handlerLine": 1493
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_capacity:supplier-network:capacity:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkCapacity"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkCapacity",
        "listSupplierNetworkCapacities",
        "transitionSupplierNetworkCapacity",
        "upsertSupplierNetworkCapacity"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/capacities\\/([^/]+)\\/(activate|deactivate)$/",
      "path": "/tenants/:id/supplier-network/capacities/:id/(activate|deactivate)",
      "handler": "handleSupplierNetworkCapacities",
      "source": {
        "routeLine": 3938,
        "handlerLine": 1493
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_capacity:supplier-network:capacity:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkCapacity"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkCapacity",
        "listSupplierNetworkCapacities",
        "transitionSupplierNetworkCapacity",
        "upsertSupplierNetworkCapacity"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/service-areas$/",
      "path": "/tenants/:id/supplier-network/service-areas",
      "handler": "handleSupplierNetworkServiceAreas",
      "source": {
        "routeLine": 3939,
        "handlerLine": 1501
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_service_area:supplier-network:service-area:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkServiceArea"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkServiceArea",
        "listSupplierNetworkServiceAreas",
        "transitionSupplierNetworkServiceArea",
        "upsertSupplierNetworkServiceArea"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/service-areas$/",
      "path": "/tenants/:id/supplier-network/service-areas",
      "handler": "handleSupplierNetworkServiceAreas",
      "source": {
        "routeLine": 3940,
        "handlerLine": 1501
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_service_area:supplier-network:service-area:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkServiceArea"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkServiceArea",
        "listSupplierNetworkServiceAreas",
        "transitionSupplierNetworkServiceArea",
        "upsertSupplierNetworkServiceArea"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/service-areas\\/([^/]+)$/",
      "path": "/tenants/:id/supplier-network/service-areas/:id",
      "handler": "handleSupplierNetworkServiceAreas",
      "source": {
        "routeLine": 3941,
        "handlerLine": 1501
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_service_area:supplier-network:service-area:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkServiceArea"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkServiceArea",
        "listSupplierNetworkServiceAreas",
        "transitionSupplierNetworkServiceArea",
        "upsertSupplierNetworkServiceArea"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/service-areas\\/([^/]+)$/",
      "path": "/tenants/:id/supplier-network/service-areas/:id",
      "handler": "handleSupplierNetworkServiceAreas",
      "source": {
        "routeLine": 3942,
        "handlerLine": 1501
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_service_area:supplier-network:service-area:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkServiceArea"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkServiceArea",
        "listSupplierNetworkServiceAreas",
        "transitionSupplierNetworkServiceArea",
        "upsertSupplierNetworkServiceArea"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/service-areas\\/([^/]+)\\/(activate|deactivate)$/",
      "path": "/tenants/:id/supplier-network/service-areas/:id/(activate|deactivate)",
      "handler": "handleSupplierNetworkServiceAreas",
      "source": {
        "routeLine": 3943,
        "handlerLine": 1501
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_service_area:supplier-network:service-area:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkServiceArea"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkServiceArea",
        "listSupplierNetworkServiceAreas",
        "transitionSupplierNetworkServiceArea",
        "upsertSupplierNetworkServiceArea"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/trust$/",
      "path": "/tenants/:id/supplier-network/trust",
      "handler": "handleSupplierNetworkTrust",
      "source": {
        "routeLine": 3944,
        "handlerLine": 1526
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_trust:supplier-network:trust:view",
        "supplier_network_trust:supplier-network:trust:refresh"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "refreshSupplierNetworkTrustEvidence"
      ],
      "storeFunctions": [
        "getTenant",
        "listSupplierNetworkTrustEvidence",
        "refreshSupplierNetworkTrustEvidence"
      ],
      "statusCodes": [
        "200",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/marketplace-integration(?:\\/([^/]+))?$/",
      "path": "/tenants/:id/supplier-network/marketplace-integration(?:/:id)?",
      "handler": "handleSupplierNetworkMarketplaceIntegration",
      "source": {
        "routeLine": 3945,
        "handlerLine": 1514
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_marketplace_integration:supplier-network:marketplace-integration:view"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkMarketplaceIntegration"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/discovery$/",
      "path": "/tenants/:id/supplier-network/discovery",
      "handler": "handleSupplierNetworkDiscovery",
      "source": {
        "routeLine": 3946,
        "handlerLine": 1516
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_discovery:supplier-network:discovery:discover"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "discoverSupplierNetwork"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/discovery$/",
      "path": "/tenants/:id/supplier-network/discovery",
      "handler": "handleSupplierNetworkDiscovery",
      "source": {
        "routeLine": 3947,
        "handlerLine": 1516
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_discovery:supplier-network:discovery:discover"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "discoverSupplierNetwork"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/trust\\/([^/]+)\\/refresh$/",
      "path": "/tenants/:id/supplier-network/trust/:id/refresh",
      "handler": "handleSupplierNetworkTrust",
      "source": {
        "routeLine": 3948,
        "handlerLine": 1526
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_trust:supplier-network:trust:view",
        "supplier_network_trust:supplier-network:trust:refresh"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "refreshSupplierNetworkTrustEvidence"
      ],
      "storeFunctions": [
        "getTenant",
        "listSupplierNetworkTrustEvidence",
        "refreshSupplierNetworkTrustEvidence"
      ],
      "statusCodes": [
        "200",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/trust\\/([^/]+)$/",
      "path": "/tenants/:id/supplier-network/trust/:id",
      "handler": "handleSupplierNetworkTrust",
      "source": {
        "routeLine": 3949,
        "handlerLine": 1526
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_trust:supplier-network:trust:view",
        "supplier_network_trust:supplier-network:trust:refresh"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "refreshSupplierNetworkTrustEvidence"
      ],
      "storeFunctions": [
        "getTenant",
        "listSupplierNetworkTrustEvidence",
        "refreshSupplierNetworkTrustEvidence"
      ],
      "statusCodes": [
        "200",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/performance$/",
      "path": "/tenants/:id/supplier-network/performance",
      "handler": "handleSupplierNetworkPerformance",
      "source": {
        "routeLine": 3950,
        "handlerLine": 1533
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_performance:supplier-network:performance:view",
        "supplier_network_performance:supplier-network:performance:recalculate"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "recalculateSupplierNetworkPerformance"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkPerformance",
        "listSupplierNetworkPerformance",
        "recalculateSupplierNetworkPerformance"
      ],
      "statusCodes": [
        "200",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/performance\\/([^/]+)\\/recalculate$/",
      "path": "/tenants/:id/supplier-network/performance/:id/recalculate",
      "handler": "handleSupplierNetworkPerformance",
      "source": {
        "routeLine": 3951,
        "handlerLine": 1533
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_performance:supplier-network:performance:view",
        "supplier_network_performance:supplier-network:performance:recalculate"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "recalculateSupplierNetworkPerformance"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkPerformance",
        "listSupplierNetworkPerformance",
        "recalculateSupplierNetworkPerformance"
      ],
      "statusCodes": [
        "200",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/performance\\/([^/]+)$/",
      "path": "/tenants/:id/supplier-network/performance/:id",
      "handler": "handleSupplierNetworkPerformance",
      "source": {
        "routeLine": 3952,
        "handlerLine": 1533
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_performance:supplier-network:performance:view",
        "supplier_network_performance:supplier-network:performance:recalculate"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "recalculateSupplierNetworkPerformance"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkPerformance",
        "listSupplierNetworkPerformance",
        "recalculateSupplierNetworkPerformance"
      ],
      "statusCodes": [
        "200",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/profile$/",
      "path": "/tenants/:id/supplier-network/profile",
      "handler": "handleSupplierNetworkProfile",
      "source": {
        "routeLine": 3953,
        "handlerLine": 1540
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_profile:supplier-network:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkProfile"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkProfile",
        "transitionSupplierNetworkProfile",
        "upsertSupplierNetworkProfile"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/profile$/",
      "path": "/tenants/:id/supplier-network/profile",
      "handler": "handleSupplierNetworkProfile",
      "source": {
        "routeLine": 3954,
        "handlerLine": 1540
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_profile:supplier-network:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkProfile"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkProfile",
        "transitionSupplierNetworkProfile",
        "upsertSupplierNetworkProfile"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/profile$/",
      "path": "/tenants/:id/supplier-network/profile",
      "handler": "handleSupplierNetworkProfile",
      "source": {
        "routeLine": 3955,
        "handlerLine": 1540
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_profile:supplier-network:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkProfile"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkProfile",
        "transitionSupplierNetworkProfile",
        "upsertSupplierNetworkProfile"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/supplier-network\\/profile\\/(publish|suspend|draft)$/",
      "path": "/tenants/:id/supplier-network/profile/(publish|suspend|draft)",
      "handler": "handleSupplierNetworkProfile",
      "source": {
        "routeLine": 3956,
        "handlerLine": 1540
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_profile:supplier-network:view",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "upsertSupplierNetworkProfile"
      ],
      "storeFunctions": [
        "getTenant",
        "getSupplierNetworkProfile",
        "transitionSupplierNetworkProfile",
        "upsertSupplierNetworkProfile"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/supplier-relationships$/",
      "path": "/tenants/:id/procurement/supplier-relationships",
      "handler": "handleProcurementSupplierRelationships",
      "source": {
        "routeLine": 3957,
        "handlerLine": 1671
      },
      "authentication": "session/authentication present",
      "authorization": [
        "procurement_supplier_relationship:procurement:supplier:relationship:view",
        "procurement_supplier_relationship:procurement:supplier:relationship:manage",
        "procurement_supplier_relationship:procurement:supplier:relationship:manage"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "listProcurementSupplierRelationships",
        "createProcurementSupplierRelationship",
        "transitionProcurementSupplierRelationship"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/supplier-relationships$/",
      "path": "/tenants/:id/procurement/supplier-relationships",
      "handler": "handleProcurementSupplierRelationships",
      "source": {
        "routeLine": 3958,
        "handlerLine": 1671
      },
      "authentication": "session/authentication present",
      "authorization": [
        "procurement_supplier_relationship:procurement:supplier:relationship:view",
        "procurement_supplier_relationship:procurement:supplier:relationship:manage",
        "procurement_supplier_relationship:procurement:supplier:relationship:manage"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "listProcurementSupplierRelationships",
        "createProcurementSupplierRelationship",
        "transitionProcurementSupplierRelationship"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/supplier-relationships\\/([^/]+)\\/(active|declined|blocked|suspended)$/",
      "path": "/tenants/:id/procurement/supplier-relationships/:id/(active|declined|blocked|suspended)",
      "handler": "handleProcurementSupplierRelationships",
      "source": {
        "routeLine": 3959,
        "handlerLine": 1671
      },
      "authentication": "session/authentication present",
      "authorization": [
        "procurement_supplier_relationship:procurement:supplier:relationship:view",
        "procurement_supplier_relationship:procurement:supplier:relationship:manage",
        "procurement_supplier_relationship:procurement:supplier:relationship:manage"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "listProcurementSupplierRelationships",
        "createProcurementSupplierRelationship",
        "transitionProcurementSupplierRelationship"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/rfqs$/",
      "path": "/tenants/:id/procurement/rfqs",
      "handler": "handleProcurementRfqs",
      "source": {
        "routeLine": 3960,
        "handlerLine": 1620
      },
      "authentication": "session/authentication present",
      "authorization": [
        "procurement_rfq:procurement:rfq:view",
        "procurement_rfq:procurement:rfq:create",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createProcurementRfq",
        "transitionProcurementRfq"
      ],
      "storeFunctions": [
        "getTenant",
        "listProcurementRfqs",
        "createProcurementRfq",
        "transitionProcurementRfq"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/rfqs$/",
      "path": "/tenants/:id/procurement/rfqs",
      "handler": "handleProcurementRfqs",
      "source": {
        "routeLine": 3961,
        "handlerLine": 1620
      },
      "authentication": "session/authentication present",
      "authorization": [
        "procurement_rfq:procurement:rfq:view",
        "procurement_rfq:procurement:rfq:create",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createProcurementRfq",
        "transitionProcurementRfq"
      ],
      "storeFunctions": [
        "getTenant",
        "listProcurementRfqs",
        "createProcurementRfq",
        "transitionProcurementRfq"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/rfqs\\/([^/]+)$/",
      "path": "/tenants/:id/procurement/rfqs/:id",
      "handler": "handleProcurementRfqs",
      "source": {
        "routeLine": 3962,
        "handlerLine": 1620
      },
      "authentication": "session/authentication present",
      "authorization": [
        "procurement_rfq:procurement:rfq:view",
        "procurement_rfq:procurement:rfq:create",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createProcurementRfq",
        "transitionProcurementRfq"
      ],
      "storeFunctions": [
        "getTenant",
        "listProcurementRfqs",
        "createProcurementRfq",
        "transitionProcurementRfq"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/rfqs\\/([^/]+)\\/(send|close|cancel)$/",
      "path": "/tenants/:id/procurement/rfqs/:id/(send|close|cancel)",
      "handler": "handleProcurementRfqs",
      "source": {
        "routeLine": 3963,
        "handlerLine": 1620
      },
      "authentication": "session/authentication present",
      "authorization": [
        "procurement_rfq:procurement:rfq:view",
        "procurement_rfq:procurement:rfq:create",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createProcurementRfq",
        "transitionProcurementRfq"
      ],
      "storeFunctions": [
        "getTenant",
        "listProcurementRfqs",
        "createProcurementRfq",
        "transitionProcurementRfq"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/rfqs\\/([^/]+)\\/responses$/",
      "path": "/tenants/:id/procurement/rfqs/:id/responses",
      "handler": "handleProcurementRfqResponses",
      "source": {
        "routeLine": 3964,
        "handlerLine": 1656
      },
      "authentication": "session/authentication present",
      "authorization": [
        "procurement_rfq:procurement:rfq:respond",
        "procurement_rfq:procurement:rfq:respond"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createProcurementRfqResponse",
        "transitionProcurementRfqResponse"
      ],
      "storeFunctions": [
        "getTenant",
        "createProcurementRfqResponse",
        "transitionProcurementRfqResponse"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/rfqs\\/([^/]+)\\/responses\\/([^/]+)\\/submit$/",
      "path": "/tenants/:id/procurement/rfqs/:id/responses/:id/submit",
      "handler": "handleProcurementRfqResponses",
      "source": {
        "routeLine": 3965,
        "handlerLine": 1656
      },
      "authentication": "session/authentication present",
      "authorization": [
        "procurement_rfq:procurement:rfq:respond",
        "procurement_rfq:procurement:rfq:respond"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createProcurementRfqResponse",
        "transitionProcurementRfqResponse"
      ],
      "storeFunctions": [
        "getTenant",
        "createProcurementRfqResponse",
        "transitionProcurementRfqResponse"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/awards$/",
      "path": "/tenants/:id/procurement/awards",
      "handler": "handleProcurementAwards",
      "source": {
        "routeLine": 3966,
        "handlerLine": 1693
      },
      "authentication": "session/authentication present",
      "authorization": [
        "procurement_award:procurement:award:view",
        "procurement_award:procurement:award:create",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createProcurementAward",
        "transitionProcurementAward"
      ],
      "storeFunctions": [
        "getTenant",
        "getProcurementAward",
        "listProcurementAwards",
        "createProcurementAward",
        "transitionProcurementAward"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/awards$/",
      "path": "/tenants/:id/procurement/awards",
      "handler": "handleProcurementAwards",
      "source": {
        "routeLine": 3967,
        "handlerLine": 1693
      },
      "authentication": "session/authentication present",
      "authorization": [
        "procurement_award:procurement:award:view",
        "procurement_award:procurement:award:create",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createProcurementAward",
        "transitionProcurementAward"
      ],
      "storeFunctions": [
        "getTenant",
        "getProcurementAward",
        "listProcurementAwards",
        "createProcurementAward",
        "transitionProcurementAward"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/awards\\/([^/]+)$/",
      "path": "/tenants/:id/procurement/awards/:id",
      "handler": "handleProcurementAwards",
      "source": {
        "routeLine": 3968,
        "handlerLine": 1693
      },
      "authentication": "session/authentication present",
      "authorization": [
        "procurement_award:procurement:award:view",
        "procurement_award:procurement:award:create",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createProcurementAward",
        "transitionProcurementAward"
      ],
      "storeFunctions": [
        "getTenant",
        "getProcurementAward",
        "listProcurementAwards",
        "createProcurementAward",
        "transitionProcurementAward"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/awards\\/([^/]+)\\/(confirm|cancel)$/",
      "path": "/tenants/:id/procurement/awards/:id/(confirm|cancel)",
      "handler": "handleProcurementAwards",
      "source": {
        "routeLine": 3969,
        "handlerLine": 1693
      },
      "authentication": "session/authentication present",
      "authorization": [
        "procurement_award:procurement:award:view",
        "procurement_award:procurement:award:create",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createProcurementAward",
        "transitionProcurementAward"
      ],
      "storeFunctions": [
        "getTenant",
        "getProcurementAward",
        "listProcurementAwards",
        "createProcurementAward",
        "transitionProcurementAward"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/comparisons$/",
      "path": "/tenants/:id/procurement/comparisons",
      "handler": "handleProcurementComparisons",
      "source": {
        "routeLine": 3970,
        "handlerLine": 1727
      },
      "authentication": "session/authentication present",
      "authorization": [
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createProcurementComparison"
      ],
      "storeFunctions": [
        "getTenant",
        "getProcurementComparison",
        "listProcurementComparisons",
        "createProcurementComparison"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/comparisons$/",
      "path": "/tenants/:id/procurement/comparisons",
      "handler": "handleProcurementComparisons",
      "source": {
        "routeLine": 3971,
        "handlerLine": 1727
      },
      "authentication": "session/authentication present",
      "authorization": [
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createProcurementComparison"
      ],
      "storeFunctions": [
        "getTenant",
        "getProcurementComparison",
        "listProcurementComparisons",
        "createProcurementComparison"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/comparisons\\/([^/]+)$/",
      "path": "/tenants/:id/procurement/comparisons/:id",
      "handler": "handleProcurementComparisons",
      "source": {
        "routeLine": 3972,
        "handlerLine": 1727
      },
      "authentication": "session/authentication present",
      "authorization": [
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createProcurementComparison"
      ],
      "storeFunctions": [
        "getTenant",
        "getProcurementComparison",
        "listProcurementComparisons",
        "createProcurementComparison"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/demands$/",
      "path": "/tenants/:id/procurement/demands",
      "handler": "handleProcurementDemands",
      "source": {
        "routeLine": 3973,
        "handlerLine": 1566
      },
      "authentication": "session/authentication present",
      "authorization": [
        "procurement_demand:procurement:demand:view",
        "procurement_demand:procurement:demand:create",
        "procurement_demand:procurement:demand:manage",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createProcurementDemand",
        "updateProcurementDemand",
        "transitionProcurementDemand"
      ],
      "storeFunctions": [
        "getTenant",
        "getProcurementDemand",
        "listProcurementDemands",
        "createProcurementDemand",
        "updateProcurementDemand",
        "transitionProcurementDemand"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/demands$/",
      "path": "/tenants/:id/procurement/demands",
      "handler": "handleProcurementDemands",
      "source": {
        "routeLine": 3974,
        "handlerLine": 1566
      },
      "authentication": "session/authentication present",
      "authorization": [
        "procurement_demand:procurement:demand:view",
        "procurement_demand:procurement:demand:create",
        "procurement_demand:procurement:demand:manage",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createProcurementDemand",
        "updateProcurementDemand",
        "transitionProcurementDemand"
      ],
      "storeFunctions": [
        "getTenant",
        "getProcurementDemand",
        "listProcurementDemands",
        "createProcurementDemand",
        "updateProcurementDemand",
        "transitionProcurementDemand"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/demands\\/([^/]+)$/",
      "path": "/tenants/:id/procurement/demands/:id",
      "handler": "handleProcurementDemands",
      "source": {
        "routeLine": 3975,
        "handlerLine": 1566
      },
      "authentication": "session/authentication present",
      "authorization": [
        "procurement_demand:procurement:demand:view",
        "procurement_demand:procurement:demand:create",
        "procurement_demand:procurement:demand:manage",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createProcurementDemand",
        "updateProcurementDemand",
        "transitionProcurementDemand"
      ],
      "storeFunctions": [
        "getTenant",
        "getProcurementDemand",
        "listProcurementDemands",
        "createProcurementDemand",
        "updateProcurementDemand",
        "transitionProcurementDemand"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/demands\\/([^/]+)$/",
      "path": "/tenants/:id/procurement/demands/:id",
      "handler": "handleProcurementDemands",
      "source": {
        "routeLine": 3976,
        "handlerLine": 1566
      },
      "authentication": "session/authentication present",
      "authorization": [
        "procurement_demand:procurement:demand:view",
        "procurement_demand:procurement:demand:create",
        "procurement_demand:procurement:demand:manage",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createProcurementDemand",
        "updateProcurementDemand",
        "transitionProcurementDemand"
      ],
      "storeFunctions": [
        "getTenant",
        "getProcurementDemand",
        "listProcurementDemands",
        "createProcurementDemand",
        "updateProcurementDemand",
        "transitionProcurementDemand"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/demands\\/([^/]+)\\/submit$/",
      "path": "/tenants/:id/procurement/demands/:id/submit",
      "handler": "handleProcurementDemands",
      "source": {
        "routeLine": 3977,
        "handlerLine": 1566
      },
      "authentication": "session/authentication present",
      "authorization": [
        "procurement_demand:procurement:demand:view",
        "procurement_demand:procurement:demand:create",
        "procurement_demand:procurement:demand:manage",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createProcurementDemand",
        "updateProcurementDemand",
        "transitionProcurementDemand"
      ],
      "storeFunctions": [
        "getTenant",
        "getProcurementDemand",
        "listProcurementDemands",
        "createProcurementDemand",
        "updateProcurementDemand",
        "transitionProcurementDemand"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/demands\\/([^/]+)\\/cancel$/",
      "path": "/tenants/:id/procurement/demands/:id/cancel",
      "handler": "handleProcurementDemands",
      "source": {
        "routeLine": 3978,
        "handlerLine": 1566
      },
      "authentication": "session/authentication present",
      "authorization": [
        "procurement_demand:procurement:demand:view",
        "procurement_demand:procurement:demand:create",
        "procurement_demand:procurement:demand:manage",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createProcurementDemand",
        "updateProcurementDemand",
        "transitionProcurementDemand"
      ],
      "storeFunctions": [
        "getTenant",
        "getProcurementDemand",
        "listProcurementDemands",
        "createProcurementDemand",
        "updateProcurementDemand",
        "transitionProcurementDemand"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/demands\\/([^/]+)\\/start-sourcing$/",
      "path": "/tenants/:id/procurement/demands/:id/start-sourcing",
      "handler": "handleProcurementDemands",
      "source": {
        "routeLine": 3979,
        "handlerLine": 1566
      },
      "authentication": "session/authentication present",
      "authorization": [
        "procurement_demand:procurement:demand:view",
        "procurement_demand:procurement:demand:create",
        "procurement_demand:procurement:demand:manage",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createProcurementDemand",
        "updateProcurementDemand",
        "transitionProcurementDemand"
      ],
      "storeFunctions": [
        "getTenant",
        "getProcurementDemand",
        "listProcurementDemands",
        "createProcurementDemand",
        "updateProcurementDemand",
        "transitionProcurementDemand"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/quotes$/",
      "path": "/tenants/:id/b2b/quotes",
      "handler": "handleB2BQuotes",
      "source": {
        "routeLine": 3980,
        "handlerLine": 1753
      },
      "authentication": "session/authentication present",
      "authorization": [
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createQuote"
      ],
      "storeFunctions": [
        "getTenant",
        "getQuote",
        "listQuotes",
        "createQuote",
        "transitionQuote"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/quotes$/",
      "path": "/tenants/:id/b2b/quotes",
      "handler": "handleB2BQuotes",
      "source": {
        "routeLine": 3981,
        "handlerLine": 1753
      },
      "authentication": "session/authentication present",
      "authorization": [
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createQuote"
      ],
      "storeFunctions": [
        "getTenant",
        "getQuote",
        "listQuotes",
        "createQuote",
        "transitionQuote"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/quotes\\/([^/]+)$/",
      "path": "/tenants/:id/b2b/quotes/:id",
      "handler": "handleB2BQuotes",
      "source": {
        "routeLine": 3982,
        "handlerLine": 1753
      },
      "authentication": "session/authentication present",
      "authorization": [
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createQuote"
      ],
      "storeFunctions": [
        "getTenant",
        "getQuote",
        "listQuotes",
        "createQuote",
        "transitionQuote"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/quotes\\/([^/]+)$/",
      "path": "/tenants/:id/b2b/quotes/:id",
      "handler": "handleB2BQuotes",
      "source": {
        "routeLine": 3983,
        "handlerLine": 1753
      },
      "authentication": "session/authentication present",
      "authorization": [
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createQuote"
      ],
      "storeFunctions": [
        "getTenant",
        "getQuote",
        "listQuotes",
        "createQuote",
        "transitionQuote"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/receipts$/",
      "path": "/tenants/:id/procurement/receipts",
      "handler": "handleProcurementReceipts",
      "source": {
        "routeLine": 3984,
        "handlerLine": 1813
      },
      "authentication": "session/authentication present",
      "authorization": [
        "procurement_receipt:procurement:receipt:view",
        "procurement_receipt:procurement:receipt:create"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createProcurementReceipt"
      ],
      "storeFunctions": [
        "getTenant",
        "getProcurementReceipt",
        "listProcurementReceipts",
        "createProcurementReceipt"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/receipts\\/([^/]+)$/",
      "path": "/tenants/:id/procurement/receipts/:id",
      "handler": "handleProcurementReceipts",
      "source": {
        "routeLine": 3985,
        "handlerLine": 1813
      },
      "authentication": "session/authentication present",
      "authorization": [
        "procurement_receipt:procurement:receipt:view",
        "procurement_receipt:procurement:receipt:create"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createProcurementReceipt"
      ],
      "storeFunctions": [
        "getTenant",
        "getProcurementReceipt",
        "listProcurementReceipts",
        "createProcurementReceipt"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/purchase-orders\\/([^/]+)\\/receipts$/",
      "path": "/tenants/:id/procurement/purchase-orders/:id/receipts",
      "handler": "handleProcurementReceipts",
      "source": {
        "routeLine": 3986,
        "handlerLine": 1813
      },
      "authentication": "session/authentication present",
      "authorization": [
        "procurement_receipt:procurement:receipt:view",
        "procurement_receipt:procurement:receipt:create"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createProcurementReceipt"
      ],
      "storeFunctions": [
        "getTenant",
        "getProcurementReceipt",
        "listProcurementReceipts",
        "createProcurementReceipt"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/purchase-orders\\/([^/]+)\\/receipts$/",
      "path": "/tenants/:id/procurement/purchase-orders/:id/receipts",
      "handler": "handleProcurementReceipts",
      "source": {
        "routeLine": 3987,
        "handlerLine": 1813
      },
      "authentication": "session/authentication present",
      "authorization": [
        "procurement_receipt:procurement:receipt:view",
        "procurement_receipt:procurement:receipt:create"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createProcurementReceipt"
      ],
      "storeFunctions": [
        "getTenant",
        "getProcurementReceipt",
        "listProcurementReceipts",
        "createProcurementReceipt"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/purchase-orders$/",
      "path": "/tenants/:id/b2b/purchase-orders",
      "handler": "handleB2BPurchaseOrders",
      "source": {
        "routeLine": 3988,
        "handlerLine": 1780
      },
      "authentication": "session/authentication present",
      "authorization": [
        "b2b_purchase_orders:b2b:po:view",
        "b2b_purchase_orders:b2b:po:create",
        "procurement_execution:procurement:award:execute",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createPurchaseOrder"
      ],
      "storeFunctions": [
        "getTenant",
        "getPurchaseOrder",
        "listPurchaseOrders",
        "createPurchaseOrder",
        "transitionPurchaseOrder"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/purchase-orders$/",
      "path": "/tenants/:id/b2b/purchase-orders",
      "handler": "handleB2BPurchaseOrders",
      "source": {
        "routeLine": 3989,
        "handlerLine": 1780
      },
      "authentication": "session/authentication present",
      "authorization": [
        "b2b_purchase_orders:b2b:po:view",
        "b2b_purchase_orders:b2b:po:create",
        "procurement_execution:procurement:award:execute",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createPurchaseOrder"
      ],
      "storeFunctions": [
        "getTenant",
        "getPurchaseOrder",
        "listPurchaseOrders",
        "createPurchaseOrder",
        "transitionPurchaseOrder"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/purchase-orders\\/([^/]+)$/",
      "path": "/tenants/:id/b2b/purchase-orders/:id",
      "handler": "handleB2BPurchaseOrders",
      "source": {
        "routeLine": 3990,
        "handlerLine": 1780
      },
      "authentication": "session/authentication present",
      "authorization": [
        "b2b_purchase_orders:b2b:po:view",
        "b2b_purchase_orders:b2b:po:create",
        "procurement_execution:procurement:award:execute",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createPurchaseOrder"
      ],
      "storeFunctions": [
        "getTenant",
        "getPurchaseOrder",
        "listPurchaseOrders",
        "createPurchaseOrder",
        "transitionPurchaseOrder"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/purchase-orders\\/([^/]+)$/",
      "path": "/tenants/:id/b2b/purchase-orders/:id",
      "handler": "handleB2BPurchaseOrders",
      "source": {
        "routeLine": 3991,
        "handlerLine": 1780
      },
      "authentication": "session/authentication present",
      "authorization": [
        "b2b_purchase_orders:b2b:po:view",
        "b2b_purchase_orders:b2b:po:create",
        "procurement_execution:procurement:award:execute",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createPurchaseOrder"
      ],
      "storeFunctions": [
        "getTenant",
        "getPurchaseOrder",
        "listPurchaseOrders",
        "createPurchaseOrder",
        "transitionPurchaseOrder"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/credit-terms$/",
      "path": "/tenants/:id/b2b/credit-terms",
      "handler": "handleB2BCreditTerms",
      "source": {
        "routeLine": 3992,
        "handlerLine": 1841
      },
      "authentication": "session/authentication present",
      "authorization": [
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getCreditTerms",
        "listCreditTerms",
        "createCreditTerms",
        "transitionCreditTerms",
        "updateCreditTerms"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/credit-terms$/",
      "path": "/tenants/:id/b2b/credit-terms",
      "handler": "handleB2BCreditTerms",
      "source": {
        "routeLine": 3993,
        "handlerLine": 1841
      },
      "authentication": "session/authentication present",
      "authorization": [
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getCreditTerms",
        "listCreditTerms",
        "createCreditTerms",
        "transitionCreditTerms",
        "updateCreditTerms"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/credit-terms\\/([^/]+)$/",
      "path": "/tenants/:id/b2b/credit-terms/:id",
      "handler": "handleB2BCreditTerms",
      "source": {
        "routeLine": 3994,
        "handlerLine": 1841
      },
      "authentication": "session/authentication present",
      "authorization": [
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getCreditTerms",
        "listCreditTerms",
        "createCreditTerms",
        "transitionCreditTerms",
        "updateCreditTerms"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/credit-terms\\/([^/]+)$/",
      "path": "/tenants/:id/b2b/credit-terms/:id",
      "handler": "handleB2BCreditTerms",
      "source": {
        "routeLine": 3995,
        "handlerLine": 1841
      },
      "authentication": "session/authentication present",
      "authorization": [
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getCreditTerms",
        "listCreditTerms",
        "createCreditTerms",
        "transitionCreditTerms",
        "updateCreditTerms"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/inventory\\/movements$/",
      "path": "/tenants/:id/inventory/movements",
      "handler": "handleInventoryMovementsList",
      "source": {
        "routeLine": 3996,
        "handlerLine": 1874
      },
      "authentication": "session/authentication present",
      "authorization": [
        "inventory:inventory:view"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "LOCATION_SCOPE_DENIED"
      ],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getOrganizationLocation",
        "listInventoryMovements"
      ],
      "statusCodes": [
        "200",
        "403",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/inventory\\/balances$/",
      "path": "/tenants/:id/inventory/balances",
      "handler": "handleInventoryBalances",
      "source": {
        "routeLine": 3997,
        "handlerLine": 1894
      },
      "authentication": "session/authentication present",
      "authorization": [
        "inventory:inventory:view"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "LOCATION_SCOPE_DENIED"
      ],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getOrganizationLocation",
        "getInventoryBalances"
      ],
      "statusCodes": [
        "200",
        "403",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/inventory\\/movements\\/batch$/",
      "path": "/tenants/:id/inventory/movements/batch",
      "handler": "handleInventoryMovementBatchCreate",
      "source": {
        "routeLine": 3998,
        "handlerLine": 1948
      },
      "authentication": "session/authentication present",
      "authorization": [
        "inventory:inventory:edit"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "INVALID_INVENTORY_COMMAND_LOCATION",
        "LOCATION_SCOPE_DENIED"
      ],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "appendInventoryMovementBatch"
      ],
      "storeFunctions": [
        "getTenant",
        "getOrganizationLocation",
        "appendInventoryMovementBatch"
      ],
      "statusCodes": [
        "400",
        "403",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/inventory\\/movements$/",
      "path": "/tenants/:id/inventory/movements",
      "handler": "handleInventoryMovementCreate",
      "source": {
        "routeLine": 3999,
        "handlerLine": 1910
      },
      "authentication": "session/authentication present",
      "authorization": [
        "inventory:inventory:edit"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [
        "LOCATION_SCOPE_DENIED"
      ],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "appendInventoryMovement"
      ],
      "storeFunctions": [
        "getTenant",
        "getOrganizationLocation",
        "appendInventoryMovement"
      ],
      "statusCodes": [
        "201",
        "403",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/locations$/",
      "path": "/tenants/:id/locations",
      "handler": "handleLocationsList",
      "source": {
        "routeLine": 4000,
        "handlerLine": 1967
      },
      "authentication": "session/authentication present",
      "authorization": [
        "locations:locations:view"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "listOrganizationLocations"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/locations$/",
      "path": "/tenants/:id/locations",
      "handler": "handleLocationCreate",
      "source": {
        "routeLine": 4001,
        "handlerLine": 1977
      },
      "authentication": "session/authentication present",
      "authorization": [
        "locations:locations:manage"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "createOrganizationLocation"
      ],
      "statusCodes": [
        "201",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/locations\\/([^/]+)$/",
      "path": "/tenants/:id/locations/:id",
      "handler": "handleLocationPatch",
      "source": {
        "routeLine": 4002,
        "handlerLine": 1987
      },
      "authentication": "session/authentication present",
      "authorization": [
        "locations:locations:manage"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "updateOrganizationLocation"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/authorization\\/scope-context$/",
      "path": "/tenants/:id/authorization/scope-context",
      "handler": "handleAuthorizationScopeContext",
      "source": {
        "routeLine": 4003,
        "handlerLine": 1997
      },
      "authentication": "session/authentication present",
      "authorization": [
        "scope_context:locations:view"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "listOrganizationLocations"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "infrastructure",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/authorization\\/conditions-contract$/",
      "path": "/tenants/:id/authorization/conditions-contract",
      "handler": "handleAuthorizationConditionsContract",
      "source": {
        "routeLine": 4004,
        "handlerLine": 2032
      },
      "authentication": "session/authentication present",
      "authorization": [
        "authorization_conditions_contract:settings:configure"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "infrastructure",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/authorization\\/role-matrix$/",
      "path": "/tenants/:id/authorization/role-matrix",
      "handler": "handleAuthorizationRoleMatrix",
      "source": {
        "routeLine": 4005,
        "handlerLine": 2061
      },
      "authentication": "session/authentication present",
      "authorization": [
        "authorization_role_matrix:settings:configure"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "infrastructure",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/authorization\\/iam-certification$/",
      "path": "/tenants/:id/authorization/iam-certification",
      "handler": "handleAuthorizationIamCertification",
      "source": {
        "routeLine": 4006,
        "handlerLine": 2092
      },
      "authentication": "session/authentication present",
      "authorization": [
        "authorization_iam_certification:settings:configure"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "infrastructure",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/business-template$/",
      "path": "/tenants/:id/business-template",
      "handler": "handleBusinessTemplateConfig",
      "source": {
        "routeLine": 4007,
        "handlerLine": 2146
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "saveBusinessTemplateConfig"
      ],
      "storeFunctions": [
        "getTenant",
        "getBusinessTemplateConfig",
        "saveBusinessTemplateConfig"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "infrastructure",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PUT",
      "pattern": "/^\\/tenants\\/([^/]+)\\/business-template$/",
      "path": "/tenants/:id/business-template",
      "handler": "handleBusinessTemplateConfig",
      "source": {
        "routeLine": 4008,
        "handlerLine": 2146
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "saveBusinessTemplateConfig"
      ],
      "storeFunctions": [
        "getTenant",
        "getBusinessTemplateConfig",
        "saveBusinessTemplateConfig"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "infrastructure",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/business-template$/",
      "path": "/tenants/:id/business-template",
      "handler": "handleBusinessTemplateConfig",
      "source": {
        "routeLine": 4009,
        "handlerLine": 2146
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "saveBusinessTemplateConfig"
      ],
      "storeFunctions": [
        "getTenant",
        "getBusinessTemplateConfig",
        "saveBusinessTemplateConfig"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "infrastructure",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)$/",
      "path": "/tenants/:id",
      "handler": "handleTenantPatch",
      "source": {
        "routeLine": 4010,
        "handlerLine": 2165
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [
        "INVALID_CURRENCY"
      ],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "updateTenant"
      ],
      "statusCodes": [
        "200",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)$/",
      "path": "/tenants/:id",
      "handler": "handleTenantPatch",
      "source": {
        "routeLine": 4011,
        "handlerLine": 2165
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [
        "INVALID_CURRENCY"
      ],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "updateTenant"
      ],
      "statusCodes": [
        "200",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/([^/]+)\\/evidence$/",
      "path": "/tenants/:id/payments/:id/evidence",
      "handler": "handlePaymentEvidenceList",
      "source": {
        "routeLine": 4012,
        "handlerLine": 2577
      },
      "authentication": "session/authentication present",
      "authorization": [
        "payments:payments:view"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/([^/]+)\\/evidence\\/([^/]+)\\/review$/",
      "path": "/tenants/:id/payments/:id/evidence/:id/review",
      "handler": "handleManualPaymentEvidenceReview",
      "source": {
        "routeLine": 4013,
        "handlerLine": 2558
      },
      "authentication": "session/authentication present",
      "authorization": [
        "payments:payments:accept"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/evidence$/",
      "path": "/tenants/:id/payments/evidence",
      "handler": "handlePaymentEvidenceSubmission",
      "source": {
        "routeLine": 4014,
        "handlerLine": 2593
      },
      "authentication": "session/authentication present",
      "authorization": [
        "payments:payments:accept"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/providers$/",
      "path": "/tenants/:id/payments/providers",
      "handler": "handlePaymentProviderMetadata",
      "source": {
        "routeLine": 4015,
        "handlerLine": 2286
      },
      "authentication": "session/authentication present",
      "authorization": [
        "payments:payments:view"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/accounts$/",
      "path": "/tenants/:id/payments/accounts",
      "handler": "handlePaymentAccounts",
      "source": {
        "routeLine": 4016,
        "handlerLine": 2294
      },
      "authentication": "session/authentication present",
      "authorization": [
        "payments:payments:view",
        "payments:payments:manage"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "listPaymentAccounts",
        "createPaymentAccount"
      ],
      "statusCodes": [
        "200",
        "201",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/accounts$/",
      "path": "/tenants/:id/payments/accounts",
      "handler": "handlePaymentAccounts",
      "source": {
        "routeLine": 4017,
        "handlerLine": 2294
      },
      "authentication": "session/authentication present",
      "authorization": [
        "payments:payments:view",
        "payments:payments:manage"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "listPaymentAccounts",
        "createPaymentAccount"
      ],
      "statusCodes": [
        "200",
        "201",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/outbound$/",
      "path": "/tenants/:id/payments/outbound",
      "handler": "handlePaymentOutbound",
      "source": {
        "routeLine": 4018,
        "handlerLine": 2362
      },
      "authentication": "session/authentication present",
      "authorization": [
        "payments:payments:view",
        "payments:payments:outbound:create",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getPaymentOutboundIntent",
        "listPaymentOutboundIntents",
        "createPaymentOutboundIntent",
        "transitionPaymentOutboundIntent"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/outbound$/",
      "path": "/tenants/:id/payments/outbound",
      "handler": "handlePaymentOutbound",
      "source": {
        "routeLine": 4019,
        "handlerLine": 2362
      },
      "authentication": "session/authentication present",
      "authorization": [
        "payments:payments:view",
        "payments:payments:outbound:create",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getPaymentOutboundIntent",
        "listPaymentOutboundIntents",
        "createPaymentOutboundIntent",
        "transitionPaymentOutboundIntent"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/outbound\\/([^/]+)$/",
      "path": "/tenants/:id/payments/outbound/:id",
      "handler": "handlePaymentOutbound",
      "source": {
        "routeLine": 4020,
        "handlerLine": 2362
      },
      "authentication": "session/authentication present",
      "authorization": [
        "payments:payments:view",
        "payments:payments:outbound:create",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getPaymentOutboundIntent",
        "listPaymentOutboundIntents",
        "createPaymentOutboundIntent",
        "transitionPaymentOutboundIntent"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/outbound\\/([^/]+)\\/(submit|confirm|fail|cancel)$/",
      "path": "/tenants/:id/payments/outbound/:id/(submit|confirm|fail|cancel)",
      "handler": "handlePaymentOutbound",
      "source": {
        "routeLine": 4021,
        "handlerLine": 2362
      },
      "authentication": "session/authentication present",
      "authorization": [
        "payments:payments:view",
        "payments:payments:outbound:create",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getPaymentOutboundIntent",
        "listPaymentOutboundIntents",
        "createPaymentOutboundIntent",
        "transitionPaymentOutboundIntent"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/procurement\\/purchase-orders\\/([^/]+)\\/payment$/",
      "path": "/tenants/:id/procurement/purchase-orders/:id/payment",
      "handler": "handleProcurementPayment",
      "source": {
        "routeLine": 4022,
        "handlerLine": 2365
      },
      "authentication": "session/authentication present",
      "authorization": [
        "procurement_payment:procurement:payment:create"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "createProcurementPaymentIntent"
      ],
      "statusCodes": [
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/procurement-settlements$/",
      "path": "/tenants/:id/payments/procurement-settlements",
      "handler": "handleProcurementSettlement",
      "source": {
        "routeLine": 4023,
        "handlerLine": 2363
      },
      "authentication": "session/authentication present",
      "authorization": [
        "payments:payments:settlement:view",
        "payments:payments:settlement:allocate"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "allocateConfirmedOutboundPaymentToProcurementSettlement"
      ],
      "storeFunctions": [
        "getTenant",
        "getProcurementSettlement",
        "listProcurementSettlementAllocations",
        "listProcurementSettlements",
        "allocateConfirmedOutboundPaymentToProcurementSettlement"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/procurement-settlements\\/purchase-orders\\/([^/]+)$/",
      "path": "/tenants/:id/payments/procurement-settlements/purchase-orders/:id",
      "handler": "handleProcurementSettlement",
      "source": {
        "routeLine": 4024,
        "handlerLine": 2363
      },
      "authentication": "session/authentication present",
      "authorization": [
        "payments:payments:settlement:view",
        "payments:payments:settlement:allocate"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "allocateConfirmedOutboundPaymentToProcurementSettlement"
      ],
      "storeFunctions": [
        "getTenant",
        "getProcurementSettlement",
        "listProcurementSettlementAllocations",
        "listProcurementSettlements",
        "allocateConfirmedOutboundPaymentToProcurementSettlement"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/procurement-settlements\\/purchase-orders\\/([^/]+)\\/allocate$/",
      "path": "/tenants/:id/payments/procurement-settlements/purchase-orders/:id/allocate",
      "handler": "handleProcurementSettlement",
      "source": {
        "routeLine": 4025,
        "handlerLine": 2363
      },
      "authentication": "session/authentication present",
      "authorization": [
        "payments:payments:settlement:view",
        "payments:payments:settlement:allocate"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "allocateConfirmedOutboundPaymentToProcurementSettlement"
      ],
      "storeFunctions": [
        "getTenant",
        "getProcurementSettlement",
        "listProcurementSettlementAllocations",
        "listProcurementSettlements",
        "allocateConfirmedOutboundPaymentToProcurementSettlement"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/orders\\/([^/]+)\\/payments\\/summary$/",
      "path": "/tenants/:id/orders/:id/payments/summary",
      "handler": "handleOrderPaymentSummary",
      "source": {
        "routeLine": 4026,
        "handlerLine": 2377
      },
      "authentication": "session/authentication present",
      "authorization": [
        "payments:payments:view"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getOrderPaymentSummary"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/([^/]+)\\/ledger$/",
      "path": "/tenants/:id/payments/:id/ledger",
      "handler": "handlePaymentLedger",
      "source": {
        "routeLine": 4027,
        "handlerLine": 2367
      },
      "authentication": "session/authentication present",
      "authorization": [
        "payments:payments:view"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "listPaymentLedger"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/([^/]+)\\/reconcile$/",
      "path": "/tenants/:id/payments/:id/reconcile",
      "handler": "handlePaymentReconciliation",
      "source": {
        "routeLine": 4028,
        "handlerLine": 2707
      },
      "authentication": "session/authentication present",
      "authorization": [
        "payments:payments:reconcile"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/([^/]+)\\/reconciliation$/",
      "path": "/tenants/:id/payments/:id/reconciliation",
      "handler": "handlePaymentCoreReconciliation",
      "source": {
        "routeLine": 4029,
        "handlerLine": 2681
      },
      "authentication": "session/authentication present",
      "authorization": [
        "payments:payments:reconcile"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/([^/]+)\\/reconciliation$/",
      "path": "/tenants/:id/payments/:id/reconciliation",
      "handler": "handlePaymentReconciliationHistory",
      "source": {
        "routeLine": 4030,
        "handlerLine": 2697
      },
      "authentication": "session/authentication present",
      "authorization": [
        "payments:payments:reconcile"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "listPaymentReconciliations"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/confirmation-attempts\\/([^/]+)\\/finalize$/",
      "path": "/tenants/:id/payments/confirmation-attempts/:id/finalize",
      "handler": "handlePaymentConfirmationFinalization",
      "source": {
        "routeLine": 4031,
        "handlerLine": 2629
      },
      "authentication": "session/authentication present",
      "authorization": [
        "payments:payments:accept"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/([^/]+)\\/status$/",
      "path": "/tenants/:id/payments/:id/status",
      "handler": "handlePaymentStatusQuery",
      "source": {
        "routeLine": 4032,
        "handlerLine": 2662
      },
      "authentication": "session/authentication present",
      "authorization": [
        "payments:payments:accept"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [
        "IDEMPOTENCY_KEY_REQUIRED"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "400",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/([^/]+)\\/lifecycle$/",
      "path": "/tenants/:id/payments/:id/lifecycle",
      "handler": "handlePaymentLifecycle",
      "source": {
        "routeLine": 4033,
        "handlerLine": 2647
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/([^/]+)\\/refund$/",
      "path": "/tenants/:id/payments/:id/refund",
      "handler": "handlePaymentRefund",
      "source": {
        "routeLine": 4034,
        "handlerLine": 2531
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/providers\\/certification$/",
      "path": "/tenants/:id/payments/providers/certification",
      "handler": "handlePaymentProviderCertification",
      "source": {
        "routeLine": 4035,
        "handlerLine": 2412
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/providers\\/capability-probe$/",
      "path": "/tenants/:id/payments/providers/capability-probe",
      "handler": "handlePaymentProviderCapabilityProbe",
      "source": {
        "routeLine": 4036,
        "handlerLine": 2426
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/providers\\/capability-evidence$/",
      "path": "/tenants/:id/payments/providers/capability-evidence",
      "handler": "handlePaymentProviderCapabilityEvidence",
      "source": {
        "routeLine": 4037,
        "handlerLine": 2433
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/providers\\/capability-evidence$/",
      "path": "/tenants/:id/payments/providers/capability-evidence",
      "handler": "handlePaymentProviderCapabilityEvidence",
      "source": {
        "routeLine": 4038,
        "handlerLine": 2433
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/production-certification$/",
      "path": "/tenants/:id/payments/production-certification",
      "handler": "handlePaymentProductionCertification",
      "source": {
        "routeLine": 4039,
        "handlerLine": 2453
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/production-certification$/",
      "path": "/tenants/:id/payments/production-certification",
      "handler": "handlePaymentProductionCertification",
      "source": {
        "routeLine": 4040,
        "handlerLine": 2453
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/([^/]+)\\/operations$/",
      "path": "/tenants/:id/payments/:id/operations",
      "handler": "handlePaymentOperationalActions",
      "source": {
        "routeLine": 4041,
        "handlerLine": 2484
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/([^/]+)\\/operations$/",
      "path": "/tenants/:id/payments/:id/operations",
      "handler": "handlePaymentOperationalActions",
      "source": {
        "routeLine": 4042,
        "handlerLine": 2484
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/([^/]+)\\/operations\\/retry$/",
      "path": "/tenants/:id/payments/:id/operations/retry",
      "handler": "handlePaymentOperationalRetry",
      "source": {
        "routeLine": 4043,
        "handlerLine": 2491
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/([^/]+)\\/operations\\/manual-review$/",
      "path": "/tenants/:id/payments/:id/operations/manual-review",
      "handler": "handlePaymentManualReview",
      "source": {
        "routeLine": 4044,
        "handlerLine": 2496
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/([^/]+)\\/settlement$/",
      "path": "/tenants/:id/payments/:id/settlement",
      "handler": "handlePaymentSettlement",
      "source": {
        "routeLine": 4045,
        "handlerLine": 2502
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/routing\\/resolve$/",
      "path": "/tenants/:id/payments/routing/resolve",
      "handler": "handlePaymentRoutingResolve",
      "source": {
        "routeLine": 4046,
        "handlerLine": 2386
      },
      "authentication": "session/authentication present",
      "authorization": [
        "payments:payments:view"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/routing\\/policies$/",
      "path": "/tenants/:id/payments/routing/policies",
      "handler": "handlePaymentRoutingPolicies",
      "source": {
        "routeLine": 4047,
        "handlerLine": 2397
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "listPaymentRoutingPolicies",
        "upsertPaymentRoutingPolicy"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/routing\\/policies$/",
      "path": "/tenants/:id/payments/routing/policies",
      "handler": "handlePaymentRoutingPolicies",
      "source": {
        "routeLine": 4048,
        "handlerLine": 2397
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "listPaymentRoutingPolicies",
        "upsertPaymentRoutingPolicy"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/([^/]+)\\/settlement\\/finalize$/",
      "path": "/tenants/:id/payments/:id/settlement/finalize",
      "handler": "handlePaymentSettlementFinalize",
      "source": {
        "routeLine": 4049,
        "handlerLine": 2512
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/([^/]+)\\/settlement$/",
      "path": "/tenants/:id/payments/:id/settlement",
      "handler": "handlePaymentSettlementHistory",
      "source": {
        "routeLine": 4050,
        "handlerLine": 2522
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/([^/]+)\\/refund$/",
      "path": "/tenants/:id/payments/:id/refund",
      "handler": "handlePaymentRefundHistory",
      "source": {
        "routeLine": 4051,
        "handlerLine": 2546
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/([^/]+)$/",
      "path": "/tenants/:id/payments/:id",
      "handler": "handlePayments",
      "source": {
        "routeLine": 4052,
        "handlerLine": 2310
      },
      "authentication": "session/authentication present",
      "authorization": [
        "payments:payments:view",
        "payments:payments:accept"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [
        "IDEMPOTENCY_KEY_REQUIRED",
        "PAYMENT_CONTEXT_REQUIRED",
        "PAYMENT_STATE_COMMAND_REQUIRED"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "createPayment"
      ],
      "storeFunctions": [
        "getTenant",
        "getPayment",
        "listPayments",
        "createPayment"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments$/",
      "path": "/tenants/:id/payments",
      "handler": "handlePayments",
      "source": {
        "routeLine": 4053,
        "handlerLine": 2310
      },
      "authentication": "session/authentication present",
      "authorization": [
        "payments:payments:view",
        "payments:payments:accept"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [
        "IDEMPOTENCY_KEY_REQUIRED",
        "PAYMENT_CONTEXT_REQUIRED",
        "PAYMENT_STATE_COMMAND_REQUIRED"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "createPayment"
      ],
      "storeFunctions": [
        "getTenant",
        "getPayment",
        "listPayments",
        "createPayment"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments$/",
      "path": "/tenants/:id/payments",
      "handler": "handlePayments",
      "source": {
        "routeLine": 4054,
        "handlerLine": 2310
      },
      "authentication": "session/authentication present",
      "authorization": [
        "payments:payments:view",
        "payments:payments:accept"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [
        "IDEMPOTENCY_KEY_REQUIRED",
        "PAYMENT_CONTEXT_REQUIRED",
        "PAYMENT_STATE_COMMAND_REQUIRED"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "createPayment"
      ],
      "storeFunctions": [
        "getTenant",
        "getPayment",
        "listPayments",
        "createPayment"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/payments\\/([^/]+)$/",
      "path": "/tenants/:id/payments/:id",
      "handler": "handlePayments",
      "source": {
        "routeLine": 4055,
        "handlerLine": 2310
      },
      "authentication": "session/authentication present",
      "authorization": [
        "payments:payments:view",
        "payments:payments:accept"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [
        "IDEMPOTENCY_KEY_REQUIRED",
        "PAYMENT_CONTEXT_REQUIRED",
        "PAYMENT_STATE_COMMAND_REQUIRED"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "createPayment"
      ],
      "storeFunctions": [
        "getTenant",
        "getPayment",
        "listPayments",
        "createPayment"
      ],
      "statusCodes": [
        "200",
        "201",
        "400",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/receivables$/",
      "path": "/tenants/:id/b2b/receivables",
      "handler": "handleB2BReceivables",
      "source": {
        "routeLine": 4056,
        "handlerLine": 2723
      },
      "authentication": "session/authentication present",
      "authorization": [
        "b2b_receivables:b2b:ar:view",
        "b2b_receivables:b2b:ar:allocate",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "allocatePaymentToReceivable",
        "createReceivable"
      ],
      "storeFunctions": [
        "getTenant",
        "listReceivableLedger",
        "allocatePaymentToReceivable",
        "getReceivable",
        "listReceivables",
        "createReceivable",
        "transitionReceivable"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/receivables$/",
      "path": "/tenants/:id/b2b/receivables",
      "handler": "handleB2BReceivables",
      "source": {
        "routeLine": 4057,
        "handlerLine": 2723
      },
      "authentication": "session/authentication present",
      "authorization": [
        "b2b_receivables:b2b:ar:view",
        "b2b_receivables:b2b:ar:allocate",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "allocatePaymentToReceivable",
        "createReceivable"
      ],
      "storeFunctions": [
        "getTenant",
        "listReceivableLedger",
        "allocatePaymentToReceivable",
        "getReceivable",
        "listReceivables",
        "createReceivable",
        "transitionReceivable"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/receivables\\/([^/]+)$/",
      "path": "/tenants/:id/b2b/receivables/:id",
      "handler": "handleB2BReceivables",
      "source": {
        "routeLine": 4058,
        "handlerLine": 2723
      },
      "authentication": "session/authentication present",
      "authorization": [
        "b2b_receivables:b2b:ar:view",
        "b2b_receivables:b2b:ar:allocate",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "allocatePaymentToReceivable",
        "createReceivable"
      ],
      "storeFunctions": [
        "getTenant",
        "listReceivableLedger",
        "allocatePaymentToReceivable",
        "getReceivable",
        "listReceivables",
        "createReceivable",
        "transitionReceivable"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/receivables\\/([^/]+)$/",
      "path": "/tenants/:id/b2b/receivables/:id",
      "handler": "handleB2BReceivables",
      "source": {
        "routeLine": 4059,
        "handlerLine": 2723
      },
      "authentication": "session/authentication present",
      "authorization": [
        "b2b_receivables:b2b:ar:view",
        "b2b_receivables:b2b:ar:allocate",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "allocatePaymentToReceivable",
        "createReceivable"
      ],
      "storeFunctions": [
        "getTenant",
        "listReceivableLedger",
        "allocatePaymentToReceivable",
        "getReceivable",
        "listReceivables",
        "createReceivable",
        "transitionReceivable"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/receivables\\/([^/]+)\\/ledger$/",
      "path": "/tenants/:id/b2b/receivables/:id/ledger",
      "handler": "handleB2BReceivables",
      "source": {
        "routeLine": 4060,
        "handlerLine": 2723
      },
      "authentication": "session/authentication present",
      "authorization": [
        "b2b_receivables:b2b:ar:view",
        "b2b_receivables:b2b:ar:allocate",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "allocatePaymentToReceivable",
        "createReceivable"
      ],
      "storeFunctions": [
        "getTenant",
        "listReceivableLedger",
        "allocatePaymentToReceivable",
        "getReceivable",
        "listReceivables",
        "createReceivable",
        "transitionReceivable"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/invoices$/",
      "path": "/tenants/:id/b2b/invoices",
      "handler": "handleB2BInvoices",
      "source": {
        "routeLine": 4061,
        "handlerLine": 2767
      },
      "authentication": "session/authentication present",
      "authorization": [
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createInvoice",
        "transitionInvoice"
      ],
      "storeFunctions": [
        "getTenant",
        "getInvoice",
        "listInvoices",
        "createInvoice",
        "transitionInvoice"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/invoices$/",
      "path": "/tenants/:id/b2b/invoices",
      "handler": "handleB2BInvoices",
      "source": {
        "routeLine": 4062,
        "handlerLine": 2767
      },
      "authentication": "session/authentication present",
      "authorization": [
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createInvoice",
        "transitionInvoice"
      ],
      "storeFunctions": [
        "getTenant",
        "getInvoice",
        "listInvoices",
        "createInvoice",
        "transitionInvoice"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/invoices\\/([^/]+)$/",
      "path": "/tenants/:id/b2b/invoices/:id",
      "handler": "handleB2BInvoices",
      "source": {
        "routeLine": 4063,
        "handlerLine": 2767
      },
      "authentication": "session/authentication present",
      "authorization": [
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createInvoice",
        "transitionInvoice"
      ],
      "storeFunctions": [
        "getTenant",
        "getInvoice",
        "listInvoices",
        "createInvoice",
        "transitionInvoice"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/invoices\\/([^/]+)$/",
      "path": "/tenants/:id/b2b/invoices/:id",
      "handler": "handleB2BInvoices",
      "source": {
        "routeLine": 4064,
        "handlerLine": 2767
      },
      "authentication": "session/authentication present",
      "authorization": [
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createInvoice",
        "transitionInvoice"
      ],
      "storeFunctions": [
        "getTenant",
        "getInvoice",
        "listInvoices",
        "createInvoice",
        "transitionInvoice"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/b2b\\/receivables\\/([^/]+)\\/allocate$/",
      "path": "/tenants/:id/b2b/receivables/:id/allocate",
      "handler": "handleB2BReceivables",
      "source": {
        "routeLine": 4065,
        "handlerLine": 2723
      },
      "authentication": "session/authentication present",
      "authorization": [
        "b2b_receivables:b2b:ar:view",
        "b2b_receivables:b2b:ar:allocate",
        "dynamic/delegated",
        "dynamic/delegated"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "location referenced; inspect handler conditions"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "allocatePaymentToReceivable",
        "createReceivable"
      ],
      "storeFunctions": [
        "getTenant",
        "listReceivableLedger",
        "allocatePaymentToReceivable",
        "getReceivable",
        "listReceivables",
        "createReceivable",
        "transitionReceivable"
      ],
      "statusCodes": [
        "200",
        "201",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/audit$/",
      "path": "/tenants/:id/audit",
      "handler": "handleTenantAudit",
      "source": {
        "routeLine": 4066,
        "handlerLine": 2796
      },
      "authentication": "session/authentication present",
      "authorization": [
        "audit:audit:view"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "listAuditEvents",
        "recordAuditEvent"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/compliance\\/retention$/",
      "path": "/tenants/:id/compliance/retention",
      "handler": "handleAuditRetention",
      "source": {
        "routeLine": 4067,
        "handlerLine": 2816
      },
      "authentication": "session/authentication present",
      "authorization": [
        "audit:compliance:manage"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getAuditRetentionPolicy",
        "setAuditRetentionPolicy"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/compliance\\/retention$/",
      "path": "/tenants/:id/compliance/retention",
      "handler": "handleAuditRetention",
      "source": {
        "routeLine": 4068,
        "handlerLine": 2816
      },
      "authentication": "session/authentication present",
      "authorization": [
        "audit:compliance:manage"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "getAuditRetentionPolicy",
        "setAuditRetentionPolicy"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/compliance\\/requests$/",
      "path": "/tenants/:id/compliance/requests",
      "handler": "handleComplianceRequests",
      "source": {
        "routeLine": 4069,
        "handlerLine": 2829
      },
      "authentication": "session/authentication present",
      "authorization": [
        "compliance:compliance:manage"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "listComplianceRequests",
        "createComplianceRequest",
        "resolveComplianceRequest"
      ],
      "statusCodes": [
        "200",
        "201",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/compliance\\/requests$/",
      "path": "/tenants/:id/compliance/requests",
      "handler": "handleComplianceRequests",
      "source": {
        "routeLine": 4070,
        "handlerLine": 2829
      },
      "authentication": "session/authentication present",
      "authorization": [
        "compliance:compliance:manage"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "listComplianceRequests",
        "createComplianceRequest",
        "resolveComplianceRequest"
      ],
      "statusCodes": [
        "200",
        "201",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/compliance\\/requests$/",
      "path": "/tenants/:id/compliance/requests",
      "handler": "handleComplianceRequests",
      "source": {
        "routeLine": 4071,
        "handlerLine": 2829
      },
      "authentication": "session/authentication present",
      "authorization": [
        "compliance:compliance:manage"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "listComplianceRequests",
        "createComplianceRequest",
        "resolveComplianceRequest"
      ],
      "statusCodes": [
        "200",
        "201",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/compliance\\/export\\/([^/]+)\\/([^/]+)$/",
      "path": "/tenants/:id/compliance/export/:id/:id",
      "handler": "handleComplianceExport",
      "source": {
        "routeLine": 4072,
        "handlerLine": 2853
      },
      "authentication": "session/authentication present",
      "authorization": [
        "compliance:compliance:manage"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "buildComplianceExport",
        "recordAuditEvent"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/compliance\\/export\\/([^/]+)$/",
      "path": "/tenants/:id/compliance/export/:id",
      "handler": "handleComplianceExport",
      "source": {
        "routeLine": 4073,
        "handlerLine": 2853
      },
      "authentication": "session/authentication present",
      "authorization": [
        "compliance:compliance:manage"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant",
        "buildComplianceExport",
        "recordAuditEvent"
      ],
      "statusCodes": [
        "200",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/admin\\/backup$/",
      "path": "/admin/backup",
      "handler": "handleAdminBackup",
      "source": {
        "routeLine": 4074,
        "handlerLine": 2870
      },
      "authentication": "needs-review",
      "authorization": "none detected",
      "scope": {
        "tenant": "global/auth/provider",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "createDatabaseBackup"
      ],
      "statusCodes": [
        "201"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/api\\/marketplace\\/search$/",
      "path": "/api/marketplace/search",
      "handler": "handleMarketplaceSearch",
      "source": {
        "routeLine": 4075,
        "handlerLine": 2895
      },
      "authentication": "needs-review",
      "authorization": "none detected",
      "scope": {
        "tenant": "public tenant/resource",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "searchMarketplaceListings"
      ],
      "statusCodes": [
        "200"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/api\\/discovery\\/products$/",
      "path": "/api/discovery/products",
      "handler": "handleDiscoveryProducts",
      "source": {
        "routeLine": 4076,
        "handlerLine": 2903
      },
      "authentication": "public/provider-authenticated path",
      "authorization": "none detected",
      "scope": {
        "tenant": "global/auth/provider",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [],
      "statusCodes": [
        "200"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/api\\/discovery\\/suppliers\\/([^/]+)$/",
      "path": "/api/discovery/suppliers/:id",
      "handler": "handleDiscoverySuppliers",
      "source": {
        "routeLine": 4077,
        "handlerLine": 2925
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_discovery:supplier-network:discovery:discover"
      ],
      "scope": {
        "tenant": "global/auth/provider",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/api\\/discovery\\/suppliers\\/([^/]+)$/",
      "path": "/api/discovery/suppliers/:id",
      "handler": "handleDiscoverySuppliers",
      "source": {
        "routeLine": 4078,
        "handlerLine": 2925
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_discovery:supplier-network:discovery:discover"
      ],
      "scope": {
        "tenant": "global/auth/provider",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/api\\/discovery\\/organizations$/",
      "path": "/api/discovery/organizations",
      "handler": "handleDiscoveryOrganizations",
      "source": {
        "routeLine": 4079,
        "handlerLine": 2979
      },
      "authentication": "public/provider-authenticated path",
      "authorization": "none detected",
      "scope": {
        "tenant": "global/auth/provider",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [],
      "statusCodes": [
        "200"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/api\\/discovery$/",
      "path": "/api/discovery",
      "handler": "handleUnifiedDiscovery",
      "source": {
        "routeLine": 4080,
        "handlerLine": 2945
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_discovery:supplier-network:discovery:discover"
      ],
      "scope": {
        "tenant": "global/auth/provider",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "400",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/api\\/discovery$/",
      "path": "/api/discovery",
      "handler": "handleUnifiedDiscovery",
      "source": {
        "routeLine": 4081,
        "handlerLine": 2945
      },
      "authentication": "session/authentication present",
      "authorization": [
        "supplier_network_discovery:supplier-network:discovery:discover"
      ],
      "scope": {
        "tenant": "global/auth/provider",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getTenant"
      ],
      "statusCodes": [
        "200",
        "400",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/api\\/marketplace\\/checkout$/",
      "path": "/api/marketplace/checkout",
      "handler": "handleMarketplaceCheckout",
      "source": {
        "routeLine": 4082,
        "handlerLine": 2997
      },
      "authentication": "session/authentication present",
      "authorization": "session-only or delegated",
      "scope": {
        "tenant": "public tenant/resource",
        "location": "not detected"
      },
      "validationCodes": [
        "TELEGRAM_BUYER_CONTEXT_INCOMPLETE",
        "TELEGRAM_STOREFRONT_NOT_PUBLISHED",
        "TELEGRAM_CHECKOUT_DISABLED",
        "TELEGRAM_CHECKOUT_SCOPE_MISMATCH"
      ],
      "idempotency": "explicit key handling",
      "transactionStoreFunctions": [
        "createMarketplaceOrder"
      ],
      "storeFunctions": [
        "authenticateSessionToken",
        "getTenant",
        "getTelegramStorefrontConfig",
        "createMarketplaceOrder"
      ],
      "statusCodes": [
        "200",
        "400",
        "401",
        "403",
        "404"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/api\\/marketplace\\/orders\\/([^/]+)$/",
      "path": "/api/marketplace/orders/:id",
      "handler": "handleMarketplaceOrderTracking",
      "source": {
        "routeLine": 4083,
        "handlerLine": 3038
      },
      "authentication": "needs-review",
      "authorization": "none detected",
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [],
      "storeFunctions": [
        "getMarketplaceOrderTracking"
      ],
      "statusCodes": [
        "200"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/api\\/marketplace\\/orders\\/status\\/([^/]+)$/",
      "path": "/api/marketplace/orders/status/:id",
      "handler": "handleMarketplaceOrderStatus",
      "source": {
        "routeLine": 4084,
        "handlerLine": 3045
      },
      "authentication": "session/authentication present",
      "authorization": [
        "marketplace_orders:marketplace_orders:update",
        "marketplace_orders:orders:delete"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "updateMarketplaceOrderStatus"
      ],
      "storeFunctions": [
        "updateMarketplaceOrderStatus"
      ],
      "statusCodes": [
        "200",
        "400"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "GET",
      "pattern": "/^\\/tenants\\/([^/]+)\\/restaurant\\/recipes$/",
      "path": "/tenants/:id/restaurant/recipes",
      "handler": "handleRestaurantRecipes",
      "source": {
        "routeLine": 4085,
        "handlerLine": 1925
      },
      "authentication": "session/authentication present",
      "authorization": [
        "restaurant_recipe:restaurant:recipes:view",
        "restaurant_recipe:restaurant:recipes:manage"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createRestaurantRecipe",
        "updateRestaurantRecipe"
      ],
      "storeFunctions": [
        "getTenant",
        "listRestaurantRecipes",
        "createRestaurantRecipe",
        "updateRestaurantRecipe"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "POST",
      "pattern": "/^\\/tenants\\/([^/]+)\\/restaurant\\/recipes$/",
      "path": "/tenants/:id/restaurant/recipes",
      "handler": "handleRestaurantRecipes",
      "source": {
        "routeLine": 4086,
        "handlerLine": 1925
      },
      "authentication": "session/authentication present",
      "authorization": [
        "restaurant_recipe:restaurant:recipes:view",
        "restaurant_recipe:restaurant:recipes:manage"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createRestaurantRecipe",
        "updateRestaurantRecipe"
      ],
      "storeFunctions": [
        "getTenant",
        "listRestaurantRecipes",
        "createRestaurantRecipe",
        "updateRestaurantRecipe"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "PATCH",
      "pattern": "/^\\/tenants\\/([^/]+)\\/restaurant\\/recipes\\/([^/]+)$/",
      "path": "/tenants/:id/restaurant/recipes/:id",
      "handler": "handleRestaurantRecipes",
      "source": {
        "routeLine": 4087,
        "handlerLine": 1925
      },
      "authentication": "session/authentication present",
      "authorization": [
        "restaurant_recipe:restaurant:recipes:view",
        "restaurant_recipe:restaurant:recipes:manage"
      ],
      "scope": {
        "tenant": "tenant/chatId",
        "location": "not detected"
      },
      "validationCodes": [],
      "idempotency": "not detected",
      "transactionStoreFunctions": [
        "createRestaurantRecipe",
        "updateRestaurantRecipe"
      ],
      "storeFunctions": [
        "getTenant",
        "listRestaurantRecipes",
        "createRestaurantRecipe",
        "updateRestaurantRecipe"
      ],
      "statusCodes": [
        "200",
        "404",
        "405"
      ],
      "classification": "needs-review",
      "coverage": "not yet test-assertion mapped",
      "evidence": {
        "handlerBodyPatterns": [
          "requireSession",
          "requireAuthorization",
          "sendJSON"
        ]
      }
    },
    {
      "method": "ANY",
      "path": "/health",
      "handler": "inline/static",
      "source": {
        "routeLine": 4107
      },
      "authentication": "public/static",
      "authorization": "not applicable unless source branch adds gate",
      "scope": {
        "tenant": "none"
      },
      "validationCodes": [],
      "idempotency": "none",
      "transactionStoreFunctions": [],
      "storeFunctions": [],
      "statusCodes": [],
      "classification": "inline/static",
      "coverage": "not yet test-assertion mapped"
    },
    {
      "method": "GET",
      "path": "/config.js",
      "handler": "inline/static",
      "source": {
        "routeLine": 4116
      },
      "authentication": "public/static",
      "authorization": "not applicable unless source branch adds gate",
      "scope": {
        "tenant": "none"
      },
      "validationCodes": [],
      "idempotency": "none",
      "transactionStoreFunctions": [],
      "storeFunctions": [],
      "statusCodes": [],
      "classification": "inline/static",
      "coverage": "not yet test-assertion mapped"
    },
    {
      "method": "GET",
      "path": "/backend/lib/*",
      "handler": "inline/static",
      "source": {
        "routeLine": 4123
      },
      "authentication": "public/static",
      "authorization": "not applicable unless source branch adds gate",
      "scope": {
        "tenant": "none"
      },
      "validationCodes": [],
      "idempotency": "none",
      "transactionStoreFunctions": [],
      "storeFunctions": [],
      "statusCodes": [],
      "classification": "inline/static",
      "coverage": "not yet test-assertion mapped"
    },
    {
      "method": "GET",
      "path": "/shared/*",
      "handler": "inline/static",
      "source": {
        "routeLine": 4126
      },
      "authentication": "public/static",
      "authorization": "not applicable unless source branch adds gate",
      "scope": {
        "tenant": "none"
      },
      "validationCodes": [],
      "idempotency": "none",
      "transactionStoreFunctions": [],
      "storeFunctions": [],
      "statusCodes": [],
      "classification": "inline/static",
      "coverage": "not yet test-assertion mapped"
    },
    {
      "method": "GET",
      "path": "/store/:id",
      "handler": "inline/static",
      "source": {
        "routeLine": 4131
      },
      "authentication": "public/static",
      "authorization": "not applicable unless source branch adds gate",
      "scope": {
        "tenant": "none"
      },
      "validationCodes": [],
      "idempotency": "none",
      "transactionStoreFunctions": [],
      "storeFunctions": [],
      "statusCodes": [],
      "classification": "inline/static",
      "coverage": "not yet test-assertion mapped"
    },
    {
      "method": "GET",
      "path": "/track",
      "handler": "inline/static",
      "source": {
        "routeLine": 4134
      },
      "authentication": "public/static",
      "authorization": "not applicable unless source branch adds gate",
      "scope": {
        "tenant": "none"
      },
      "validationCodes": [],
      "idempotency": "none",
      "transactionStoreFunctions": [],
      "storeFunctions": [],
      "statusCodes": [],
      "classification": "inline/static",
      "coverage": "not yet test-assertion mapped"
    }
  ],
  "limitations": [
    "Static parser inventory; no runtime router execution.",
    "Permission extraction is literal-pattern only; delegated/dynamic authorization remains review-required.",
    "Validation codes and HTTP statuses reflect explicit handler literals; delegated store behavior is not fully expanded.",
    "No test assertions are mapped yet; coverage remains unverified."
  ]
}| Method | Route | Handler | Source lines (route/handler) | Authentication | Authorization / permission | Scope | Body fields | Query fields | Validation codes | Idempotency | Transaction boundary | Store calls | Statuses | Classification | Coverage |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| POST | `/integrations/payments/:id/notifications` | `handlePaymentProviderNotification` | 3841/2239 | Payment Core central authorization | PaymentCore authorization callback | global/auth/provider; not detected |  |  | PAYMENT_NOTIFICATION_NOT_CONFIGURED, INVALID_PROVIDER_NOTIFICATION | not detected | delegated to PaymentCore + store; inspect corresponding core operation |  | 400, 503 | domain capability: payments | not yet test-assertion mapped |
| POST | `/auth/telegram` | `handleTelegramAuth` | 3842/902 | Telegram initData signature/age verification | identity/proof/token validation; no tenant business permission | global/auth/provider; not detected | initData |  |  | not detected | delegated store transaction not detected by direct lexical scan | getOrCreateUserByTelegram, listUserMemberships, createSession, createAuthChallenge | 200 | domain capability: identity-tenant-infrastructure | not yet test-assertion mapped |
| POST | `/auth/migrate-legacy` | `handleLegacyMigration` | 3843/888 | Telegram initData signature/age verification | identity/proof/token validation; no tenant business permission | global/auth/provider; not detected | initData, apiKey, deviceName |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenantByApiKey, getOrCreateUserByTelegram, ensureMembership, createSession | 200, 400, 401 | domain capability: identity-tenant-infrastructure | not yet test-assertion mapped |
| GET | `/auth/country-packs` | `handleOnboardingCountryOptions` | 3844/928 | public read endpoint |  | global/auth/provider; not detected |  |  |  | not detected | undefined |  | 200 | domain capability: identity-tenant-infrastructure | not yet test-assertion mapped |
| POST | `/auth/tenants` | `handleCreateTenant` | 3845/936 | tenant-scoped session required; owner-role gate | owner-role | tenant/chatId; not detected | sellerName, challengeToken, businessType, country, currency, timezone, deviceName |  |  | not detected | explicit store transaction in createTenantForUser | getAuthChallengeForTenantCreation, createTenantForUser, createSession | 400, 401 | domain capability: identity-tenant-infrastructure | not yet test-assertion mapped |
| GET | `/auth/tenants` | `handleMyTenants` | 3846/978 | tenant-scoped session required | session-only at route; store-layer enforcement not yet fully expanded | tenant/chatId; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | listUserMemberships | 200 | domain capability: identity-tenant-infrastructure | not yet test-assertion mapped |
| POST | `/auth/select-tenant` | `handleSelectTenant` | 3847/984 | optional bearer session token |  | global/auth/provider; not detected | chatId, challengeToken, deviceName |  |  | not detected | delegated store transaction not detected by direct lexical scan | authenticateSessionToken, consumeAuthChallenge, listUserMemberships, createSession | 200, 400, 401, 403 | domain capability: identity-tenant-infrastructure | not yet test-assertion mapped |
| POST | `/auth/logout` | `handleLogout` | 3848/1010 | tenant-scoped session required | session-only at route; store-layer enforcement not yet fully expanded | global/auth/provider; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | revokeSession | 200 | domain capability: identity-tenant-infrastructure | not yet test-assertion mapped |
| POST | `/auth/pairing` | `handleCreatePairing` | 3849/1016 | tenant-scoped session required; owner-role gate | owner-role | global/auth/provider; not detected | role |  |  | not detected | delegated store transaction not detected by direct lexical scan | createPairingChallenge | 201 | domain capability: identity-tenant-infrastructure | not yet test-assertion mapped |
| POST | `/auth/pair` | `handlePairDevice` | 3850/1025 | one-time pairing challenge token | identity/proof/token validation; no tenant business permission | global/auth/provider; not detected | token, deviceName |  |  | not detected | explicit store transaction in consumePairingChallenge | consumePairingChallenge, createSession | 200, 400, 401 | domain capability: identity-tenant-infrastructure | not yet test-assertion mapped |
| GET | `/tenants/:id/memberships` | `handleListTenantMemberships` | 3851/1048 | tenant-scoped session required; central permission/scope evaluator | membership:membership:role:manage | tenant/chatId; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, listTenantMemberships | 200, 404 | domain capability: identity-tenant-infrastructure | not yet test-assertion mapped |
| GET | `/tenants/:id/packs/:id/lifecycle` | `handlePackLifecycle` | 3852/3230 | tenant-scoped session required; central permission/scope evaluator | pack_lifecycle:pack:lifecycle:view, dynamic/delegated | tenant/chatId; not detected | action, targetState, target_state, state, expectedVersion, expected_version |  | PACK_LIFECYCLE_ACTION_REQUIRED, UNSUPPORTED_PACK_LIFECYCLE_ACTION, PACK_LIFECYCLE_ACTION_STATE_MISMATCH, PACK_UPGRADE_COMMAND_REQUIRED, PACK_RECOVERY_NOT_REQUIRED, PACK_UPGRADE_NOT_AVAILABLE, UNSUPPORTED_PACK_LIFECYCLE_API_STATE | not detected | explicit store transaction in transitionPackLifecycle | getTenant, getPackLifecycle, transitionPackLifecycle | 200, 400, 404, 405, 409 | domain capability: pack-lifecycle | not yet test-assertion mapped |
| POST | `/tenants/:id/packs/:id/lifecycle` | `handlePackLifecycle` | 3853/3230 | tenant-scoped session required; central permission/scope evaluator | pack_lifecycle:pack:lifecycle:view, dynamic/delegated | tenant/chatId; not detected | action, targetState, target_state, state, expectedVersion, expected_version |  | PACK_LIFECYCLE_ACTION_REQUIRED, UNSUPPORTED_PACK_LIFECYCLE_ACTION, PACK_LIFECYCLE_ACTION_STATE_MISMATCH, PACK_UPGRADE_COMMAND_REQUIRED, PACK_RECOVERY_NOT_REQUIRED, PACK_UPGRADE_NOT_AVAILABLE, UNSUPPORTED_PACK_LIFECYCLE_API_STATE | not detected | explicit store transaction in transitionPackLifecycle | getTenant, getPackLifecycle, transitionPackLifecycle | 200, 400, 404, 405, 409 | domain capability: pack-lifecycle | not yet test-assertion mapped |
| POST | `/auth/membership-role` | `handleChangeMembershipRole` | 3854/1060 | tenant-scoped session required; central permission/scope evaluator | membership:membership:role:manage | global/auth/provider; not detected | membershipId, role |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, changeMembershipRole | 200, 400, 404 | domain capability: identity-tenant-infrastructure | not yet test-assertion mapped |
| POST | `/auth/membership-contextual-role` | `handleAssignMembershipContextualRole` | 3855/1075 | tenant-scoped session required; central permission/scope evaluator | membership:membership:role:manage | global/auth/provider; not detected | membershipId, role, scopeType, scopeId |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, assignMembershipContextualRole | 201, 404 | domain capability: identity-tenant-infrastructure | not yet test-assertion mapped |
| POST | `/auth/membership-contextual-role/revoke` | `handleRevokeMembershipContextualRole` | 3856/1094 | tenant-scoped session required; central permission/scope evaluator | membership:membership:role:manage | global/auth/provider; not detected | membershipId, role, scopeType, scopeId |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, revokeMembershipContextualRole | 200, 404 | domain capability: identity-tenant-infrastructure | not yet test-assertion mapped |
| POST | `/auth/invites` | `handleCreateInvite` | 3857/1039 | tenant-scoped session required; owner-role gate | owner-role | global/auth/provider; not detected | role |  |  | not detected | delegated store transaction not detected by direct lexical scan | createInvite | 201 | domain capability: identity-tenant-infrastructure | not yet test-assertion mapped |
| POST | `/auth/invites/revoke` | `handleRevokeInvite` | 3858/1120 | tenant-scoped session required; owner-role gate | owner-role | global/auth/provider; not detected | token |  |  | not detected | delegated store transaction not detected by direct lexical scan | revokeInvite | 200, 400 | domain capability: identity-tenant-infrastructure | not yet test-assertion mapped |
| POST | `/auth/accept-invite` | `handleAcceptInvite` | 3859/1155 | Telegram initData signature/age verification; one-time invite token | identity/proof/token validation; no tenant business permission | global/auth/provider; not detected | token, initData, deviceName |  |  | not detected | explicit store transaction in consumeInvite | getOrCreateUserByTelegram, consumeInvite, createSession | 200, 400, 401 | domain capability: identity-tenant-infrastructure | not yet test-assertion mapped |
| GET | `/tenants/:id/invites` | `handleListInvites` | 3860/1113 | tenant-scoped session required; owner-role gate | owner-role | tenant/chatId; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | listInvites | 200 | domain capability: identity-tenant-infrastructure | not yet test-assertion mapped |
| GET | `/tenants/:id/devices` | `handleListDevices` | 3861/1130 | tenant-scoped session required; owner-role gate | owner-role | tenant/chatId; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | listDevices | 200 | domain capability: identity-tenant-infrastructure | not yet test-assertion mapped |
| POST | `/auth/devices/revoke` | `handleRevokeDevice` | 3862/1137 | tenant-scoped session required; owner-role gate | owner-role | global/auth/provider; not detected | deviceId |  |  | not detected | delegated store transaction not detected by direct lexical scan | revokeDevice | 200, 400 | domain capability: identity-tenant-infrastructure | not yet test-assertion mapped |
| POST | `/sync/:id` | `handleSync` | 3863/1221 | tenant-scoped session required | session-only at route; store-layer enforcement not yet fully expanded | tenant/chatId; not detected | orders |  |  | not detected | explicit store transaction in saveQueuedOrders | getTenant, saveQueuedOrders | 200, 404 | domain capability: event-infrastructure | not yet test-assertion mapped |
| POST | `/events/:id` | `handleSyncEvents` | 3864/1176 | tenant-scoped session required; central permission/scope evaluator | customers:customers:manage, inventory:inventory:edit | tenant/chatId; location referenced; inspect handler conditions | events |  | LOCATION_SCOPE_DENIED | not detected | explicit store transaction in processSyncEvent | getTenant, getOrganizationLocation, processSyncEvent | 200, 400, 403, 404 | domain capability: event-infrastructure | not yet test-assertion mapped |
| GET | `/sync/:id` | `handleSyncPull` | 3865/1256 | tenant-scoped session required; owner-role gate | owner-role | tenant/chatId; not detected |  |  |  | not detected | explicit store transaction in pullNewOrders | getTenant, pullNewOrders | 200, 404 | domain capability: event-infrastructure | not yet test-assertion mapped |
| GET | `/orders/:id` | `handleOrdersFeed` | 3866/1244 | tenant-scoped session required; central permission/scope evaluator | orders:orders:view | tenant/chatId; not detected |  | limit |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, getOrders | 200, 404 | domain capability: commerce-orders | not yet test-assertion mapped |
| GET | `/tenants/:id/service-provider/resources` | `handleServiceProviderResources` | 3867/3650 | tenant-scoped session required; central permission/scope evaluator | service_resource:service:service_resource:view | tenant/chatId; location referenced; inspect handler conditions |  |  | SERVICE_PROVIDER_ASSIGNMENT_REQUIRED, LOCATION_SCOPE_DENIED | not detected | delegated store transaction not detected by direct lexical scan | getTenant, listServiceResources, getOrganizationLocation, getServiceResourceAvailability | 200, 403, 404, 405 | domain capability: service-booking | not yet test-assertion mapped |
| GET | `/tenants/:id/service-provider/bookings` | `handleServiceProviderBookings` | 3868/3683 | tenant-scoped session required; central permission/scope evaluator | session-only at route; store-layer enforcement not yet fully expanded | tenant/chatId; location referenced; inspect handler conditions |  |  | SERVICE_PROVIDER_ASSIGNMENT_REQUIRED, LOCATION_SCOPE_DENIED | not detected | delegated store transaction not detected by direct lexical scan | getTenant, listServiceResources, getOrganizationLocation, listServiceProviderBookings | 200, 403, 404, 405 | domain capability: service-booking | not yet test-assertion mapped |
| GET | `/tenants/:id/service-resources` | `handleServiceResources` | 3869/3508 | tenant-scoped session required; central permission/scope evaluator | service_resource:service:service_resource:view, service_resource:service:service_resource:manage | tenant/chatId; location referenced; inspect handler conditions | locationId, location_id, idempotencyKey, idempotency_key | location_id, include_inactive, service_item_id | LOCATION_SCOPE_DENIED, SERVICE_RESOURCE_NOT_FOUND, IDEMPOTENCY_KEY_REQUIRED | explicit key handling | explicit store transaction in createServiceResource, updateServiceResource | getTenant, listServiceResources, getOrganizationLocation, createServiceResource, updateServiceResource | 200, 400, 403, 404, 405 | domain capability: service-booking | not yet test-assertion mapped |
| POST | `/tenants/:id/service-resources` | `handleServiceResources` | 3870/3508 | tenant-scoped session required; central permission/scope evaluator | service_resource:service:service_resource:view, service_resource:service:service_resource:manage | tenant/chatId; location referenced; inspect handler conditions | locationId, location_id, idempotencyKey, idempotency_key | location_id, include_inactive, service_item_id | LOCATION_SCOPE_DENIED, SERVICE_RESOURCE_NOT_FOUND, IDEMPOTENCY_KEY_REQUIRED | explicit key handling | explicit store transaction in createServiceResource, updateServiceResource | getTenant, listServiceResources, getOrganizationLocation, createServiceResource, updateServiceResource | 200, 400, 403, 404, 405 | domain capability: service-booking | not yet test-assertion mapped |
| PATCH | `/tenants/:id/service-resources/:id` | `handleServiceResources` | 3871/3508 | tenant-scoped session required; central permission/scope evaluator | service_resource:service:service_resource:view, service_resource:service:service_resource:manage | tenant/chatId; location referenced; inspect handler conditions | locationId, location_id, idempotencyKey, idempotency_key | location_id, include_inactive, service_item_id | LOCATION_SCOPE_DENIED, SERVICE_RESOURCE_NOT_FOUND, IDEMPOTENCY_KEY_REQUIRED | explicit key handling | explicit store transaction in createServiceResource, updateServiceResource | getTenant, listServiceResources, getOrganizationLocation, createServiceResource, updateServiceResource | 200, 400, 403, 404, 405 | domain capability: service-booking | not yet test-assertion mapped |
| GET | `/tenants/:id/service-resources/:id/availability` | `handleServiceResourceAvailability` | 3872/3613 | tenant-scoped session required; central permission/scope evaluator | session-only at route; store-layer enforcement not yet fully expanded | tenant/chatId; location referenced; inspect handler conditions | idempotencyKey, idempotency_key |  | SERVICE_RESOURCE_NOT_FOUND, LOCATION_SCOPE_DENIED, IDEMPOTENCY_KEY_REQUIRED | explicit key handling | explicit store transaction in setServiceResourceAvailability | getTenant, listServiceResources, getOrganizationLocation, getServiceResourceAvailability, setServiceResourceAvailability | 200, 400, 403, 404, 405 | domain capability: service-booking | not yet test-assertion mapped |
| PUT | `/tenants/:id/service-resources/:id/availability` | `handleServiceResourceAvailability` | 3873/3613 | tenant-scoped session required; central permission/scope evaluator | session-only at route; store-layer enforcement not yet fully expanded | tenant/chatId; location referenced; inspect handler conditions | idempotencyKey, idempotency_key |  | SERVICE_RESOURCE_NOT_FOUND, LOCATION_SCOPE_DENIED, IDEMPOTENCY_KEY_REQUIRED | explicit key handling | explicit store transaction in setServiceResourceAvailability | getTenant, listServiceResources, getOrganizationLocation, getServiceResourceAvailability, setServiceResourceAvailability | 200, 400, 403, 404, 405 | domain capability: service-booking | not yet test-assertion mapped |
| GET | `/tenants/:id/orders/:id/service-bookings` | `handleServiceBookings` | 3874/3716 | tenant-scoped session required; central permission/scope evaluator | service_booking:service:service_booking:view | tenant/chatId; location referenced; inspect handler conditions | idempotencyKey, idempotency_key, status, next_status, nextStatus |  | ORDER_NOT_FOUND, LOCATION_SCOPE_DENIED, IDEMPOTENCY_KEY_REQUIRED | explicit key handling | explicit store transaction in createServiceBooking, transitionServiceBooking | getTenant, getOrders, getOrganizationLocation, listServiceBookings, createServiceBooking, transitionServiceBooking | 200, 400, 403, 404, 405 | domain capability: service-booking | not yet test-assertion mapped |
| POST | `/tenants/:id/orders/:id/service-bookings` | `handleServiceBookings` | 3875/3716 | tenant-scoped session required; central permission/scope evaluator | service_booking:service:service_booking:view | tenant/chatId; location referenced; inspect handler conditions | idempotencyKey, idempotency_key, status, next_status, nextStatus |  | ORDER_NOT_FOUND, LOCATION_SCOPE_DENIED, IDEMPOTENCY_KEY_REQUIRED | explicit key handling | explicit store transaction in createServiceBooking, transitionServiceBooking | getTenant, getOrders, getOrganizationLocation, listServiceBookings, createServiceBooking, transitionServiceBooking | 200, 400, 403, 404, 405 | domain capability: service-booking | not yet test-assertion mapped |
| PATCH | `/tenants/:id/orders/:id/service-bookings/:id` | `handleServiceBookings` | 3876/3716 | tenant-scoped session required; central permission/scope evaluator | service_booking:service:service_booking:view | tenant/chatId; location referenced; inspect handler conditions | idempotencyKey, idempotency_key, status, next_status, nextStatus |  | ORDER_NOT_FOUND, LOCATION_SCOPE_DENIED, IDEMPOTENCY_KEY_REQUIRED | explicit key handling | explicit store transaction in createServiceBooking, transitionServiceBooking | getTenant, getOrders, getOrganizationLocation, listServiceBookings, createServiceBooking, transitionServiceBooking | 200, 400, 403, 404, 405 | domain capability: service-booking | not yet test-assertion mapped |
| POST | `/tenants/:id/orders/:id/service-delivery-assessment` | `handleServiceDeliveryAssessment` | 3877/3767 | tenant-scoped session required | session-only at route; store-layer enforcement not yet fully expanded | tenant/chatId; location referenced; inspect handler conditions | idempotencyKey, idempotency_key |  | IDEMPOTENCY_KEY_REQUIRED | explicit key handling | explicit store transaction in recordServiceDeliveryAssessment | getTenant, recordServiceDeliveryAssessment | 200, 400, 404, 405 | domain capability: service-booking | not yet test-assertion mapped |
| GET | `/tenants/:id/orders/:id/fulfillment` | `handleOrderFulfillment` | 3878/3792 | tenant-scoped session required; central permission/scope evaluator | fulfillment:fulfillment:view, logistics:logistics:deliveries:update_assigned, fulfillment:fulfillment:update | tenant/chatId; location referenced; inspect handler conditions | locationId, location_id, idempotencyKey, idempotency_key, status, nextStatus, next_status |  | IDEMPOTENCY_KEY_REQUIRED | explicit key handling | explicit store transaction in transitionOrderFulfillment | getTenant, getOrderFulfillment, assertCourierOwnsDelivery, transitionOrderFulfillment | 200, 400, 404, 405 | domain capability: fulfillment | not yet test-assertion mapped |
| POST | `/tenants/:id/orders/:id/delivery-assignment` | `handleDeliveryAssignment` | 3879/3461 | tenant-scoped session required; central permission/scope evaluator | logistics:logistics:deliveries:view, logistics:logistics:deliveries:update_assigned, dynamic/delegated | tenant/chatId; location referenced; inspect handler conditions | locationId, location_id, action, status, idempotencyKey, idempotency_key, courierUserId, courier_user_id |  | IDEMPOTENCY_KEY_REQUIRED | explicit key handling | explicit store transaction in transitionDeliveryAssignment, assignDeliveryCourier | getTenant, getDeliveryAssignment, assertCourierOwnsDelivery, transitionDeliveryAssignment, assignDeliveryCourier | 200, 400, 404 | domain capability: logistics | not yet test-assertion mapped |
| PATCH | `/tenants/:id/orders/:id/delivery-assignment` | `handleDeliveryAssignment` | 3880/3461 | tenant-scoped session required; central permission/scope evaluator | logistics:logistics:deliveries:view, logistics:logistics:deliveries:update_assigned, dynamic/delegated | tenant/chatId; location referenced; inspect handler conditions | locationId, location_id, action, status, idempotencyKey, idempotency_key, courierUserId, courier_user_id |  | IDEMPOTENCY_KEY_REQUIRED | explicit key handling | explicit store transaction in transitionDeliveryAssignment, assignDeliveryCourier | getTenant, getDeliveryAssignment, assertCourierOwnsDelivery, transitionDeliveryAssignment, assignDeliveryCourier | 200, 400, 404 | domain capability: logistics | not yet test-assertion mapped |
| GET | `/tenants/:id/logistics/scheduling` | `handleLogisticsScheduling` | 3881/3338 | tenant-scoped session required; central permission/scope evaluator | scheduling:logistics:scheduling:view, scheduling:logistics:scheduling:request | tenant/chatId; location referenced; inspect handler conditions | locationId, location_id, idempotencyKey, idempotency_key, timezone, scheduledStart, scheduled_start, scheduledEnd, scheduled_end, status, targetStatus, target_status, expectedVersion, expected_version, reason | locationId, status, activityType | LOCATION_SCOPE_DENIED, IDEMPOTENCY_KEY_REQUIRED, SCHEDULING_ACTIVITY_NOT_FOUND, SCHEDULING_STATUS_REQUIRED, SCHEDULING_VERSION_REQUIRED | explicit key handling | explicit store transaction in createLogisticsSchedulingActivity, transitionLogisticsSchedulingActivity | getTenant, getOrganizationLocation, listLogisticsSchedulingActivities, getLogisticsSchedulingTimeZone, createLogisticsSchedulingActivity, getLogisticsSchedulingActivity, evaluateLogisticsSchedulingActivity, transitionLogisticsSchedulingActivity | 200, 400, 403, 404, 405 | domain capability: logistics | not yet test-assertion mapped |
| POST | `/tenants/:id/logistics/scheduling` | `handleLogisticsScheduling` | 3882/3338 | tenant-scoped session required; central permission/scope evaluator | scheduling:logistics:scheduling:view, scheduling:logistics:scheduling:request | tenant/chatId; location referenced; inspect handler conditions | locationId, location_id, idempotencyKey, idempotency_key, timezone, scheduledStart, scheduled_start, scheduledEnd, scheduled_end, status, targetStatus, target_status, expectedVersion, expected_version, reason | locationId, status, activityType | LOCATION_SCOPE_DENIED, IDEMPOTENCY_KEY_REQUIRED, SCHEDULING_ACTIVITY_NOT_FOUND, SCHEDULING_STATUS_REQUIRED, SCHEDULING_VERSION_REQUIRED | explicit key handling | explicit store transaction in createLogisticsSchedulingActivity, transitionLogisticsSchedulingActivity | getTenant, getOrganizationLocation, listLogisticsSchedulingActivities, getLogisticsSchedulingTimeZone, createLogisticsSchedulingActivity, getLogisticsSchedulingActivity, evaluateLogisticsSchedulingActivity, transitionLogisticsSchedulingActivity | 200, 400, 403, 404, 405 | domain capability: logistics | not yet test-assertion mapped |
| GET | `/tenants/:id/logistics/scheduling/:id` | `handleLogisticsScheduling` | 3883/3338 | tenant-scoped session required; central permission/scope evaluator | scheduling:logistics:scheduling:view, scheduling:logistics:scheduling:request | tenant/chatId; location referenced; inspect handler conditions | locationId, location_id, idempotencyKey, idempotency_key, timezone, scheduledStart, scheduled_start, scheduledEnd, scheduled_end, status, targetStatus, target_status, expectedVersion, expected_version, reason | locationId, status, activityType | LOCATION_SCOPE_DENIED, IDEMPOTENCY_KEY_REQUIRED, SCHEDULING_ACTIVITY_NOT_FOUND, SCHEDULING_STATUS_REQUIRED, SCHEDULING_VERSION_REQUIRED | explicit key handling | explicit store transaction in createLogisticsSchedulingActivity, transitionLogisticsSchedulingActivity | getTenant, getOrganizationLocation, listLogisticsSchedulingActivities, getLogisticsSchedulingTimeZone, createLogisticsSchedulingActivity, getLogisticsSchedulingActivity, evaluateLogisticsSchedulingActivity, transitionLogisticsSchedulingActivity | 200, 400, 403, 404, 405 | domain capability: logistics | not yet test-assertion mapped |
| POST | `/tenants/:id/logistics/scheduling/:id/evaluate` | `handleLogisticsScheduling` | 3884/3338 | tenant-scoped session required; central permission/scope evaluator | scheduling:logistics:scheduling:view, scheduling:logistics:scheduling:request | tenant/chatId; location referenced; inspect handler conditions | locationId, location_id, idempotencyKey, idempotency_key, timezone, scheduledStart, scheduled_start, scheduledEnd, scheduled_end, status, targetStatus, target_status, expectedVersion, expected_version, reason | locationId, status, activityType | LOCATION_SCOPE_DENIED, IDEMPOTENCY_KEY_REQUIRED, SCHEDULING_ACTIVITY_NOT_FOUND, SCHEDULING_STATUS_REQUIRED, SCHEDULING_VERSION_REQUIRED | explicit key handling | explicit store transaction in createLogisticsSchedulingActivity, transitionLogisticsSchedulingActivity | getTenant, getOrganizationLocation, listLogisticsSchedulingActivities, getLogisticsSchedulingTimeZone, createLogisticsSchedulingActivity, getLogisticsSchedulingActivity, evaluateLogisticsSchedulingActivity, transitionLogisticsSchedulingActivity | 200, 400, 403, 404, 405 | domain capability: logistics | not yet test-assertion mapped |
| PATCH | `/tenants/:id/logistics/scheduling/:id/transition` | `handleLogisticsScheduling` | 3885/3338 | tenant-scoped session required; central permission/scope evaluator | scheduling:logistics:scheduling:view, scheduling:logistics:scheduling:request | tenant/chatId; location referenced; inspect handler conditions | locationId, location_id, idempotencyKey, idempotency_key, timezone, scheduledStart, scheduled_start, scheduledEnd, scheduled_end, status, targetStatus, target_status, expectedVersion, expected_version, reason | locationId, status, activityType | LOCATION_SCOPE_DENIED, IDEMPOTENCY_KEY_REQUIRED, SCHEDULING_ACTIVITY_NOT_FOUND, SCHEDULING_STATUS_REQUIRED, SCHEDULING_VERSION_REQUIRED | explicit key handling | explicit store transaction in createLogisticsSchedulingActivity, transitionLogisticsSchedulingActivity | getTenant, getOrganizationLocation, listLogisticsSchedulingActivities, getLogisticsSchedulingTimeZone, createLogisticsSchedulingActivity, getLogisticsSchedulingActivity, evaluateLogisticsSchedulingActivity, transitionLogisticsSchedulingActivity | 200, 400, 403, 404, 405 | domain capability: logistics | not yet test-assertion mapped |
| GET | `/tenants/:id/delivery-assignments` | `handleDeliveryAssignmentsList` | 3886/3443 | tenant-scoped session required; central permission/scope evaluator | logistics:logistics:deliveries:view | tenant/chatId; location referenced; inspect handler conditions |  | locationId, status, courierUserId |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, listDeliveryAssignments | 200, 404 | domain capability: logistics | not yet test-assertion mapped |
| GET | `/tenants/:id/orders/:id/delivery-assignment` | `handleDeliveryAssignment` | 3887/3461 | tenant-scoped session required; central permission/scope evaluator | logistics:logistics:deliveries:view, logistics:logistics:deliveries:update_assigned, dynamic/delegated | tenant/chatId; location referenced; inspect handler conditions | locationId, location_id, action, status, idempotencyKey, idempotency_key, courierUserId, courier_user_id |  | IDEMPOTENCY_KEY_REQUIRED | explicit key handling | explicit store transaction in transitionDeliveryAssignment, assignDeliveryCourier | getTenant, getDeliveryAssignment, assertCourierOwnsDelivery, transitionDeliveryAssignment, assignDeliveryCourier | 200, 400, 404 | domain capability: logistics | not yet test-assertion mapped |
| POST | `/tenants/:id/orders/:id/fulfillment` | `handleOrderFulfillment` | 3888/3792 | tenant-scoped session required; central permission/scope evaluator | fulfillment:fulfillment:view, logistics:logistics:deliveries:update_assigned, fulfillment:fulfillment:update | tenant/chatId; location referenced; inspect handler conditions | locationId, location_id, idempotencyKey, idempotency_key, status, nextStatus, next_status |  | IDEMPOTENCY_KEY_REQUIRED | explicit key handling | explicit store transaction in transitionOrderFulfillment | getTenant, getOrderFulfillment, assertCourierOwnsDelivery, transitionOrderFulfillment | 200, 400, 404, 405 | domain capability: fulfillment | not yet test-assertion mapped |
| GET | `/catalog/:id` | `handleCatalogGet` | 3889/1265 | public read endpoint |  | tenant/chatId; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, getCatalog | 200, 404 | domain capability: catalog | not yet test-assertion mapped |
| GET | `/tenants/:id/storefront-channels` | `handleSellerStorefrontChannelsGet` | 3890/495 | tenant-scoped session required; public storefront context/token validation; central permission/scope evaluator | seller_storefront_channels:settings:configure | tenant/chatId; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, getTelegramStorefrontConfig | 200 | domain capability: channel-configuration | not yet test-assertion mapped |
| GET | `/tenants/:id/storefront-consistency` | `handleCrossChannelConsistencyGet` | 3891/484 | tenant-scoped session required; public storefront context/token validation; central permission/scope evaluator | seller_storefront_channels:settings:configure | tenant/chatId; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, getTelegramStorefrontConfig | 200 | domain capability: channel-configuration | not yet test-assertion mapped |
| GET | `/tenants/:id/telegram-storefront` | `handleTelegramStorefrontGet` | 3892/504 | tenant-scoped session required; public storefront context/token validation; central permission/scope evaluator | telegram_storefront:settings:configure | tenant/chatId; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, getTelegramStorefrontConfig | 200 | domain capability: telegram-channel | not yet test-assertion mapped |
| GET | `/api/telegram-storefront/:id` | `handleTelegramStorefrontPublicGet` | 3893/460 | public storefront context/token validation |  | public tenant/resource; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, getTelegramStorefrontConfig | 200, 404 | domain capability: telegram-channel | not yet test-assertion mapped |
| POST | `/api/telegram-storefront/:id/buyer-session` | `handleTelegramStorefrontBuyerSession` | 3894/536 | Telegram buyer initData verified with configured bot secret; public storefront context/token validation |  | public tenant/resource; not detected | initData, init_data |  | TELEGRAM_CREDENTIAL_REQUIRED | not detected | delegated store transaction not detected by direct lexical scan | getTenant, getTelegramStorefrontConfig, recordAuditEvent | 200, 404, 409 | domain capability: telegram-channel | not yet test-assertion mapped |
| GET | `/api/telegram-storefront/:id/orders/:id/service-bookings` | `handleTelegramStorefrontServiceBookings` | 3895/691 | Telegram buyer initData verified with configured bot secret; public storefront context/token validation |  | tenant/chatId; not detected | idempotencyKey, idempotency_key, service_item_id, serviceItemId, requested_start, requestedStart, requested_end, requestedEnd, appointment_mode, appointmentMode, customer_note, customerNote |  | TELEGRAM_ORDER_STATUS_DISABLED, TELEGRAM_BUYER_AUTH_REQUIRED, IDEMPOTENCY_KEY_REQUIRED, SERVICE_BOOKING_ORDER_LINE_INVALID | explicit key handling | explicit store transaction in createServiceBooking | getTenant, getTelegramStorefrontConfig, getTelegramBuyerServiceBookings, createServiceBooking, recordAuditEvent | 200, 400, 401, 403, 404, 405, 409 | mixed: service-booking + telegram-channel | not yet test-assertion mapped |
| POST | `/api/telegram-storefront/:id/orders/:id/service-bookings` | `handleTelegramStorefrontServiceBookings` | 3896/691 | Telegram buyer initData verified with configured bot secret; public storefront context/token validation |  | tenant/chatId; not detected | idempotencyKey, idempotency_key, service_item_id, serviceItemId, requested_start, requestedStart, requested_end, requestedEnd, appointment_mode, appointmentMode, customer_note, customerNote |  | TELEGRAM_ORDER_STATUS_DISABLED, TELEGRAM_BUYER_AUTH_REQUIRED, IDEMPOTENCY_KEY_REQUIRED, SERVICE_BOOKING_ORDER_LINE_INVALID | explicit key handling | explicit store transaction in createServiceBooking | getTenant, getTelegramStorefrontConfig, getTelegramBuyerServiceBookings, createServiceBooking, recordAuditEvent | 200, 400, 401, 403, 404, 405, 409 | mixed: service-booking + telegram-channel | not yet test-assertion mapped |
| GET | `/api/telegram-storefront/:id/orders/:id/service-feasibility` | `handleTelegramStorefrontServiceFeasibility` | 3897/587 | Telegram buyer initData verified with configured bot secret; public storefront context/token validation |  | tenant/chatId; not detected |  | service_item_id, start, end | TELEGRAM_ORDER_STATUS_DISABLED, TELEGRAM_BUYER_AUTH_REQUIRED | not detected | delegated store transaction not detected by direct lexical scan | getTenant, getTelegramStorefrontConfig, assessTelegramBuyerServiceFeasibility | 200, 401, 403, 404 | mixed: service-booking + telegram-channel | not yet test-assertion mapped |
| POST | `/api/telegram-storefront/:id/orders/:id/service-bookings/:id/cancel` | `handleTelegramStorefrontServiceBookingCancel` | 3898/625 | Telegram buyer initData verified with configured bot secret; public storefront context/token validation |  | tenant/chatId; not detected | idempotencyKey, idempotency_key, expected_version, expectedVersion |  | TELEGRAM_ORDER_STATUS_DISABLED, TELEGRAM_BUYER_AUTH_REQUIRED, SERVICE_BOOKING_NOT_FOUND, IDEMPOTENCY_KEY_REQUIRED, SERVICE_BOOKING_VERSION_REQUIRED | explicit key handling | explicit store transaction in transitionServiceBooking | getTenant, getTelegramStorefrontConfig, getTelegramBuyerServiceBookings, transitionServiceBooking, recordAuditEvent | 200, 400, 401, 403, 404 | mixed: service-booking + telegram-channel | not yet test-assertion mapped |
| GET | `/api/telegram-storefront/:id/orders/:id/fulfillment` | `handleTelegramStorefrontFulfillment` | 3899/794 | Telegram buyer initData verified with configured bot secret; public storefront context/token validation |  | tenant/chatId; not detected |  |  | TELEGRAM_FULFILLMENT_DISABLED, TELEGRAM_BUYER_AUTH_REQUIRED | not detected | delegated store transaction not detected by direct lexical scan | getTenant, getTelegramStorefrontConfig, getTelegramBuyerFulfillmentExperience, recordAuditEvent | 200, 401, 403, 404 | mixed: fulfillment + telegram-channel | not yet test-assertion mapped |
| GET | `/api/telegram-storefront/:id/orders/:id` | `handleTelegramStorefrontOrder` | 3900/825 | public storefront context/token validation |  | tenant/chatId; not detected |  | token | TELEGRAM_ORDER_STATUS_DISABLED | not detected | delegated store transaction not detected by direct lexical scan | getTenant, getTelegramStorefrontConfig, getMarketplaceOrderTracking | 200, 400, 403, 404 | domain capability: telegram-channel | not yet test-assertion mapped |
| GET | `/api/telegram-storefront/:id/orders` | `handleTelegramStorefrontOrderHistory` | 3901/566 | Telegram buyer initData verified with configured bot secret; public storefront context/token validation |  | tenant/chatId; not detected |  |  | TELEGRAM_ORDER_STATUS_DISABLED, TELEGRAM_BUYER_AUTH_REQUIRED | not detected | delegated store transaction not detected by direct lexical scan | getTenant, getTelegramStorefrontConfig, listTelegramBuyerOrders, recordAuditEvent | 200, 401, 403, 404 | domain capability: telegram-channel | not yet test-assertion mapped |
| POST | `/tenants/:id/telegram-storefront/verify` | `handleTelegramStorefrontVerify` | 3902/514 | tenant-scoped session required; central permission/scope evaluator | telegram_storefront:settings:configure | tenant/chatId; not detected |  |  |  | not detected | explicit store transaction in verifyTelegramStorefront | getTenant, verifyTelegramStorefront | 200 | domain capability: telegram-channel | not yet test-assertion mapped |
| PATCH | `/tenants/:id/telegram-storefront` | `handleTelegramStorefrontPatch` | 3903/523 | tenant-scoped session required; central permission/scope evaluator | telegram_storefront:settings:configure | tenant/chatId; not detected | credentialRef |  | INVALID_CREDENTIAL_REF | not detected | explicit store transaction in upsertTelegramStorefrontConfig | getTenant, upsertTelegramStorefrontConfig | 200, 400 | domain capability: telegram-channel | not yet test-assertion mapped |
| POST | `/catalog/:id` | `handleCatalogPost` | 3904/1286 | tenant-scoped session required; owner-role gate | owner-role | tenant/chatId; not detected | products |  |  | not detected | explicit store transaction in saveCatalog | getTenant, saveCatalog, getCatalog | 200, 400, 404, 409 | domain capability: catalog | not yet test-assertion mapped |
| GET | `/tenants` | `handleTenantsList` | 3905/1343 | tenant-scoped session required | session-only at route; store-layer enforcement not yet fully expanded | tenant/chatId; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | listUserMemberships | 200 | domain capability: identity-tenant-infrastructure | not yet test-assertion mapped |
| GET | `/tenants/:id/customers` | `handleCustomersList` | 3906/1353 | tenant-scoped session required; central permission/scope evaluator | customers:customers:view | tenant/chatId; not detected |  | q, status, limit |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, listCustomers | 200, 404 | domain capability: customers | not yet test-assertion mapped |
| POST | `/tenants/:id/customers` | `handleCustomerCreate` | 3907/1377 | tenant-scoped session required; central permission/scope evaluator | customers:customers:manage | tenant/chatId; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, upsertCustomer | 201, 404 | domain capability: customers | not yet test-assertion mapped |
| GET | `/tenants/:id/customers/:id` | `handleCustomerGet` | 3908/1367 | tenant-scoped session required; central permission/scope evaluator | customers:customers:view | tenant/chatId; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, getCustomer | 200, 404 | domain capability: customers | not yet test-assertion mapped |
| PATCH | `/tenants/:id/customers/:id` | `handleCustomerPatch` | 3909/1387 | tenant-scoped session required; central permission/scope evaluator | customers:customers:manage | tenant/chatId; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, updateCustomer | 200, 404 | domain capability: customers | not yet test-assertion mapped |
| GET | `/tenants/:id/b2b/pricing` | `handleCustomerPricing` | 3910/1397 | tenant-scoped session required; central permission/scope evaluator | dynamic/delegated | tenant/chatId; not detected |  | customer_id, product_id, status, limit |  | not detected | explicit store transaction in upsertCustomerPricing | getTenant, getCustomerPricing, listCustomerPricing, updateCustomerPricing, upsertCustomerPricing | 200, 404 | domain capability: customers | not yet test-assertion mapped |
| POST | `/tenants/:id/b2b/pricing` | `handleCustomerPricing` | 3911/1397 | tenant-scoped session required; central permission/scope evaluator | dynamic/delegated | tenant/chatId; not detected |  | customer_id, product_id, status, limit |  | not detected | explicit store transaction in upsertCustomerPricing | getTenant, getCustomerPricing, listCustomerPricing, updateCustomerPricing, upsertCustomerPricing | 200, 404 | domain capability: customers | not yet test-assertion mapped |
| GET | `/tenants/:id/b2b/pricing/:id` | `handleCustomerPricing` | 3912/1397 | tenant-scoped session required; central permission/scope evaluator | dynamic/delegated | tenant/chatId; not detected |  | customer_id, product_id, status, limit |  | not detected | explicit store transaction in upsertCustomerPricing | getTenant, getCustomerPricing, listCustomerPricing, updateCustomerPricing, upsertCustomerPricing | 200, 404 | domain capability: customers | not yet test-assertion mapped |
| PATCH | `/tenants/:id/b2b/pricing/:id` | `handleCustomerPricing` | 3913/1397 | tenant-scoped session required; central permission/scope evaluator | dynamic/delegated | tenant/chatId; not detected |  | customer_id, product_id, status, limit |  | not detected | explicit store transaction in upsertCustomerPricing | getTenant, getCustomerPricing, listCustomerPricing, updateCustomerPricing, upsertCustomerPricing | 200, 404 | domain capability: customers | not yet test-assertion mapped |
| GET | `/tenants/:id/supplier-network/capabilities` | `handleSupplierNetworkCapabilities` | 3914/1420 | tenant-scoped session required; central permission/scope evaluator | supplier_network_capability:supplier-network:capability:view, dynamic/delegated | tenant/chatId; not detected | status | status, code, limit |  | not detected | explicit store transaction in upsertSupplierNetworkCapability | getTenant, getSupplierNetworkCapability, listSupplierNetworkCapabilities, transitionSupplierNetworkCapability, upsertSupplierNetworkCapability | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| POST | `/tenants/:id/supplier-network/capabilities` | `handleSupplierNetworkCapabilities` | 3915/1420 | tenant-scoped session required; central permission/scope evaluator | supplier_network_capability:supplier-network:capability:view, dynamic/delegated | tenant/chatId; not detected | status | status, code, limit |  | not detected | explicit store transaction in upsertSupplierNetworkCapability | getTenant, getSupplierNetworkCapability, listSupplierNetworkCapabilities, transitionSupplierNetworkCapability, upsertSupplierNetworkCapability | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| GET | `/tenants/:id/supplier-network/capabilities/:id` | `handleSupplierNetworkCapabilities` | 3916/1420 | tenant-scoped session required; central permission/scope evaluator | supplier_network_capability:supplier-network:capability:view, dynamic/delegated | tenant/chatId; not detected | status | status, code, limit |  | not detected | explicit store transaction in upsertSupplierNetworkCapability | getTenant, getSupplierNetworkCapability, listSupplierNetworkCapabilities, transitionSupplierNetworkCapability, upsertSupplierNetworkCapability | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| PATCH | `/tenants/:id/supplier-network/capabilities/:id` | `handleSupplierNetworkCapabilities` | 3917/1420 | tenant-scoped session required; central permission/scope evaluator | supplier_network_capability:supplier-network:capability:view, dynamic/delegated | tenant/chatId; not detected | status | status, code, limit |  | not detected | explicit store transaction in upsertSupplierNetworkCapability | getTenant, getSupplierNetworkCapability, listSupplierNetworkCapabilities, transitionSupplierNetworkCapability, upsertSupplierNetworkCapability | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| POST | `/tenants/:id/supplier-network/capabilities/:id/(activate|deactivate)` | `handleSupplierNetworkCapabilities` | 3918/1420 | tenant-scoped session required; central permission/scope evaluator | supplier_network_capability:supplier-network:capability:view, dynamic/delegated | tenant/chatId; not detected | status | status, code, limit |  | not detected | explicit store transaction in upsertSupplierNetworkCapability | getTenant, getSupplierNetworkCapability, listSupplierNetworkCapabilities, transitionSupplierNetworkCapability, upsertSupplierNetworkCapability | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| GET | `/tenants/:id/supplier-network/catalog` | `handleSupplierNetworkCatalog` | 3919/1452 | tenant-scoped session required; central permission/scope evaluator | supplier_network_catalog_listing:supplier-network:catalog:view, dynamic/delegated | tenant/chatId; not detected | status | status, productId, limit |  | not detected | explicit store transaction in upsertSupplierNetworkCatalogListing | getTenant, getSupplierNetworkCatalogListing, listSupplierNetworkCatalogListings, transitionSupplierNetworkCatalogListing, upsertSupplierNetworkCatalogListing | 200, 404, 405 | mixed: supplier-network + catalog | not yet test-assertion mapped |
| POST | `/tenants/:id/supplier-network/catalog` | `handleSupplierNetworkCatalog` | 3920/1452 | tenant-scoped session required; central permission/scope evaluator | supplier_network_catalog_listing:supplier-network:catalog:view, dynamic/delegated | tenant/chatId; not detected | status | status, productId, limit |  | not detected | explicit store transaction in upsertSupplierNetworkCatalogListing | getTenant, getSupplierNetworkCatalogListing, listSupplierNetworkCatalogListings, transitionSupplierNetworkCatalogListing, upsertSupplierNetworkCatalogListing | 200, 404, 405 | mixed: supplier-network + catalog | not yet test-assertion mapped |
| GET | `/tenants/:id/supplier-network/catalog/:id` | `handleSupplierNetworkCatalog` | 3921/1452 | tenant-scoped session required; central permission/scope evaluator | supplier_network_catalog_listing:supplier-network:catalog:view, dynamic/delegated | tenant/chatId; not detected | status | status, productId, limit |  | not detected | explicit store transaction in upsertSupplierNetworkCatalogListing | getTenant, getSupplierNetworkCatalogListing, listSupplierNetworkCatalogListings, transitionSupplierNetworkCatalogListing, upsertSupplierNetworkCatalogListing | 200, 404, 405 | mixed: supplier-network + catalog | not yet test-assertion mapped |
| PATCH | `/tenants/:id/supplier-network/catalog/:id` | `handleSupplierNetworkCatalog` | 3922/1452 | tenant-scoped session required; central permission/scope evaluator | supplier_network_catalog_listing:supplier-network:catalog:view, dynamic/delegated | tenant/chatId; not detected | status | status, productId, limit |  | not detected | explicit store transaction in upsertSupplierNetworkCatalogListing | getTenant, getSupplierNetworkCatalogListing, listSupplierNetworkCatalogListings, transitionSupplierNetworkCatalogListing, upsertSupplierNetworkCatalogListing | 200, 404, 405 | mixed: supplier-network + catalog | not yet test-assertion mapped |
| POST | `/tenants/:id/supplier-network/catalog/:id/(activate|deactivate)` | `handleSupplierNetworkCatalog` | 3923/1452 | tenant-scoped session required; central permission/scope evaluator | supplier_network_catalog_listing:supplier-network:catalog:view, dynamic/delegated | tenant/chatId; not detected | status | status, productId, limit |  | not detected | explicit store transaction in upsertSupplierNetworkCatalogListing | getTenant, getSupplierNetworkCatalogListing, listSupplierNetworkCatalogListings, transitionSupplierNetworkCatalogListing, upsertSupplierNetworkCatalogListing | 200, 404, 405 | mixed: supplier-network + catalog | not yet test-assertion mapped |
| GET | `/tenants/:id/supplier-network/qualifications` | `handleSupplierNetworkQualifications` | 3924/1477 | tenant-scoped session required; central permission/scope evaluator | supplier_network_qualification:supplier-network:qualification:view, dynamic/delegated | tenant/chatId; not detected | status | status, qualificationType, limit |  | not detected | explicit store transaction in upsertSupplierNetworkQualification | getTenant, getSupplierNetworkQualification, listSupplierNetworkQualifications, transitionSupplierNetworkQualification, upsertSupplierNetworkQualification | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| POST | `/tenants/:id/supplier-network/qualifications` | `handleSupplierNetworkQualifications` | 3925/1477 | tenant-scoped session required; central permission/scope evaluator | supplier_network_qualification:supplier-network:qualification:view, dynamic/delegated | tenant/chatId; not detected | status | status, qualificationType, limit |  | not detected | explicit store transaction in upsertSupplierNetworkQualification | getTenant, getSupplierNetworkQualification, listSupplierNetworkQualifications, transitionSupplierNetworkQualification, upsertSupplierNetworkQualification | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| GET | `/tenants/:id/supplier-network/qualifications/:id` | `handleSupplierNetworkQualifications` | 3926/1477 | tenant-scoped session required; central permission/scope evaluator | supplier_network_qualification:supplier-network:qualification:view, dynamic/delegated | tenant/chatId; not detected | status | status, qualificationType, limit |  | not detected | explicit store transaction in upsertSupplierNetworkQualification | getTenant, getSupplierNetworkQualification, listSupplierNetworkQualifications, transitionSupplierNetworkQualification, upsertSupplierNetworkQualification | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| PATCH | `/tenants/:id/supplier-network/qualifications/:id` | `handleSupplierNetworkQualifications` | 3927/1477 | tenant-scoped session required; central permission/scope evaluator | supplier_network_qualification:supplier-network:qualification:view, dynamic/delegated | tenant/chatId; not detected | status | status, qualificationType, limit |  | not detected | explicit store transaction in upsertSupplierNetworkQualification | getTenant, getSupplierNetworkQualification, listSupplierNetworkQualifications, transitionSupplierNetworkQualification, upsertSupplierNetworkQualification | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| POST | `/tenants/:id/supplier-network/qualifications/:id/(verify|document|revoke)` | `handleSupplierNetworkQualifications` | 3928/1477 | tenant-scoped session required; central permission/scope evaluator | supplier_network_qualification:supplier-network:qualification:view, dynamic/delegated | tenant/chatId; not detected | status | status, qualificationType, limit |  | not detected | explicit store transaction in upsertSupplierNetworkQualification | getTenant, getSupplierNetworkQualification, listSupplierNetworkQualifications, transitionSupplierNetworkQualification, upsertSupplierNetworkQualification | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| GET | `/tenants/:id/supplier-network/commercial-terms` | `handleSupplierNetworkCommercialTerms` | 3929/1485 | tenant-scoped session required; central permission/scope evaluator | supplier_network_commercial_terms:supplier-network:commercial:view, dynamic/delegated | tenant/chatId; not detected | status | status, subjectType, subjectId, limit |  | not detected | explicit store transaction in upsertSupplierNetworkCommercialTerms | getTenant, getSupplierNetworkCommercialTerms, listSupplierNetworkCommercialTerms, transitionSupplierNetworkCommercialTerms, upsertSupplierNetworkCommercialTerms | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| POST | `/tenants/:id/supplier-network/commercial-terms` | `handleSupplierNetworkCommercialTerms` | 3930/1485 | tenant-scoped session required; central permission/scope evaluator | supplier_network_commercial_terms:supplier-network:commercial:view, dynamic/delegated | tenant/chatId; not detected | status | status, subjectType, subjectId, limit |  | not detected | explicit store transaction in upsertSupplierNetworkCommercialTerms | getTenant, getSupplierNetworkCommercialTerms, listSupplierNetworkCommercialTerms, transitionSupplierNetworkCommercialTerms, upsertSupplierNetworkCommercialTerms | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| GET | `/tenants/:id/supplier-network/commercial-terms/:id` | `handleSupplierNetworkCommercialTerms` | 3931/1485 | tenant-scoped session required; central permission/scope evaluator | supplier_network_commercial_terms:supplier-network:commercial:view, dynamic/delegated | tenant/chatId; not detected | status | status, subjectType, subjectId, limit |  | not detected | explicit store transaction in upsertSupplierNetworkCommercialTerms | getTenant, getSupplierNetworkCommercialTerms, listSupplierNetworkCommercialTerms, transitionSupplierNetworkCommercialTerms, upsertSupplierNetworkCommercialTerms | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| PATCH | `/tenants/:id/supplier-network/commercial-terms/:id` | `handleSupplierNetworkCommercialTerms` | 3932/1485 | tenant-scoped session required; central permission/scope evaluator | supplier_network_commercial_terms:supplier-network:commercial:view, dynamic/delegated | tenant/chatId; not detected | status | status, subjectType, subjectId, limit |  | not detected | explicit store transaction in upsertSupplierNetworkCommercialTerms | getTenant, getSupplierNetworkCommercialTerms, listSupplierNetworkCommercialTerms, transitionSupplierNetworkCommercialTerms, upsertSupplierNetworkCommercialTerms | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| POST | `/tenants/:id/supplier-network/commercial-terms/:id/(activate|deactivate)` | `handleSupplierNetworkCommercialTerms` | 3933/1485 | tenant-scoped session required; central permission/scope evaluator | supplier_network_commercial_terms:supplier-network:commercial:view, dynamic/delegated | tenant/chatId; not detected | status | status, subjectType, subjectId, limit |  | not detected | explicit store transaction in upsertSupplierNetworkCommercialTerms | getTenant, getSupplierNetworkCommercialTerms, listSupplierNetworkCommercialTerms, transitionSupplierNetworkCommercialTerms, upsertSupplierNetworkCommercialTerms | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| GET | `/tenants/:id/supplier-network/capacities` | `handleSupplierNetworkCapacities` | 3934/1493 | tenant-scoped session required; central permission/scope evaluator | supplier_network_capacity:supplier-network:capacity:view, dynamic/delegated | tenant/chatId; not detected | status | status, subjectType, subjectId, availability, limit |  | not detected | explicit store transaction in upsertSupplierNetworkCapacity | getTenant, getSupplierNetworkCapacity, listSupplierNetworkCapacities, transitionSupplierNetworkCapacity, upsertSupplierNetworkCapacity | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| POST | `/tenants/:id/supplier-network/capacities` | `handleSupplierNetworkCapacities` | 3935/1493 | tenant-scoped session required; central permission/scope evaluator | supplier_network_capacity:supplier-network:capacity:view, dynamic/delegated | tenant/chatId; not detected | status | status, subjectType, subjectId, availability, limit |  | not detected | explicit store transaction in upsertSupplierNetworkCapacity | getTenant, getSupplierNetworkCapacity, listSupplierNetworkCapacities, transitionSupplierNetworkCapacity, upsertSupplierNetworkCapacity | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| GET | `/tenants/:id/supplier-network/capacities/:id` | `handleSupplierNetworkCapacities` | 3936/1493 | tenant-scoped session required; central permission/scope evaluator | supplier_network_capacity:supplier-network:capacity:view, dynamic/delegated | tenant/chatId; not detected | status | status, subjectType, subjectId, availability, limit |  | not detected | explicit store transaction in upsertSupplierNetworkCapacity | getTenant, getSupplierNetworkCapacity, listSupplierNetworkCapacities, transitionSupplierNetworkCapacity, upsertSupplierNetworkCapacity | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| PATCH | `/tenants/:id/supplier-network/capacities/:id` | `handleSupplierNetworkCapacities` | 3937/1493 | tenant-scoped session required; central permission/scope evaluator | supplier_network_capacity:supplier-network:capacity:view, dynamic/delegated | tenant/chatId; not detected | status | status, subjectType, subjectId, availability, limit |  | not detected | explicit store transaction in upsertSupplierNetworkCapacity | getTenant, getSupplierNetworkCapacity, listSupplierNetworkCapacities, transitionSupplierNetworkCapacity, upsertSupplierNetworkCapacity | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| POST | `/tenants/:id/supplier-network/capacities/:id/(activate|deactivate)` | `handleSupplierNetworkCapacities` | 3938/1493 | tenant-scoped session required; central permission/scope evaluator | supplier_network_capacity:supplier-network:capacity:view, dynamic/delegated | tenant/chatId; not detected | status | status, subjectType, subjectId, availability, limit |  | not detected | explicit store transaction in upsertSupplierNetworkCapacity | getTenant, getSupplierNetworkCapacity, listSupplierNetworkCapacities, transitionSupplierNetworkCapacity, upsertSupplierNetworkCapacity | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| GET | `/tenants/:id/supplier-network/service-areas` | `handleSupplierNetworkServiceAreas` | 3939/1501 | tenant-scoped session required; central permission/scope evaluator | supplier_network_service_area:supplier-network:service-area:view, dynamic/delegated | tenant/chatId; not detected | status | status, scopeType, countryCode, geoCode, limit |  | not detected | explicit store transaction in upsertSupplierNetworkServiceArea | getTenant, getSupplierNetworkServiceArea, listSupplierNetworkServiceAreas, transitionSupplierNetworkServiceArea, upsertSupplierNetworkServiceArea | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| POST | `/tenants/:id/supplier-network/service-areas` | `handleSupplierNetworkServiceAreas` | 3940/1501 | tenant-scoped session required; central permission/scope evaluator | supplier_network_service_area:supplier-network:service-area:view, dynamic/delegated | tenant/chatId; not detected | status | status, scopeType, countryCode, geoCode, limit |  | not detected | explicit store transaction in upsertSupplierNetworkServiceArea | getTenant, getSupplierNetworkServiceArea, listSupplierNetworkServiceAreas, transitionSupplierNetworkServiceArea, upsertSupplierNetworkServiceArea | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| GET | `/tenants/:id/supplier-network/service-areas/:id` | `handleSupplierNetworkServiceAreas` | 3941/1501 | tenant-scoped session required; central permission/scope evaluator | supplier_network_service_area:supplier-network:service-area:view, dynamic/delegated | tenant/chatId; not detected | status | status, scopeType, countryCode, geoCode, limit |  | not detected | explicit store transaction in upsertSupplierNetworkServiceArea | getTenant, getSupplierNetworkServiceArea, listSupplierNetworkServiceAreas, transitionSupplierNetworkServiceArea, upsertSupplierNetworkServiceArea | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| PATCH | `/tenants/:id/supplier-network/service-areas/:id` | `handleSupplierNetworkServiceAreas` | 3942/1501 | tenant-scoped session required; central permission/scope evaluator | supplier_network_service_area:supplier-network:service-area:view, dynamic/delegated | tenant/chatId; not detected | status | status, scopeType, countryCode, geoCode, limit |  | not detected | explicit store transaction in upsertSupplierNetworkServiceArea | getTenant, getSupplierNetworkServiceArea, listSupplierNetworkServiceAreas, transitionSupplierNetworkServiceArea, upsertSupplierNetworkServiceArea | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| POST | `/tenants/:id/supplier-network/service-areas/:id/(activate|deactivate)` | `handleSupplierNetworkServiceAreas` | 3943/1501 | tenant-scoped session required; central permission/scope evaluator | supplier_network_service_area:supplier-network:service-area:view, dynamic/delegated | tenant/chatId; not detected | status | status, scopeType, countryCode, geoCode, limit |  | not detected | explicit store transaction in upsertSupplierNetworkServiceArea | getTenant, getSupplierNetworkServiceArea, listSupplierNetworkServiceAreas, transitionSupplierNetworkServiceArea, upsertSupplierNetworkServiceArea | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| GET | `/tenants/:id/supplier-network/trust` | `handleSupplierNetworkTrust` | 3944/1526 | tenant-scoped session required; central permission/scope evaluator | supplier_network_trust:supplier-network:trust:view, supplier_network_trust:supplier-network:trust:refresh | tenant/chatId; not detected | supplierOrganizationId, supplier_organization_id | supplierOrganizationId, evidenceType, limit |  | not detected | explicit store transaction in refreshSupplierNetworkTrustEvidence | getTenant, listSupplierNetworkTrustEvidence, refreshSupplierNetworkTrustEvidence | 200, 400, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| GET | `/tenants/:id/supplier-network/marketplace-integration(?:/:id)?` | `handleSupplierNetworkMarketplaceIntegration` | 3945/1514 | tenant-scoped session required; central permission/scope evaluator | supplier_network_marketplace_integration:supplier-network:marketplace-integration:view | tenant/chatId; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, getSupplierNetworkMarketplaceIntegration | 200, 404, 405 | mixed: supplier-network + marketplace | not yet test-assertion mapped |
| GET | `/tenants/:id/supplier-network/discovery` | `handleSupplierNetworkDiscovery` | 3946/1516 | tenant-scoped session required; central permission/scope evaluator | supplier_network_discovery:supplier-network:discovery:discover | tenant/chatId; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, discoverSupplierNetwork | 200, 404, 405 | mixed: supplier-network + discovery | not yet test-assertion mapped |
| POST | `/tenants/:id/supplier-network/discovery` | `handleSupplierNetworkDiscovery` | 3947/1516 | tenant-scoped session required; central permission/scope evaluator | supplier_network_discovery:supplier-network:discovery:discover | tenant/chatId; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, discoverSupplierNetwork | 200, 404, 405 | mixed: supplier-network + discovery | not yet test-assertion mapped |
| POST | `/tenants/:id/supplier-network/trust/:id/refresh` | `handleSupplierNetworkTrust` | 3948/1526 | tenant-scoped session required; central permission/scope evaluator | supplier_network_trust:supplier-network:trust:view, supplier_network_trust:supplier-network:trust:refresh | tenant/chatId; not detected | supplierOrganizationId, supplier_organization_id | supplierOrganizationId, evidenceType, limit |  | not detected | explicit store transaction in refreshSupplierNetworkTrustEvidence | getTenant, listSupplierNetworkTrustEvidence, refreshSupplierNetworkTrustEvidence | 200, 400, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| GET | `/tenants/:id/supplier-network/trust/:id` | `handleSupplierNetworkTrust` | 3949/1526 | tenant-scoped session required; central permission/scope evaluator | supplier_network_trust:supplier-network:trust:view, supplier_network_trust:supplier-network:trust:refresh | tenant/chatId; not detected | supplierOrganizationId, supplier_organization_id | supplierOrganizationId, evidenceType, limit |  | not detected | explicit store transaction in refreshSupplierNetworkTrustEvidence | getTenant, listSupplierNetworkTrustEvidence, refreshSupplierNetworkTrustEvidence | 200, 400, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| GET | `/tenants/:id/supplier-network/performance` | `handleSupplierNetworkPerformance` | 3950/1533 | tenant-scoped session required; central permission/scope evaluator | supplier_network_performance:supplier-network:performance:view, supplier_network_performance:supplier-network:performance:recalculate | tenant/chatId; not detected | supplierOrganizationId, supplier_organization_id | supplierOrganizationId, metricType, limit |  | not detected | explicit store transaction in recalculateSupplierNetworkPerformance | getTenant, getSupplierNetworkPerformance, listSupplierNetworkPerformance, recalculateSupplierNetworkPerformance | 200, 400, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| POST | `/tenants/:id/supplier-network/performance/:id/recalculate` | `handleSupplierNetworkPerformance` | 3951/1533 | tenant-scoped session required; central permission/scope evaluator | supplier_network_performance:supplier-network:performance:view, supplier_network_performance:supplier-network:performance:recalculate | tenant/chatId; not detected | supplierOrganizationId, supplier_organization_id | supplierOrganizationId, metricType, limit |  | not detected | explicit store transaction in recalculateSupplierNetworkPerformance | getTenant, getSupplierNetworkPerformance, listSupplierNetworkPerformance, recalculateSupplierNetworkPerformance | 200, 400, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| GET | `/tenants/:id/supplier-network/performance/:id` | `handleSupplierNetworkPerformance` | 3952/1533 | tenant-scoped session required; central permission/scope evaluator | supplier_network_performance:supplier-network:performance:view, supplier_network_performance:supplier-network:performance:recalculate | tenant/chatId; not detected | supplierOrganizationId, supplier_organization_id | supplierOrganizationId, metricType, limit |  | not detected | explicit store transaction in recalculateSupplierNetworkPerformance | getTenant, getSupplierNetworkPerformance, listSupplierNetworkPerformance, recalculateSupplierNetworkPerformance | 200, 400, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| GET | `/tenants/:id/supplier-network/profile` | `handleSupplierNetworkProfile` | 3953/1540 | tenant-scoped session required; central permission/scope evaluator | supplier_network_profile:supplier-network:view, dynamic/delegated | tenant/chatId; not detected | status |  |  | not detected | explicit store transaction in upsertSupplierNetworkProfile | getTenant, getSupplierNetworkProfile, transitionSupplierNetworkProfile, upsertSupplierNetworkProfile | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| POST | `/tenants/:id/supplier-network/profile` | `handleSupplierNetworkProfile` | 3954/1540 | tenant-scoped session required; central permission/scope evaluator | supplier_network_profile:supplier-network:view, dynamic/delegated | tenant/chatId; not detected | status |  |  | not detected | explicit store transaction in upsertSupplierNetworkProfile | getTenant, getSupplierNetworkProfile, transitionSupplierNetworkProfile, upsertSupplierNetworkProfile | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| PATCH | `/tenants/:id/supplier-network/profile` | `handleSupplierNetworkProfile` | 3955/1540 | tenant-scoped session required; central permission/scope evaluator | supplier_network_profile:supplier-network:view, dynamic/delegated | tenant/chatId; not detected | status |  |  | not detected | explicit store transaction in upsertSupplierNetworkProfile | getTenant, getSupplierNetworkProfile, transitionSupplierNetworkProfile, upsertSupplierNetworkProfile | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| POST | `/tenants/:id/supplier-network/profile/(publish|suspend|draft)` | `handleSupplierNetworkProfile` | 3956/1540 | tenant-scoped session required; central permission/scope evaluator | supplier_network_profile:supplier-network:view, dynamic/delegated | tenant/chatId; not detected | status |  |  | not detected | explicit store transaction in upsertSupplierNetworkProfile | getTenant, getSupplierNetworkProfile, transitionSupplierNetworkProfile, upsertSupplierNetworkProfile | 200, 404, 405 | domain capability: supplier-network | not yet test-assertion mapped |
| GET | `/tenants/:id/procurement/supplier-relationships` | `handleProcurementSupplierRelationships` | 3957/1671 | tenant-scoped session required; central permission/scope evaluator | procurement_supplier_relationship:procurement:supplier:relationship:view, procurement_supplier_relationship:procurement:supplier:relationship:manage | tenant/chatId; not detected | reason | direction, status, limit |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, listProcurementSupplierRelationships, createProcurementSupplierRelationship, transitionProcurementSupplierRelationship | 200, 201, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| POST | `/tenants/:id/procurement/supplier-relationships` | `handleProcurementSupplierRelationships` | 3958/1671 | tenant-scoped session required; central permission/scope evaluator | procurement_supplier_relationship:procurement:supplier:relationship:view, procurement_supplier_relationship:procurement:supplier:relationship:manage | tenant/chatId; not detected | reason | direction, status, limit |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, listProcurementSupplierRelationships, createProcurementSupplierRelationship, transitionProcurementSupplierRelationship | 200, 201, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| POST | `/tenants/:id/procurement/supplier-relationships/:id/(active|declined|blocked|suspended)` | `handleProcurementSupplierRelationships` | 3959/1671 | tenant-scoped session required; central permission/scope evaluator | procurement_supplier_relationship:procurement:supplier:relationship:view, procurement_supplier_relationship:procurement:supplier:relationship:manage | tenant/chatId; not detected | reason | direction, status, limit |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, listProcurementSupplierRelationships, createProcurementSupplierRelationship, transitionProcurementSupplierRelationship | 200, 201, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/procurement/rfqs` | `handleProcurementRfqs` | 3960/1620 | tenant-scoped session required; central permission/scope evaluator | procurement_rfq:procurement:rfq:view, procurement_rfq:procurement:rfq:create, dynamic/delegated | tenant/chatId; not detected | reason | status, demand_id, limit |  | not detected | explicit store transaction in createProcurementRfq, transitionProcurementRfq | getTenant, listProcurementRfqs, createProcurementRfq, transitionProcurementRfq | 200, 201, 400, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| POST | `/tenants/:id/procurement/rfqs` | `handleProcurementRfqs` | 3961/1620 | tenant-scoped session required; central permission/scope evaluator | procurement_rfq:procurement:rfq:view, procurement_rfq:procurement:rfq:create, dynamic/delegated | tenant/chatId; not detected | reason | status, demand_id, limit |  | not detected | explicit store transaction in createProcurementRfq, transitionProcurementRfq | getTenant, listProcurementRfqs, createProcurementRfq, transitionProcurementRfq | 200, 201, 400, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/procurement/rfqs/:id` | `handleProcurementRfqs` | 3962/1620 | tenant-scoped session required; central permission/scope evaluator | procurement_rfq:procurement:rfq:view, procurement_rfq:procurement:rfq:create, dynamic/delegated | tenant/chatId; not detected | reason | status, demand_id, limit |  | not detected | explicit store transaction in createProcurementRfq, transitionProcurementRfq | getTenant, listProcurementRfqs, createProcurementRfq, transitionProcurementRfq | 200, 201, 400, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| POST | `/tenants/:id/procurement/rfqs/:id/(send|close|cancel)` | `handleProcurementRfqs` | 3963/1620 | tenant-scoped session required; central permission/scope evaluator | procurement_rfq:procurement:rfq:view, procurement_rfq:procurement:rfq:create, dynamic/delegated | tenant/chatId; not detected | reason | status, demand_id, limit |  | not detected | explicit store transaction in createProcurementRfq, transitionProcurementRfq | getTenant, listProcurementRfqs, createProcurementRfq, transitionProcurementRfq | 200, 201, 400, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| POST | `/tenants/:id/procurement/rfqs/:id/responses` | `handleProcurementRfqResponses` | 3964/1656 | tenant-scoped session required; central permission/scope evaluator | procurement_rfq:procurement:rfq:respond | tenant/chatId; not detected |  |  |  | not detected | explicit store transaction in createProcurementRfqResponse, transitionProcurementRfqResponse | getTenant, createProcurementRfqResponse, transitionProcurementRfqResponse | 200, 201, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| POST | `/tenants/:id/procurement/rfqs/:id/responses/:id/submit` | `handleProcurementRfqResponses` | 3965/1656 | tenant-scoped session required; central permission/scope evaluator | procurement_rfq:procurement:rfq:respond | tenant/chatId; not detected |  |  |  | not detected | explicit store transaction in createProcurementRfqResponse, transitionProcurementRfqResponse | getTenant, createProcurementRfqResponse, transitionProcurementRfqResponse | 200, 201, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/procurement/awards` | `handleProcurementAwards` | 3966/1693 | tenant-scoped session required; central permission/scope evaluator | procurement_award:procurement:award:view, procurement_award:procurement:award:create, dynamic/delegated | tenant/chatId; not detected | reason | demand_id, rfq_id, status, limit |  | not detected | explicit store transaction in createProcurementAward, transitionProcurementAward | getTenant, getProcurementAward, listProcurementAwards, createProcurementAward, transitionProcurementAward | 200, 201, 400, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| POST | `/tenants/:id/procurement/awards` | `handleProcurementAwards` | 3967/1693 | tenant-scoped session required; central permission/scope evaluator | procurement_award:procurement:award:view, procurement_award:procurement:award:create, dynamic/delegated | tenant/chatId; not detected | reason | demand_id, rfq_id, status, limit |  | not detected | explicit store transaction in createProcurementAward, transitionProcurementAward | getTenant, getProcurementAward, listProcurementAwards, createProcurementAward, transitionProcurementAward | 200, 201, 400, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/procurement/awards/:id` | `handleProcurementAwards` | 3968/1693 | tenant-scoped session required; central permission/scope evaluator | procurement_award:procurement:award:view, procurement_award:procurement:award:create, dynamic/delegated | tenant/chatId; not detected | reason | demand_id, rfq_id, status, limit |  | not detected | explicit store transaction in createProcurementAward, transitionProcurementAward | getTenant, getProcurementAward, listProcurementAwards, createProcurementAward, transitionProcurementAward | 200, 201, 400, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| POST | `/tenants/:id/procurement/awards/:id/(confirm|cancel)` | `handleProcurementAwards` | 3969/1693 | tenant-scoped session required; central permission/scope evaluator | procurement_award:procurement:award:view, procurement_award:procurement:award:create, dynamic/delegated | tenant/chatId; not detected | reason | demand_id, rfq_id, status, limit |  | not detected | explicit store transaction in createProcurementAward, transitionProcurementAward | getTenant, getProcurementAward, listProcurementAwards, createProcurementAward, transitionProcurementAward | 200, 201, 400, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/procurement/comparisons` | `handleProcurementComparisons` | 3970/1727 | tenant-scoped session required; central permission/scope evaluator | dynamic/delegated | tenant/chatId; not detected | rfqId, rfq_id | rfq_id, limit |  | not detected | explicit store transaction in createProcurementComparison | getTenant, getProcurementComparison, listProcurementComparisons, createProcurementComparison | 200, 201, 400, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| POST | `/tenants/:id/procurement/comparisons` | `handleProcurementComparisons` | 3971/1727 | tenant-scoped session required; central permission/scope evaluator | dynamic/delegated | tenant/chatId; not detected | rfqId, rfq_id | rfq_id, limit |  | not detected | explicit store transaction in createProcurementComparison | getTenant, getProcurementComparison, listProcurementComparisons, createProcurementComparison | 200, 201, 400, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/procurement/comparisons/:id` | `handleProcurementComparisons` | 3972/1727 | tenant-scoped session required; central permission/scope evaluator | dynamic/delegated | tenant/chatId; not detected | rfqId, rfq_id | rfq_id, limit |  | not detected | explicit store transaction in createProcurementComparison | getTenant, getProcurementComparison, listProcurementComparisons, createProcurementComparison | 200, 201, 400, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/procurement/demands` | `handleProcurementDemands` | 3973/1566 | tenant-scoped session required; central permission/scope evaluator | procurement_demand:procurement:demand:view, procurement_demand:procurement:demand:create, procurement_demand:procurement:demand:manage, dynamic/delegated | tenant/chatId; not detected | reason | status, requester_id, limit |  | not detected | explicit store transaction in createProcurementDemand, updateProcurementDemand, transitionProcurementDemand | getTenant, getProcurementDemand, listProcurementDemands, createProcurementDemand, updateProcurementDemand, transitionProcurementDemand | 200, 201, 400, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| POST | `/tenants/:id/procurement/demands` | `handleProcurementDemands` | 3974/1566 | tenant-scoped session required; central permission/scope evaluator | procurement_demand:procurement:demand:view, procurement_demand:procurement:demand:create, procurement_demand:procurement:demand:manage, dynamic/delegated | tenant/chatId; not detected | reason | status, requester_id, limit |  | not detected | explicit store transaction in createProcurementDemand, updateProcurementDemand, transitionProcurementDemand | getTenant, getProcurementDemand, listProcurementDemands, createProcurementDemand, updateProcurementDemand, transitionProcurementDemand | 200, 201, 400, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/procurement/demands/:id` | `handleProcurementDemands` | 3975/1566 | tenant-scoped session required; central permission/scope evaluator | procurement_demand:procurement:demand:view, procurement_demand:procurement:demand:create, procurement_demand:procurement:demand:manage, dynamic/delegated | tenant/chatId; not detected | reason | status, requester_id, limit |  | not detected | explicit store transaction in createProcurementDemand, updateProcurementDemand, transitionProcurementDemand | getTenant, getProcurementDemand, listProcurementDemands, createProcurementDemand, updateProcurementDemand, transitionProcurementDemand | 200, 201, 400, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| PATCH | `/tenants/:id/procurement/demands/:id` | `handleProcurementDemands` | 3976/1566 | tenant-scoped session required; central permission/scope evaluator | procurement_demand:procurement:demand:view, procurement_demand:procurement:demand:create, procurement_demand:procurement:demand:manage, dynamic/delegated | tenant/chatId; not detected | reason | status, requester_id, limit |  | not detected | explicit store transaction in createProcurementDemand, updateProcurementDemand, transitionProcurementDemand | getTenant, getProcurementDemand, listProcurementDemands, createProcurementDemand, updateProcurementDemand, transitionProcurementDemand | 200, 201, 400, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| POST | `/tenants/:id/procurement/demands/:id/submit` | `handleProcurementDemands` | 3977/1566 | tenant-scoped session required; central permission/scope evaluator | procurement_demand:procurement:demand:view, procurement_demand:procurement:demand:create, procurement_demand:procurement:demand:manage, dynamic/delegated | tenant/chatId; not detected | reason | status, requester_id, limit |  | not detected | explicit store transaction in createProcurementDemand, updateProcurementDemand, transitionProcurementDemand | getTenant, getProcurementDemand, listProcurementDemands, createProcurementDemand, updateProcurementDemand, transitionProcurementDemand | 200, 201, 400, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| POST | `/tenants/:id/procurement/demands/:id/cancel` | `handleProcurementDemands` | 3978/1566 | tenant-scoped session required; central permission/scope evaluator | procurement_demand:procurement:demand:view, procurement_demand:procurement:demand:create, procurement_demand:procurement:demand:manage, dynamic/delegated | tenant/chatId; not detected | reason | status, requester_id, limit |  | not detected | explicit store transaction in createProcurementDemand, updateProcurementDemand, transitionProcurementDemand | getTenant, getProcurementDemand, listProcurementDemands, createProcurementDemand, updateProcurementDemand, transitionProcurementDemand | 200, 201, 400, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| POST | `/tenants/:id/procurement/demands/:id/start-sourcing` | `handleProcurementDemands` | 3979/1566 | tenant-scoped session required; central permission/scope evaluator | procurement_demand:procurement:demand:view, procurement_demand:procurement:demand:create, procurement_demand:procurement:demand:manage, dynamic/delegated | tenant/chatId; not detected | reason | status, requester_id, limit |  | not detected | explicit store transaction in createProcurementDemand, updateProcurementDemand, transitionProcurementDemand | getTenant, getProcurementDemand, listProcurementDemands, createProcurementDemand, updateProcurementDemand, transitionProcurementDemand | 200, 201, 400, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/b2b/quotes` | `handleB2BQuotes` | 3980/1753 | tenant-scoped session required; central permission/scope evaluator | dynamic/delegated | tenant/chatId; not detected | status, state, reason | customer_id, status, limit |  | not detected | explicit store transaction in createQuote | getTenant, getQuote, listQuotes, createQuote, transitionQuote | 200, 201, 400, 404 | domain capability: procurement | not yet test-assertion mapped |
| POST | `/tenants/:id/b2b/quotes` | `handleB2BQuotes` | 3981/1753 | tenant-scoped session required; central permission/scope evaluator | dynamic/delegated | tenant/chatId; not detected | status, state, reason | customer_id, status, limit |  | not detected | explicit store transaction in createQuote | getTenant, getQuote, listQuotes, createQuote, transitionQuote | 200, 201, 400, 404 | domain capability: procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/b2b/quotes/:id` | `handleB2BQuotes` | 3982/1753 | tenant-scoped session required; central permission/scope evaluator | dynamic/delegated | tenant/chatId; not detected | status, state, reason | customer_id, status, limit |  | not detected | explicit store transaction in createQuote | getTenant, getQuote, listQuotes, createQuote, transitionQuote | 200, 201, 400, 404 | domain capability: procurement | not yet test-assertion mapped |
| PATCH | `/tenants/:id/b2b/quotes/:id` | `handleB2BQuotes` | 3983/1753 | tenant-scoped session required; central permission/scope evaluator | dynamic/delegated | tenant/chatId; not detected | status, state, reason | customer_id, status, limit |  | not detected | explicit store transaction in createQuote | getTenant, getQuote, listQuotes, createQuote, transitionQuote | 200, 201, 400, 404 | domain capability: procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/procurement/receipts` | `handleProcurementReceipts` | 3984/1813 | tenant-scoped session required; central permission/scope evaluator | procurement_receipt:procurement:receipt:view, procurement_receipt:procurement:receipt:create | tenant/chatId; not detected |  | purchase_order_id, status, limit |  | not detected | explicit store transaction in createProcurementReceipt | getTenant, getProcurementReceipt, listProcurementReceipts, createProcurementReceipt | 200, 201, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/procurement/receipts/:id` | `handleProcurementReceipts` | 3985/1813 | tenant-scoped session required; central permission/scope evaluator | procurement_receipt:procurement:receipt:view, procurement_receipt:procurement:receipt:create | tenant/chatId; not detected |  | purchase_order_id, status, limit |  | not detected | explicit store transaction in createProcurementReceipt | getTenant, getProcurementReceipt, listProcurementReceipts, createProcurementReceipt | 200, 201, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/procurement/purchase-orders/:id/receipts` | `handleProcurementReceipts` | 3986/1813 | tenant-scoped session required; central permission/scope evaluator | procurement_receipt:procurement:receipt:view, procurement_receipt:procurement:receipt:create | tenant/chatId; not detected |  | purchase_order_id, status, limit |  | not detected | explicit store transaction in createProcurementReceipt | getTenant, getProcurementReceipt, listProcurementReceipts, createProcurementReceipt | 200, 201, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| POST | `/tenants/:id/procurement/purchase-orders/:id/receipts` | `handleProcurementReceipts` | 3987/1813 | tenant-scoped session required; central permission/scope evaluator | procurement_receipt:procurement:receipt:view, procurement_receipt:procurement:receipt:create | tenant/chatId; not detected |  | purchase_order_id, status, limit |  | not detected | explicit store transaction in createProcurementReceipt | getTenant, getProcurementReceipt, listProcurementReceipts, createProcurementReceipt | 200, 201, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/b2b/purchase-orders` | `handleB2BPurchaseOrders` | 3988/1780 | tenant-scoped session required; central permission/scope evaluator | b2b_purchase_orders:b2b:po:view, b2b_purchase_orders:b2b:po:create, procurement_execution:procurement:award:execute, dynamic/delegated | tenant/chatId; not detected | sourceType, source_type, status, state, reason | customer_id, status, limit |  | not detected | explicit store transaction in createPurchaseOrder | getTenant, getPurchaseOrder, listPurchaseOrders, createPurchaseOrder, transitionPurchaseOrder | 200, 201, 400, 404 | domain capability: procurement | not yet test-assertion mapped |
| POST | `/tenants/:id/b2b/purchase-orders` | `handleB2BPurchaseOrders` | 3989/1780 | tenant-scoped session required; central permission/scope evaluator | b2b_purchase_orders:b2b:po:view, b2b_purchase_orders:b2b:po:create, procurement_execution:procurement:award:execute, dynamic/delegated | tenant/chatId; not detected | sourceType, source_type, status, state, reason | customer_id, status, limit |  | not detected | explicit store transaction in createPurchaseOrder | getTenant, getPurchaseOrder, listPurchaseOrders, createPurchaseOrder, transitionPurchaseOrder | 200, 201, 400, 404 | domain capability: procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/b2b/purchase-orders/:id` | `handleB2BPurchaseOrders` | 3990/1780 | tenant-scoped session required; central permission/scope evaluator | b2b_purchase_orders:b2b:po:view, b2b_purchase_orders:b2b:po:create, procurement_execution:procurement:award:execute, dynamic/delegated | tenant/chatId; not detected | sourceType, source_type, status, state, reason | customer_id, status, limit |  | not detected | explicit store transaction in createPurchaseOrder | getTenant, getPurchaseOrder, listPurchaseOrders, createPurchaseOrder, transitionPurchaseOrder | 200, 201, 400, 404 | domain capability: procurement | not yet test-assertion mapped |
| PATCH | `/tenants/:id/b2b/purchase-orders/:id` | `handleB2BPurchaseOrders` | 3991/1780 | tenant-scoped session required; central permission/scope evaluator | b2b_purchase_orders:b2b:po:view, b2b_purchase_orders:b2b:po:create, procurement_execution:procurement:award:execute, dynamic/delegated | tenant/chatId; not detected | sourceType, source_type, status, state, reason | customer_id, status, limit |  | not detected | explicit store transaction in createPurchaseOrder | getTenant, getPurchaseOrder, listPurchaseOrders, createPurchaseOrder, transitionPurchaseOrder | 200, 201, 400, 404 | domain capability: procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/b2b/credit-terms` | `handleB2BCreditTerms` | 3992/1841 | tenant-scoped session required; central permission/scope evaluator | dynamic/delegated | tenant/chatId; not detected | status, state, reason | customer_id, status, limit |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, getCreditTerms, listCreditTerms, createCreditTerms, transitionCreditTerms, updateCreditTerms | 200, 201, 400, 404 | domain capability: procurement | not yet test-assertion mapped |
| POST | `/tenants/:id/b2b/credit-terms` | `handleB2BCreditTerms` | 3993/1841 | tenant-scoped session required; central permission/scope evaluator | dynamic/delegated | tenant/chatId; not detected | status, state, reason | customer_id, status, limit |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, getCreditTerms, listCreditTerms, createCreditTerms, transitionCreditTerms, updateCreditTerms | 200, 201, 400, 404 | domain capability: procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/b2b/credit-terms/:id` | `handleB2BCreditTerms` | 3994/1841 | tenant-scoped session required; central permission/scope evaluator | dynamic/delegated | tenant/chatId; not detected | status, state, reason | customer_id, status, limit |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, getCreditTerms, listCreditTerms, createCreditTerms, transitionCreditTerms, updateCreditTerms | 200, 201, 400, 404 | domain capability: procurement | not yet test-assertion mapped |
| PATCH | `/tenants/:id/b2b/credit-terms/:id` | `handleB2BCreditTerms` | 3995/1841 | tenant-scoped session required; central permission/scope evaluator | dynamic/delegated | tenant/chatId; not detected | status, state, reason | customer_id, status, limit |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, getCreditTerms, listCreditTerms, createCreditTerms, transitionCreditTerms, updateCreditTerms | 200, 201, 400, 404 | domain capability: procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/inventory/movements` | `handleInventoryMovementsList` | 3996/1874 | tenant-scoped session required; central permission/scope evaluator | inventory:inventory:view | tenant/chatId; location referenced; inspect handler conditions |  | location_id, product_id, limit | LOCATION_SCOPE_DENIED | not detected | delegated store transaction not detected by direct lexical scan | getTenant, getOrganizationLocation, listInventoryMovements | 200, 403, 404 | domain capability: inventory | not yet test-assertion mapped |
| GET | `/tenants/:id/inventory/balances` | `handleInventoryBalances` | 3997/1894 | tenant-scoped session required; central permission/scope evaluator | inventory:inventory:view | tenant/chatId; location referenced; inspect handler conditions |  | location_id | LOCATION_SCOPE_DENIED | not detected | delegated store transaction not detected by direct lexical scan | getTenant, getOrganizationLocation, getInventoryBalances | 200, 403, 404 | domain capability: inventory | not yet test-assertion mapped |
| POST | `/tenants/:id/inventory/movements/batch` | `handleInventoryMovementBatchCreate` | 3998/1948 | tenant-scoped session required; central permission/scope evaluator | inventory:inventory:edit | tenant/chatId; location referenced; inspect handler conditions | locationId, location_id |  | INVALID_INVENTORY_COMMAND_LOCATION, LOCATION_SCOPE_DENIED | not detected | explicit store transaction in appendInventoryMovementBatch | getTenant, getOrganizationLocation, appendInventoryMovementBatch | 400, 403, 404 | domain capability: inventory | not yet test-assertion mapped |
| POST | `/tenants/:id/inventory/movements` | `handleInventoryMovementCreate` | 3999/1910 | tenant-scoped session required; central permission/scope evaluator | inventory:inventory:edit | tenant/chatId; location referenced; inspect handler conditions | locationId, location_id |  | LOCATION_SCOPE_DENIED | not detected | explicit store transaction in appendInventoryMovement | getTenant, getOrganizationLocation, appendInventoryMovement | 201, 403, 404 | domain capability: inventory | not yet test-assertion mapped |
| GET | `/tenants/:id/locations` | `handleLocationsList` | 4000/1967 | tenant-scoped session required; central permission/scope evaluator | locations:locations:view | tenant/chatId; location referenced; inspect handler conditions |  | include_inactive |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, listOrganizationLocations | 200, 404 | domain capability: organization-location | not yet test-assertion mapped |
| POST | `/tenants/:id/locations` | `handleLocationCreate` | 4001/1977 | tenant-scoped session required; central permission/scope evaluator | locations:locations:manage | tenant/chatId; location referenced; inspect handler conditions |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, createOrganizationLocation | 201, 404 | domain capability: organization-location | not yet test-assertion mapped |
| PATCH | `/tenants/:id/locations/:id` | `handleLocationPatch` | 4002/1987 | tenant-scoped session required; central permission/scope evaluator | locations:locations:manage | tenant/chatId; location referenced; inspect handler conditions |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, updateOrganizationLocation | 200, 404 | domain capability: organization-location | not yet test-assertion mapped |
| GET | `/tenants/:id/authorization/scope-context` | `handleAuthorizationScopeContext` | 4003/1997 | tenant-scoped session required; central permission/scope evaluator | scope_context:locations:view | tenant/chatId; location referenced; inspect handler conditions |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, listOrganizationLocations | 200, 404, 405 | domain capability: authorization-infrastructure | not yet test-assertion mapped |
| GET | `/tenants/:id/authorization/conditions-contract` | `handleAuthorizationConditionsContract` | 4004/2032 | tenant-scoped session required; central permission/scope evaluator | authorization_conditions_contract:settings:configure | tenant/chatId; location referenced; inspect handler conditions |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant | 200, 404, 405 | domain capability: authorization-infrastructure | not yet test-assertion mapped |
| GET | `/tenants/:id/authorization/role-matrix` | `handleAuthorizationRoleMatrix` | 4005/2061 | tenant-scoped session required; central permission/scope evaluator | authorization_role_matrix:settings:configure | tenant/chatId; location referenced; inspect handler conditions |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant | 200, 404, 405 | domain capability: authorization-infrastructure | not yet test-assertion mapped |
| GET | `/tenants/:id/authorization/iam-certification` | `handleAuthorizationIamCertification` | 4006/2092 | tenant-scoped session required; central permission/scope evaluator | authorization_iam_certification:settings:configure | tenant/chatId; location referenced; inspect handler conditions |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant | 200, 404, 405 | domain capability: authorization-infrastructure | not yet test-assertion mapped |
| GET | `/tenants/:id/business-template` | `handleBusinessTemplateConfig` | 4007/2146 | tenant-scoped session required; owner-role gate | owner-role | tenant/chatId; not detected |  |  |  | not detected | explicit store transaction in saveBusinessTemplateConfig | getTenant, getBusinessTemplateConfig, saveBusinessTemplateConfig | 200, 404, 405 | domain capability: tenant-configuration | not yet test-assertion mapped |
| PUT | `/tenants/:id/business-template` | `handleBusinessTemplateConfig` | 4008/2146 | tenant-scoped session required; owner-role gate | owner-role | tenant/chatId; not detected |  |  |  | not detected | explicit store transaction in saveBusinessTemplateConfig | getTenant, getBusinessTemplateConfig, saveBusinessTemplateConfig | 200, 404, 405 | domain capability: tenant-configuration | not yet test-assertion mapped |
| PATCH | `/tenants/:id/business-template` | `handleBusinessTemplateConfig` | 4009/2146 | tenant-scoped session required; owner-role gate | owner-role | tenant/chatId; not detected |  |  |  | not detected | explicit store transaction in saveBusinessTemplateConfig | getTenant, getBusinessTemplateConfig, saveBusinessTemplateConfig | 200, 404, 405 | domain capability: tenant-configuration | not yet test-assertion mapped |
| GET | `/tenants/:id` | `handleTenantPatch` | 4010/2165 | tenant-scoped session required; owner-role gate | owner-role | tenant/chatId; not detected | sellerName, branding, vendorCode |  | INVALID_CURRENCY | not detected | delegated store transaction not detected by direct lexical scan | getTenant, updateTenant | 200, 400, 404, 405 | domain capability: tenant-configuration | not yet test-assertion mapped |
| PATCH | `/tenants/:id` | `handleTenantPatch` | 4011/2165 | tenant-scoped session required; owner-role gate | owner-role | tenant/chatId; not detected | sellerName, branding, vendorCode |  | INVALID_CURRENCY | not detected | delegated store transaction not detected by direct lexical scan | getTenant, updateTenant | 200, 400, 404, 405 | domain capability: tenant-configuration | not yet test-assertion mapped |
| GET | `/tenants/:id/payments/:id/evidence` | `handlePaymentEvidenceList` | 4012/2577 | tenant-scoped session required; Payment Core central authorization; central permission/scope evaluator | payments:payments:view, PaymentCore authorization callback | tenant/chatId; not detected |  |  |  | not detected | delegated to PaymentCore + store; inspect corresponding core operation | getTenant | 200, 404 | domain capability: payments | not yet test-assertion mapped |
| POST | `/tenants/:id/payments/:id/evidence/:id/review` | `handleManualPaymentEvidenceReview` | 4013/2558 | tenant-scoped session required; Payment Core central authorization; central permission/scope evaluator | payments:payments:accept, PaymentCore authorization callback | tenant/chatId; not detected |  |  |  | not detected | delegated to PaymentCore + store; inspect corresponding core operation | getTenant | 404 | domain capability: payments | not yet test-assertion mapped |
| POST | `/tenants/:id/payments/evidence` | `handlePaymentEvidenceSubmission` | 4014/2593 | tenant-scoped session required; Payment Core central authorization; central permission/scope evaluator | payments:payments:accept, PaymentCore authorization callback | tenant/chatId; not detected |  |  |  | not detected | delegated to PaymentCore + store; inspect corresponding core operation | getTenant | 404 | domain capability: payments | not yet test-assertion mapped |
| GET | `/tenants/:id/payments/providers` | `handlePaymentProviderMetadata` | 4015/2286 | tenant-scoped session required; central permission/scope evaluator | payments:payments:view | tenant/chatId; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant | 200, 404 | domain capability: payments | not yet test-assertion mapped |
| GET | `/tenants/:id/payments/accounts` | `handlePaymentAccounts` | 4016/2294 | tenant-scoped session required; central permission/scope evaluator | payments:payments:view, payments:payments:manage | tenant/chatId; not detected |  | status |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, listPaymentAccounts, createPaymentAccount | 200, 201, 404 | domain capability: payments | not yet test-assertion mapped |
| POST | `/tenants/:id/payments/accounts` | `handlePaymentAccounts` | 4017/2294 | tenant-scoped session required; central permission/scope evaluator | payments:payments:view, payments:payments:manage | tenant/chatId; not detected |  | status |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, listPaymentAccounts, createPaymentAccount | 200, 201, 404 | domain capability: payments | not yet test-assertion mapped |
| GET | `/tenants/:id/payments/outbound` | `handlePaymentOutbound` | 4018/2362 | tenant-scoped session required; central permission/scope evaluator | payments:payments:view, payments:payments:outbound:create, dynamic/delegated | tenant/chatId; not detected |  | purchase_order_id, state, limit |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, getPaymentOutboundIntent, listPaymentOutboundIntents, createPaymentOutboundIntent, transitionPaymentOutboundIntent | 200, 201, 404, 405 | domain capability: payments | not yet test-assertion mapped |
| POST | `/tenants/:id/payments/outbound` | `handlePaymentOutbound` | 4019/2362 | tenant-scoped session required; central permission/scope evaluator | payments:payments:view, payments:payments:outbound:create, dynamic/delegated | tenant/chatId; not detected |  | purchase_order_id, state, limit |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, getPaymentOutboundIntent, listPaymentOutboundIntents, createPaymentOutboundIntent, transitionPaymentOutboundIntent | 200, 201, 404, 405 | domain capability: payments | not yet test-assertion mapped |
| GET | `/tenants/:id/payments/outbound/:id` | `handlePaymentOutbound` | 4020/2362 | tenant-scoped session required; central permission/scope evaluator | payments:payments:view, payments:payments:outbound:create, dynamic/delegated | tenant/chatId; not detected |  | purchase_order_id, state, limit |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, getPaymentOutboundIntent, listPaymentOutboundIntents, createPaymentOutboundIntent, transitionPaymentOutboundIntent | 200, 201, 404, 405 | domain capability: payments | not yet test-assertion mapped |
| POST | `/tenants/:id/payments/outbound/:id/(submit|confirm|fail|cancel)` | `handlePaymentOutbound` | 4021/2362 | tenant-scoped session required; central permission/scope evaluator | payments:payments:view, payments:payments:outbound:create, dynamic/delegated | tenant/chatId; not detected |  | purchase_order_id, state, limit |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, getPaymentOutboundIntent, listPaymentOutboundIntents, createPaymentOutboundIntent, transitionPaymentOutboundIntent | 200, 201, 404, 405 | domain capability: payments | not yet test-assertion mapped |
| POST | `/tenants/:id/procurement/purchase-orders/:id/payment` | `handleProcurementPayment` | 4022/2365 | tenant-scoped session required; central permission/scope evaluator | procurement_payment:procurement:payment:create | tenant/chatId; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, createProcurementPaymentIntent | 201, 404, 405 | mixed: payments + procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/payments/procurement-settlements` | `handleProcurementSettlement` | 4023/2363 | tenant-scoped session required; central permission/scope evaluator | payments:payments:settlement:view, payments:payments:settlement:allocate | tenant/chatId; location referenced; inspect handler conditions |  | purchase_order_id, status, limit |  | not detected | explicit store transaction in allocateConfirmedOutboundPaymentToProcurementSettlement | getTenant, getProcurementSettlement, listProcurementSettlementAllocations, listProcurementSettlements, allocateConfirmedOutboundPaymentToProcurementSettlement | 200, 201, 404, 405 | mixed: payments + procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/payments/procurement-settlements/purchase-orders/:id` | `handleProcurementSettlement` | 4024/2363 | tenant-scoped session required; central permission/scope evaluator | payments:payments:settlement:view, payments:payments:settlement:allocate | tenant/chatId; location referenced; inspect handler conditions |  | purchase_order_id, status, limit |  | not detected | explicit store transaction in allocateConfirmedOutboundPaymentToProcurementSettlement | getTenant, getProcurementSettlement, listProcurementSettlementAllocations, listProcurementSettlements, allocateConfirmedOutboundPaymentToProcurementSettlement | 200, 201, 404, 405 | mixed: payments + procurement | not yet test-assertion mapped |
| POST | `/tenants/:id/payments/procurement-settlements/purchase-orders/:id/allocate` | `handleProcurementSettlement` | 4025/2363 | tenant-scoped session required; central permission/scope evaluator | payments:payments:settlement:view, payments:payments:settlement:allocate | tenant/chatId; location referenced; inspect handler conditions |  | purchase_order_id, status, limit |  | not detected | explicit store transaction in allocateConfirmedOutboundPaymentToProcurementSettlement | getTenant, getProcurementSettlement, listProcurementSettlementAllocations, listProcurementSettlements, allocateConfirmedOutboundPaymentToProcurementSettlement | 200, 201, 404, 405 | mixed: payments + procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/orders/:id/payments/summary` | `handleOrderPaymentSummary` | 4026/2377 | tenant-scoped session required; Payment Core central authorization; central permission/scope evaluator | payments:payments:view, PaymentCore authorization callback | tenant/chatId; not detected |  |  |  | not detected | delegated to PaymentCore + store; inspect corresponding core operation | getTenant, getOrderPaymentSummary | 200, 404 | domain capability: payments | not yet test-assertion mapped |
| GET | `/tenants/:id/payments/:id/ledger` | `handlePaymentLedger` | 4027/2367 | tenant-scoped session required; central permission/scope evaluator | payments:payments:view | tenant/chatId; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, listPaymentLedger | 200, 404 | domain capability: payments | not yet test-assertion mapped |
| POST | `/tenants/:id/payments/:id/reconcile` | `handlePaymentReconciliation` | 4028/2707 | tenant-scoped session required; Payment Core central authorization; central permission/scope evaluator | payments:payments:reconcile, PaymentCore authorization callback | tenant/chatId; not detected |  |  |  | not detected | delegated to PaymentCore + store; inspect corresponding core operation | getTenant | 200, 404 | domain capability: payments | not yet test-assertion mapped |
| POST | `/tenants/:id/payments/:id/reconciliation` | `handlePaymentCoreReconciliation` | 4029/2681 | tenant-scoped session required; Payment Core central authorization; central permission/scope evaluator | payments:payments:reconcile, PaymentCore authorization callback | tenant/chatId; not detected |  |  |  | not detected | delegated to PaymentCore + store; inspect corresponding core operation | getTenant | 200, 404 | domain capability: payments | not yet test-assertion mapped |
| GET | `/tenants/:id/payments/:id/reconciliation` | `handlePaymentReconciliationHistory` | 4030/2697 | tenant-scoped session required; central permission/scope evaluator | payments:payments:reconcile | tenant/chatId; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, listPaymentReconciliations | 200, 404 | domain capability: payments | not yet test-assertion mapped |
| POST | `/tenants/:id/payments/confirmation-attempts/:id/finalize` | `handlePaymentConfirmationFinalization` | 4031/2629 | tenant-scoped session required; Payment Core central authorization; central permission/scope evaluator | payments:payments:accept, PaymentCore authorization callback | tenant/chatId; not detected |  |  |  | not detected | delegated to PaymentCore + store; inspect corresponding core operation | getTenant | 404 | domain capability: payments | not yet test-assertion mapped |
| POST | `/tenants/:id/payments/:id/status` | `handlePaymentStatusQuery` | 4032/2662 | tenant-scoped session required; Payment Core central authorization; central permission/scope evaluator | payments:payments:accept, PaymentCore authorization callback | tenant/chatId; not detected | idempotencyKey, idempotency_key |  | IDEMPOTENCY_KEY_REQUIRED | explicit key handling | delegated to PaymentCore + store; inspect corresponding core operation | getTenant | 200, 400, 404 | domain capability: payments | not yet test-assertion mapped |
| POST | `/tenants/:id/payments/:id/lifecycle` | `handlePaymentLifecycle` | 4033/2647 | tenant-scoped session required; Payment Core central authorization | PaymentCore authorization callback | tenant/chatId; not detected |  |  |  | not detected | delegated to PaymentCore + store; inspect corresponding core operation | getTenant | 200, 404 | domain capability: payments | not yet test-assertion mapped |
| POST | `/tenants/:id/payments/:id/refund` | `handlePaymentRefund` | 4034/2531 | tenant-scoped session required; Payment Core central authorization | PaymentCore authorization callback | tenant/chatId; not detected |  |  |  | not detected | delegated to PaymentCore + store; inspect corresponding core operation | getTenant | 200, 404 | domain capability: payments | not yet test-assertion mapped |
| GET | `/tenants/:id/payments/providers/certification` | `handlePaymentProviderCertification` | 4035/2412 | tenant-scoped session required; Payment Core central authorization | PaymentCore authorization callback | tenant/chatId; not detected |  | providerId |  | not detected | delegated to PaymentCore + store; inspect corresponding core operation | getTenant | 200, 404, 405 | domain capability: payments | not yet test-assertion mapped |
| POST | `/tenants/:id/payments/providers/capability-probe` | `handlePaymentProviderCapabilityProbe` | 4036/2426 | tenant-scoped session required; Payment Core central authorization | PaymentCore authorization callback | tenant/chatId; not detected |  |  |  | not detected | delegated to PaymentCore + store; inspect corresponding core operation | getTenant | 200, 404, 405 | domain capability: payments | not yet test-assertion mapped |
| GET | `/tenants/:id/payments/providers/capability-evidence` | `handlePaymentProviderCapabilityEvidence` | 4037/2433 | tenant-scoped session required; Payment Core central authorization | PaymentCore authorization callback | tenant/chatId; not detected |  |  |  | not detected | delegated to PaymentCore + store; inspect corresponding core operation | getTenant | 200, 404, 405 | domain capability: payments | not yet test-assertion mapped |
| POST | `/tenants/:id/payments/providers/capability-evidence` | `handlePaymentProviderCapabilityEvidence` | 4038/2433 | tenant-scoped session required; Payment Core central authorization | PaymentCore authorization callback | tenant/chatId; not detected |  |  |  | not detected | delegated to PaymentCore + store; inspect corresponding core operation | getTenant | 200, 404, 405 | domain capability: payments | not yet test-assertion mapped |
| GET | `/tenants/:id/payments/production-certification` | `handlePaymentProductionCertification` | 4039/2453 | tenant-scoped session required; Payment Core central authorization | PaymentCore authorization callback | tenant/chatId; not detected |  |  |  | not detected | delegated to PaymentCore + store; inspect corresponding core operation | getTenant | 200, 404, 405 | domain capability: payments | not yet test-assertion mapped |
| POST | `/tenants/:id/payments/production-certification` | `handlePaymentProductionCertification` | 4040/2453 | tenant-scoped session required; Payment Core central authorization | PaymentCore authorization callback | tenant/chatId; not detected |  |  |  | not detected | delegated to PaymentCore + store; inspect corresponding core operation | getTenant | 200, 404, 405 | domain capability: payments | not yet test-assertion mapped |
| GET | `/tenants/:id/payments/:id/operations` | `handlePaymentOperationalActions` | 4041/2484 | tenant-scoped session required; Payment Core central authorization | PaymentCore authorization callback | tenant/chatId; not detected |  |  |  | not detected | delegated to PaymentCore + store; inspect corresponding core operation | getTenant | 200, 404, 405 | domain capability: payments | not yet test-assertion mapped |
| POST | `/tenants/:id/payments/:id/operations` | `handlePaymentOperationalActions` | 4042/2484 | tenant-scoped session required; Payment Core central authorization | PaymentCore authorization callback | tenant/chatId; not detected |  |  |  | not detected | delegated to PaymentCore + store; inspect corresponding core operation | getTenant | 200, 404, 405 | domain capability: payments | not yet test-assertion mapped |
| POST | `/tenants/:id/payments/:id/operations/retry` | `handlePaymentOperationalRetry` | 4043/2491 | tenant-scoped session required; Payment Core central authorization | PaymentCore authorization callback | tenant/chatId; not detected |  |  |  | not detected | delegated to PaymentCore + store; inspect corresponding core operation | getTenant | 200, 404 | domain capability: payments | not yet test-assertion mapped |
| POST | `/tenants/:id/payments/:id/operations/manual-review` | `handlePaymentManualReview` | 4044/2496 | tenant-scoped session required; Payment Core central authorization | PaymentCore authorization callback | tenant/chatId; not detected |  |  |  | not detected | delegated to PaymentCore + store; inspect corresponding core operation | getTenant | 200, 404 | domain capability: payments | not yet test-assertion mapped |
| POST | `/tenants/:id/payments/:id/settlement` | `handlePaymentSettlement` | 4045/2502 | tenant-scoped session required; Payment Core central authorization | PaymentCore authorization callback | tenant/chatId; not detected |  |  |  | not detected | delegated to PaymentCore + store; inspect corresponding core operation | getTenant | 200, 404 | domain capability: payments | not yet test-assertion mapped |
| POST | `/tenants/:id/payments/routing/resolve` | `handlePaymentRoutingResolve` | 4046/2386 | tenant-scoped session required; Payment Core central authorization; central permission/scope evaluator | payments:payments:view, PaymentCore authorization callback | tenant/chatId; not detected |  |  |  | not detected | delegated to PaymentCore + store; inspect corresponding core operation | getTenant | 200, 404 | domain capability: payments | not yet test-assertion mapped |
| GET | `/tenants/:id/payments/routing/policies` | `handlePaymentRoutingPolicies` | 4047/2397 | tenant-scoped session required | session-only at route; store-layer enforcement not yet fully expanded | tenant/chatId; location referenced; inspect handler conditions |  | channel, locationId |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, listPaymentRoutingPolicies, upsertPaymentRoutingPolicy | 200, 404 | domain capability: payments | not yet test-assertion mapped |
| POST | `/tenants/:id/payments/routing/policies` | `handlePaymentRoutingPolicies` | 4048/2397 | tenant-scoped session required | session-only at route; store-layer enforcement not yet fully expanded | tenant/chatId; location referenced; inspect handler conditions |  | channel, locationId |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, listPaymentRoutingPolicies, upsertPaymentRoutingPolicy | 200, 404 | domain capability: payments | not yet test-assertion mapped |
| POST | `/tenants/:id/payments/:id/settlement/finalize` | `handlePaymentSettlementFinalize` | 4049/2512 | tenant-scoped session required; Payment Core central authorization | PaymentCore authorization callback | tenant/chatId; not detected |  |  |  | not detected | delegated to PaymentCore + store; inspect corresponding core operation | getTenant | 200, 404 | domain capability: payments | not yet test-assertion mapped |
| GET | `/tenants/:id/payments/:id/settlement` | `handlePaymentSettlementHistory` | 4050/2522 | tenant-scoped session required; Payment Core central authorization | PaymentCore authorization callback | tenant/chatId; not detected |  |  |  | not detected | delegated to PaymentCore + store; inspect corresponding core operation | getTenant | 200, 404 | domain capability: payments | not yet test-assertion mapped |
| GET | `/tenants/:id/payments/:id/refund` | `handlePaymentRefundHistory` | 4051/2546 | tenant-scoped session required; Payment Core central authorization | PaymentCore authorization callback | tenant/chatId; not detected |  |  |  | not detected | delegated to PaymentCore + store; inspect corresponding core operation | getTenant | 200, 404 | domain capability: payments | not yet test-assertion mapped |
| GET | `/tenants/:id/payments/:id` | `handlePayments` | 4052/2310 | tenant-scoped session required; Payment Core central authorization; central permission/scope evaluator | payments:payments:view, payments:payments:accept, PaymentCore authorization callback | tenant/chatId; not detected | idempotencyKey, idempotency_key, targetState, target_state, state | state, order_id, limit | IDEMPOTENCY_KEY_REQUIRED, PAYMENT_CONTEXT_REQUIRED, PAYMENT_STATE_COMMAND_REQUIRED | explicit key handling | delegated to PaymentCore + store; inspect corresponding core operation | getTenant, getPayment, listPayments, createPayment | 200, 201, 400, 404, 405 | domain capability: payments | not yet test-assertion mapped |
| GET | `/tenants/:id/payments` | `handlePayments` | 4053/2310 | tenant-scoped session required; Payment Core central authorization; central permission/scope evaluator | payments:payments:view, payments:payments:accept, PaymentCore authorization callback | tenant/chatId; not detected | idempotencyKey, idempotency_key, targetState, target_state, state | state, order_id, limit | IDEMPOTENCY_KEY_REQUIRED, PAYMENT_CONTEXT_REQUIRED, PAYMENT_STATE_COMMAND_REQUIRED | explicit key handling | delegated to PaymentCore + store; inspect corresponding core operation | getTenant, getPayment, listPayments, createPayment | 200, 201, 400, 404, 405 | domain capability: payments | not yet test-assertion mapped |
| POST | `/tenants/:id/payments` | `handlePayments` | 4054/2310 | tenant-scoped session required; Payment Core central authorization; central permission/scope evaluator | payments:payments:view, payments:payments:accept, PaymentCore authorization callback | tenant/chatId; not detected | idempotencyKey, idempotency_key, targetState, target_state, state | state, order_id, limit | IDEMPOTENCY_KEY_REQUIRED, PAYMENT_CONTEXT_REQUIRED, PAYMENT_STATE_COMMAND_REQUIRED | explicit key handling | delegated to PaymentCore + store; inspect corresponding core operation | getTenant, getPayment, listPayments, createPayment | 200, 201, 400, 404, 405 | domain capability: payments | not yet test-assertion mapped |
| PATCH | `/tenants/:id/payments/:id` | `handlePayments` | 4055/2310 | tenant-scoped session required; Payment Core central authorization; central permission/scope evaluator | payments:payments:view, payments:payments:accept, PaymentCore authorization callback | tenant/chatId; not detected | idempotencyKey, idempotency_key, targetState, target_state, state | state, order_id, limit | IDEMPOTENCY_KEY_REQUIRED, PAYMENT_CONTEXT_REQUIRED, PAYMENT_STATE_COMMAND_REQUIRED | explicit key handling | delegated to PaymentCore + store; inspect corresponding core operation | getTenant, getPayment, listPayments, createPayment | 200, 201, 400, 404, 405 | domain capability: payments | not yet test-assertion mapped |
| GET | `/tenants/:id/b2b/receivables` | `handleB2BReceivables` | 4056/2723 | tenant-scoped session required; central permission/scope evaluator | b2b_receivables:b2b:ar:view, b2b_receivables:b2b:ar:allocate, dynamic/delegated | tenant/chatId; location referenced; inspect handler conditions | status, reason | customer_id, status, limit |  | not detected | explicit store transaction in allocatePaymentToReceivable, createReceivable | getTenant, listReceivableLedger, allocatePaymentToReceivable, getReceivable, listReceivables, createReceivable, transitionReceivable | 200, 201, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| POST | `/tenants/:id/b2b/receivables` | `handleB2BReceivables` | 4057/2723 | tenant-scoped session required; central permission/scope evaluator | b2b_receivables:b2b:ar:view, b2b_receivables:b2b:ar:allocate, dynamic/delegated | tenant/chatId; location referenced; inspect handler conditions | status, reason | customer_id, status, limit |  | not detected | explicit store transaction in allocatePaymentToReceivable, createReceivable | getTenant, listReceivableLedger, allocatePaymentToReceivable, getReceivable, listReceivables, createReceivable, transitionReceivable | 200, 201, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/b2b/receivables/:id` | `handleB2BReceivables` | 4058/2723 | tenant-scoped session required; central permission/scope evaluator | b2b_receivables:b2b:ar:view, b2b_receivables:b2b:ar:allocate, dynamic/delegated | tenant/chatId; location referenced; inspect handler conditions | status, reason | customer_id, status, limit |  | not detected | explicit store transaction in allocatePaymentToReceivable, createReceivable | getTenant, listReceivableLedger, allocatePaymentToReceivable, getReceivable, listReceivables, createReceivable, transitionReceivable | 200, 201, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| PATCH | `/tenants/:id/b2b/receivables/:id` | `handleB2BReceivables` | 4059/2723 | tenant-scoped session required; central permission/scope evaluator | b2b_receivables:b2b:ar:view, b2b_receivables:b2b:ar:allocate, dynamic/delegated | tenant/chatId; location referenced; inspect handler conditions | status, reason | customer_id, status, limit |  | not detected | explicit store transaction in allocatePaymentToReceivable, createReceivable | getTenant, listReceivableLedger, allocatePaymentToReceivable, getReceivable, listReceivables, createReceivable, transitionReceivable | 200, 201, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/b2b/receivables/:id/ledger` | `handleB2BReceivables` | 4060/2723 | tenant-scoped session required; central permission/scope evaluator | b2b_receivables:b2b:ar:view, b2b_receivables:b2b:ar:allocate, dynamic/delegated | tenant/chatId; location referenced; inspect handler conditions | status, reason | customer_id, status, limit |  | not detected | explicit store transaction in allocatePaymentToReceivable, createReceivable | getTenant, listReceivableLedger, allocatePaymentToReceivable, getReceivable, listReceivables, createReceivable, transitionReceivable | 200, 201, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/b2b/invoices` | `handleB2BInvoices` | 4061/2767 | tenant-scoped session required; central permission/scope evaluator | dynamic/delegated | tenant/chatId; not detected | status, reason | customer_id, status, limit |  | not detected | explicit store transaction in createInvoice, transitionInvoice | getTenant, getInvoice, listInvoices, createInvoice, transitionInvoice | 200, 201, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| POST | `/tenants/:id/b2b/invoices` | `handleB2BInvoices` | 4062/2767 | tenant-scoped session required; central permission/scope evaluator | dynamic/delegated | tenant/chatId; not detected | status, reason | customer_id, status, limit |  | not detected | explicit store transaction in createInvoice, transitionInvoice | getTenant, getInvoice, listInvoices, createInvoice, transitionInvoice | 200, 201, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/b2b/invoices/:id` | `handleB2BInvoices` | 4063/2767 | tenant-scoped session required; central permission/scope evaluator | dynamic/delegated | tenant/chatId; not detected | status, reason | customer_id, status, limit |  | not detected | explicit store transaction in createInvoice, transitionInvoice | getTenant, getInvoice, listInvoices, createInvoice, transitionInvoice | 200, 201, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| PATCH | `/tenants/:id/b2b/invoices/:id` | `handleB2BInvoices` | 4064/2767 | tenant-scoped session required; central permission/scope evaluator | dynamic/delegated | tenant/chatId; not detected | status, reason | customer_id, status, limit |  | not detected | explicit store transaction in createInvoice, transitionInvoice | getTenant, getInvoice, listInvoices, createInvoice, transitionInvoice | 200, 201, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| POST | `/tenants/:id/b2b/receivables/:id/allocate` | `handleB2BReceivables` | 4065/2723 | tenant-scoped session required; central permission/scope evaluator | b2b_receivables:b2b:ar:view, b2b_receivables:b2b:ar:allocate, dynamic/delegated | tenant/chatId; location referenced; inspect handler conditions | status, reason | customer_id, status, limit |  | not detected | explicit store transaction in allocatePaymentToReceivable, createReceivable | getTenant, listReceivableLedger, allocatePaymentToReceivable, getReceivable, listReceivables, createReceivable, transitionReceivable | 200, 201, 404, 405 | domain capability: procurement | not yet test-assertion mapped |
| GET | `/tenants/:id/audit` | `handleTenantAudit` | 4066/2796 | tenant-scoped session required; central permission/scope evaluator | audit:audit:view | tenant/chatId; not detected |  | limit, action, actor_id, entity_type |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, listAuditEvents, recordAuditEvent | 200, 404 | domain capability: audit-infrastructure | not yet test-assertion mapped |
| GET | `/tenants/:id/compliance/retention` | `handleAuditRetention` | 4067/2816 | tenant-scoped session required; central permission/scope evaluator | audit:compliance:manage | tenant/chatId; not detected | retentionDays |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, getAuditRetentionPolicy, setAuditRetentionPolicy | 200, 404 | domain capability: compliance | not yet test-assertion mapped |
| PATCH | `/tenants/:id/compliance/retention` | `handleAuditRetention` | 4068/2816 | tenant-scoped session required; central permission/scope evaluator | audit:compliance:manage | tenant/chatId; not detected | retentionDays |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, getAuditRetentionPolicy, setAuditRetentionPolicy | 200, 404 | domain capability: compliance | not yet test-assertion mapped |
| GET | `/tenants/:id/compliance/requests` | `handleComplianceRequests` | 4069/2829 | tenant-scoped session required; central permission/scope evaluator | compliance:compliance:manage | tenant/chatId; not detected | requestId, status, resolutionNote | status, limit |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, listComplianceRequests, createComplianceRequest, resolveComplianceRequest | 200, 201, 404 | domain capability: compliance | not yet test-assertion mapped |
| POST | `/tenants/:id/compliance/requests` | `handleComplianceRequests` | 4070/2829 | tenant-scoped session required; central permission/scope evaluator | compliance:compliance:manage | tenant/chatId; not detected | requestId, status, resolutionNote | status, limit |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, listComplianceRequests, createComplianceRequest, resolveComplianceRequest | 200, 201, 404 | domain capability: compliance | not yet test-assertion mapped |
| PATCH | `/tenants/:id/compliance/requests` | `handleComplianceRequests` | 4071/2829 | tenant-scoped session required; central permission/scope evaluator | compliance:compliance:manage | tenant/chatId; not detected | requestId, status, resolutionNote | status, limit |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, listComplianceRequests, createComplianceRequest, resolveComplianceRequest | 200, 201, 404 | domain capability: compliance | not yet test-assertion mapped |
| GET | `/tenants/:id/compliance/export/:id/:id` | `handleComplianceExport` | 4072/2853 | tenant-scoped session required; central permission/scope evaluator | compliance:compliance:manage | tenant/chatId; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, buildComplianceExport, recordAuditEvent | 200, 404 | domain capability: compliance | not yet test-assertion mapped |
| GET | `/tenants/:id/compliance/export/:id` | `handleComplianceExport` | 4073/2853 | tenant-scoped session required; central permission/scope evaluator | compliance:compliance:manage | tenant/chatId; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant, buildComplianceExport, recordAuditEvent | 200, 404 | domain capability: compliance | not yet test-assertion mapped |
| POST | `/admin/backup` | `handleAdminBackup` | 4074/2870 | configured bearer backup token | identity/proof/token validation; no tenant business permission | global/auth/provider; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | createDatabaseBackup | 201 | domain capability: audit-infrastructure | not yet test-assertion mapped |
| GET | `/api/marketplace/search` | `handleMarketplaceSearch` | 4075/2895 | public read endpoint |  | public tenant/resource; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | searchMarketplaceListings | 200 | mixed: marketplace + discovery | not yet test-assertion mapped |
| GET | `/api/discovery/products` | `handleDiscoveryProducts` | 4076/2903 | needs-review: authentication mechanism not identified in handler |  | global/auth/provider; not detected |  | q, search, category, currency, seller |  | not detected | undefined |  | 200 | domain capability: discovery | not yet test-assertion mapped |
| GET | `/api/discovery/suppliers/:id` | `handleDiscoverySuppliers` | 4077/2925 | tenant-scoped session required; central permission/scope evaluator | supplier_network_discovery:supplier-network:discovery:discover | global/auth/provider; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant | 200, 404, 405 | domain capability: discovery | not yet test-assertion mapped |
| POST | `/api/discovery/suppliers/:id` | `handleDiscoverySuppliers` | 4078/2925 | tenant-scoped session required; central permission/scope evaluator | supplier_network_discovery:supplier-network:discovery:discover | global/auth/provider; not detected |  |  |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant | 200, 404, 405 | domain capability: discovery | not yet test-assertion mapped |
| GET | `/api/discovery/organizations` | `handleDiscoveryOrganizations` | 4079/2979 | needs-review: authentication mechanism not identified in handler |  | global/auth/provider; not detected |  | q, search, country, countryCode, currency, seller |  | not detected | undefined |  | 200 | domain capability: discovery | not yet test-assertion mapped |
| GET | `/api/discovery` | `handleUnifiedDiscovery` | 4080/2945 | tenant-scoped session required; central permission/scope evaluator | supplier_network_discovery:supplier-network:discovery:discover | global/auth/provider; not detected |  | chatId |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant | 200, 400, 404 | domain capability: discovery | not yet test-assertion mapped |
| POST | `/api/discovery` | `handleUnifiedDiscovery` | 4081/2945 | tenant-scoped session required; central permission/scope evaluator | supplier_network_discovery:supplier-network:discovery:discover | global/auth/provider; not detected |  | chatId |  | not detected | delegated store transaction not detected by direct lexical scan | getTenant | 200, 400, 404 | domain capability: discovery | not yet test-assertion mapped |
| POST | `/api/marketplace/checkout` | `handleMarketplaceCheckout` | 4082/2997 | Telegram buyer initData verified with configured bot secret; optional bearer session token; public storefront context/token validation |  | public tenant/resource; not detected | idempotency_key, telegram_storefront_chat_id, telegram_init_data, items, buyer_id, customer_phone, customer_name, service_delivery |  | TELEGRAM_BUYER_CONTEXT_INCOMPLETE, TELEGRAM_STOREFRONT_NOT_PUBLISHED, TELEGRAM_CHECKOUT_DISABLED, TELEGRAM_CHECKOUT_SCOPE_MISMATCH | explicit key handling | explicit store transaction in createMarketplaceOrder | authenticateSessionToken, getTenant, getTelegramStorefrontConfig, createMarketplaceOrder | 200, 400, 401, 403, 404 | mixed: marketplace + commerce-orders | not yet test-assertion mapped |
| GET | `/api/marketplace/orders/:id` | `handleMarketplaceOrderTracking` | 4083/3038 | public storefront context/token validation |  | tenant/chatId; not detected |  | token |  | not detected | delegated store transaction not detected by direct lexical scan | getMarketplaceOrderTracking | 200 | mixed: marketplace + commerce-orders | not yet test-assertion mapped |
| PATCH | `/api/marketplace/orders/status/:id` | `handleMarketplaceOrderStatus` | 4084/3045 | tenant-scoped session required; central permission/scope evaluator | marketplace_orders:marketplace_orders:update, marketplace_orders:orders:delete | tenant/chatId; not detected | status |  |  | not detected | explicit store transaction in updateMarketplaceOrderStatus | updateMarketplaceOrderStatus | 200, 400 | mixed: marketplace + commerce-orders | not yet test-assertion mapped |
| GET | `/tenants/:id/restaurant/recipes` | `handleRestaurantRecipes` | 4085/1925 | tenant-scoped session required; central permission/scope evaluator | restaurant_recipe:restaurant:recipes:view, restaurant_recipe:restaurant:recipes:manage | tenant/chatId; not detected |  | include_archived |  | not detected | explicit store transaction in createRestaurantRecipe, updateRestaurantRecipe | getTenant, listRestaurantRecipes, createRestaurantRecipe, updateRestaurantRecipe | 200, 404, 405 | domain capability: restaurant | not yet test-assertion mapped |
| POST | `/tenants/:id/restaurant/recipes` | `handleRestaurantRecipes` | 4086/1925 | tenant-scoped session required; central permission/scope evaluator | restaurant_recipe:restaurant:recipes:view, restaurant_recipe:restaurant:recipes:manage | tenant/chatId; not detected |  | include_archived |  | not detected | explicit store transaction in createRestaurantRecipe, updateRestaurantRecipe | getTenant, listRestaurantRecipes, createRestaurantRecipe, updateRestaurantRecipe | 200, 404, 405 | domain capability: restaurant | not yet test-assertion mapped |
| PATCH | `/tenants/:id/restaurant/recipes/:id` | `handleRestaurantRecipes` | 4087/1925 | tenant-scoped session required; central permission/scope evaluator | restaurant_recipe:restaurant:recipes:view, restaurant_recipe:restaurant:recipes:manage | tenant/chatId; not detected |  | include_archived |  | not detected | explicit store transaction in createRestaurantRecipe, updateRestaurantRecipe | getTenant, listRestaurantRecipes, createRestaurantRecipe, updateRestaurantRecipe | 200, 404, 405 | domain capability: restaurant | not yet test-assertion mapped |
| ANY | `/health` | `inline/static` | 4107/— | public/static | not applicable unless source branch adds gate | none |  |  |  | none | undefined |  |  | inline/static | not yet test-assertion mapped |
| GET | `/config.js` | `inline/static` | 4116/— | public/static | not applicable unless source branch adds gate | none |  |  |  | none | undefined |  |  | inline/static | not yet test-assertion mapped |
| GET | `/backend/lib/*` | `inline/static` | 4123/— | public/static | not applicable unless source branch adds gate | none |  |  |  | none | undefined |  |  | inline/static | not yet test-assertion mapped |
| GET | `/shared/*` | `inline/static` | 4126/— | public/static | not applicable unless source branch adds gate | none |  |  |  | none | undefined |  |  | inline/static | not yet test-assertion mapped |
| GET | `/store/:id` | `inline/static` | 4131/— | public/static | not applicable unless source branch adds gate | none |  |  |  | none | undefined |  |  | inline/static | not yet test-assertion mapped |
| GET | `/track` | `inline/static` | 4134/— | public/static | not applicable unless source branch adds gate | none |  |  |  | none | undefined |  |  | inline/static | not yet test-assertion mapped |

## Limitations

- Static parser inventory; no runtime router execution.
- Permission extraction is literal-pattern only; delegated/dynamic authorization remains review-required.
- Validation codes and HTTP statuses reflect explicit handler literals; delegated store behavior is not fully expanded.
- No test assertions are mapped yet; coverage remains unverified.
- Classification is path-derived and is a logical capability label only; it does not assert sole data ownership or authorize module extraction.
