# SQLite dependency map

- Source commit: `e216db18ade2a5ffa66aff9dc3096e207251a918`
- Source: `backend/lib/store-sqlite.js`
- Exported store functions: **253**
- Literal SQL API call sites in the full file: **1321** (950 inside exported function bodies)
- Split literal SQL statements: **1677**
- Dynamic SQL call sites: **3**
- Unique tables: **110** (112 table declarations)
- Foreign-key declarations / deduplicated edges: **286 / 280**
- Index declarations / unique names: **206 / 192**
- Migration guards: **85**

## Method and limitations

- Every literal `db.prepare()` / `db.exec()` call in the file is recorded in `sqlCalls`; each literal SQL block is split into individual statements in `sqlStatements` (including multiple DDL statements inside one `db.exec`).
- Each statement records its operation, source line, SQL text, referenced tables, read/write/schema access and nearest function scope plus enclosing exported function.
- Exported-function records include their statement/call counts, DML table reads/writes, direct named local calls and transaction markers.
- Three dynamic SQL call sites remain separately identified; dynamic table names, arrow-function indirection and imported calls require manual review.
- Transaction markers are syntactic evidence. Absence of a local `BEGIN` does not prove that a function is outside a caller-owned transaction.
- Table owners are provisional, based on schema shape, observed DML and domain contracts—not names alone.

## Exported function dependency map

| Function / line | SQL calls | SQL statements | Read tables | Write tables | Direct local calls | Transaction evidence |
|---|---:|---:|---|---|---|---|
| `transitionPackLifecycle` (L3646) | 7 | 7 | pack_lifecycle | pack_lifecycle | assertProcurementActor, audit, ensureDatabase, nowIso, packLifecycleFromRow, tenantOrganizationId | explicit local transaction |
| `getPackLifecycle` (L3727) | 1 | 1 | pack_lifecycle | — | ensureDatabase | no explicit local transaction detected |
| `getTelegramStorefrontConfig` (L3769) | 2 | 2 | telegram_storefront_configs, tenants | — | ensureDatabase, parseJSON | no explicit local transaction detected |
| `upsertTelegramStorefrontConfig` (L3789) | 5 | 5 | — | telegram_storefront_configs | assertTelegramStorefrontTransition, audit, ensureDatabase, getTelegramStorefrontConfig, getTenant, json, nowIso | explicit local transaction |
| `verifyTelegramStorefront` (L3845) | 4 | 4 | — | telegram_storefront_configs | audit, ensureDatabase, getTelegramStorefrontConfig, getTenant, nowIso | explicit local transaction |
| `listSupplierNetworkQualifications` (L3880) | 1 | 1 | supplier_network_qualifications | — | ensureDatabase, tenantOrganizationId | no explicit local transaction detected |
| `getSupplierNetworkQualification` (L3881) | 0 | 0 | — | — | ensureDatabase, supplierNetworkQualificationFromRow, supplierNetworkQualificationRow, tenantOrganizationId | no explicit local transaction detected |
| `upsertSupplierNetworkQualification` (L3882) | 6 | 6 | supplier_network_qualifications | supplier_network_qualifications | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, json, normalizeSupplierNetworkQualificationInput, nowIso, supplierNetworkQualificationFromRow, supplierNetworkQualificationRow, tenantOrganizationId | explicit local transaction |
| `transitionSupplierNetworkQualification` (L3883) | 1 | 1 | — | supplier_network_qualifications | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, nowIso, supplierNetworkQualificationFromRow, supplierNetworkQualificationRow, tenantOrganizationId | no explicit local transaction detected |
| `listSupplierNetworkCommercialTerms` (L3891) | 1 | 1 | supplier_network_commercial_terms | — | ensureDatabase, tenantOrganizationId | no explicit local transaction detected |
| `getSupplierNetworkCommercialTerms` (L3892) | 0 | 0 | — | — | ensureDatabase, supplierNetworkCommercialTermsFromRow, supplierNetworkCommercialTermsRow, tenantOrganizationId | no explicit local transaction detected |
| `upsertSupplierNetworkCommercialTerms` (L3893) | 9 | 9 | catalog_products, supplier_network_capabilities, supplier_network_commercial_terms | supplier_network_commercial_terms | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, json, normalizeSupplierNetworkCommercialTermsInput, nowIso, supplierNetworkCommercialTermsFromRow, supplierNetworkCommercialTermsRow, supplierTenantForOrganization, tenantOrganizationId | explicit local transaction |
| `transitionSupplierNetworkCommercialTerms` (L3894) | 1 | 1 | — | supplier_network_commercial_terms | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, nowIso, supplierNetworkCommercialTermsFromRow, supplierNetworkCommercialTermsRow, tenantOrganizationId | no explicit local transaction detected |
| `listSupplierNetworkCapacities` (L3950) | 1 | 1 | supplier_network_capacity_signals | — | ensureDatabase, tenantOrganizationId | no explicit local transaction detected |
| `getSupplierNetworkCapacity` (L3951) | 0 | 0 | — | — | ensureDatabase, supplierNetworkCapacityFromRow, supplierNetworkCapacityRow, tenantOrganizationId | no explicit local transaction detected |
| `upsertSupplierNetworkCapacity` (L3952) | 7 | 7 | supplier_network_capacity_signals | supplier_network_capacity_signals | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, json, normalizeSupplierNetworkCapacityInput, nowIso, supplierNetworkCapacityFromRow, supplierNetworkCapacityRow, tenantOrganizationId | explicit local transaction |
| `transitionSupplierNetworkCapacity` (L3996) | 1 | 1 | — | supplier_network_capacity_signals | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, nowIso, supplierNetworkCapacityFromRow, supplierNetworkCapacityRow, tenantOrganizationId | no explicit local transaction detected |
| `listSupplierNetworkServiceAreas` (L3998) | 1 | 1 | supplier_network_service_areas | — | ensureDatabase, tenantOrganizationId | no explicit local transaction detected |
| `getSupplierNetworkServiceArea` (L3999) | 0 | 0 | — | — | ensureDatabase, supplierNetworkServiceAreaFromRow, supplierNetworkServiceAreaRow, tenantOrganizationId | no explicit local transaction detected |
| `upsertSupplierNetworkServiceArea` (L4000) | 7 | 7 | supplier_network_service_areas | supplier_network_service_areas | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, json, normalizeSupplierNetworkServiceAreaInput, nowIso, supplierNetworkServiceAreaFromRow, supplierNetworkServiceAreaRow, tenantOrganizationId | explicit local transaction |
| `transitionSupplierNetworkServiceArea` (L4001) | 1 | 1 | — | supplier_network_service_areas | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, nowIso, supplierNetworkServiceAreaFromRow, supplierNetworkServiceAreaRow, tenantOrganizationId | no explicit local transaction detected |
| `listSupplierNetworkCatalogListings` (L4010) | 1 | 1 | supplier_network_catalog_listings | — | ensureDatabase, tenantOrganizationId | no explicit local transaction detected |
| `getSupplierNetworkCatalogListing` (L4011) | 0 | 0 | — | — | ensureDatabase, supplierNetworkCatalogFromRow, supplierNetworkCatalogRow, tenantOrganizationId | no explicit local transaction detected |
| `upsertSupplierNetworkCatalogListing` (L4012) | 8 | 8 | catalog_products, supplier_network_catalog_listings | supplier_network_catalog_listings | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, json, normalizeSupplierNetworkCatalogInput, nowIso, supplierNetworkCatalogFromRow, supplierNetworkCatalogRow, supplierTenantForOrganization, tenantOrganizationId | explicit local transaction |
| `transitionSupplierNetworkCatalogListing` (L4013) | 1 | 1 | — | supplier_network_catalog_listings | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, nowIso, supplierNetworkCatalogFromRow, supplierNetworkCatalogRow, tenantOrganizationId | no explicit local transaction detected |
| `listSupplierNetworkCapabilities` (L4021) | 1 | 1 | supplier_network_capabilities | — | ensureDatabase, tenantOrganizationId | no explicit local transaction detected |
| `getSupplierNetworkCapability` (L4022) | 0 | 0 | — | — | ensureDatabase, supplierNetworkCapabilityFromRow, supplierNetworkCapabilityRow, tenantOrganizationId | no explicit local transaction detected |
| `upsertSupplierNetworkCapability` (L4023) | 7 | 7 | supplier_network_capabilities | supplier_network_capabilities | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, json, normalizeSupplierNetworkCapabilityInput, nowIso, supplierNetworkCapabilityFromRow, supplierNetworkCapabilityRow, tenantOrganizationId | explicit local transaction |
| `transitionSupplierNetworkCapability` (L4024) | 1 | 1 | — | supplier_network_capabilities | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, nowIso, supplierNetworkCapabilityFromRow, supplierNetworkCapabilityRow, tenantOrganizationId | no explicit local transaction detected |
| `getSupplierNetworkProfile` (L4036) | 0 | 0 | — | — | ensureDatabase, supplierNetworkProfileFromRow, supplierNetworkProfileRow, tenantOrganizationId | no explicit local transaction detected |
| `upsertSupplierNetworkProfile` (L4037) | 6 | 6 | organizations | supplier_network_profiles | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, json, normalizeSupplierProfileInput, nowIso, supplierNetworkProfileFromRow, supplierNetworkProfileRow, tenantOrganizationId | explicit local transaction |
| `transitionSupplierNetworkProfile` (L4038) | 1 | 1 | — | supplier_network_profiles | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, nowIso, supplierNetworkProfileFromRow, supplierNetworkProfileRow, tenantOrganizationId | no explicit local transaction detected |
| `listPaymentOutboundIntents` (L4045) | 1 | 1 | payment_outbound_intents | — | ensureDatabase, tenantOrganizationId | no explicit local transaction detected |
| `getPaymentOutboundIntent` (L4046) | 1 | 1 | payment_outbound_intents | — | ensureDatabase, paymentOutboundFromRow, tenantOrganizationId | no explicit local transaction detected |
| `createPaymentOutboundIntent` (L4047) | 4 | 4 | payment_outbound_intents, purchase_orders | payment_outbound_intents | audit, ensureDatabase, json, normaliseCurrency, nowIso, paymentOutboundFromRow, tenantCurrency, tenantOrganizationId | no explicit local transaction detected |
| `transitionPaymentOutboundIntent` (L4048) | 3 | 3 | payment_outbound_intents | payment_outbound_intents | audit, ensureDatabase, nowIso, paymentOutboundFromRow, tenantOrganizationId | no explicit local transaction detected |
| `createProcurementPaymentIntent` (L4049) | 1 | 1 | purchase_orders | — | createPaymentOutboundIntent, tenantOrganizationId | no explicit local transaction detected |
| `getProcurementSettlement` (L4068) | 2 | 2 | payment_procurement_settlement_allocations, payment_procurement_settlements | — | ensureDatabase, paymentProcurementSettlementFromRow, tenantOrganizationId | no explicit local transaction detected |
| `listProcurementSettlements` (L4069) | 2 | 2 | payment_procurement_settlement_allocations, payment_procurement_settlements | — | ensureDatabase, paymentProcurementSettlementFromRow, tenantOrganizationId | no explicit local transaction detected |
| `listProcurementSettlementAllocations` (L4070) | 2 | 2 | payment_outbound_intents, payment_procurement_settlement_allocations, payment_procurement_settlements | — | ensureDatabase, normaliseCurrency, tenantOrganizationId | no explicit local transaction detected |
| `allocateConfirmedOutboundPaymentToProcurementSettlement` (L4071) | 8 | 8 | payment_outbound_intents, payment_procurement_settlement_allocations | payment_procurement_settlement_allocations, payment_procurement_settlements | audit, ensureDatabase, getOrCreateProcurementSettlement, getProcurementSettlement, normaliseCurrency, nowIso, tenantOrganizationId | explicit local transaction |
| `createProcurementDemand` (L4248) | 6 | 6 | procurement_demands | procurement_demand_items, procurement_demands | assertProcurementActor, assertProcurementLocation, audit, ensureDatabase, generateProcurementRequestNumber, getProcurementDemand, nowIso, procurementDemandHash, procurementDemandInput, tenantOrganizationId | explicit local transaction |
| `getProcurementDemand` (L4292) | 2 | 2 | procurement_demand_items, procurement_demands | — | ensureDatabase, procurementDemandFromRow, tenantOrganizationId | no explicit local transaction detected |
| `listProcurementDemands` (L4301) | 0 | 0 | — | — | ensureDatabase, procurementDemandRows, tenantOrganizationId | no explicit local transaction detected |
| `updateProcurementDemand` (L4314) | 8 | 8 | procurement_demand_items, procurement_demands | procurement_demand_items, procurement_demands | assertProcurementActor, assertProcurementLocation, audit, ensureDatabase, getProcurementDemand, nowIso, procurementDemandHash, procurementDemandInput, tenantOrganizationId | explicit local transaction |
| `transitionProcurementDemand` (L4349) | 5 | 5 | procurement_demands | procurement_demands | assertProcurementActor, audit, ensureDatabase, getProcurementDemand, nowIso, tenantOrganizationId | explicit local transaction |
| `getProcurementSupplierParticipation` (L4379) | 0 | 0 | — | — | ensureDatabase, supplierParticipantFromRow, supplierParticipantRow, tenantOrganizationId | no explicit local transaction detected |
| `setProcurementSupplierParticipation` (L4380) | 2 | 2 | — | procurement_supplier_participants | assertSupplierMember, audit, ensureDatabase, getProcurementSupplierParticipation, nowIso, supplierParticipantRow, tenantOrganizationId | no explicit local transaction detected |
| `discoverProcurementSuppliers` (L4381) | 1 | 1 | organizations, procurement_supplier_participants | — | assertSupplierMember, ensureDatabase, normaliseCurrency, tenantOrganizationId | no explicit local transaction detected |
| `listProcurementSupplierRelationships` (L4382) | 1 | 1 | organizations, procurement_supplier_relationships | — | assertSupplierMember, ensureDatabase, tenantOrganizationId | no explicit local transaction detected |
| `createProcurementSupplierRelationship` (L4383) | 5 | 5 | organizations, procurement_supplier_relationships | procurement_supplier_relationships | activeDiscoverableSupplier, assertSupplierMember, audit, ensureDatabase, nowIso, supplierRelationshipFromRow, tenantOrganizationId | no explicit local transaction detected |
| `transitionProcurementSupplierRelationship` (L4384) | 3 | 3 | organizations, procurement_supplier_relationships | procurement_supplier_relationships | assertSupplierMember, audit, ensureDatabase, nowIso, supplierRelationshipFromRow, tenantOrganizationId | no explicit local transaction detected |
| `createProcurementRfq` (L4441) | 8 | 8 | procurement_demand_items, procurement_rfqs | procurement_rfq_items, procurement_rfq_suppliers, procurement_rfqs | assertActiveSupplierRelationship, assertProcurementActor, audit, ensureDatabase, getProcurementDemand, json, nowIso, procurementCapacityEvidenceSnapshotForSupplier, procurementRfqHash, procurementRfqInput, rfqRows, tenantOrganizationId | explicit local transaction |
| `listProcurementRfqs` (L4443) | 1 | 1 | procurement_rfqs | — | assertProcurementActor, ensureDatabase, rfqRows, tenantOrganizationId | no explicit local transaction detected |
| `transitionProcurementRfq` (L4444) | 6 | 6 | procurement_rfq_suppliers, procurement_rfqs | procurement_rfqs | assertProcurementActor, audit, ensureDatabase, nowIso, rfqRows, tenantOrganizationId | explicit local transaction |
| `createProcurementRfqResponse` (L4446) | 14 | 14 | organizations, procurement_rfq_items, procurement_rfq_response_items, procurement_rfq_responses, procurement_rfqs | procurement_rfq_response_items, procurement_rfq_responses | assertProcurementActor, assertRfqRecipient, audit, ensureDatabase, normaliseCurrency, nowIso, procurementRfqHash, procurementRfqResponseFromRow, tenantOrganizationId | explicit local transaction |
| `transitionProcurementRfqResponse` (L4448) | 9 | 9 | organizations, procurement_rfq_response_items, procurement_rfq_responses, procurement_rfqs | procurement_rfq_responses, procurement_rfq_suppliers | assertProcurementActor, audit, ensureDatabase, nowIso, procurementRfqResponseFromRow, tenantOrganizationId | explicit local transaction |
| `listSupplierNetworkTrustEvidence` (L4574) | 1 | 1 | supplier_network_trust_evidence | — | assertProcurementActor, ensureDatabase, nowIso, supplierNetworkTrustCanAccessEvidence, tenantOrganizationId | no explicit local transaction detected |
| `getSupplierNetworkTrustEvidence` (L4617) | 1 | 1 | supplier_network_trust_evidence | — | assertProcurementActor, ensureDatabase, supplierNetworkTrustCanAccessEvidence, supplierNetworkTrustEvidenceFromRow, tenantOrganizationId | no explicit local transaction detected |
| `refreshSupplierNetworkTrustEvidence` (L4625) | 10 | 10 | procurement_supplier_participants, procurement_supplier_relationships, supplier_network_performance_observations, supplier_network_qualifications | supplier_network_trust_evidence | assertProcurementActor, audit, ensureDatabase, json, listSupplierNetworkTrustEvidence, nowIso, tenantOrganizationId | explicit local transaction |
| `listSupplierNetworkPerformance` (L4659) | 2 | 2 | procurement_supplier_relationships, supplier_network_performance_observations | — | assertProcurementActor, tenantOrganizationId | no explicit local transaction detected |
| `getSupplierNetworkPerformance` (L4673) | 2 | 2 | procurement_supplier_relationships, supplier_network_performance_observations | — | assertProcurementActor, supplierNetworkPerformanceFromRow, tenantOrganizationId | no explicit local transaction detected |
| `recalculateSupplierNetworkPerformance` (L4686) | 9 | 9 | procurement_receipt_lines, procurement_receipts, procurement_rfq_responses, procurement_rfq_suppliers, procurement_rfqs, procurement_supplier_participants, purchase_order_items, purchase_orders | supplier_network_performance_observations | assertProcurementActor, audit, json, listSupplierNetworkPerformance, nowIso, tenantOrganizationId | explicit local transaction |
| `getSupplierNetworkMarketplaceIntegration` (L4739) | 3 | 3 | catalog_products, organizations, supplier_network_catalog_listings, supplier_network_profiles, tenants | — | assertProcurementActor, audit, ensureDatabase, marketplaceIntegrationVisible, marketplacePresenceForOrganization, supplierParticipantRow, tenantOrganizationId | no explicit local transaction detected |
| `discoverSupplierNetwork` (L4741) | 9 | 9 | catalog_products, organizations, procurement_supplier_participants, procurement_supplier_relationships, supplier_network_capabilities, supplier_network_capacity_signals, supplier_network_catalog_listings, supplier_network_commercial_terms, supplier_network_profiles, supplier_network_qualifications, supplier_network_service_areas, supplier_network_trust_evidence, tenants | — | assertProcurementActor, audit, ensureDatabase, marketplacePresenceForOrganization, normaliseCurrency, parseJSON, supplierNetworkDiscoveryVisible, tenantOrganizationId | no explicit local transaction detected |
| `getProcurementComparison` (L4819) | 0 | 0 | — | — | assertProcurementActor, comparisonRows, ensureDatabase, tenantOrganizationId | no explicit local transaction detected |
| `listProcurementComparisons` (L4826) | 1 | 1 | procurement_comparisons | — | assertProcurementActor, comparisonRows, ensureDatabase, tenantOrganizationId | no explicit local transaction detected |
| `createProcurementComparison` (L4838) | 11 | 11 | organizations, procurement_comparisons, procurement_rfq_items, procurement_rfq_response_items, procurement_rfq_responses, procurement_rfqs | procurement_comparison_line_offers, procurement_comparison_suppliers, procurement_comparisons | assertProcurementActor, audit, comparisonLeadSort, comparisonRows, comparisonValiditySort, comparisonValidityTimestamp, ensureDatabase, normaliseCurrency, nowIso, tenantOrganizationId | explicit local transaction |
| `getProcurementAward` (L4969) | 0 | 0 | — | — | assertProcurementActor, ensureDatabase, getProcurementAwardById, tenantOrganizationId | no explicit local transaction detected |
| `listProcurementAwards` (L4976) | 1 | 1 | procurement_awards | — | assertProcurementActor, ensureDatabase, getProcurementAwardById, tenantOrganizationId | no explicit local transaction detected |
| `createProcurementAward` (L4994) | 12 | 12 | procurement_awards, procurement_comparison_line_offers, procurement_comparisons, procurement_demands, procurement_rfq_items, procurement_rfq_responses, procurement_rfqs | procurement_award_lines, procurement_awards | assertProcurementActor, audit, ensureDatabase, getProcurementAwardById, normaliseCurrency, nowIso, procurementAwardHash, tenantOrganizationId | explicit local transaction |
| `transitionProcurementAward` (L5053) | 7 | 7 | procurement_award_lines, procurement_awards | procurement_awards, procurement_demands | assertProcurementActor, audit, ensureDatabase, getProcurementAwardById, nowIso, tenantOrganizationId | explicit local transaction |
| `listCustomerPricing` (L5106) | 1 | 1 | customer_pricing_rules | — | tenantOrganizationId | no explicit local transaction detected |
| `getCustomerPricing` (L5118) | 1 | 1 | customer_pricing_rules | — | customerPricingFromRow, tenantOrganizationId | no explicit local transaction detected |
| `upsertCustomerPricing` (L5123) | 5 | 5 | customer_pricing_rules | customer_pricing_rules | assertBusinessCustomer, assertCatalogProductForOrganization, audit, customerPricingFromRow, normaliseCurrency, nowIso, tenantCurrency, tenantOrganizationId | explicit local transaction |
| `updateCustomerPricing` (L5184) | 0 | 0 | — | — | getCustomerPricing, upsertCustomerPricing | no explicit local transaction detected |
| `getQuote` (L5218) | 0 | 0 | — | — | getQuoteByIdSync, tenantOrganizationId | no explicit local transaction detected |
| `listQuotes` (L5223) | 1 | 1 | quotes | — | quoteFromRow, quoteItemsFromRow, tenantOrganizationId | no explicit local transaction detected |
| `createQuote` (L5238) | 6 | 6 | customer_pricing_rules | quote_items, quotes | assertCatalogProductForOrganization, assertQuoteCustomer, audit, getQuoteByIdSync, nextQuoteNumber, normaliseCurrency, nowIso, parseJSON, tenantCurrency, tenantOrganizationId | explicit local transaction |
| `transitionQuote` (L5284) | 1 | 1 | — | quotes | audit, getQuoteByIdSync, nowIso, tenantOrganizationId | no explicit local transaction detected |
| `getCreditTerms` (L5379) | 1 | 1 | customer_credit_terms | — | creditTermsFromRow, tenantOrganizationId | no explicit local transaction detected |
| `listCreditTerms` (L5385) | 1 | 1 | customer_credit_terms | — | tenantOrganizationId | no explicit local transaction detected |
| `createCreditTerms` (L5395) | 2 | 2 | customer_credit_terms | customer_credit_terms | assertBusinessCustomerForCredit, audit, getCreditTerms, normaliseCurrency, nowIso, tenantCurrency, tenantOrganizationId | no explicit local transaction detected |
| `transitionCreditTerms` (L5430) | 1 | 1 | — | customer_credit_terms | audit, getCreditTerms, nowIso, tenantOrganizationId | no explicit local transaction detected |
| `updateCreditTerms` (L5448) | 1 | 1 | — | customer_credit_terms | audit, getCreditTerms, normaliseCurrency, nowIso, tenantCurrency, tenantOrganizationId | no explicit local transaction detected |
| `getPurchaseOrder` (L5467) | 0 | 0 | — | — | getPurchaseOrderByIdSync, tenantOrganizationId | no explicit local transaction detected |
| `listPurchaseOrders` (L5472) | 1 | 1 | purchase_orders | — | purchaseOrderFromRow, purchaseOrderItemsFromRow, tenantOrganizationId | no explicit local transaction detected |
| `createPurchaseOrder` (L5482) | 6 | 6 | purchase_orders | purchase_order_items, purchase_orders | audit, createPurchaseOrderFromProcurementAward, getPurchaseOrderByIdSync, getQuoteByIdSync, nextPurchaseOrderNumber, nowIso, tenantOrganizationId | explicit local transaction |
| `getProcurementReceipt` (L5562) | 0 | 0 | — | — | assertProcurementActor, getProcurementReceiptByIdSync, tenantOrganizationId | no explicit local transaction detected |
| `listProcurementReceipts` (L5568) | 1 | 1 | procurement_receipts | — | assertProcurementActor, getProcurementReceiptByIdSync, tenantOrganizationId | no explicit local transaction detected |
| `createProcurementReceipt` (L5579) | 12 | 12 | catalog_products, locations, procurement_receipt_lines, procurement_receipts, purchase_order_items, purchase_orders | procurement_receipt_lines, procurement_receipts | appendInventoryMovement, assertProcurementActor, audit, getProcurementReceiptByIdSync, nextProcurementReceiptNumber, nowIso, parseJSON, procurementReceiptHash, tenantOrganizationId | explicit local transaction |
| `createPurchaseOrderFromProcurementAward` (L5680) | 8 | 8 | procurement_award_lines, procurement_awards, procurement_rfq_items, purchase_orders | purchase_order_items, purchase_orders | assertProcurementActor, audit, getPurchaseOrderByIdSync, nextPurchaseOrderNumber, normaliseCurrency, nowIso, tenantCurrency, tenantOrganizationId | explicit local transaction |
| `transitionPurchaseOrder` (L5732) | 1 | 1 | — | purchase_orders | audit, getPurchaseOrderByIdSync, nowIso, tenantOrganizationId | no explicit local transaction detected |
| `getReceivable` (L5775) | 1 | 1 | accounts_receivable | — | ensureDatabase, receivableFromRow, tenantOrganizationId | no explicit local transaction detected |
| `listReceivables` (L5781) | 1 | 1 | accounts_receivable | — | ensureDatabase, tenantOrganizationId | no explicit local transaction detected |
| `createReceivable` (L5791) | 10 | 10 | accounts_receivable, customer_credit_terms, orders | accounts_receivable, ar_ledger_entries | addDaysIso, assertBusinessCustomerForReceivable, audit, ensureDatabase, getPurchaseOrderByIdSync, getReceivable, json, normaliseCurrency, nowIso, parseJSON, tenantCurrency, tenantOrganizationId | explicit local transaction |
| `transitionReceivable` (L5843) | 2 | 2 | — | accounts_receivable, ar_ledger_entries | audit, getReceivable, json, nowIso | no explicit local transaction detected |
| `allocatePaymentToReceivable` (L5857) | 7 | 7 | ar_payment_allocations | accounts_receivable, ar_ledger_entries, ar_payment_allocations | audit, getPayment, getReceivable, json, nowIso | explicit local transaction |
| `listReceivableLedger` (L5884) | 1 | 1 | ar_ledger_entries | — | getReceivable, normaliseCurrency, parseJSON | no explicit local transaction detected |
| `getInvoice` (L5908) | 1 | 1 | invoices | — | ensureDatabase, invoiceFromRow, invoiceItems, tenantOrganizationId | no explicit local transaction detected |
| `listInvoices` (L5915) | 1 | 1 | invoices | — | ensureDatabase, invoiceFromRow, invoiceItems, tenantOrganizationId | no explicit local transaction detected |
| `createInvoice` (L5940) | 6 | 6 | invoices | invoice_items, invoices | audit, ensureDatabase, getInvoice, getReceivable, nextInvoiceNumber, nowIso, sourceItemsForInvoice, tenantCurrency, tenantOrganizationId | explicit local transaction |
| `transitionInvoice` (L5969) | 5 | 5 | invoices | invoices | audit, ensureDatabase, getInvoice, invoiceFromRow, invoiceItems, nowIso, tenantOrganizationId | explicit local transaction |
| `listOrganizationLocations` (L6176) | 1 | 1 | locations | — | ensureCanonicalIdentityForTenant, ensureDatabase | no explicit local transaction detected |
| `getOrganizationLocation` (L6189) | 1 | 1 | locations | — | ensureCanonicalIdentityForTenant, ensureDatabase, organizationLocationFromRow | no explicit local transaction detected |
| `createOrganizationLocation` (L6197) | 2 | 2 | locations | locations | audit, ensureCanonicalIdentityForTenant, ensureDatabase, normaliseLocationStatus, normaliseLocationTimeZone, normaliseLocationType, nowIso, organizationLocationFromRow | no explicit local transaction detected |
| `updateOrganizationLocation` (L6219) | 3 | 3 | locations | locations | audit, ensureCanonicalIdentityForTenant, ensureDatabase, normaliseLocationStatus, normaliseLocationTimeZone, normaliseLocationType, organizationLocationFromRow | no explicit local transaction detected |
| `getIdentityForTenant` (L6245) | 3 | 3 | channel_identities, locations, organizations | — | ensureCanonicalIdentityForTenant, ensureDatabase, parseJSON | no explicit local transaction detected |
| `listServiceResources` (L6544) | 1 | 1 | service_resources | — | ensureCanonicalIdentityForTenant, ensureDatabase | no explicit local transaction detected |
| `createServiceResource` (L6557) | 10 | 10 | service_resource_commands, service_resources, tenants | service_resource_commands, service_resources | audit, ensureCanonicalIdentityForTenant, ensureDatabase, json, nowIso, serviceResourceFromRow, serviceResourceInput, validateServiceResourceReferences | explicit local transaction |
| `updateServiceResource` (L6602) | 11 | 11 | service_resource_commands, service_resource_commitments, service_resources, tenants | service_resource_commands, service_resources | audit, ensureCanonicalIdentityForTenant, ensureDatabase, json, nowIso, serviceResourceFromRow, serviceResourceInput, validateServiceResourceReferences | explicit local transaction |
| `getServiceResourceAvailability` (L6691) | 2 | 2 | locations, organizations, service_resource_availability, service_resources | — | ensureCanonicalIdentityForTenant, ensureDatabase, serviceResourceAvailabilityFromRow | no explicit local transaction detected |
| `setServiceResourceAvailability` (L6725) | 14 | 14 | locations, organizations, service_resource_availability, service_resource_availability_commands, service_resource_commitments, service_resources, tenants | service_resource_availability, service_resource_availability_commands | audit, ensureCanonicalIdentityForTenant, ensureDatabase, json, nowIso, parseJSON, serviceResourceAvailabilityFromRow | explicit local transaction |
| `createServiceBooking` (L6817) | 11 | 11 | orders, service_booking_commands, service_bookings, tenants | service_booking_commands, service_bookings | assertServiceBookingAuthorityBoundary, assertTelegramBuyerOwnsCanonicalServiceOrder, audit, bookingRequiredText, bookingTimestamp, ensureDatabase, getTenant, nowIso, orderFromRow, serviceBookingFromRow | explicit local transaction |
| `transitionServiceBooking` (L6867) | 18 | 18 | locations, orders, organizations, service_booking_commands, service_bookings, service_resource_availability, service_resource_commitments, service_resources, tenants | service_booking_commands, service_bookings, service_resource_commitments | assertServiceBookingAuthorityBoundary, assertTelegramBuyerOwnsCanonicalServiceOrder, audit, bookingRequiredText, ensureDatabase, getTenant, nowIso, orderFromRow, parseJSON, serviceBookingFromRow | explicit local transaction |
| `listServiceProviderBookings` (L6998) | 1 | 1 | service_bookings, service_resource_commitments, service_resources | — | ensureDatabase, getTenant, serviceBookingFromRow | no explicit local transaction detected |
| `listServiceBookings` (L7028) | 1 | 1 | service_bookings | — | ensureDatabase, getTenant | no explicit local transaction detected |
| `recordServiceDeliveryAssessment` (L7036) | 10 | 10 | orders, service_delivery_assessment_commands, tenants | orders, service_delivery_assessment_commands | assertLogisticsSchedulingAuthorization, audit, ensureDatabase, getCoreFulfillmentOrder, getTenant, json, nowIso, orderFromRow | explicit local transaction |
| `getOrCreateTenant` (L7255) | 3 | 3 | tenants | tenants | audit, ensureCanonicalIdentityForTenant, ensureDatabase, nowIso, tenantFromRow | no explicit local transaction detected |
| `getTenant` (L7275) | 1 | 1 | tenants | — | ensureDatabase, tenantCurrency, tenantFromRow | no explicit local transaction detected |
| `getBusinessTemplateConfig` (L7287) | 1 | 1 | tenant_business_templates | — | ensureDatabase, getTenant, parseJSON | no explicit local transaction detected |
| `saveBusinessTemplateConfig` (L7301) | 4 | 4 | — | tenant_business_templates | audit, ensureDatabase, getTenant, json, nowIso | explicit local transaction |
| `getTenantByApiKey` (L7368) | 1 | 1 | tenants | — | ensureDatabase, tenantFromRow | no explicit local transaction detected |
| `updateTenant` (L7374) | 3 | 3 | catalog_products, orders | organizations, tenants | audit, ensureDatabase, getTenant, json, normaliseCurrency, tenantCurrency | no explicit local transaction detected |
| `listTenants` (L7416) | 1 | 1 | tenants | — | ensureDatabase | no explicit local transaction detected |
| `getCatalog` (L7421) | 1 | 1 | catalog_products | — | ensureDatabase | no explicit local transaction detected |
| `saveCatalog` (L7428) | 8 | 8 | catalog_products, inventory_movements, orders, tenants | catalog_products | audit, ensureDatabase, ensureInventoryOpeningBalances, insertProduct, parseJSON, tenantCurrency | explicit local transaction |
| `listCustomers` (L7536) | 1 | 1 | customers | — | ensureDatabase, getTenant | no explicit local transaction detected |
| `getCustomer` (L7553) | 1 | 1 | customers | — | customerFromRow, ensureDatabase, getTenant | no explicit local transaction detected |
| `upsertCustomer` (L7647) | 0 | 0 | — | — | upsertCustomerSync | no explicit local transaction detected |
| `updateCustomer` (L7651) | 0 | 0 | — | — | getCustomer, upsertCustomer | no explicit local transaction detected |
| `listInventoryMovements` (L7686) | 1 | 1 | inventory_movements | — | ensureDatabase, getTenant | no explicit local transaction detected |
| `getInventoryBalances` (L7700) | 1 | 1 | inventory_movements | — | ensureDatabase, getTenant | no explicit local transaction detected |
| `appendInventoryMovement` (L7837) | 3 | 3 | — | — | appendInventoryMovementInTransaction, ensureDatabase, getTenant, waitForInventoryTransactionSlot | explicit local transaction |
| `appendInventoryMovementBatch` (L7872) | 4 | 4 | inventory_movements | — | appendInventoryMovementInTransaction, canonicalizeInventoryCommandValue, ensureDatabase, getTenant, waitForInventoryTransactionSlot | explicit local transaction |
| `processSyncEvent` (L7999) | 6 | 6 | sync_events | sync_events | appendInventoryMovementInTransaction, ensureDatabase, getTenant, json, nowIso, upsertCustomerSync | explicit local transaction |
| `createPaymentWithIntent` (L8161) | 18 | 18 | customers, orders, payment_accounts, payment_idempotency_keys, payment_intents, payment_refunds, payments | payment_idempotency_keys, payment_intents, payment_ledger_entries, payments | audit, ensureDatabase, hashPaymentRequest, json, normaliseCurrency, nowIso, parseJSON, paymentFromRow, paymentIntentFromRow, resolvePaymentContext, syncMarketplacePaymentAllocation, tenantCurrency | explicit local transaction |
| `getPaymentIntent` (L8266) | 1 | 1 | payment_intents | — | ensureDatabase, paymentIntentFromRow, resolvePaymentContext | no explicit local transaction detected |
| `insertPaymentIntent` (L8271) | 4 | 4 | orders, payment_accounts, payment_intents | payment_intents | ensureDatabase, json, normaliseCurrency, nowIso, paymentIntentFromRow, resolvePaymentContext, tenantCurrency | no explicit local transaction detected |
| `getPaymentAccountForProviderNotification` (L8303) | 1 | 1 | payment_accounts, tenants | — | ensureDatabase, parseJSON | no explicit local transaction detected |
| `resolvePaymentIntentForProviderEvidence` (L8328) | 4 | 2 | payment_evidence, payment_intents | — | ensureDatabase, getPaymentAccountForProviderNotification, nowIso, paymentEvidenceFromRow, paymentIntentFromRow | no explicit local transaction detected |
| `insertProviderNotificationEvidence` (L8425) | 8 | 8 | payment_accounts, payment_evidence | payment_evidence | audit, classifyProviderNotificationIdentity, ensureDatabase, json, nowIso, paymentEvidenceFromRow, resolvePaymentIntentForProviderEvidence | no explicit local transaction detected |
| `createPaymentConfirmationAttempt` (L8610) | 7 | 7 | payment_confirmation_attempts, payment_evidence, payment_intents, payments | payment_confirmation_attempts | audit, ensureDatabase, nowIso, paymentConfirmationAttemptFromRow, tenantOrganizationId | no explicit local transaction detected |
| `updatePaymentConfirmationAttempt` (L8646) | 3 | 3 | payment_confirmation_attempts | payment_confirmation_attempts | audit, ensureDatabase, json, nowIso, parseJSON, paymentConfirmationAttemptFromRow, tenantOrganizationId | no explicit local transaction detected |
| `getPaymentConfirmationAttempt` (L8679) | 1 | 1 | payment_confirmation_attempts | — | ensureDatabase, paymentConfirmationAttemptFromRow, tenantOrganizationId | no explicit local transaction detected |
| `getPaymentConfirmationAttemptByProviderTransaction` (L8687) | 1 | 1 | payment_confirmation_attempts, payment_evidence | — | ensureDatabase, paymentConfirmationAttemptFromRow, tenantOrganizationId | no explicit local transaction detected |
| `insertPaymentEvidence` (L8710) | 6 | 6 | payment_evidence, payment_intents, payments | payment_evidence | audit, ensureDatabase, hashPaymentRequest, json, nowIso, paymentEvidenceFromRow, resolvePaymentContext | no explicit local transaction detected |
| `listPaymentEvidence` (L8781) | 1 | 1 | payment_evidence | — | ensureDatabase, getPayment | no explicit local transaction detected |
| `insertPaymentVerification` (L8787) | 9 | 9 | payment_evidence, payment_intents, payment_verifications, payments | payment_verifications | audit, ensureDatabase, json, nowIso, paymentVerificationFromRow, resolvePaymentContext | no explicit local transaction detected |
| `listPaymentVerifications` (L8917) | 1 | 1 | payment_verifications | — | ensureDatabase, getPayment | no explicit local transaction detected |
| `insertPaymentDecision` (L8923) | 5 | 5 | payment_decisions, payment_verifications, payments | payment_decisions | ensureDatabase, json, nowIso, paymentDecisionFromRow, resolvePaymentContext | no explicit local transaction detected |
| `listPaymentDecisions` (L8970) | 1 | 1 | payment_decisions | — | ensureDatabase, getPayment | no explicit local transaction detected |
| `getPaymentIdempotency` (L8976) | 1 | 1 | payment_idempotency_keys | — | ensureDatabase, resolvePaymentContext | no explicit local transaction detected |
| `insertPaymentIdempotency` (L8981) | 1 | 1 | — | payment_idempotency_keys | ensureDatabase, getPaymentIdempotency, nowIso, resolvePaymentContext | no explicit local transaction detected |
| `updatePaymentIdempotencyProgress` (L8993) | 1 | 1 | — | payment_idempotency_keys | ensureDatabase, getPaymentIdempotency, resolvePaymentContext | no explicit local transaction detected |
| `completePaymentIdempotency` (L9015) | 1 | 1 | — | payment_idempotency_keys | ensureDatabase, getPaymentIdempotency, resolvePaymentContext | no explicit local transaction detected |
| `beginPaymentStatusQuery` (L9040) | 11 | 11 | payment_status_query_commands, payments | payment_status_query_commands | ensureDatabase, nowIso, resolvePaymentContext | explicit local transaction |
| `markPaymentStatusQueryProviderStarted` (L9137) | 1 | 1 | — | payment_status_query_commands | ensureDatabase, nowIso, resolvePaymentContext | no explicit local transaction detected |
| `completePaymentStatusQuery` (L9164) | 3 | 3 | payment_status_query_commands | payment_status_query_commands | ensureDatabase, json, nowIso, resolvePaymentContext | no explicit local transaction detected |
| `commitPaymentDecision` (L9205) | 26 | 26 | marketplace_payment_allocations, marketplace_seller_orders, payment_accounts, payment_evidence, payment_idempotency_keys, payment_intents, payment_status_query_commands, payment_verifications, payments | marketplace_payment_allocations, marketplace_settlements, payment_decisions, payment_idempotency_keys, payment_ledger_entries, payments | audit, ensureDatabase, json, normaliseCurrency, nowIso, paymentFromRow, paymentVerificationFromRow, resolvePaymentContext | explicit local transaction |
| `listPaymentAccounts` (L9633) | 1 | 1 | payment_accounts | — | ensureDatabase, parseJSON, resolvePaymentContext | no explicit local transaction detected |
| `createPaymentAccount` (L9644) | 1 | 1 | — | payment_accounts | audit, ensureDatabase, json, listPaymentAccounts, nowIso, resolvePaymentContext | no explicit local transaction detected |
| `createPayment` (L9661) | 9 | 9 | customers, orders, payment_accounts, payments | payment_ledger_entries, payments | audit, ensureDatabase, json, normaliseCurrency, nowIso, parseJSON, paymentFromRow, resolvePaymentContext, syncMarketplacePaymentAllocation, tenantCurrency | explicit local transaction |
| `listPaymentRoutingPolicies` (L9717) | 1 | 1 | payment_routing_policies | — | ensureDatabase, getTenantByChatId, parseJSON | no explicit local transaction detected |
| `upsertPaymentRoutingPolicy` (L9735) | 3 | 3 | payment_routing_policies | payment_routing_policies | ensureDatabase, getTenantByChatId, json, listPaymentRoutingPolicies, nowIso | no explicit local transaction detected |
| `getPaymentSettlementByIdempotencyKey` (L9764) | 1 | 1 | payment_settlements | — | ensureDatabase, getTenantByChatId, normalizePaymentSettlement | no explicit local transaction detected |
| `createPaymentSettlement` (L9772) | 3 | 3 | payment_settlements, payments | payment_settlements | audit, ensureDatabase, getTenantByChatId, json, normaliseCurrency, normalizePaymentSettlement, nowIso | no explicit local transaction detected |
| `finalizePaymentSettlement` (L9841) | 7 | 7 | payment_settlements | payment_settlements | audit, ensureDatabase, getTenantByChatId, json, normalizePaymentSettlement, nowIso | explicit local transaction |
| `listPaymentSettlements` (L9883) | 1 | 1 | payment_settlements | — | ensureDatabase, getTenantByChatId | no explicit local transaction detected |
| `getPaymentRefunds` (L9918) | 1 | 1 | payment_refunds | — | ensureDatabase, getTenantByChatId | no explicit local transaction detected |
| `getPaymentRefundByIdempotencyKey` (L9928) | 1 | 1 | payment_refunds | — | ensureDatabase, getTenantByChatId, normalizePaymentRefund | no explicit local transaction detected |
| `createPaymentRefundRequest` (L9936) | 4 | 4 | payment_refunds, payments | payment_refunds | audit, ensureDatabase, getTenantByChatId, normaliseCurrency, normalizePaymentRefund, nowIso | no explicit local transaction detected |
| `finalizePaymentRefund` (L9997) | 24 | 24 | marketplace_payment_allocations, marketplace_refunds, payment_refunds, payments | marketplace_payment_allocations, marketplace_refunds, marketplace_settlements, payment_ledger_entries, payment_refunds, payments | audit, ensureDatabase, getTenantByChatId, json, normalizePaymentRefund, nowIso | explicit local transaction |
| `getPayment` (L10117) | 1 | 1 | payments | — | ensureDatabase, paymentFromRow, resolvePaymentContext | no explicit local transaction detected |
| `getOrderPaymentSummary` (L10123) | 2 | 2 | orders, payment_refunds, payments | — | ensureDatabase, normaliseCurrency, resolvePaymentContext | no explicit local transaction detected |
| `listPayments` (L10174) | 1 | 1 | payments | — | ensureDatabase, resolvePaymentContext | no explicit local transaction detected |
| `transitionPayment` (L10185) | 12 | 12 | marketplace_payment_allocations, marketplace_seller_orders, payments | marketplace_payment_allocations, marketplace_settlements, payment_ledger_entries, payments | audit, ensureDatabase, json, normaliseCurrency, nowIso, paymentFromRow, paymentStateTimestampColumn, resolvePaymentContext | explicit local transaction |
| `listPaymentLedger` (L10228) | 1 | 1 | payment_ledger_entries | — | ensureDatabase, getPayment, normaliseCurrency, parseJSON | no explicit local transaction detected |
| `recordPaymentReconciliation` (L10238) | 3 | 3 | payment_reconciliations | payment_reconciliations | ensureDatabase, getPayment, json, normaliseCurrency, nowIso | no explicit local transaction detected |
| `listPaymentReconciliations` (L10283) | 1 | 1 | payment_reconciliations | — | ensureDatabase, getPayment | no explicit local transaction detected |
| `reconcilePayment` (L10292) | 2 | 2 | payment_reconciliations | payment_reconciliations | ensureDatabase, getPayment, normaliseCurrency, nowIso, transitionPayment | no explicit local transaction detected |
| `getOrderFulfillment` (L10411) | 1 | 1 | fulfillments | — | ensureDatabase, fulfillmentFromRow, getCoreFulfillmentOrder | no explicit local transaction detected |
| `selectDeliveryCourier` (L10487) | 1 | 1 | delivery_assignments, membership_roles, memberships | — | ensureDatabase | no explicit local transaction detected |
| `assignDeliveryCourier` (L10521) | 19 | 19 | delivery_assignment_commands, delivery_assignments, fulfillments, membership_roles, memberships, orders, tenants | delivery_assignment_commands, delivery_assignments, fulfillments | assertLogisticsSchedulingAuthorization, assertServiceDeliveryReadyForExecution, audit, ensureDatabase, getCoreFulfillmentOrder, getTenant, hasCourierLocationGrant, json, normalizeCoreFulfillmentType, nowIso, orderFromRow, selectDeliveryCourier | explicit local transaction |
| `listDeliveryAssignments` (L10683) | 3 | 3 | delivery_assignments, fulfillments, locations, membership_roles, memberships, users | — | ensureDatabase, getTenant, parseJSON | no explicit local transaction detected |
| `getDeliveryAssignment` (L10784) | 2 | 2 | delivery_assignments, fulfillments, locations, membership_roles, memberships | — | ensureDatabase, getTenant, hasCourierLocationGrant, parseJSON | no explicit local transaction detected |
| `assertCourierOwnsDelivery` (L10846) | 1 | 1 | membership_roles, memberships | — | ensureDatabase, getDeliveryAssignment, getTenant, hasCourierLocationGrant | no explicit local transaction detected |
| `createLogisticsSchedulingActivity` (L11105) | 7 | 7 | logistics_scheduling_activities | logistics_scheduling_activities | assertLogisticsSchedulingAuthorization, assertSchedulingLocation, assertSchedulingReferences, audit, ensureDatabase, getCanonicalSchedulingTimeZone, getTenant, json, logisticsSchedulingRow, nowIso, parseJSON, schedulingRequestHash | explicit local transaction |
| `getLogisticsSchedulingTimeZone` (L11237) | 0 | 0 | — | — | ensureDatabase, getCanonicalSchedulingTimeZone, getTenant | no explicit local transaction detected |
| `getLogisticsSchedulingActivity` (L11244) | 1 | 1 | logistics_scheduling_activities | — | ensureDatabase, getTenant, logisticsSchedulingRow | no explicit local transaction detected |
| `listLogisticsSchedulingActivities` (L11254) | 1 | 1 | logistics_scheduling_activities | — | assertSchedulingLocation, ensureDatabase, getTenant | no explicit local transaction detected |
| `evaluateLogisticsSchedulingActivity` (L11289) | 2 | 2 | logistics_scheduling_activities | — | assertLogisticsSchedulingAuthorization, assertSchedulingLocation, ensureDatabase, getCanonicalSchedulingTimeZone, getTenant, parseJSON | no explicit local transaction detected |
| `transitionLogisticsSchedulingActivity` (L11362) | 9 | 9 | logistics_scheduling_activities | logistics_scheduling_activities | assertLogisticsSchedulingAuthorization, assertSchedulingLocation, audit, ensureDatabase, getCanonicalSchedulingTimeZone, getTenant, logisticsSchedulingRow, nowIso, parseJSON | explicit local transaction |
| `transitionDeliveryAssignment` (L11650) | 36 | 36 | delivery_assignment_commands, delivery_assignments, fulfillments, locations, membership_roles, memberships, orders, tenants | delivery_assignment_commands, delivery_assignments, fulfillments | applyCoreFulfillmentInventoryConsequence, assertDeliveryProofInput, audit, deliveryProofReference, ensureDatabase, getCoreFulfillmentOrder, getTenant, hasCourierLocationGrant, isCanonicalMarketplaceOrderRow, json, normalizeCoreFulfillmentStatus, nowIso, orderFromRow, parseJSON, resolveDeliveryProof | explicit local transaction |
| `transitionOrderFulfillment` (L11912) | 17 | 17 | delivery_assignments, fulfillment_commands, fulfillments, locations, orders, tenants, users | fulfillment_commands, fulfillments | applyCoreFulfillmentInventoryConsequence, assertDeliveryProofInput, assertServiceDeliveryReadyForExecution, audit, ensureDatabase, fulfillmentFromRow, getCoreFulfillmentOrder, isCanonicalMarketplaceOrderRow, json, normalizeCoreFulfillmentStatus, normalizeCoreFulfillmentType, nowIso, orderFromRow, parseJSON, resolveDeliveryProof | explicit local transaction |
| `coreFulfillmentContract` (L12144) | 0 | 0 | — | — | — | no explicit local transaction detected |
| `getOrders` (L12164) | 1 | 1 | orders | — | ensureDatabase, orderFromRow | no explicit local transaction detected |
| `saveQueuedOrders` (L12172) | 6 | 6 | customers, orders, payments, tenants | — | audit, ensureCanonicalPaymentForOrder, ensureDatabase, insertOrder, normaliseCurrency, nowIso, parseJSON, queuedOrderIdentityHash, tenantCurrency, upsertCustomerSync, validateAndTotalOrderItems | explicit local transaction |
| `pullNewOrders` (L12272) | 5 | 5 | orders | orders | audit, ensureDatabase, orderFromRow | explicit local transaction |
| `searchMarketplaceListings` (L12299) | 1 | 1 | catalog_products, tenants | — | defaultVendorCode, ensureDatabase, normaliseCurrency, parseJSON, productFromRow | no explicit local transaction detected |
| `createMarketplaceOrder` (L12327) | 19 | 19 | catalog_products, inventory_movements, locations, marketplace_checkout_idempotency, marketplace_orders, tenants | marketplace_checkout_idempotency, marketplace_fulfillments, marketplace_inventory_reservations, marketplace_orders, marketplace_payment_allocations, marketplace_seller_orders, marketplace_settlements | appendInventoryMovementInTransaction, audit, defaultVendorCode, ensureDatabase, hashToken, insertOrder, insertProduct, json, normaliseCurrency, nowIso, parseJSON, productFromRow | explicit local transaction |
| `updateMarketplaceOrderStatus` (L12701) | 24 | 24 | catalog_products, inventory_movements, locations, marketplace_payment_allocations, marketplace_seller_orders, orders, payment_refunds, payments, tenants | marketplace_fulfillments, marketplace_inventory_reservations, marketplace_orders, marketplace_payment_allocations, marketplace_refunds, marketplace_seller_orders, marketplace_settlements, orders, payment_refunds | appendInventoryMovementInTransaction, audit, ensureDatabase, insertProduct, json, nowIso, orderFromRow, parseJSON, productFromRow | explicit local transaction |
| `getMarketplaceOrderTracking` (L12904) | 2 | 2 | orders, tenants | — | ensureDatabase, getTenant, hashToken, normaliseCurrency, orderFromRow, parseJSON | no explicit local transaction detected |
| `getTelegramBuyerFulfillmentExperience` (L12929) | 1 | 1 | fulfillments, marketplace_fulfillments, marketplace_orders, marketplace_seller_orders, orders | — | ensureDatabase, getTenant, parseJSON | no explicit local transaction detected |
| `listTelegramBuyerOrders` (L12983) | 1 | 1 | marketplace_orders, marketplace_seller_orders | — | ensureDatabase, getTenant | no explicit local transaction detected |
| `getTelegramBuyerServiceBookings` (L13017) | 2 | 2 | marketplace_orders, marketplace_seller_orders, orders, service_bookings, service_resource_commitments, service_resources | — | ensureDatabase, getTenant, orderFromRow | no explicit local transaction detected |
| `assessTelegramBuyerServiceFeasibility` (L13079) | 4 | 4 | locations, membership_roles, memberships, organizations, service_bookings, service_resource_availability, service_resource_commitments, service_resources | — | bookingRequiredText, bookingTimestamp, ensureDatabase, getTelegramBuyerServiceBookings, getTenant, parseJSON | no explicit local transaction detected |
| `listAuditEvents` (L13217) | 1 | 1 | audit_events | — | ensureDatabase, getTenant, parseJSON | no explicit local transaction detected |
| `verifyAuditEventChain` (L13252) | 1 | 1 | audit_events | — | ensureDatabase, getTenant, json | no explicit local transaction detected |
| `createDatabaseBackup` (L13323) | 1 | 1 | — | — | ensureDatabase, sqlString | no explicit local transaction detected |
| `getOrCreateUserByTelegram` (L13346) | 4 | 4 | users | users | ensureDatabase, nowIso | no explicit local transaction detected |
| `listTenantMemberships` (L13360) | 2 | 2 | membership_roles, memberships, users | — | ensureDatabase | no explicit local transaction detected |
| `listUserMemberships` (L13380) | 1 | 1 | memberships, tenants | — | ensureDatabase, parseJSON | no explicit local transaction detected |
| `assignMembershipContextualRole` (L13448) | 8 | 8 | locations, membership_roles, memberships, service_resources, tenants | membership_roles | assertContextualRoleAssignable, audit, ensureDatabase, nowIso | no explicit local transaction detected |
| `revokeMembershipContextualRole` (L13541) | 4 | 4 | membership_roles, memberships | membership_roles | audit, ensureDatabase, nowIso | no explicit local transaction detected |
| `changeMembershipRole` (L13602) | 6 | 6 | memberships | membership_roles, memberships | audit, ensureDatabase, nowIso | no explicit local transaction detected |
| `ensureMembership` (L13657) | 0 | 0 | — | — | ensureMembershipSync | no explicit local transaction detected |
| `createTenantForUser` (L13661) | 10 | 10 | auth_challenges, tenant_creation_requests | auth_challenges, tenant_creation_requests, tenants | audit, ensureCanonicalIdentityForTenant, ensureDatabase, ensureMembershipSync, hashToken, json, normaliseCurrency, nowIso, parseJSON | explicit local transaction |
| `createSession` (L13741) | 4 | 4 | locations, membership_roles, memberships, pack_lifecycle, tenants | sessions | createDeviceRow, ensureDatabase, hashToken | no explicit local transaction detected |
| `authenticateSessionToken` (L13776) | 2 | 2 | devices, locations, membership_roles, memberships, pack_lifecycle, sessions, tenants | devices | ensureDatabase, hashToken, nowIso, parseJSON | no explicit local transaction detected |
| `recordAuditEvent` (L13906) | 0 | 0 | — | — | audit, ensureDatabase | no explicit local transaction detected |
| `getAuditRetentionPolicy` (L13925) | 1 | 1 | audit_retention_policies | — | ensureDatabase, getTenant | no explicit local transaction detected |
| `setAuditRetentionPolicy` (L13938) | 1 | 1 | — | audit_retention_policies | audit, ensureDatabase, getAuditRetentionPolicy, getTenant, nowIso | no explicit local transaction detected |
| `createComplianceRequest` (L13965) | 3 | 3 | customers, locations | compliance_requests | audit, ensureDatabase, getComplianceRequest, getTenant, nowIso | no explicit local transaction detected |
| `getComplianceRequest` (L14010) | 1 | 1 | compliance_requests | — | ensureDatabase, getTenant | no explicit local transaction detected |
| `listComplianceRequests` (L14023) | 1 | 1 | compliance_requests | — | ensureDatabase, getTenant | no explicit local transaction detected |
| `resolveComplianceRequest` (L14040) | 1 | 1 | — | compliance_requests | audit, ensureDatabase, getComplianceRequest, getTenant, nowIso | no explicit local transaction detected |
| `buildComplianceExport` (L14073) | 7 | 7 | audit_events, customers, locations, orders | — | customerFromRow, ensureDatabase, getAuditRetentionPolicy, getTenant, listComplianceRequests, nowIso, parseJSON | no explicit local transaction detected |
| `revokeSession` (L14157) | 1 | 1 | — | sessions | ensureDatabase, nowIso | no explicit local transaction detected |
| `listDevices` (L14169) | 1 | 1 | devices, sessions | — | ensureDatabase | no explicit local transaction detected |
| `revokeDevice` (L14220) | 4 | 4 | devices, memberships | devices, sessions | audit, ensureDatabase, nowIso | no explicit local transaction detected |
| `createAuthChallenge` (L14236) | 1 | 1 | — | auth_challenges | ensureDatabase, hashToken | no explicit local transaction detected |
| `getAuthChallengeForTenantCreation` (L14245) | 2 | 2 | auth_challenges, tenant_creation_requests | — | ensureDatabase, hashToken | no explicit local transaction detected |
| `consumeAuthChallenge` (L14258) | 2 | 2 | auth_challenges | auth_challenges | ensureDatabase, hashToken, nowIso | no explicit local transaction detected |
| `createPairingChallenge` (L14267) | 2 | 2 | memberships | pairing_challenges | audit, ensureDatabase, hashToken | no explicit local transaction detected |
| `consumePairingChallenge` (L14282) | 6 | 6 | pairing_challenges | pairing_challenges, users | audit, ensureDatabase, ensureMembershipSync, hashToken, nowIso | explicit local transaction |
| `createInvite` (L14310) | 2 | 2 | memberships | invites | audit, ensureDatabase, hashToken | no explicit local transaction detected |
| `listInvites` (L14328) | 1 | 1 | invites, users | — | ensureDatabase | no explicit local transaction detected |
| `revokeInvite` (L14345) | 3 | 3 | invites, memberships | invites | audit, ensureDatabase, hashToken, nowIso | no explicit local transaction detected |
| `consumeInvite` (L14364) | 9 | 9 | invites, memberships, tenants | invites, memberships | audit, ensureDatabase, ensureMembershipSync, hashToken, nowIso, roleRank | explicit local transaction |
| `createPaymentOperationalAction` (L14401) | 3 | 3 | payment_operational_actions | payment_operational_actions | audit, ensureDatabase, getPayment, normalizePaymentOperationalAction, nowIso | no explicit local transaction detected |
| `updatePaymentOperationalAction` (L14428) | 3 | 3 | payment_operational_actions, payments, tenants | payment_operational_actions | audit, ensureDatabase, json, normalizePaymentOperationalAction, nowIso | no explicit local transaction detected |
| `listPaymentOperationalActions` (L14450) | 1 | 0 | — | — | ensureDatabase, getPayment | no explicit local transaction detected |
| `recordPaymentProviderCapabilityEvidence` (L14465) | 3 | 3 | payment_provider_capability_certifications | payment_provider_capability_certifications | audit, ensureDatabase, getTenantByChatId, json, normalizePaymentProviderCapabilityCertification, nowIso | no explicit local transaction detected |
| `certifyPaymentProviderCapability` (L14521) | 4 | 4 | payment_provider_capability_certifications | payment_provider_capability_certifications | audit, ensureDatabase, getTenantByChatId, json, normalizePaymentProviderCapabilityCertification, nowIso | no explicit local transaction detected |
| `listPaymentProviderCapabilityEvidence` (L14591) | 1 | 1 | payment_provider_capability_certifications | — | ensureDatabase, getTenantByChatId | no explicit local transaction detected |
| `recordPaymentProductionCertification` (L14626) | 3 | 3 | payment_production_certifications | payment_production_certifications | audit, ensureDatabase, getTenantByChatId, json, normalizePaymentProductionCertification, nowIso | no explicit local transaction detected |
| `listPaymentProductionCertifications` (L14674) | 2 | 2 | payment_production_certifications | — | ensureDatabase, getTenantByChatId | no explicit local transaction detected |
| `getDatabasePath` (L14704) | 0 | 0 | — | — | — | no explicit local transaction detected |
| `getDatabaseForTests` (L14709) | 0 | 0 | — | — | ensureDatabase | no explicit local transaction detected |
| `listRestaurantRecipes` (L14776) | 2 | 2 | restaurant_recipes | — | ensureDatabase, getTenant | no explicit local transaction detected |
| `createRestaurantRecipe` (L14786) | 7 | 7 | restaurant_recipes | restaurant_recipes | audit, ensureDatabase, getTenant, json, normalizeRestaurantRecipeInput, nowIso, restaurantRecipeFromRow, waitForInventoryTransactionSlot | explicit local transaction |
| `updateRestaurantRecipe` (L14825) | 6 | 6 | restaurant_recipes | restaurant_recipes | audit, ensureDatabase, getTenant, json, normalizeRestaurantRecipeInput, nowIso, parseJSON, restaurantRecipeFromRow, waitForInventoryTransactionSlot | explicit local transaction |

## Table ownership and dependency map

| Table | Provisional logical owner | Read/write scopes | DDL source lines |
|---|---|---:|---|
| `accounts_receivable` | B2B commerce | 3/3 | 1043 |
| `ar_ledger_entries` | B2B commerce | 1/3 | 1067 |
| `ar_payment_allocations` | B2B commerce | 1/1 | 1085 |
| `audit_events` | Audit | 4/2 | 355 |
| `audit_retention_policies` | Audit | 1/1 | 690 |
| `auth_challenges` | Identity and access | 3/3 | 410 |
| `catalog_products` | Catalog | 18/3 | 316 |
| `channel_identities` | Channel and integration configuration | 3/2 | 497 |
| `compliance_requests` | Compliance | 2/2 | 697 |
| `customer_credit_terms` | B2B commerce | 4/3 | 1008 |
| `customer_pricing_rules` | B2B commerce | 4/1 | 873 |
| `customers` | Commerce / customer | 12/1 | 585 |
| `delivery_assignment_commands` | Fulfillment and Logistics | 2/2 | 2588 |
| `delivery_assignments` | Fulfillment and Logistics | 6/2 | 2224 |
| `delivery_assignments_v44` | Fulfillment and Logistics | 0/1 | 2254 |
| `devices` | Identity and access | 4/3 | 390 |
| `fulfillment_commands` | Fulfillment and Logistics | 1/2 | 2551 |
| `fulfillments` | Fulfillment and Logistics | 9/3 | 2195 |
| `inventory_movements` | Inventory | 10/3 | 622 |
| `invites` | Identity and access | 3/3 | 449 |
| `invoice_items` | B2B commerce | 1/1 | 1133 |
| `invoices` | B2B commerce | 5/2 | 1111 |
| `locations` | Tenant and organization core | 33/4 | 485 |
| `logistics_scheduling_activities` | Logistics Scheduling request coordination | 5/2 | 3236 |
| `marketplace_checkout_idempotency` | Marketplace | 1/1 | 1267 |
| `marketplace_fulfillments` | Marketplace | 1/2 | 1192 |
| `marketplace_inventory_reservations` | Marketplace | 0/2 | 1205 |
| `marketplace_orders` | Marketplace | 5/2 | 1154 |
| `marketplace_payment_allocations` | Marketplace | 5/6 | 1220 |
| `marketplace_payment_allocations_v40` | Marketplace | 0/1 | 2106 |
| `marketplace_refunds` | Marketplace | 1/2 | 1251 |
| `marketplace_seller_orders` | Marketplace | 8/2 | 1175 |
| `marketplace_settlements` | Marketplace | 0/6 | 1236 |
| `membership_roles` | Identity and access | 12/5 | 3136 |
| `memberships` | Identity and access | 21/3 | 379 |
| `metadata` | Persistence infrastructure | 1/1 | 297 |
| `orders` | Commerce / customer | 28/5 | 329 |
| `organizations` | Tenant and organization core | 20/3 | 476 |
| `pack_lifecycle` | Pack and business-template configuration | 5/1 | 2161 |
| `pairing_challenges` | Identity and access | 1/2 | 417, 433 |
| `payment_accounts` | Payments | 7/1 | 776 |
| `payment_confirmation_attempts` | Payments | 4/2 | 2420 |
| `payment_decisions` | Payments | 2/2 | 2368 |
| `payment_evidence` | Payments | 8/2 | 2312 |
| `payment_idempotency_keys` | Payments | 3/5 | 2388 |
| `payment_intents` | Payments | 8/2 | 2290 |
| `payment_ledger_entries` | Payments | 1/5 | 824 |
| `payment_ledger_entries_gap113` | Payments | 0/1 | 3071 |
| `payment_operational_actions` | Payments | 2/2 | 2807 |
| `payment_outbound_intents` | Payments | 6/2 | 1777 |
| `payment_procurement_settlement_allocations` | Payments | 5/1 | 1827 |
| `payment_procurement_settlements` | Payments | 4/2 | 1811 |
| `payment_production_certifications` | Payments | 2/1 | 2841 |
| `payment_provider_capability_certifications` | Payments | 3/2 | 2871 |
| `payment_reconciliations` | Payments | 3/2 | 841 |
| `payment_refunds` | Payments | 7/3 | 2988 |
| `payment_routing_policies` | Payments | 2/1 | 2782 |
| `payment_settlements` | Payments | 4/2 | 2949 |
| `payment_status_query_commands` | Payments | 3/4 | 2452 |
| `payment_verifications` | Payments | 4/1 | 2341 |
| `payments` | Payments | 20/6 | 790 |
| `payments_gap113` | Payments | 0/1 | 3030 |
| `phone_routing` | Channel and integration configuration | 0/1 | 349 |
| `procurement_award_lines` | Procurement | 3/1 | 1612 |
| `procurement_awards` | Procurement | 5/2 | 1586 |
| `procurement_comparison_line_offers` | Procurement | 2/1 | 1557 |
| `procurement_comparison_suppliers` | Procurement | 1/1 | 1536 |
| `procurement_comparisons` | Procurement | 4/1 | 1523 |
| `procurement_demand_items` | Procurement | 4/2 | 1321 |
| `procurement_demands` | Procurement | 6/4 | 1288 |
| `procurement_receipt_lines` | Procurement | 3/1 | 1742 |
| `procurement_receipts` | Procurement | 5/1 | 1722 |
| `procurement_rfq_items` | Procurement | 5/1 | 1430 |
| `procurement_rfq_response_items` | Procurement | 4/1 | 1483 |
| `procurement_rfq_responses` | Procurement | 6/2 | 1459 |
| `procurement_rfq_suppliers` | Procurement | 4/2 | 1447 |
| `procurement_rfqs` | Procurement | 9/2 | 1404 |
| `procurement_supplier_participants` | Procurement | 6/1 | 1369 |
| `procurement_supplier_relationships` | Procurement | 10/2 | 1379 |
| `purchase_order_items` | Procurement | 3/2 | 974 |
| `purchase_orders` | Procurement | 10/3 | 950 |
| `purchase_orders_phase17_6_new` | Procurement | 0/1 | 1656 |
| `quote_items` | B2B commerce | 1/1 | 923 |
| `quotes` | B2B commerce | 3/2 | 902 |
| `restaurant_recipes` | Restaurant capability | 3/2 | 3558 |
| `schema_migrations` | Persistence infrastructure | 1/1 | 293 |
| `service_booking_commands` | Service capability | 2/2 | 2668 |
| `service_bookings` | Service capability | 6/3 | 2652 |
| `service_delivery_assessment_commands` | Service capability | 1/2 | 2606 |
| `service_resource_availability` | Service capability | 4/1 | 3358 |
| `service_resource_availability_commands` | Service capability | 1/1 | 3371 |
| `service_resource_commands` | Service capability | 2/2 | 3340 |
| `service_resource_commitments` | Service capability | 6/2 | 3394, 3440 |
| `service_resources` | Service capability | 10/2 | 3319 |
| `sessions` | Identity and access | 2/3 | 400 |
| `supplier_network_capabilities` | Supplier Network | 5/2 | 3204 |
| `supplier_network_capacity_signals` | Supplier Network | 5/2 | 1924 |
| `supplier_network_catalog_listings` | Supplier Network | 5/2 | 1890 |
| `supplier_network_commercial_terms` | Supplier Network | 4/2 | 1959 |
| `supplier_network_performance_observations` | Supplier Network | 3/1 | 2032 |
| `supplier_network_profiles` | Supplier Network | 3/2 | 1860 |
| `supplier_network_qualifications` | Supplier Network | 6/2 | 1996 |
| `supplier_network_service_areas` | Supplier Network | 4/2 | 3172 |
| `supplier_network_trust_evidence` | Supplier Network | 3/1 | 2066 |
| `sync_events` | Event and synchronization infrastructure | 1/1 | 650 |
| `telegram_storefront_configs` | Channel and integration configuration | 1/2 | 2132 |
| `tenant_business_templates` | Pack and business-template configuration | 1/1 | 3285 |
| `tenant_creation_requests` | Identity and access | 2/1 | 3301 |
| `tenants` | Tenant and organization core | 47/7 | 306 |
| `users` | Identity and access | 5/2 | 372 |

## Foreign-key relationships

| From table | From columns | To table | To columns | On delete | On update |
|---|---|---|---|---|---|
| `catalog_products` | chat_id | `tenants` | chat_id | CASCADE | default |
| `orders` | chat_id | `tenants` | chat_id | CASCADE | default |
| `phone_routing` | chat_id | `tenants` | chat_id | CASCADE | default |
| `memberships` | user_id | `users` | id | CASCADE | default |
| `memberships` | chat_id | `tenants` | chat_id | CASCADE | default |
| `devices` | user_id | `users` | id | CASCADE | default |
| `devices` | chat_id | `tenants` | chat_id | CASCADE | default |
| `sessions` | device_id | `devices` | id | CASCADE | default |
| `auth_challenges` | user_id | `users` | id | CASCADE | default |
| `pairing_challenges` | chat_id | `tenants` | chat_id | CASCADE | default |
| `pairing_challenges` | created_by_user_id | `users` | id | CASCADE | default |
| `invites` | chat_id | `tenants` | chat_id | CASCADE | default |
| `invites` | created_by_user_id | `users` | id | CASCADE | default |
| `invites` | used_by_user_id | `users` | id | SET NULL | default |
| `locations` | organization_id | `organizations` | id | CASCADE | default |
| `channel_identities` | organization_id | `organizations` | id | CASCADE | default |
| `customers` | organization_id | `organizations` | id | CASCADE | default |
| `customers` | default_location_id | `locations` | id | SET NULL | default |
| `inventory_movements` | organization_id | `organizations` | id | CASCADE | default |
| `inventory_movements` | location_id | `locations` | id | RESTRICT | default |
| `audit_retention_policies` | organization_id | `organizations` | id | CASCADE | default |
| `compliance_requests` | organization_id | `organizations` | id | CASCADE | default |
| `compliance_requests` | location_id | `locations` | id | SET NULL | default |
| `payment_accounts` | organization_id | `organizations` | id | CASCADE | default |
| `payments` | organization_id | `organizations` | id | CASCADE | default |
| `payments` | location_id | `locations` | id | SET NULL | default |
| `payments` | payment_account_id | `payment_accounts` | id | SET NULL | default |
| `payment_ledger_entries` | payment_id | `payments` | id | CASCADE | default |
| `payment_ledger_entries` | organization_id | `organizations` | id | CASCADE | default |
| `payment_reconciliations` | payment_id | `payments` | id | CASCADE | default |
| `payment_reconciliations` | organization_id | `organizations` | id | CASCADE | default |
| `customer_pricing_rules` | organization_id | `organizations` | id | CASCADE | default |
| `customer_pricing_rules` | customer_id | `customers` | id | CASCADE | default |
| `quotes` | organization_id | `organizations` | id | CASCADE | default |
| `quotes` | customer_id | `customers` | id | RESTRICT | default |
| `quote_items` | quote_id | `quotes` | id | CASCADE | default |
| `purchase_orders` | organization_id | `organizations` | id | CASCADE | default |
| `purchase_orders` | customer_id | `customers` | id | RESTRICT | default |
| `purchase_orders` | quote_id | `quotes` | id | RESTRICT | default |
| `purchase_order_items` | purchase_order_id | `purchase_orders` | id | CASCADE | default |
| `customer_credit_terms` | organization_id | `organizations` | id | CASCADE | default |
| `customer_credit_terms` | customer_id | `customers` | id | RESTRICT | default |
| `accounts_receivable` | organization_id | `organizations` | id | CASCADE | default |
| `accounts_receivable` | location_id | `locations` | id | SET NULL | default |
| `accounts_receivable` | customer_id | `customers` | id | RESTRICT | default |
| `accounts_receivable` | credit_terms_id | `customer_credit_terms` | id | SET NULL | default |
| `ar_ledger_entries` | receivable_id | `accounts_receivable` | id | CASCADE | default |
| `ar_ledger_entries` | organization_id | `organizations` | id | CASCADE | default |
| `ar_ledger_entries` | payment_id | `payments` | id | SET NULL | default |
| `ar_payment_allocations` | receivable_id | `accounts_receivable` | id | CASCADE | default |
| `ar_payment_allocations` | payment_id | `payments` | id | CASCADE | default |
| `ar_payment_allocations` | organization_id | `organizations` | id | CASCADE | default |
| `invoices` | organization_id | `organizations` | id | CASCADE | default |
| `invoices` | location_id | `locations` | id | SET NULL | default |
| `invoices` | customer_id | `customers` | id | RESTRICT | default |
| `invoices` | receivable_id | `accounts_receivable` | id | RESTRICT | default |
| `invoice_items` | invoice_id | `invoices` | id | CASCADE | default |
| `marketplace_seller_orders` | marketplace_order_id | `marketplace_orders` | id | CASCADE | default |
| `marketplace_seller_orders` | seller_id | `tenants` | chat_id | RESTRICT | default |
| `marketplace_seller_orders` | organization_id | `organizations` | id | RESTRICT | default |
| `marketplace_fulfillments` | seller_order_id | `marketplace_seller_orders` | id | CASCADE | default |
| `marketplace_inventory_reservations` | marketplace_order_id | `marketplace_orders` | id | CASCADE | default |
| `marketplace_inventory_reservations` | seller_order_id | `marketplace_seller_orders` | id | CASCADE | default |
| `marketplace_inventory_reservations` | seller_id | `tenants` | chat_id | RESTRICT | default |
| `marketplace_payment_allocations` | marketplace_order_id | `marketplace_orders` | id | CASCADE | default |
| `marketplace_payment_allocations` | seller_order_id | `marketplace_seller_orders` | id | CASCADE | default |
| `marketplace_payment_allocations` | payment_id | `payments` | id | SET NULL | default |
| `marketplace_payment_allocations` | organization_id | `organizations` | id | RESTRICT | default |
| `marketplace_settlements` | marketplace_order_id | `marketplace_orders` | id | CASCADE | default |
| `marketplace_settlements` | seller_order_id | `marketplace_seller_orders` | id | CASCADE | default |
| `marketplace_settlements` | organization_id | `organizations` | id | RESTRICT | default |
| `marketplace_refunds` | marketplace_order_id | `marketplace_orders` | id | CASCADE | default |
| `marketplace_refunds` | seller_order_id | `marketplace_seller_orders` | id | CASCADE | default |
| `marketplace_refunds` | payment_id | `payments` | id | SET NULL | default |
| `marketplace_refunds` | organization_id | `organizations` | id | RESTRICT | default |
| `marketplace_checkout_idempotency` | marketplace_order_id | `marketplace_orders` | id | CASCADE | default |
| `procurement_demands` | organization_id | `organizations` | id | CASCADE | default |
| `procurement_demands` | requester_id | `users` | id | RESTRICT | default |
| `procurement_demands` | delivery_location_id | `locations` | id | RESTRICT | default |
| `procurement_demands` | created_by_user_id | `users` | id | SET NULL | default |
| `procurement_demands` | updated_by_user_id | `users` | id | SET NULL | default |
| `procurement_demand_items` | demand_id | `procurement_demands` | id | CASCADE | default |
| `procurement_supplier_participants` | organization_id | `organizations` | id | CASCADE | default |
| `procurement_supplier_participants` | created_by_user_id | `users` | id | SET NULL | default |
| `procurement_supplier_participants` | updated_by_user_id | `users` | id | SET NULL | default |
| `procurement_supplier_relationships` | buyer_organization_id | `organizations` | id | CASCADE | default |
| `procurement_supplier_relationships` | supplier_organization_id | `organizations` | id | CASCADE | default |
| `procurement_supplier_relationships` | created_by_user_id | `users` | id | SET NULL | default |
| `procurement_supplier_relationships` | updated_by_user_id | `users` | id | SET NULL | default |
| `procurement_rfqs` | organization_id | `organizations` | id | CASCADE | default |
| `procurement_rfqs` | demand_id | `procurement_demands` | id | RESTRICT | default |
| `procurement_rfqs` | created_by_user_id | `users` | id | SET NULL | default |
| `procurement_rfqs` | updated_by_user_id | `users` | id | SET NULL | default |
| `procurement_rfq_items` | rfq_id | `procurement_rfqs` | id | CASCADE | default |
| `procurement_rfq_items` | demand_item_id | `procurement_demand_items` | id | RESTRICT | default |
| `procurement_rfq_suppliers` | rfq_id | `procurement_rfqs` | id | CASCADE | default |
| `procurement_rfq_suppliers` | supplier_organization_id | `organizations` | id | RESTRICT | default |
| `procurement_rfq_responses` | rfq_id | `procurement_rfqs` | id | CASCADE | default |
| `procurement_rfq_responses` | supplier_organization_id | `organizations` | id | RESTRICT | default |
| `procurement_rfq_responses` | created_by_user_id | `users` | id | SET NULL | default |
| `procurement_rfq_responses` | updated_by_user_id | `users` | id | SET NULL | default |
| `procurement_rfq_response_items` | response_id | `procurement_rfq_responses` | id | CASCADE | default |
| `procurement_rfq_response_items` | rfq_item_id | `procurement_rfq_items` | id | RESTRICT | default |
| `procurement_comparisons` | organization_id | `organizations` | id | CASCADE | default |
| `procurement_comparisons` | rfq_id | `procurement_rfqs` | id | RESTRICT | default |
| `procurement_comparisons` | created_by_user_id | `users` | id | SET NULL | default |
| `procurement_comparison_suppliers` | comparison_id | `procurement_comparisons` | id | CASCADE | default |
| `procurement_comparison_suppliers` | supplier_organization_id | `organizations` | id | RESTRICT | default |
| `procurement_comparison_suppliers` | response_id | `procurement_rfq_responses` | id | RESTRICT | default |
| `procurement_comparison_line_offers` | comparison_id | `procurement_comparisons` | id | CASCADE | default |
| `procurement_comparison_line_offers` | supplier_organization_id | `organizations` | id | RESTRICT | default |
| `procurement_comparison_line_offers` | response_id | `procurement_rfq_responses` | id | RESTRICT | default |
| `procurement_comparison_line_offers` | rfq_item_id | `procurement_rfq_items` | id | RESTRICT | default |
| `procurement_awards` | organization_id | `organizations` | id | CASCADE | default |
| `procurement_awards` | demand_id | `procurement_demands` | id | RESTRICT | default |
| `procurement_awards` | rfq_id | `procurement_rfqs` | id | RESTRICT | default |
| `procurement_awards` | comparison_id | `procurement_comparisons` | id | RESTRICT | default |
| `procurement_awards` | created_by_user_id | `users` | id | SET NULL | default |
| `procurement_awards` | confirmed_by_user_id | `users` | id | SET NULL | default |
| `procurement_award_lines` | award_id | `procurement_awards` | id | CASCADE | default |
| `procurement_award_lines` | rfq_item_id | `procurement_rfq_items` | id | RESTRICT | default |
| `procurement_award_lines` | supplier_organization_id | `organizations` | id | RESTRICT | default |
| `procurement_award_lines` | response_id | `procurement_rfq_responses` | id | RESTRICT | default |
| `procurement_award_lines` | comparison_line_offer_id | `procurement_comparison_line_offers` | id | RESTRICT | default |
| `purchase_orders_phase17_6_new` | organization_id | `organizations` | id | CASCADE | default |
| `purchase_orders_phase17_6_new` | customer_id | `customers` | id | RESTRICT | default |
| `purchase_orders_phase17_6_new` | quote_id | `quotes` | id | RESTRICT | default |
| `purchase_orders_phase17_6_new` | procurement_award_id | `procurement_awards` | id | RESTRICT | default |
| `purchase_orders_phase17_6_new` | supplier_organization_id | `organizations` | id | RESTRICT | default |
| `procurement_receipts` | organization_id | `organizations` | id | CASCADE | default |
| `procurement_receipts` | purchase_order_id | `purchase_orders` | id | RESTRICT | default |
| `procurement_receipts` | location_id | `locations` | id | RESTRICT | default |
| `procurement_receipts` | created_by_user_id | `users` | id | SET NULL | default |
| `procurement_receipt_lines` | receipt_id | `procurement_receipts` | id | CASCADE | default |
| `procurement_receipt_lines` | purchase_order_item_id | `purchase_order_items` | id | RESTRICT | default |
| `payment_outbound_intents` | organization_id | `organizations` | id | CASCADE | default |
| `payment_outbound_intents` | counterparty_organization_id | `organizations` | id | RESTRICT | default |
| `payment_outbound_intents` | purchase_order_id | `purchase_orders` | id | RESTRICT | default |
| `payment_outbound_intents` | created_by_user_id | `users` | id | SET NULL | default |
| `payment_procurement_settlements` | organization_id | `organizations` | id | CASCADE | default |
| `payment_procurement_settlements` | purchase_order_id | `purchase_orders` | id | RESTRICT | default |
| `payment_procurement_settlements` | supplier_organization_id | `organizations` | id | RESTRICT | default |
| `payment_procurement_settlements` | created_by_user_id | `users` | id | SET NULL | default |
| `payment_procurement_settlement_allocations` | settlement_id | `payment_procurement_settlements` | id | CASCADE | default |
| `payment_procurement_settlement_allocations` | outbound_intent_id | `payment_outbound_intents` | id | RESTRICT | default |
| `payment_procurement_settlement_allocations` | created_by_user_id | `users` | id | SET NULL | default |
| `supplier_network_profiles` | organization_id | `organizations` | id | CASCADE | default |
| `supplier_network_profiles` | created_by_user_id | `users` | id | SET NULL | default |
| `supplier_network_profiles` | updated_by_user_id | `users` | id | SET NULL | default |
| `supplier_network_catalog_listings` | organization_id | `organizations` | id | CASCADE | default |
| `supplier_network_catalog_listings` | created_by_user_id | `users` | id | SET NULL | default |
| `supplier_network_catalog_listings` | updated_by_user_id | `users` | id | SET NULL | default |
| `supplier_network_capacity_signals` | organization_id | `organizations` | id | CASCADE | default |
| `supplier_network_capacity_signals` | created_by_user_id | `users` | id | SET NULL | default |
| `supplier_network_capacity_signals` | updated_by_user_id | `users` | id | SET NULL | default |
| `supplier_network_commercial_terms` | organization_id | `organizations` | id | CASCADE | default |
| `supplier_network_commercial_terms` | created_by_user_id | `users` | id | SET NULL | default |
| `supplier_network_commercial_terms` | updated_by_user_id | `users` | id | SET NULL | default |
| `supplier_network_qualifications` | organization_id | `organizations` | id | CASCADE | default |
| `supplier_network_qualifications` | verified_by_user_id | `users` | id | SET NULL | default |
| `supplier_network_qualifications` | created_by_user_id | `users` | id | SET NULL | default |
| `supplier_network_qualifications` | updated_by_user_id | `users` | id | SET NULL | default |
| `supplier_network_performance_observations` | supplier_organization_id | `organizations` | id | CASCADE | default |
| `supplier_network_performance_observations` | created_by_user_id | `users` | id | SET NULL | default |
| `supplier_network_trust_evidence` | supplier_organization_id | `organizations` | id | CASCADE | default |
| `supplier_network_trust_evidence` | created_by_user_id | `users` | id | SET NULL | default |
| `marketplace_payment_allocations_v40` | marketplace_order_id | `marketplace_orders` | id | CASCADE | default |
| `marketplace_payment_allocations_v40` | seller_order_id | `marketplace_seller_orders` | id | CASCADE | default |
| `marketplace_payment_allocations_v40` | payment_id | `payments` | id | SET NULL | default |
| `marketplace_payment_allocations_v40` | organization_id | `organizations` | id | RESTRICT | default |
| `telegram_storefront_configs` | organization_id | `organizations` | id | CASCADE | default |
| `telegram_storefront_configs` | created_by_user_id | `users` | id | SET NULL | default |
| `telegram_storefront_configs` | updated_by_user_id | `users` | id | SET NULL | default |
| `pack_lifecycle` | organization_id | `organizations` | id | CASCADE | default |
| `pack_lifecycle` | created_by_user_id | `users` | id | SET NULL | default |
| `pack_lifecycle` | updated_by_user_id | `users` | id | SET NULL | default |
| `fulfillments` | server_order_id | `orders` | server_order_id | CASCADE | default |
| `fulfillments` | organization_id | `organizations` | id | CASCADE | default |
| `fulfillments` | location_id | `locations` | id | SET NULL | default |
| `fulfillments` | created_by_user_id | `users` | id | SET NULL | default |
| `fulfillments` | updated_by_user_id | `users` | id | SET NULL | default |
| `delivery_assignments` | fulfillment_id | `fulfillments` | id | CASCADE | default |
| `delivery_assignments` | organization_id | `organizations` | id | CASCADE | default |
| `delivery_assignments` | location_id | `locations` | id | SET NULL | default |
| `delivery_assignments` | courier_user_id | `users` | id | RESTRICT | default |
| `delivery_assignments` | assigned_by_user_id | `users` | id | SET NULL | default |
| `delivery_assignments_v44` | fulfillment_id | `fulfillments` | id | CASCADE | default |
| `delivery_assignments_v44` | organization_id | `organizations` | id | CASCADE | default |
| `delivery_assignments_v44` | location_id | `locations` | id | SET NULL | default |
| `delivery_assignments_v44` | courier_user_id | `users` | id | RESTRICT | default |
| `delivery_assignments_v44` | assigned_by_user_id | `users` | id | SET NULL | default |
| `payment_intents` | organization_id | `organizations` | id | CASCADE | default |
| `payment_intents` | location_id | `locations` | id | SET NULL | default |
| `payment_intents` | payment_account_id | `payment_accounts` | id | SET NULL | default |
| `payment_intents` | created_by_user_id | `users` | id | SET NULL | default |
| `payment_evidence` | organization_id | `organizations` | id | CASCADE | default |
| `payment_evidence` | location_id | `locations` | id | SET NULL | default |
| `payment_evidence` | payment_id | `payments` | id | SET NULL | default |
| `payment_evidence` | payment_intent_id | `payment_intents` | id | SET NULL | default |
| `payment_evidence` | submitted_by_user_id | `users` | id | SET NULL | default |
| `payment_verifications` | organization_id | `organizations` | id | CASCADE | default |
| `payment_verifications` | payment_id | `payments` | id | SET NULL | default |
| `payment_verifications` | payment_intent_id | `payment_intents` | id | SET NULL | default |
| `payment_verifications` | evidence_id | `payment_evidence` | id | CASCADE | default |
| `payment_decisions` | organization_id | `organizations` | id | CASCADE | default |
| `payment_decisions` | payment_id | `payments` | id | CASCADE | default |
| `payment_decisions` | payment_intent_id | `payment_intents` | id | SET NULL | default |
| `payment_decisions` | evidence_id | `payment_evidence` | id | SET NULL | default |
| `payment_decisions` | verification_id | `payment_verifications` | id | SET NULL | default |
| `payment_decisions` | actor_id | `users` | id | SET NULL | default |
| `payment_idempotency_keys` | organization_id | `organizations` | id | CASCADE | default |
| `payment_confirmation_attempts` | organization_id | `organizations` | id | CASCADE | default |
| `payment_confirmation_attempts` | payment_id | `payments` | id | SET NULL | default |
| `payment_confirmation_attempts` | payment_intent_id | `payment_intents` | id | CASCADE | default |
| `payment_confirmation_attempts` | evidence_id | `payment_evidence` | id | CASCADE | default |
| `payment_confirmation_attempts` | payment_account_id | `payment_accounts` | id | SET NULL | default |
| `payment_status_query_commands` | organization_id | `organizations` | id | CASCADE | default |
| `payment_status_query_commands` | payment_id | `payments` | id | CASCADE | default |
| `fulfillment_commands` | organization_id | `organizations` | id | CASCADE | default |
| `fulfillment_commands` | server_order_id | `orders` | server_order_id | CASCADE | default |
| `delivery_assignment_commands` | organization_id | `organizations` | id | CASCADE | default |
| `service_delivery_assessment_commands` | organization_id | `organizations` | id | CASCADE | default |
| `service_bookings` | organization_id | `organizations` | id | CASCADE | default |
| `service_bookings` | chat_id | `tenants` | chat_id | CASCADE | default |
| `service_booking_commands` | organization_id | `organizations` | id | CASCADE | default |
| `service_booking_commands` | booking_id | `service_bookings` | id | CASCADE | default |
| `payment_routing_policies` | organization_id | `organizations` | id | CASCADE | default |
| `payment_routing_policies` | location_id | `locations` | id | CASCADE | default |
| `payment_operational_actions` | organization_id | `organizations` | id | CASCADE | default |
| `payment_operational_actions` | payment_id | `payments` | id | CASCADE | default |
| `payment_operational_actions` | actor_id | `users` | id | SET NULL | default |
| `payment_production_certifications` | organization_id | `organizations` | id | CASCADE | default |
| `payment_production_certifications` | certified_by_user_id | `users` | id | SET NULL | default |
| `payment_provider_capability_certifications` | organization_id | `organizations` | id | CASCADE | default |
| `payment_provider_capability_certifications` | certified_by_user_id | `users` | id | SET NULL | default |
| `payment_settlements` | organization_id | `organizations` | id | CASCADE | default |
| `payment_settlements` | payment_id | `payments` | id | CASCADE | default |
| `payment_refunds` | organization_id | `organizations` | id | CASCADE | default |
| `payment_refunds` | payment_id | `payments` | id | CASCADE | default |
| `payment_refunds` | payment_intent_id | `payment_intents` | id | SET NULL | default |
| `payments_gap113` | organization_id | `organizations` | id | CASCADE | default |
| `payments_gap113` | location_id | `locations` | id | SET NULL | default |
| `payments_gap113` | payment_account_id | `payment_accounts` | id | SET NULL | default |
| `payments_gap113` | payment_intent_id | `payment_intents` | id | SET NULL | default |
| `payment_ledger_entries_gap113` | payment_id | `payments` | id | CASCADE | default |
| `payment_ledger_entries_gap113` | organization_id | `organizations` | id | CASCADE | default |
| `payment_ledger_entries_gap113` | decision_id | `payment_decisions` | id | default | default |
| `membership_roles` | membership_id | `memberships` | id | CASCADE | default |
| `supplier_network_service_areas` | organization_id | `organizations` | id | CASCADE | default |
| `supplier_network_service_areas` | created_by_user_id | `users` | id | SET NULL | default |
| `supplier_network_service_areas` | updated_by_user_id | `users` | id | SET NULL | default |
| `supplier_network_capabilities` | organization_id | `organizations` | id | CASCADE | default |
| `supplier_network_capabilities` | created_by_user_id | `users` | id | SET NULL | default |
| `supplier_network_capabilities` | updated_by_user_id | `users` | id | SET NULL | default |
| `logistics_scheduling_activities` | organization_id | `organizations` | id | CASCADE | default |
| `logistics_scheduling_activities` | location_id | `locations` | id | SET NULL | default |
| `logistics_scheduling_activities` | related_fulfillment_id | `fulfillments` | id | SET NULL | default |
| `logistics_scheduling_activities` | confirmed_by_user_id | `users` | id | SET NULL | default |
| `logistics_scheduling_activities` | created_by_user_id | `users` | id | SET NULL | default |
| `logistics_scheduling_activities` | updated_by_user_id | `users` | id | SET NULL | default |
| `tenant_business_templates` | chat_id | `tenants` | chat_id | CASCADE | default |
| `tenant_business_templates` | updated_by_user_id | `users` | id | SET NULL | default |
| `tenant_creation_requests` | challenge_token_hash | `auth_challenges` | token_hash | CASCADE | default |
| `tenant_creation_requests` | user_id | `users` | id | CASCADE | default |
| `tenant_creation_requests` | chat_id | `tenants` | chat_id | CASCADE | default |
| `service_resources` | organization_id | `organizations` | id | CASCADE | default |
| `service_resources` | chat_id | `tenants` | chat_id | CASCADE | default |
| `service_resource_commands` | organization_id | `organizations` | id | CASCADE | default |
| `service_resource_commands` | resource_id | `service_resources` | id | CASCADE | default |
| `service_resource_availability` | resource_id | `service_resources` | id | CASCADE | default |
| `service_resource_availability` | organization_id | `organizations` | id | CASCADE | default |
| `service_resource_availability` | chat_id | `tenants` | chat_id | CASCADE | default |
| `service_resource_availability_commands` | organization_id | `organizations` | id | CASCADE | default |
| `service_resource_availability_commands` | resource_id | `service_resources` | id | CASCADE | default |
| `service_resource_commitments` | organization_id | `organizations` | id | CASCADE | default |
| `service_resource_commitments` | chat_id | `tenants` | chat_id | CASCADE | default |
| `service_resource_commitments` | resource_id | `service_resources` | id | CASCADE | default |
| `service_resource_commitments` | booking_id | `service_bookings` | id | CASCADE | default |
| `restaurant_recipes` | organization_id | `organizations` | id | CASCADE | default |
| `restaurant_recipes` | chat_id | `tenants` | chat_id | CASCADE | default |

## Index declarations

| Index | Table | Unique | Columns | Source line |
|---|---|---|---|---:|
| `idx_catalog_marketplace` | `catalog_products` | false | marketplace_listed, stock | 326 |
| `idx_orders_tenant_created` | `orders` | false | chat_id, created_at DESC | 342 |
| `idx_orders_undelivered` | `orders` | false | chat_id, delivered_to_device | 344 |
| `idx_orders_marketplace` | `orders` | false | marketplace_order_id | 346 |
| `idx_audit_tenant_created` | `audit_events` | false | chat_id, created_at DESC | 364 |
| `idx_memberships_user` | `memberships` | false | user_id, status | 388 |
| `idx_memberships_tenant` | `memberships` | false | chat_id, status | 389 |
| `idx_devices_tenant` | `devices` | false | chat_id, status | 399 |
| `idx_sessions_hash` | `sessions` | false | token_hash | 408 |
| `idx_sessions_device` | `sessions` | false | device_id | 409 |
| `idx_pairing_challenges_tenant` | `pairing_challenges` | false | chat_id, expires_at | 426 |
| `idx_pairing_challenges_tenant` | `pairing_challenges` | false | chat_id, expires_at | 442 |
| `idx_invites_tenant` | `invites` | false | chat_id, expires_at | 460 |
| `idx_locations_org` | `locations` | false | organization_id, status | 495 |
| `idx_channel_identities_org` | `channel_identities` | false | organization_id, status | 507 |
| `idx_tenants_organization` | `tenants` | false | organization_id | 510 |
| `idx_audit_organization_created` | `audit_events` | false | organization_id, created_at DESC | 513 |
| `idx_locations_org_code` | `locations` | false | organization_id, code | 572 |
| `idx_locations_org_type` | `locations` | false | organization_id, type, status | 573 |
| `idx_customers_org_updated` | `customers` | false | organization_id, updated_at DESC | 602 |
| `idx_customers_org_phone` | `customers` | false | organization_id, phone | 604 |
| `idx_customers_org_name` | `customers` | false | organization_id, name | 606 |
| `idx_orders_customer` | `orders` | false | chat_id, customer_id, created_at DESC | 609 |
| `idx_inventory_movements_org_product_time` | `inventory_movements` | false | organization_id, product_id, occurred_at DESC | 639 |
| `idx_inventory_movements_location_product_time` | `inventory_movements` | false | location_id, product_id, occurred_at DESC | 641 |
| `idx_inventory_movements_reference` | `inventory_movements` | false | reference_type, reference_id | 643 |
| `idx_sync_events_org_time` | `sync_events` | false | organization_id, occurred_at DESC | 665 |
| `idx_sync_events_org_type` | `sync_events` | false | organization_id, event_type | 666 |
| `idx_audit_org_time` | `audit_events` | false | organization_id, created_at DESC | 683 |
| `idx_audit_actor_time` | `audit_events` | false | actor_id, created_at DESC | 685 |
| `idx_audit_entity_time` | `audit_events` | false | entity_type, entity_id, created_at DESC | 687 |
| `idx_compliance_requests_org_status` | `compliance_requests` | false | organization_id, status, created_at DESC | 711 |
| `idx_compliance_requests_subject` | `compliance_requests` | false | subject_type, subject_id, created_at DESC | 713 |
| `idx_catalog_currency` | `catalog_products` | false | chat_id, currency | 759 |
| `idx_orders_currency` | `orders` | false | chat_id, currency | 761 |
| `idx_payment_accounts_org` | `payment_accounts` | false | organization_id, status | 787 |
| `idx_payments_org_created` | `payments` | false | organization_id, created_at DESC | 814 |
| `idx_payments_order` | `payments` | false | organization_id, order_id | 816 |
| `idx_payments_state` | `payments` | false | organization_id, state | 818 |
| `uq_payments_external_reference` | `payments` | true | organization_id, provider_id, external_reference | 820 |
| `idx_payment_ledger_payment` | `payment_ledger_entries` | false | payment_id, created_at | 838 |
| `idx_payment_reconciliation_org` | `payment_reconciliations` | false | organization_id, status, created_at DESC | 854 |
| `idx_customer_pricing_org_customer` | `customer_pricing_rules` | false | organization_id, customer_id, status | 889 |
| `idx_customer_pricing_org_product` | `customer_pricing_rules` | false | organization_id, product_id, status | 891 |
| `idx_quotes_org_customer` | `quotes` | false | organization_id, customer_id, created_at DESC | 935 |
| `idx_quotes_org_status` | `quotes` | false | organization_id, status, updated_at DESC | 937 |
| `idx_quote_items_quote` | `quote_items` | false | quote_id | 939 |
| `idx_purchase_orders_org_customer` | `purchase_orders` | false | organization_id, customer_id, created_at DESC | 986 |
| `idx_purchase_orders_org_status` | `purchase_orders` | false | organization_id, status, updated_at DESC | 988 |
| `idx_purchase_order_items_order` | `purchase_order_items` | false | purchase_order_id | 990 |
| `idx_credit_terms_org_status` | `customer_credit_terms` | false | organization_id, status, updated_at DESC | 1032 |
| `idx_credit_terms_org_customer` | `customer_credit_terms` | false | organization_id, customer_id | 1034 |
| `idx_ar_org_status` | `accounts_receivable` | false | organization_id, status, due_at | 1062 |
| `idx_ar_org_customer` | `accounts_receivable` | false | organization_id, customer_id, status | 1064 |
| `idx_ar_ledger_receivable` | `ar_ledger_entries` | false | receivable_id, created_at | 1082 |
| `idx_ar_alloc_payment` | `ar_payment_allocations` | false | organization_id, payment_id | 1096 |
| `idx_invoices_org_status` | `invoices` | false | organization_id, status, created_at DESC | 1131 |
| `idx_invoices_org_customer` | `invoices` | false | organization_id, customer_id, created_at DESC | 1132 |
| `idx_invoice_items_invoice` | `invoice_items` | false | invoice_id | 1144 |
| `uq_marketplace_orders_idempotency` | `marketplace_orders` | true | idempotency_key | 1167 |
| `idx_marketplace_orders_buyer` | `marketplace_orders` | false | buyer_identity, created_at DESC | 1170 |
| `idx_marketplace_orders_status` | `marketplace_orders` | false | status, created_at DESC | 1172 |
| `idx_marketplace_seller_orders_seller` | `marketplace_seller_orders` | false | organization_id, status, created_at DESC | 1189 |
| `idx_marketplace_fulfillments_order` | `marketplace_fulfillments` | false | seller_order_id, status | 1202 |
| `idx_marketplace_reservations_product` | `marketplace_inventory_reservations` | false | seller_id, product_id, status | 1217 |
| `idx_marketplace_payment_allocations_order` | `marketplace_payment_allocations` | false | marketplace_order_id, status | 1233 |
| `idx_marketplace_settlements_org_status` | `marketplace_settlements` | false | organization_id, status, created_at DESC | 1248 |
| `idx_marketplace_refunds_order` | `marketplace_refunds` | false | marketplace_order_id, created_at DESC | 1264 |
| `idx_marketplace_checkout_idem_buyer` | `marketplace_checkout_idempotency` | false | buyer_identity, created_at DESC | 1276 |
| `idx_procurement_demands_org_status` | `procurement_demands` | false | organization_id, status, updated_at DESC | 1314 |
| `idx_procurement_demands_requester` | `procurement_demands` | false | organization_id, requester_id, created_at DESC | 1316 |
| `idx_procurement_demands_source` | `procurement_demands` | false | organization_id, source, source_object_id | 1318 |
| `idx_procurement_demand_items_demand` | `procurement_demand_items` | false | demand_id, created_at ASC | 1336 |
| `idx_procurement_demand_items_product` | `procurement_demand_items` | false | product_id | 1338 |
| `idx_procurement_supplier_discovery` | `procurement_supplier_participants` | false | status, discoverable, updated_at DESC | 1378 |
| `idx_procurement_supplier_relationships_buyer` | `procurement_supplier_relationships` | false | buyer_organization_id, status, updated_at DESC | 1393 |
| `idx_procurement_supplier_relationships_supplier` | `procurement_supplier_relationships` | false | supplier_organization_id, status, updated_at DESC | 1394 |
| `idx_procurement_rfqs_org_status` | `procurement_rfqs` | false | organization_id,status,updated_at DESC | 1427 |
| `idx_procurement_rfqs_demand` | `procurement_rfqs` | false | organization_id,demand_id | 1428 |
| `idx_procurement_rfq_items_rfq` | `procurement_rfq_items` | false | rfq_id,created_at,id | 1445 |
| `idx_procurement_rfq_suppliers_supplier` | `procurement_rfq_suppliers` | false | supplier_organization_id,status,updated_at DESC | 1457 |
| `idx_procurement_rfq_responses_rfq` | `procurement_rfq_responses` | false | rfq_id,status,updated_at DESC | 1480 |
| `idx_procurement_rfq_responses_supplier` | `procurement_rfq_responses` | false | supplier_organization_id,status,updated_at DESC | 1481 |
| `idx_procurement_rfq_response_items_response` | `procurement_rfq_response_items` | false | response_id,created_at,id | 1496 |
| `idx_procurement_comparisons_rfq` | `procurement_comparisons` | false | organization_id,rfq_id,version DESC | 1535 |
| `idx_procurement_comparison_suppliers_rank` | `procurement_comparison_suppliers` | false | comparison_id,eligible,rank | 1556 |
| `idx_procurement_comparison_lines_comparison` | `procurement_comparison_line_offers` | false | comparison_id,supplier_organization_id | 1575 |
| `idx_procurement_awards_org_status` | `procurement_awards` | false | organization_id,status,updated_at DESC | 1608 |
| `idx_procurement_awards_demand` | `procurement_awards` | false | organization_id,demand_id,created_at DESC | 1610 |
| `idx_procurement_award_lines_award` | `procurement_award_lines` | false | award_id,rfq_item_id | 1629 |
| `idx_purchase_orders_org_customer` | `purchase_orders` | false | organization_id, customer_id, created_at DESC | 1696 |
| `idx_purchase_orders_org_supplier` | `purchase_orders` | false | organization_id, supplier_organization_id, created_at DESC | 1697 |
| `idx_purchase_orders_org_status` | `purchase_orders` | false | organization_id, status, updated_at DESC | 1698 |
| `idx_purchase_orders_org_source` | `purchase_orders` | false | organization_id, source_type, created_at DESC | 1699 |
| `idx_purchase_order_items_order` | `purchase_order_items` | false | purchase_order_id | 1700 |
| `idx_procurement_receipts_po` | `procurement_receipts` | false | organization_id,purchase_order_id,received_at DESC | 1740 |
| `idx_procurement_receipt_lines_receipt` | `procurement_receipt_lines` | false | receipt_id,purchase_order_item_id | 1753 |
| `idx_payment_outbound_org_state` | `payment_outbound_intents` | false | organization_id,state,created_at DESC | 1792 |
| `idx_payment_outbound_po` | `payment_outbound_intents` | false | organization_id,purchase_order_id | 1793 |
| `idx_payment_outbound_counterparty` | `payment_outbound_intents` | false | counterparty_organization_id,state | 1794 |
| `idx_payment_procurement_settlements_org_status` | `payment_procurement_settlements` | false | organization_id,status,updated_at DESC | 1825 |
| `idx_payment_procurement_settlement_allocations_settlement` | `payment_procurement_settlement_allocations` | false | settlement_id,created_at ASC | 1837 |
| `idx_payment_procurement_settlement_allocations_intent` | `payment_procurement_settlement_allocations` | false | outbound_intent_id | 1839 |
| `idx_supplier_network_profiles_visibility_status` | `supplier_network_profiles` | false | status, visibility, updated_at DESC | 1878 |
| `idx_supplier_network_catalog_org_status` | `supplier_network_catalog_listings` | false | organization_id,status,updated_at DESC | 1912 |
| `idx_supplier_network_catalog_product` | `supplier_network_catalog_listings` | false | product_id,status,visibility,organization_id | 1914 |
| `idx_supplier_network_capacity_org_status` | `supplier_network_capacity_signals` | false | organization_id,status,updated_at DESC | 1946 |
| `idx_supplier_network_capacity_discovery` | `supplier_network_capacity_signals` | false | subject_type,subject_id,status,availability,visibility,organization_id | 1948 |
| `idx_supplier_network_commercial_org_status` | `supplier_network_commercial_terms` | false | organization_id,status,updated_at DESC | 1983 |
| `idx_supplier_network_commercial_discovery` | `supplier_network_commercial_terms` | false | subject_type,subject_id,status,visibility,organization_id | 1985 |
| `uq_supplier_network_commercial_network` | `supplier_network_commercial_terms` | true | organization_id | 1987 |
| `idx_supplier_network_qualification_org_status` | `supplier_network_qualifications` | false | organization_id,status,updated_at DESC | 2017 |
| `idx_supplier_network_qualification_discovery` | `supplier_network_qualifications` | false | qualification_type,status,visibility,organization_id | 2019 |
| `uq_supplier_network_qualification_reference` | `supplier_network_qualifications` | true | organization_id,qualification_type,reference_number | 2021 |
| `idx_supplier_network_performance_supplier_metric` | `supplier_network_performance_observations` | false | supplier_organization_id,metric_type,calculated_at DESC | 2048 |
| `idx_supplier_network_performance_visibility` | `supplier_network_performance_observations` | false | visibility,metric_type,calculated_at DESC | 2050 |
| `idx_supplier_network_trust_supplier_type` | `supplier_network_trust_evidence` | false | supplier_organization_id,evidence_type,observed_at DESC | 2082 |
| `idx_supplier_network_trust_visibility` | `supplier_network_trust_evidence` | false | visibility,evidence_type,observed_at DESC | 2084 |
| `uq_supplier_network_trust_source` | `supplier_network_trust_evidence` | true | supplier_organization_id,evidence_type,source_authority,source_entity_type,source_entity_id | 2086 |
| `idx_marketplace_payment_allocations_order` | `marketplace_payment_allocations` | false | marketplace_order_id, status | 2124 |
| `idx_telegram_storefront_status` | `telegram_storefront_configs` | false | status, updated_at DESC | 2148 |
| `idx_pack_lifecycle_org_state` | `pack_lifecycle` | false | organization_id, state, updated_at DESC | 2182 |
| `idx_pack_lifecycle_pack` | `pack_lifecycle` | false | pack_id, organization_id | 2184 |
| `idx_fulfillments_org_status` | `fulfillments` | false | organization_id, status, updated_at DESC | 2213 |
| `idx_fulfillments_location_status` | `fulfillments` | false | location_id, status, updated_at DESC | 2215 |
| `idx_delivery_assignments_courier` | `delivery_assignments` | false | courier_user_id,status,updated_at DESC | 2239 |
| `idx_delivery_assignments_org` | `delivery_assignments` | false | organization_id,status,updated_at DESC | 2241 |
| `idx_delivery_assignments_courier` | `delivery_assignments` | false | courier_user_id,status,updated_at DESC | 2274 |
| `idx_delivery_assignments_org` | `delivery_assignments` | false | organization_id,status,updated_at DESC | 2276 |
| `idx_delivery_assignments_active_fulfillment` | `delivery_assignments` | true | fulfillment_id | 2278 |
| `idx_payment_intents_org_created` | `payment_intents` | false | organization_id, created_at DESC | 2308 |
| `idx_payment_intents_org_order` | `payment_intents` | false | organization_id, order_id | 2309 |
| `idx_payment_intents_org_status` | `payment_intents` | false | organization_id, status | 2310 |
| `idx_payment_evidence_org_provider_fingerprint` | `payment_evidence` | true | organization_id, provider_id, fingerprint | 2334 |
| `idx_payment_evidence_org_provider_transaction` | `payment_evidence` | true | organization_id, provider_id, provider_transaction_id | 2335 |
| `idx_payment_evidence_payment` | `payment_evidence` | false | payment_id, created_at DESC | 2336 |
| `idx_payment_evidence_intent` | `payment_evidence` | false | payment_intent_id, created_at DESC | 2337 |
| `idx_payment_evidence_org_status` | `payment_evidence` | false | organization_id, status, created_at DESC | 2338 |
| `idx_payment_evidence_external_reference` | `payment_evidence` | false | organization_id, provider_id, external_reference | 2339 |
| `idx_payment_verifications_payment` | `payment_verifications` | false | payment_id, created_at DESC | 2363 |
| `idx_payment_verifications_evidence` | `payment_verifications` | false | evidence_id, created_at DESC | 2364 |
| `idx_payment_verifications_intent` | `payment_verifications` | false | payment_intent_id, created_at DESC | 2365 |
| `idx_payment_verifications_org_result` | `payment_verifications` | false | organization_id, result, created_at DESC | 2366 |
| `idx_payment_decisions_payment` | `payment_decisions` | false | payment_id, created_at DESC | 2383 |
| `idx_payment_decisions_evidence` | `payment_decisions` | false | evidence_id, created_at DESC | 2384 |
| `idx_payment_decisions_verification` | `payment_decisions` | false | verification_id, created_at DESC | 2385 |
| `idx_payment_decisions_org_created` | `payment_decisions` | false | organization_id, created_at DESC | 2386 |
| `idx_payment_idempotency_expiry` | `payment_idempotency_keys` | false | expires_at | 2402 |
| `idx_payment_confirmation_attempts_org_status` | `payment_confirmation_attempts` | false | organization_id,status,updated_at DESC | 2440 |
| `idx_payment_confirmation_attempts_evidence` | `payment_confirmation_attempts` | false | evidence_id,created_at DESC | 2441 |
| `idx_payment_confirmation_attempts_intent` | `payment_confirmation_attempts` | false | payment_intent_id,created_at DESC | 2442 |
| `uq_payment_confirmation_attempts_provider_tx` | `payment_confirmation_attempts` | true | organization_id,provider_id,payment_account_id,provider_transaction_id | 2443 |
| `idx_payment_status_query_commands_payment` | `payment_status_query_commands` | false | organization_id, payment_id, created_at DESC | 2465 |
| `idx_payment_ledger_decision` | `payment_ledger_entries` | false | decision_id | 2533 |
| `idx_fulfillment_commands_order` | `fulfillment_commands` | false | organization_id, server_order_id, created_at DESC | 2560 |
| `idx_delivery_assignment_commands_order` | `delivery_assignment_commands` | false | organization_id, server_order_id, created_at DESC | 2597 |
| `idx_service_delivery_assessment_commands_order` | `service_delivery_assessment_commands` | false | organization_id, server_order_id, created_at DESC | 2614 |
| `idx_service_bookings_order` | `service_bookings` | false | organization_id, chat_id, server_order_id, created_at DESC | 2666 |
| `idx_service_booking_commands_booking` | `service_booking_commands` | false | organization_id, booking_id, created_at DESC | 2677 |
| `uq_payment_evidence_notification` | `payment_evidence` | true | organization_id,provider_id,payment_account_id,provider_notification_id | 2758 |
| `idx_payment_evidence_auth_reference` | `payment_evidence` | false | organization_id,provider_id,payment_account_id,authentication_reference | 2761 |
| `idx_payments_payment_intent` | `payments` | false | payment_intent_id | 2775 |
| `idx_payment_routing_policy_match` | `payment_routing_policies` | false | organization_id, channel, status, priority, location_id | 2798 |
| `uq_payment_operational_idempotency` | `payment_operational_actions` | true | organization_id, idempotency_key | 2825 |
| `idx_payment_operational_payment` | `payment_operational_actions` | false | payment_id, created_at DESC | 2828 |
| `idx_payment_operational_status` | `payment_operational_actions` | false | organization_id, status, next_retry_at, created_at DESC | 2830 |
| `idx_payment_production_certifications` | `payment_production_certifications` | false | organization_id, certification_scope, updated_at DESC | 2858 |
| `idx_payment_provider_capability_certification` | `payment_provider_capability_certifications` | false | organization_id, provider_id, capability, certification_scope, updated_at DESC | 2889 |
| `idx_payment_verifications_evidence_verifier` | `payment_verifications` | true | evidence_id, verifier, verifier_version | 2900 |
| `idx_audit_lineage` | `audit_events` | false | organization_id, lineage_type, lineage_id, created_at DESC | 2923 |
| `uq_payment_verifications_provider_transaction` | `payment_verifications` | true | organization_id, provider_id, observed_transaction_id | 2934 |
| `idx_payment_verifications_provider_transaction` | `payment_verifications` | false | organization_id, provider_id, observed_transaction_id, created_at DESC | 2937 |
| `idx_payment_settlements_payment` | `payment_settlements` | false | payment_id, created_at DESC | 2973 |
| `idx_payment_settlements_org_status` | `payment_settlements` | false | organization_id, status, created_at DESC | 2975 |
| `idx_payment_settlements_provider_reference` | `payment_settlements` | false | organization_id, provider_id, provider_settlement_reference | 2977 |
| `idx_payment_refunds_payment` | `payment_refunds` | false | payment_id, created_at DESC | 3011 |
| `idx_payment_refunds_org_status` | `payment_refunds` | false | organization_id, status, created_at DESC | 3013 |
| `idx_payment_refunds_provider` | `payment_refunds` | false | organization_id, provider_id, provider_refund_id | 3015 |
| `idx_payments_org_created` | `payments` | false | organization_id, created_at DESC | 3063 |
| `idx_payments_order` | `payments` | false | organization_id, order_id | 3064 |
| `idx_payments_state` | `payments` | false | organization_id, state | 3065 |
| `idx_payments_payment_intent` | `payments` | false | payment_intent_id | 3066 |
| `uq_payments_external_reference` | `payments` | true | organization_id, provider_id, external_reference | 3067 |
| `idx_payment_ledger_payment` | `payment_ledger_entries` | false | payment_id, created_at | 3096 |
| `idx_payment_reconciliation_payment_created` | `payment_reconciliations` | false | payment_id, created_at DESC | 3124 |
| `idx_payment_reconciliation_fingerprint` | `payment_reconciliations` | false | organization_id, fingerprint | 3125 |
| `idx_membership_roles_membership` | `membership_roles` | false | membership_id, status | 3148 |
| `idx_membership_roles_scope` | `membership_roles` | false | scope_type, scope_id, status | 3150 |
| `idx_supplier_network_service_areas_org_status` | `supplier_network_service_areas` | false | organization_id,status,updated_at DESC | 3192 |
| `idx_supplier_network_service_areas_discovery` | `supplier_network_service_areas` | false | country_code,scope_type,geo_code,status,visibility,organization_id | 3194 |
| `idx_supplier_network_capabilities_org_status` | `supplier_network_capabilities` | false | organization_id,status,updated_at DESC | 3222 |
| `idx_supplier_network_capabilities_discovery` | `supplier_network_capabilities` | false | code,status,visibility,organization_id | 3224 |
| `idx_logistics_scheduling_org_status` | `logistics_scheduling_activities` | false | organization_id,status,scheduled_start,updated_at DESC | 3269 |
| `idx_logistics_scheduling_org_location` | `logistics_scheduling_activities` | false | organization_id,location_id,scheduled_start,updated_at DESC | 3271 |
| `idx_logistics_scheduling_order` | `logistics_scheduling_activities` | false | organization_id,related_order_id,updated_at DESC | 3273 |
| `idx_logistics_scheduling_fulfillment` | `logistics_scheduling_activities` | false | organization_id,related_fulfillment_id,updated_at DESC | 3275 |
| `idx_tenant_creation_requests_user` | `tenant_creation_requests` | false | user_id, created_at DESC | 3309 |
| `idx_service_resources_org_status` | `service_resources` | false | organization_id, status, name | 3336 |
| `idx_service_resources_service` | `service_resources` | false | organization_id, service_item_id, status | 3338 |
| `idx_service_resource_commands_resource` | `service_resource_commands` | false | organization_id, resource_id, created_at DESC | 3349 |
| `idx_service_resource_availability_org` | `service_resource_availability` | false | organization_id, chat_id | 3369 |
| `idx_service_resource_commitments_overlap` | `service_resource_commitments` | false | organization_id, chat_id, resource_id, state, starts_at, ends_at | 3408 |
| `idx_service_resource_commitments_overlap` | `service_resource_commitments` | false | organization_id, chat_id, resource_id, state, starts_at, ends_at | 3454 |
| `idx_service_bookings_resource_window` | `service_bookings` | false | organization_id, chat_id, service_resource_id, status, requested_start, requested_end | 3456 |
| `idx_restaurant_recipes_org_status` | `restaurant_recipes` | false | organization_id, status, name | 3577 |
| `idx_restaurant_recipes_chat_updated` | `restaurant_recipes` | false | chat_id, updated_at DESC | 3579 |

## Migration dependency map

| Version | Source order | Source line | Operations | Tables touched |
|---:|---:|---:|---|---|
| 1 | 1 | L304 | CREATE TABLE, CREATE INDEX, INSERT | tenants, catalog_products, orders, phone_routing, audit_events, schema_migrations |
| 2 | 2 | L370 | CREATE TABLE, CREATE INDEX, INSERT | users, memberships, devices, sessions, auth_challenges, pairing_challenges, schema_migrations |
| 3 | 3 | L431 | CREATE TABLE, CREATE INDEX, INSERT | pairing_challenges, schema_migrations |
| 4 | 4 | L447 | CREATE TABLE, CREATE INDEX, INSERT | invites, schema_migrations |
| 5 | 5 | L464 | ALTER TABLE, INSERT | catalog_products, schema_migrations |
| 6 | 6 | L474 | CREATE TABLE, ALTER TABLE, CREATE INDEX, INSERT, UPDATE | organizations, locations, channel_identities, tenants, audit_events, schema_migrations |
| 7 | 7 | L570 | CREATE INDEX, INSERT | locations, schema_migrations |
| 8 | 8 | L583 | CREATE TABLE, ALTER TABLE, CREATE INDEX, INSERT | customers, orders, schema_migrations |
| 9 | 9 | L620 | CREATE TABLE, CREATE INDEX, INSERT | inventory_movements, schema_migrations |
| 10 | 10 | L648 | CREATE TABLE, CREATE INDEX, INSERT | sync_events, schema_migrations |
| 11 | 11 | L675 | CREATE TABLE, ALTER TABLE, CREATE INDEX, INSERT, UPDATE | audit_retention_policies, compliance_requests, audit_events, schema_migrations |
| 12 | 12 | L740 | ALTER TABLE, CREATE INDEX, INSERT, UPDATE | catalog_products, orders, schema_migrations |
| 13 | 13 | L774 | CREATE TABLE, CREATE INDEX, INSERT | payment_accounts, payments, payment_ledger_entries, payment_reconciliations, schema_migrations |
| 14 | 14 | L871 | CREATE TABLE, CREATE INDEX, INSERT | customer_pricing_rules, schema_migrations |
| 15 | 15 | L900 | CREATE TABLE, CREATE INDEX, INSERT | quotes, quote_items, schema_migrations |
| 16 | 16 | L948 | CREATE TABLE, CREATE INDEX, INSERT | purchase_orders, purchase_order_items, schema_migrations |
| 17 | 17 | L1006 | CREATE TABLE, CREATE INDEX, INSERT | customer_credit_terms, schema_migrations |
| 18 | 18 | L1041 | CREATE TABLE, CREATE INDEX, INSERT | accounts_receivable, ar_ledger_entries, ar_payment_allocations, schema_migrations |
| 19 | 19 | L1109 | CREATE TABLE, CREATE INDEX, INSERT | invoices, invoice_items, schema_migrations |
| 20 | 20 | L1149 | CREATE TABLE, CREATE INDEX, INSERT | marketplace_orders, marketplace_seller_orders, marketplace_fulfillments, marketplace_inventory_reservations, marketplace_payment_allocations, marketplace_settlements, marketplace_refunds, marketplace_checkout_idempotency, schema_migrations |
| 21 | 21 | L1286 | CREATE TABLE, CREATE INDEX, INSERT | procurement_demands, procurement_demand_items, schema_migrations |
| 22 | 22 | L1367 | CREATE TABLE, CREATE INDEX, INSERT | procurement_supplier_participants, procurement_supplier_relationships, schema_migrations |
| 23 | 23 | L1402 | CREATE TABLE, CREATE INDEX, INSERT | procurement_rfqs, procurement_rfq_items, procurement_rfq_suppliers, procurement_rfq_responses, procurement_rfq_response_items, schema_migrations |
| 24 | 24 | L1521 | CREATE TABLE, CREATE INDEX, INSERT | procurement_comparisons, procurement_comparison_suppliers, procurement_comparison_line_offers, schema_migrations |
| 25 | 25 | L1584 | CREATE TABLE, CREATE INDEX, INSERT | procurement_awards, procurement_award_lines, schema_migrations |
| 26 | 26 | L1653 | CREATE TABLE, ALTER TABLE, CREATE INDEX, DROP TABLE, INSERT | purchase_orders_phase17_6_new, purchase_orders, purchase_order_items, schema_migrations |
| 27 | 27 | L1720 | CREATE TABLE, CREATE INDEX, INSERT | procurement_receipts, procurement_receipt_lines, schema_migrations |
| 28 | 28 | L1775 | CREATE TABLE, CREATE INDEX, INSERT | payment_outbound_intents, schema_migrations |
| 29 | 29 | L1809 | CREATE TABLE, CREATE INDEX, INSERT | payment_procurement_settlements, payment_procurement_settlement_allocations, schema_migrations |
| 30 | 30 | L1858 | CREATE TABLE, CREATE INDEX, INSERT | supplier_network_profiles, schema_migrations |
| 32 | 31 | L1888 | CREATE TABLE, CREATE INDEX, INSERT | supplier_network_catalog_listings, schema_migrations |
| 34 | 32 | L1922 | CREATE TABLE, CREATE INDEX, INSERT | supplier_network_capacity_signals, schema_migrations |
| 35 | 33 | L1957 | CREATE TABLE, CREATE INDEX, INSERT | supplier_network_commercial_terms, schema_migrations |
| 36 | 34 | L1994 | CREATE TABLE, CREATE INDEX, INSERT | supplier_network_qualifications, schema_migrations |
| 37 | 35 | L2030 | CREATE TABLE, CREATE INDEX, INSERT | supplier_network_performance_observations, schema_migrations |
| 38 | 36 | L2064 | CREATE TABLE, CREATE INDEX, INSERT | supplier_network_trust_evidence, schema_migrations |
| 60 | 37 | L2104 | CREATE TABLE, ALTER TABLE, CREATE INDEX, DROP TABLE, INSERT | marketplace_payment_allocations_v40, marketplace_payment_allocations, schema_migrations |
| 39 | 38 | L2130 | CREATE TABLE, CREATE INDEX, INSERT | telegram_storefront_configs, schema_migrations |
| 40 | 39 | L2159 | CREATE TABLE, CREATE INDEX, INSERT | pack_lifecycle, schema_migrations |
| 42 | 40 | L2193 | CREATE TABLE, CREATE INDEX, INSERT | fulfillments, schema_migrations |
| 43 | 41 | L2222 | CREATE TABLE, CREATE INDEX, INSERT | delivery_assignments, schema_migrations |
| 44 | 42 | L2249 | CREATE TABLE, ALTER TABLE, CREATE INDEX, DROP TABLE, INSERT | delivery_assignments_v44, delivery_assignments, schema_migrations |
| 45 | 43 | L2288 | CREATE TABLE, CREATE INDEX, INSERT | payment_intents, payment_evidence, payment_verifications, payment_decisions, payment_idempotency_keys, schema_migrations |
| 61 | 44 | L2408 | ALTER TABLE, INSERT | payment_evidence, schema_migrations |
| 62 | 45 | L2418 | CREATE TABLE, CREATE INDEX, INSERT | payment_confirmation_attempts, schema_migrations |
| 64 | 46 | L2450 | CREATE TABLE, CREATE INDEX, INSERT | payment_status_query_commands, schema_migrations |
| 65 | 47 | L2473 | INSERT | schema_migrations |
| 66 | 48 | L2500 | INSERT | schema_migrations |
| 68 | 49 | L2526 | ALTER TABLE, CREATE INDEX, INSERT | payment_ledger_entries, schema_migrations |
| 69 | 50 | L2538 | ALTER TABLE, INSERT | fulfillments, schema_migrations |
| 70 | 51 | L2549 | CREATE TABLE, CREATE INDEX, INSERT | fulfillment_commands, schema_migrations |
| 71 | 52 | L2586 | CREATE TABLE, CREATE INDEX, INSERT | delivery_assignment_commands, schema_migrations |
| 72 | 53 | L2604 | CREATE TABLE, CREATE INDEX, INSERT | service_delivery_assessment_commands, schema_migrations |
| 73 | 54 | L2650 | CREATE TABLE, CREATE INDEX, INSERT | service_bookings, service_booking_commands, schema_migrations |
| 74 | 55 | L2684 | ALTER TABLE, INSERT | service_bookings, schema_migrations |
| 75 | 56 | L2701 | ALTER TABLE, INSERT | service_bookings, schema_migrations |
| 67 | 57 | L2712 | ALTER TABLE, INSERT, UPDATE | payment_status_query_commands, schema_migrations |
| 63 | 58 | L2745 | ALTER TABLE, CREATE INDEX, INSERT | payment_evidence, schema_migrations |
| 46 | 59 | L2769 | ALTER TABLE, CREATE INDEX, INSERT | payments, schema_migrations |
| 51 | 60 | L2780 | CREATE TABLE, CREATE INDEX, INSERT | payment_routing_policies, schema_migrations |
| 52 | 61 | L2805 | CREATE TABLE, CREATE INDEX, INSERT | payment_operational_actions, schema_migrations |
| 55 | 62 | L2839 | CREATE TABLE, CREATE INDEX, INSERT | payment_production_certifications, schema_migrations |
| 53 | 63 | L2869 | CREATE TABLE, CREATE INDEX, INSERT | payment_provider_capability_certifications, schema_migrations |
| 54 | 64 | L2898 | CREATE INDEX, INSERT | payment_verifications, schema_migrations |
| 56 | 65 | L2909 | ALTER TABLE, INSERT | payment_verifications, schema_migrations |
| 57 | 66 | L2917 | ALTER TABLE, CREATE INDEX, INSERT | audit_events, schema_migrations |
| 59 | 67 | L2932 | CREATE INDEX, INSERT | payment_verifications, schema_migrations |
| 50 | 68 | L2947 | CREATE TABLE, CREATE INDEX, INSERT | payment_settlements, schema_migrations |
| 49 | 69 | L2986 | CREATE TABLE, CREATE INDEX, INSERT | payment_refunds, schema_migrations |
| 48 | 70 | L3025 | CREATE TABLE, ALTER TABLE, CREATE INDEX, DROP TABLE, INSERT | payments_gap113, payment_ledger_entries_gap113, payments, payment_ledger_entries, schema_migrations |
| 47 | 71 | L3111 | ALTER TABLE, CREATE INDEX, INSERT | payment_reconciliations, schema_migrations |
| 41 | 72 | L3134 | CREATE TABLE, CREATE INDEX, INSERT | membership_roles, schema_migrations |
| 33 | 73 | L3170 | CREATE TABLE, CREATE INDEX, INSERT | supplier_network_service_areas, schema_migrations |
| 31 | 74 | L3202 | CREATE TABLE, CREATE INDEX, INSERT | supplier_network_capabilities, schema_migrations |
| 58 | 75 | L3234 | CREATE TABLE, CREATE INDEX, INSERT | logistics_scheduling_activities, schema_migrations |
| 76 | 76 | L3283 | CREATE TABLE, INSERT | tenant_business_templates, schema_migrations |
| 77 | 77 | L3299 | CREATE TABLE, CREATE INDEX, INSERT | tenant_creation_requests, schema_migrations |
| 78 | 78 | L3317 | CREATE TABLE, CREATE INDEX, INSERT | service_resources, service_resource_commands, schema_migrations |
| 79 | 79 | L3356 | CREATE TABLE, CREATE INDEX, INSERT | service_resource_availability, service_resource_availability_commands, schema_migrations |
| 80 | 80 | L3386 | CREATE TABLE, ALTER TABLE, CREATE INDEX, INSERT | service_resource_commitments, service_bookings, schema_migrations |
| 81 | 81 | L3413 | CREATE TABLE, ALTER TABLE, CREATE INDEX, INSERT | service_resource_commitments, service_bookings, schema_migrations |
| 82 | 82 | L3545 | ALTER TABLE, INSERT | locations, schema_migrations |
| 83 | 83 | L3556 | CREATE TABLE, CREATE INDEX, INSERT | restaurant_recipes, schema_migrations |
| 84 | 84 | L3587 | ALTER TABLE, INSERT | supplier_network_capacity_signals, schema_migrations |
| 85 | 85 | L3596 | ALTER TABLE, INSERT, UPDATE, DELETE | procurement_rfq_suppliers, locations, schema_migrations, pack_lifecycle, telegram_storefront_configs, supplier_network_qualifications, supplier_network_commercial_terms, supplier_network_capacity_signals, supplier_network_service_areas, supplier_network_catalog_listings, supplier_network_capabilities, supplier_network_profiles, payment_outbound_intents, payment_procurement_settlements, payment_procurement_settlement_allocations, procurement_demands, procurement_demand_items, procurement_supplier_participants, procurement_supplier_relationships, procurement_rfqs, procurement_rfq_items, procurement_rfq_responses, procurement_rfq_response_items, supplier_network_trust_evidence, supplier_network_performance_observations, procurement_comparisons, procurement_comparison_suppliers, procurement_comparison_line_offers, procurement_awards, procurement_award_lines, customer_pricing_rules, quotes, quote_items, customer_credit_terms, purchase_orders, purchase_order_items, procurement_receipts, procurement_receipt_lines, accounts_receivable, ar_ledger_entries, ar_payment_allocations, invoices, invoice_items, tenants, phone_routing, metadata, organizations, channel_identities, inventory_movements, service_resources, service_resource_commands, service_resource_availability, service_resource_availability_commands, service_bookings, service_booking_commands, service_resource_commitments, service_delivery_assessment_commands, catalog_products, orders, tenant_business_templates, customers, sync_events, payment_intents, payments, payment_ledger_entries, payment_idempotency_keys, payment_evidence, payment_confirmation_attempts, payment_verifications, payment_decisions, payment_status_query_commands, marketplace_payment_allocations, payment_accounts, payment_routing_policies, payment_settlements, payment_refunds, payment_reconciliations, fulfillments, delivery_assignment_commands, delivery_assignments, logistics_scheduling_activities, fulfillment_commands, marketplace_orders, marketplace_seller_orders, marketplace_fulfillments, marketplace_inventory_reservations, marketplace_settlements, marketplace_checkout_idempotency, marketplace_refunds, users, membership_roles, memberships, tenant_creation_requests, devices, sessions, audit_retention_policies, compliance_requests, auth_challenges, pairing_challenges, invites, payment_operational_actions, payment_provider_capability_certifications, payment_production_certifications, restaurant_recipes |

**Migration ordering:** source order is not numerically ascending. The 85 guards cover historical migrations, but later-numbered guards occur before some earlier-numbered guards. Preserve actual source order and inspect dependencies; do not sort or rewrite migration history.

## Cross-domain transactional invariants

### Marketplace checkout atomicity

- Functions: `createMarketplaceOrder`
- Tables: `marketplace_orders`, `marketplace_seller_orders`, `marketplace_fulfillments`, `marketplace_inventory_reservations`, `marketplace_payment_allocations`, `marketplace_settlements`, `marketplace_checkout_idempotency`, `catalog_products`, `inventory_movements`
- Invariant: Checkout creates canonical marketplace/seller order, fulfillment/reservation/payment allocation/settlement and idempotency records while applying inventory consequences in one SQLite transaction.
- Authority boundary: Marketplace orchestrates; Inventory and Payment remain canonical authorities.
### Marketplace cancellation compensation

- Functions: `updateMarketplaceOrderStatus`
- Tables: `orders`, `marketplace_seller_orders`, `marketplace_inventory_reservations`, `inventory_movements`, `marketplace_payment_allocations`, `payment_refunds`, `marketplace_refunds`, `marketplace_settlements`, `marketplace_fulfillments`, `payments`
- Invariant: Cancellation releases reserved stock once and creates canonical Payment refund identity while updating Marketplace projections and lifecycle rows atomically.
- Authority boundary: Marketplace orchestrates; Payment refund and Inventory movement remain canonical.
### Payment financial decision and ledger

- Functions: `commitPaymentDecision`, `createPayment`, `transitionPayment`, `finalizePaymentRefund`, `finalizePaymentSettlement`
- Tables: `payments`, `payment_decisions`, `payment_ledger_entries`, `payment_idempotency_keys`, `payment_verifications`, `payment_evidence`, `payment_intents`, `marketplace_payment_allocations`, `marketplace_settlements`
- Invariant: Financial state, evidence/verification binding, ledger entries, idempotency and marketplace settlement consequences are transactionally coordinated.
- Authority boundary: Payment Core remains sole financial decision and ledger authority.
### Fulfillment and delivery command lifecycle

- Functions: `transitionOrderFulfillment`, `transitionDeliveryAssignment`, `assignDeliveryCourier`
- Tables: `orders`, `fulfillments`, `delivery_assignments`, `fulfillment_commands`, `delivery_assignment_commands`, `inventory_movements`, `locations`, `memberships`, `membership_roles`
- Invariant: Commands validate tenant/org/location/courier scope, durable replay, proof/lifecycle transitions and existing Inventory consequences within transaction boundaries.
- Authority boundary: Preserve frozen Order → Fulfillment → Delivery Assignment → Delivery Lifecycle → Proof/Exception → Inventory consequence chain; Payment/Settlement remain outside Logistics.
### Procurement receipt and Inventory posting

- Functions: `createProcurementReceipt`, `appendInventoryMovement`
- Tables: `purchase_orders`, `purchase_order_items`, `procurement_receipts`, `procurement_receipt_lines`, `catalog_products`, `locations`, `inventory_movements`, `audit_events`
- Invariant: Receipt intent binds to approved procurement-origin PO lines and organization location; receipt and canonical inventory movement posting must remain transactionally coherent and replay-safe.
- Authority boundary: Procurement owns receipt intent; Inventory owns stock movement.
### Procurement RFQ-time capacity snapshot

- Functions: `createProcurementRfq`
- Tables: `procurement_rfqs`, `procurement_rfq_items`, `procurement_rfq_suppliers`, `supplier_network_capacity_signals`
- Invariant: Capacity evidence is snapshotted per invited supplier at RFQ creation with capture time; later evidence changes must not rewrite historical RFQ snapshot.
- Authority boundary: Supplier Network owns source evidence; Procurement owns immutable RFQ snapshot. Neither authorizes operational scheduling.
### Service resource and booking commitment

- Functions: `createServiceBooking`, `transitionServiceBooking`, `createServiceResource`, `updateServiceResource`, `setServiceResourceAvailability`
- Tables: `service_resources`, `service_resource_availability`, `service_resource_commitments`, `service_bookings`, `service_booking_commands`, `service_resource_commands`, `service_resource_availability_commands`, `orders`, `locations`
- Invariant: Booking/resource/availability/commitment state shares resource/location scope and idempotent command records.
- Authority boundary: Service capability owns booking/resource commitments; no second Logistics Scheduling authority.

## Cohesive units that must remain together

- **Marketplace checkout and cancellation:** `createMarketplaceOrder`, `updateMarketplaceOrderStatus`. Shared lifecycle, inventory reservations/movements, Payment allocation/refund, settlement and idempotency.
- **Payment decision/refund/settlement core:** `commitPaymentDecision`, `createPayment`, `transitionPayment`, `createPaymentRefundRequest`, `finalizePaymentRefund`, `createPaymentSettlement`, `finalizePaymentSettlement`. Financial decision, ledger, evidence, idempotency and Marketplace allocation effects.
- **Inventory movement primitive and consumers:** `appendInventoryMovement`, `appendInventoryMovementBatch`, `createProcurementReceipt`, `createMarketplaceOrder`, `updateMarketplaceOrderStatus`, `transitionOrderFulfillment`, `transitionDeliveryAssignment`. Canonical Inventory ledger is consumed by Procurement, Marketplace and Fulfillment.
- **Fulfillment and delivery lifecycle:** `assignDeliveryCourier`, `transitionDeliveryAssignment`, `transitionOrderFulfillment`. Command idempotency, tenant/location/courier scope, proof and Inventory consequence.
- **Service resource and booking lifecycle:** `createServiceResource`, `updateServiceResource`, `setServiceResourceAvailability`, `createServiceBooking`, `transitionServiceBooking`. Resource availability, commitments, bookings and location-scoped authorization.
- **Identity/session/membership lifecycle:** `createTenantForUser`, `ensureMembership`, `createSession`, `authenticateSessionToken`, `consumeInvite`, `consumePairingChallenge`, `changeMembershipRole`, `assignMembershipContextualRole`, `revokeMembershipContextualRole`. Membership, contextual roles, device/session identity and tenant scope.

## Potentially bounded extraction candidates (not approved)

| Candidate | Functions | Tables | Risk | Status / dependency |
|---|---|---|---|---|
| `restaurant_recipes` | `listRestaurantRecipes`, `createRestaurantRecipe`, `updateRestaurantRecipe` | `restaurant_recipes` | low-to-medium | candidate for proof only; not approved; Audit writes and shared Inventory transaction-slot serialization still apply. |
| `tenant_business_templates` | `getBusinessTemplateConfig`, `saveBusinessTemplateConfig` | `tenant_business_templates` | low-to-medium | candidate for proof only; not approved; Tenant lookup, owner authorization at HTTP boundary, allowlisted keys and audit. |
| `pack_lifecycle` | `getPackLifecycle`, `transitionPackLifecycle` | `pack_lifecycle` | medium | candidate for proof only; not approved; Pack readiness preconditions, actor checks and shared audit. |

## Decision

**No extraction from `store-sqlite.js` is approved by this audit pass.** Validate the SQL and caller graph against tests before considering any bounded slice. A domain-shaped table prefix or function-name cluster is not proof of a safe persistence boundary.

Machine-readable function/table/index/FK/migration map: `sqlite-dependency-map.json`; all 1,639 normalized full SQL statements: `sqlite-sql-statements.json`.