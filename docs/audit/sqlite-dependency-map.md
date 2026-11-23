# SQLite dependency map

- Source commit: `e216db18ade2a5ffa66aff9dc3096e207251a918`
- Source: `backend/lib/store-sqlite.js`
- Exported functions: **253**
- Literal SQL statements in exported functions: **947**
- Dynamic `db.prepare/db.exec` calls not captured as literal SQL: **3**
- Unique tables: **110** (112 declarations)
- Foreign-key declarations: **286** (280 deduplicated edges)
- Index declarations: **206** (192 unique names)
- Migration guards: **85**

## Method and limitations

- Exported functions are parsed from source; each record includes source line, literal SQL statements, read/write table access, direct named local calls, and transaction markers.
- The SQL statement scan sees literal `db.prepare()` and `db.exec()` arguments. Three dynamic call sites are listed separately; helper-generated SQL and indirect calls remain a manual-review limitation.
- A direct call graph is not a complete runtime call graph. Callback references, imports from other modules, and dynamic dispatch are not inferred.
- Transaction flags distinguish explicit local `BEGIN`/`COMMIT`/`ROLLBACK`, caller-owned transaction support, and serialized write slots. Absence of local markers is not proof of autocommit.
- Logical table owners are provisional, based on schema shape, observed reads/writes, and existing domain contracts—not names alone.

## Exported function dependency map

| Exported function / line | Tables accessed | SQL operations | Direct local function calls | Transaction evidence |
|---|---|---|---|---|
| `transitionPackLifecycle` (L3646) | pack_lifecycle | SELECT, BEGIN, INSERT, UPDATE, COMMIT, ROLLBACK | assertProcurementActor, audit, ensureDatabase, nowIso, packLifecycleFromRow, tenantOrganizationId | explicit local transaction with commit/rollback |
| `getPackLifecycle` (L3727) | pack_lifecycle | SELECT | ensureDatabase | no explicit transaction boundary detected in function body |
| `getTelegramStorefrontConfig` (L3769) | telegram_storefront_configs, tenants | SELECT | ensureDatabase, parseJSON | no explicit transaction boundary detected in function body |
| `upsertTelegramStorefrontConfig` (L3789) | telegram_storefront_configs | BEGIN, UPDATE, INSERT, COMMIT, ROLLBACK | assertTelegramStorefrontTransition, audit, ensureDatabase, getTelegramStorefrontConfig, getTenant, json, nowIso | explicit local transaction with commit/rollback |
| `verifyTelegramStorefront` (L3845) | telegram_storefront_configs | BEGIN, UPDATE, COMMIT, ROLLBACK | audit, ensureDatabase, getTelegramStorefrontConfig, getTenant, nowIso | explicit local transaction with commit/rollback |
| `listSupplierNetworkQualifications` (L3880) | supplier_network_qualifications | SELECT | ensureDatabase, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `getSupplierNetworkQualification` (L3881) | no literal SQL table found | none detected | ensureDatabase, supplierNetworkQualificationFromRow, supplierNetworkQualificationRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `upsertSupplierNetworkQualification` (L3882) | supplier_network_qualifications | BEGIN, UPDATE, INSERT, COMMIT, ROLLBACK, SELECT | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, json, normalizeSupplierNetworkQualificationInput, nowIso, supplierNetworkQualificationFromRow, supplierNetworkQualificationRow, tenantOrganizationId | explicit local transaction with commit/rollback |
| `transitionSupplierNetworkQualification` (L3883) | supplier_network_qualifications | UPDATE | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, nowIso, supplierNetworkQualificationFromRow, supplierNetworkQualificationRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `listSupplierNetworkCommercialTerms` (L3891) | supplier_network_commercial_terms | SELECT | ensureDatabase, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `getSupplierNetworkCommercialTerms` (L3892) | no literal SQL table found | none detected | ensureDatabase, supplierNetworkCommercialTermsFromRow, supplierNetworkCommercialTermsRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `upsertSupplierNetworkCommercialTerms` (L3893) | catalog_products, supplier_network_capabilities, supplier_network_commercial_terms | SELECT, BEGIN, UPDATE, INSERT, COMMIT, ROLLBACK | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, json, normalizeSupplierNetworkCommercialTermsInput, nowIso, supplierNetworkCommercialTermsFromRow, supplierNetworkCommercialTermsRow, supplierTenantForOrganization, tenantOrganizationId | explicit local transaction with commit/rollback |
| `transitionSupplierNetworkCommercialTerms` (L3894) | supplier_network_commercial_terms | UPDATE | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, nowIso, supplierNetworkCommercialTermsFromRow, supplierNetworkCommercialTermsRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `listSupplierNetworkCapacities` (L3950) | supplier_network_capacity_signals | SELECT | ensureDatabase, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `getSupplierNetworkCapacity` (L3951) | no literal SQL table found | none detected | ensureDatabase, supplierNetworkCapacityFromRow, supplierNetworkCapacityRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `upsertSupplierNetworkCapacity` (L3952) | supplier_network_capacity_signals | SELECT, BEGIN, UPDATE, INSERT, COMMIT, ROLLBACK | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, json, normalizeSupplierNetworkCapacityInput, nowIso, supplierNetworkCapacityFromRow, supplierNetworkCapacityRow, tenantOrganizationId | explicit local transaction with commit/rollback |
| `transitionSupplierNetworkCapacity` (L3996) | supplier_network_capacity_signals | UPDATE | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, nowIso, supplierNetworkCapacityFromRow, supplierNetworkCapacityRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `listSupplierNetworkServiceAreas` (L3998) | supplier_network_service_areas | SELECT | ensureDatabase, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `getSupplierNetworkServiceArea` (L3999) | no literal SQL table found | none detected | ensureDatabase, supplierNetworkServiceAreaFromRow, supplierNetworkServiceAreaRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `upsertSupplierNetworkServiceArea` (L4000) | supplier_network_service_areas | SELECT, BEGIN, UPDATE, INSERT, COMMIT, ROLLBACK | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, json, normalizeSupplierNetworkServiceAreaInput, nowIso, supplierNetworkServiceAreaFromRow, supplierNetworkServiceAreaRow, tenantOrganizationId | explicit local transaction with commit/rollback |
| `transitionSupplierNetworkServiceArea` (L4001) | supplier_network_service_areas | UPDATE | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, nowIso, supplierNetworkServiceAreaFromRow, supplierNetworkServiceAreaRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `listSupplierNetworkCatalogListings` (L4010) | supplier_network_catalog_listings | SELECT | ensureDatabase, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `getSupplierNetworkCatalogListing` (L4011) | no literal SQL table found | none detected | ensureDatabase, supplierNetworkCatalogFromRow, supplierNetworkCatalogRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `upsertSupplierNetworkCatalogListing` (L4012) | catalog_products, supplier_network_catalog_listings | SELECT, BEGIN, UPDATE, INSERT, COMMIT, ROLLBACK | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, json, normalizeSupplierNetworkCatalogInput, nowIso, supplierNetworkCatalogFromRow, supplierNetworkCatalogRow, supplierTenantForOrganization, tenantOrganizationId | explicit local transaction with commit/rollback |
| `transitionSupplierNetworkCatalogListing` (L4013) | supplier_network_catalog_listings | UPDATE | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, nowIso, supplierNetworkCatalogFromRow, supplierNetworkCatalogRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `listSupplierNetworkCapabilities` (L4021) | supplier_network_capabilities | SELECT | ensureDatabase, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `getSupplierNetworkCapability` (L4022) | no literal SQL table found | none detected | ensureDatabase, supplierNetworkCapabilityFromRow, supplierNetworkCapabilityRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `upsertSupplierNetworkCapability` (L4023) | supplier_network_capabilities | SELECT, BEGIN, UPDATE, INSERT, COMMIT, ROLLBACK | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, json, normalizeSupplierNetworkCapabilityInput, nowIso, supplierNetworkCapabilityFromRow, supplierNetworkCapabilityRow, tenantOrganizationId | explicit local transaction with commit/rollback |
| `transitionSupplierNetworkCapability` (L4024) | supplier_network_capabilities | UPDATE | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, nowIso, supplierNetworkCapabilityFromRow, supplierNetworkCapabilityRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `getSupplierNetworkProfile` (L4036) | no literal SQL table found | none detected | ensureDatabase, supplierNetworkProfileFromRow, supplierNetworkProfileRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `upsertSupplierNetworkProfile` (L4037) | organizations, supplier_network_profiles | SELECT, BEGIN, INSERT, UPDATE, COMMIT, ROLLBACK | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, json, normalizeSupplierProfileInput, nowIso, supplierNetworkProfileFromRow, supplierNetworkProfileRow, tenantOrganizationId | explicit local transaction with commit/rollback |
| `transitionSupplierNetworkProfile` (L4038) | supplier_network_profiles | UPDATE | assertProcurementActor, assertSupplierNetworkParticipant, audit, ensureDatabase, nowIso, supplierNetworkProfileFromRow, supplierNetworkProfileRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `listPaymentOutboundIntents` (L4045) | payment_outbound_intents | SELECT | ensureDatabase, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `getPaymentOutboundIntent` (L4046) | payment_outbound_intents | SELECT | ensureDatabase, paymentOutboundFromRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `createPaymentOutboundIntent` (L4047) | payment_outbound_intents, purchase_orders | SELECT, INSERT | audit, ensureDatabase, json, normaliseCurrency, nowIso, paymentOutboundFromRow, tenantCurrency, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `transitionPaymentOutboundIntent` (L4048) | payment_outbound_intents | SELECT, UPDATE | audit, ensureDatabase, nowIso, paymentOutboundFromRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `createProcurementPaymentIntent` (L4049) | purchase_orders | SELECT | createPaymentOutboundIntent, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `getProcurementSettlement` (L4068) | payment_procurement_settlement_allocations, payment_procurement_settlements | SELECT | ensureDatabase, paymentProcurementSettlementFromRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `listProcurementSettlements` (L4069) | payment_procurement_settlement_allocations, payment_procurement_settlements | SELECT | ensureDatabase, paymentProcurementSettlementFromRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `listProcurementSettlementAllocations` (L4070) | payment_outbound_intents, payment_procurement_settlement_allocations, payment_procurement_settlements | SELECT | ensureDatabase, normaliseCurrency, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `allocateConfirmedOutboundPaymentToProcurementSettlement` (L4071) | payment_outbound_intents, payment_procurement_settlement_allocations, payment_procurement_settlements | SELECT, BEGIN, INSERT, UPDATE, COMMIT, ROLLBACK | audit, ensureDatabase, getOrCreateProcurementSettlement, getProcurementSettlement, normaliseCurrency, nowIso, tenantOrganizationId | explicit local transaction with commit/rollback |
| `createProcurementDemand` (L4248) | procurement_demand_items, procurement_demands | SELECT, BEGIN, INSERT, COMMIT, ROLLBACK | assertProcurementActor, assertProcurementLocation, audit, ensureDatabase, generateProcurementRequestNumber, getProcurementDemand, nowIso, procurementDemandHash, procurementDemandInput, tenantOrganizationId | explicit local transaction with commit/rollback |
| `getProcurementDemand` (L4292) | procurement_demand_items, procurement_demands | SELECT | ensureDatabase, procurementDemandFromRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `listProcurementDemands` (L4301) | no literal SQL table found | none detected | ensureDatabase, procurementDemandRows, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `updateProcurementDemand` (L4314) | procurement_demand_items, procurement_demands | SELECT, BEGIN, UPDATE, DELETE, INSERT, COMMIT, ROLLBACK | assertProcurementActor, assertProcurementLocation, audit, ensureDatabase, getProcurementDemand, nowIso, procurementDemandHash, procurementDemandInput, tenantOrganizationId | explicit local transaction with commit/rollback |
| `transitionProcurementDemand` (L4349) | procurement_demands | SELECT, BEGIN, UPDATE, COMMIT, ROLLBACK | assertProcurementActor, audit, ensureDatabase, getProcurementDemand, nowIso, tenantOrganizationId | explicit local transaction with commit/rollback |
| `getProcurementSupplierParticipation` (L4379) | no literal SQL table found | none detected | ensureDatabase, supplierParticipantFromRow, supplierParticipantRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `setProcurementSupplierParticipation` (L4380) | procurement_supplier_participants | INSERT, UPDATE | assertSupplierMember, audit, ensureDatabase, getProcurementSupplierParticipation, nowIso, supplierParticipantRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `discoverProcurementSuppliers` (L4381) | organizations, procurement_supplier_participants | SELECT | assertSupplierMember, ensureDatabase, normaliseCurrency, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `listProcurementSupplierRelationships` (L4382) | organizations, procurement_supplier_relationships | SELECT | assertSupplierMember, ensureDatabase, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `createProcurementSupplierRelationship` (L4383) | organizations, procurement_supplier_relationships | SELECT, INSERT | activeDiscoverableSupplier, assertSupplierMember, audit, ensureDatabase, nowIso, supplierRelationshipFromRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `transitionProcurementSupplierRelationship` (L4384) | organizations, procurement_supplier_relationships | SELECT, UPDATE | assertSupplierMember, audit, ensureDatabase, nowIso, supplierRelationshipFromRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `createProcurementRfq` (L4441) | procurement_demand_items, procurement_rfq_items, procurement_rfq_suppliers, procurement_rfqs | SELECT, BEGIN, INSERT, COMMIT, ROLLBACK | assertActiveSupplierRelationship, assertProcurementActor, audit, ensureDatabase, getProcurementDemand, json, nowIso, procurementCapacityEvidenceSnapshotForSupplier, procurementRfqHash, procurementRfqInput, rfqRows, tenantOrganizationId | explicit local transaction with commit/rollback |
| `listProcurementRfqs` (L4443) | procurement_rfqs | SELECT | assertProcurementActor, ensureDatabase, rfqRows, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `transitionProcurementRfq` (L4444) | procurement_rfq_suppliers, procurement_rfqs | SELECT, BEGIN, UPDATE, COMMIT, ROLLBACK | assertProcurementActor, audit, ensureDatabase, nowIso, rfqRows, tenantOrganizationId | explicit local transaction with commit/rollback |
| `createProcurementRfqResponse` (L4446) | organizations, procurement_rfq_items, procurement_rfq_response_items, procurement_rfq_responses, procurement_rfqs | SELECT, BEGIN, UPDATE, DELETE, INSERT, COMMIT, ROLLBACK | assertProcurementActor, assertRfqRecipient, audit, ensureDatabase, normaliseCurrency, nowIso, procurementRfqHash, procurementRfqResponseFromRow, tenantOrganizationId | explicit local transaction with commit/rollback |
| `transitionProcurementRfqResponse` (L4448) | organizations, procurement_rfq_response_items, procurement_rfq_responses, procurement_rfq_suppliers, procurement_rfqs | SELECT, BEGIN, UPDATE, COMMIT, ROLLBACK | assertProcurementActor, audit, ensureDatabase, nowIso, procurementRfqResponseFromRow, tenantOrganizationId | explicit local transaction with commit/rollback |
| `listSupplierNetworkTrustEvidence` (L4574) | supplier_network_trust_evidence | SELECT | assertProcurementActor, ensureDatabase, nowIso, supplierNetworkTrustCanAccessEvidence, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `getSupplierNetworkTrustEvidence` (L4617) | supplier_network_trust_evidence | SELECT | assertProcurementActor, ensureDatabase, supplierNetworkTrustCanAccessEvidence, supplierNetworkTrustEvidenceFromRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `refreshSupplierNetworkTrustEvidence` (L4625) | procurement_supplier_participants, procurement_supplier_relationships, supplier_network_performance_observations, supplier_network_qualifications, supplier_network_trust_evidence | SELECT, BEGIN, INSERT, COMMIT, ROLLBACK | assertProcurementActor, audit, ensureDatabase, json, listSupplierNetworkTrustEvidence, nowIso, tenantOrganizationId | explicit local transaction with commit/rollback |
| `listSupplierNetworkPerformance` (L4659) | procurement_supplier_relationships, supplier_network_performance_observations | SELECT | assertProcurementActor, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `getSupplierNetworkPerformance` (L4673) | procurement_supplier_relationships, supplier_network_performance_observations | SELECT | assertProcurementActor, supplierNetworkPerformanceFromRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `recalculateSupplierNetworkPerformance` (L4686) | procurement_receipt_lines, procurement_receipts, procurement_rfq_responses, procurement_rfq_suppliers, procurement_rfqs, procurement_supplier_participants, purchase_order_items, purchase_orders, supplier_network_performance_observations | SELECT, BEGIN, INSERT, COMMIT, ROLLBACK | assertProcurementActor, audit, json, listSupplierNetworkPerformance, nowIso, tenantOrganizationId | explicit local transaction with commit/rollback |
| `getSupplierNetworkMarketplaceIntegration` (L4739) | catalog_products, organizations, supplier_network_catalog_listings, supplier_network_profiles, tenants | SELECT | assertProcurementActor, audit, ensureDatabase, marketplaceIntegrationVisible, marketplacePresenceForOrganization, supplierParticipantRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `discoverSupplierNetwork` (L4741) | catalog_products, organizations, procurement_supplier_participants, procurement_supplier_relationships, supplier_network_capabilities, supplier_network_capacity_signals, supplier_network_catalog_listings, supplier_network_commercial_terms, supplier_network_profiles, supplier_network_qualifications, supplier_network_service_areas, supplier_network_trust_evidence, tenants | SELECT | assertProcurementActor, audit, ensureDatabase, marketplacePresenceForOrganization, normaliseCurrency, parseJSON, supplierNetworkDiscoveryVisible, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `getProcurementComparison` (L4819) | no literal SQL table found | none detected | assertProcurementActor, comparisonRows, ensureDatabase, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `listProcurementComparisons` (L4826) | procurement_comparisons | SELECT | assertProcurementActor, comparisonRows, ensureDatabase, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `createProcurementComparison` (L4838) | organizations, procurement_comparison_line_offers, procurement_comparison_suppliers, procurement_comparisons, procurement_rfq_items, procurement_rfq_response_items, procurement_rfq_responses, procurement_rfqs | SELECT, BEGIN, INSERT, COMMIT, ROLLBACK | assertProcurementActor, audit, comparisonLeadSort, comparisonRows, comparisonValiditySort, comparisonValidityTimestamp, ensureDatabase, normaliseCurrency, nowIso, tenantOrganizationId | explicit local transaction with commit/rollback |
| `getProcurementAward` (L4969) | no literal SQL table found | none detected | assertProcurementActor, ensureDatabase, getProcurementAwardById, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `listProcurementAwards` (L4976) | procurement_awards | SELECT | assertProcurementActor, ensureDatabase, getProcurementAwardById, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `createProcurementAward` (L4994) | procurement_award_lines, procurement_awards, procurement_comparison_line_offers, procurement_comparisons, procurement_demands, procurement_rfq_items, procurement_rfq_responses, procurement_rfqs | SELECT, BEGIN, INSERT, COMMIT, ROLLBACK | assertProcurementActor, audit, ensureDatabase, getProcurementAwardById, normaliseCurrency, nowIso, procurementAwardHash, tenantOrganizationId | explicit local transaction with commit/rollback |
| `transitionProcurementAward` (L5053) | procurement_award_lines, procurement_awards, procurement_demands | SELECT, BEGIN, UPDATE, COMMIT, ROLLBACK | assertProcurementActor, audit, ensureDatabase, getProcurementAwardById, nowIso, tenantOrganizationId | explicit local transaction with commit/rollback |
| `listCustomerPricing` (L5106) | customer_pricing_rules | SELECT | tenantOrganizationId | no explicit transaction boundary detected in function body |
| `getCustomerPricing` (L5118) | customer_pricing_rules | SELECT | customerPricingFromRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `upsertCustomerPricing` (L5123) | customer_pricing_rules | BEGIN, INSERT, SELECT, COMMIT, ROLLBACK | assertBusinessCustomer, assertCatalogProductForOrganization, audit, customerPricingFromRow, normaliseCurrency, nowIso, tenantCurrency, tenantOrganizationId | explicit local transaction with commit/rollback |
| `updateCustomerPricing` (L5184) | no literal SQL table found | none detected | getCustomerPricing, upsertCustomerPricing | no explicit transaction boundary detected in function body |
| `getQuote` (L5218) | no literal SQL table found | none detected | getQuoteByIdSync, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `listQuotes` (L5223) | quotes | SELECT | quoteFromRow, quoteItemsFromRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `createQuote` (L5238) | customer_pricing_rules, quote_items, quotes | SELECT, BEGIN, INSERT, COMMIT, ROLLBACK | assertCatalogProductForOrganization, assertQuoteCustomer, audit, getQuoteByIdSync, nextQuoteNumber, normaliseCurrency, nowIso, parseJSON, tenantCurrency, tenantOrganizationId | explicit local transaction with commit/rollback |
| `transitionQuote` (L5284) | quotes | UPDATE | audit, getQuoteByIdSync, nowIso, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `getCreditTerms` (L5379) | customer_credit_terms | SELECT | creditTermsFromRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `listCreditTerms` (L5385) | customer_credit_terms | SELECT | tenantOrganizationId | no explicit transaction boundary detected in function body |
| `createCreditTerms` (L5395) | customer_credit_terms | SELECT, INSERT | assertBusinessCustomerForCredit, audit, getCreditTerms, normaliseCurrency, nowIso, tenantCurrency, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `transitionCreditTerms` (L5430) | customer_credit_terms | UPDATE | audit, getCreditTerms, nowIso, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `updateCreditTerms` (L5448) | customer_credit_terms | UPDATE | audit, getCreditTerms, normaliseCurrency, nowIso, tenantCurrency, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `getPurchaseOrder` (L5467) | no literal SQL table found | none detected | getPurchaseOrderByIdSync, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `listPurchaseOrders` (L5472) | purchase_orders | SELECT | purchaseOrderFromRow, purchaseOrderItemsFromRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `createPurchaseOrder` (L5482) | purchase_order_items, purchase_orders | SELECT, BEGIN, INSERT, COMMIT, ROLLBACK | audit, createPurchaseOrderFromProcurementAward, getPurchaseOrderByIdSync, getQuoteByIdSync, nextPurchaseOrderNumber, nowIso, tenantOrganizationId | explicit local transaction with commit/rollback |
| `getProcurementReceipt` (L5562) | no literal SQL table found | none detected | assertProcurementActor, getProcurementReceiptByIdSync, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `listProcurementReceipts` (L5568) | procurement_receipts | SELECT | assertProcurementActor, getProcurementReceiptByIdSync, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `createProcurementReceipt` (L5579) | catalog_products, locations, procurement_receipt_lines, procurement_receipts, purchase_order_items, purchase_orders | SELECT, BEGIN, INSERT, COMMIT, ROLLBACK, UPDATE | appendInventoryMovement, assertProcurementActor, audit, getProcurementReceiptByIdSync, nextProcurementReceiptNumber, nowIso, parseJSON, procurementReceiptHash, tenantOrganizationId | explicit local transaction with commit/rollback |
| `createPurchaseOrderFromProcurementAward` (L5680) | procurement_award_lines, procurement_awards, procurement_rfq_items, purchase_order_items, purchase_orders | SELECT, BEGIN, INSERT, COMMIT, ROLLBACK | assertProcurementActor, audit, getPurchaseOrderByIdSync, nextPurchaseOrderNumber, normaliseCurrency, nowIso, tenantCurrency, tenantOrganizationId | explicit local transaction with commit/rollback |
| `transitionPurchaseOrder` (L5732) | purchase_orders | UPDATE | audit, getPurchaseOrderByIdSync, nowIso, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `getReceivable` (L5775) | accounts_receivable | SELECT | ensureDatabase, receivableFromRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `listReceivables` (L5781) | accounts_receivable | SELECT | ensureDatabase, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `createReceivable` (L5791) | accounts_receivable, ar_ledger_entries, customer_credit_terms, orders | SELECT, BEGIN, INSERT, COMMIT, ROLLBACK | addDaysIso, assertBusinessCustomerForReceivable, audit, ensureDatabase, getPurchaseOrderByIdSync, getReceivable, json, normaliseCurrency, nowIso, parseJSON, tenantCurrency, tenantOrganizationId | explicit local transaction with commit/rollback |
| `transitionReceivable` (L5843) | accounts_receivable, ar_ledger_entries | UPDATE, INSERT | audit, getReceivable, json, nowIso | no explicit transaction boundary detected in function body |
| `allocatePaymentToReceivable` (L5857) | accounts_receivable, ar_ledger_entries, ar_payment_allocations | SELECT, BEGIN, INSERT, UPDATE, COMMIT, ROLLBACK | audit, getPayment, getReceivable, json, nowIso | explicit local transaction with commit/rollback |
| `listReceivableLedger` (L5884) | ar_ledger_entries | SELECT | getReceivable, normaliseCurrency, parseJSON | no explicit transaction boundary detected in function body |
| `getInvoice` (L5908) | invoices | SELECT | ensureDatabase, invoiceFromRow, invoiceItems, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `listInvoices` (L5915) | invoices | SELECT | ensureDatabase, invoiceFromRow, invoiceItems, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `createInvoice` (L5940) | invoice_items, invoices | SELECT, BEGIN, INSERT, COMMIT, ROLLBACK | audit, ensureDatabase, getInvoice, getReceivable, nextInvoiceNumber, nowIso, sourceItemsForInvoice, tenantCurrency, tenantOrganizationId | explicit local transaction with commit/rollback |
| `transitionInvoice` (L5969) | invoices | BEGIN, SELECT, UPDATE, COMMIT, ROLLBACK | audit, ensureDatabase, getInvoice, invoiceFromRow, invoiceItems, nowIso, tenantOrganizationId | explicit local transaction with commit/rollback |
| `listOrganizationLocations` (L6176) | locations | SELECT | ensureCanonicalIdentityForTenant, ensureDatabase | no explicit transaction boundary detected in function body |
| `getOrganizationLocation` (L6189) | locations | SELECT | ensureCanonicalIdentityForTenant, ensureDatabase, organizationLocationFromRow | no explicit transaction boundary detected in function body |
| `createOrganizationLocation` (L6197) | locations | INSERT, SELECT | audit, ensureCanonicalIdentityForTenant, ensureDatabase, normaliseLocationStatus, normaliseLocationTimeZone, normaliseLocationType, nowIso, organizationLocationFromRow | no explicit transaction boundary detected in function body |
| `updateOrganizationLocation` (L6219) | locations | SELECT, UPDATE | audit, ensureCanonicalIdentityForTenant, ensureDatabase, normaliseLocationStatus, normaliseLocationTimeZone, normaliseLocationType, organizationLocationFromRow | no explicit transaction boundary detected in function body |
| `getIdentityForTenant` (L6245) | channel_identities, locations, organizations | SELECT | ensureCanonicalIdentityForTenant, ensureDatabase, parseJSON | no explicit transaction boundary detected in function body |
| `listServiceResources` (L6544) | service_resources | SELECT | ensureCanonicalIdentityForTenant, ensureDatabase | no explicit transaction boundary detected in function body |
| `createServiceResource` (L6557) | service_resource_commands, service_resources, tenants | BEGIN, SELECT, COMMIT, INSERT, ROLLBACK | audit, ensureCanonicalIdentityForTenant, ensureDatabase, json, nowIso, serviceResourceFromRow, serviceResourceInput, validateServiceResourceReferences | explicit local transaction with commit/rollback |
| `updateServiceResource` (L6602) | service_resource_commands, service_resource_commitments, service_resources, tenants | BEGIN, SELECT, COMMIT, UPDATE, INSERT, ROLLBACK | audit, ensureCanonicalIdentityForTenant, ensureDatabase, json, nowIso, serviceResourceFromRow, serviceResourceInput, validateServiceResourceReferences | explicit local transaction with commit/rollback |
| `getServiceResourceAvailability` (L6691) | locations, organizations, service_resource_availability, service_resources | SELECT | ensureCanonicalIdentityForTenant, ensureDatabase, serviceResourceAvailabilityFromRow | no explicit transaction boundary detected in function body |
| `setServiceResourceAvailability` (L6725) | locations, organizations, service_resource_availability, service_resource_availability_commands, service_resource_commitments, service_resources, tenants | BEGIN, SELECT, COMMIT, INSERT, ROLLBACK | audit, ensureCanonicalIdentityForTenant, ensureDatabase, json, nowIso, parseJSON, serviceResourceAvailabilityFromRow | explicit local transaction with commit/rollback |
| `createServiceBooking` (L6817) | orders, service_booking_commands, service_bookings, tenants | BEGIN, SELECT, COMMIT, INSERT, ROLLBACK | assertServiceBookingAuthorityBoundary, assertTelegramBuyerOwnsCanonicalServiceOrder, audit, bookingRequiredText, bookingTimestamp, ensureDatabase, getTenant, nowIso, orderFromRow, serviceBookingFromRow | explicit local transaction with commit/rollback |
| `transitionServiceBooking` (L6867) | locations, orders, organizations, service_booking_commands, service_bookings, service_resource_availability, service_resource_commitments, service_resources, tenants | BEGIN, SELECT, COMMIT, UPDATE, INSERT, ROLLBACK | assertServiceBookingAuthorityBoundary, assertTelegramBuyerOwnsCanonicalServiceOrder, audit, bookingRequiredText, ensureDatabase, getTenant, nowIso, orderFromRow, parseJSON, serviceBookingFromRow | explicit local transaction with commit/rollback |
| `listServiceProviderBookings` (L6998) | service_bookings, service_resource_commitments, service_resources | SELECT | ensureDatabase, getTenant, serviceBookingFromRow | no explicit transaction boundary detected in function body |
| `listServiceBookings` (L7028) | service_bookings | SELECT | ensureDatabase, getTenant | no explicit transaction boundary detected in function body |
| `recordServiceDeliveryAssessment` (L7036) | orders, service_delivery_assessment_commands, tenants | BEGIN, SELECT, COMMIT, UPDATE, INSERT, ROLLBACK | assertLogisticsSchedulingAuthorization, audit, ensureDatabase, getCoreFulfillmentOrder, getTenant, json, nowIso, orderFromRow | explicit local transaction with commit/rollback |
| `getOrCreateTenant` (L7255) | tenants | SELECT, INSERT | audit, ensureCanonicalIdentityForTenant, ensureDatabase, nowIso, tenantFromRow | no explicit transaction boundary detected in function body |
| `getTenant` (L7275) | tenants | SELECT | ensureDatabase, tenantCurrency, tenantFromRow | no explicit transaction boundary detected in function body |
| `getBusinessTemplateConfig` (L7287) | tenant_business_templates | SELECT | ensureDatabase, getTenant, parseJSON | no explicit transaction boundary detected in function body |
| `saveBusinessTemplateConfig` (L7301) | tenant_business_templates | BEGIN, INSERT, COMMIT, ROLLBACK | audit, ensureDatabase, getTenant, json, nowIso | explicit local transaction with commit/rollback |
| `getTenantByApiKey` (L7368) | tenants | SELECT | ensureDatabase, tenantFromRow | no explicit transaction boundary detected in function body |
| `updateTenant` (L7374) | catalog_products, orders, organizations, tenants | SELECT, UPDATE | audit, ensureDatabase, getTenant, json, normaliseCurrency, tenantCurrency | no explicit transaction boundary detected in function body |
| `listTenants` (L7416) | tenants | SELECT | ensureDatabase | no explicit transaction boundary detected in function body |
| `getCatalog` (L7421) | catalog_products | SELECT | ensureDatabase | no explicit transaction boundary detected in function body |
| `saveCatalog` (L7428) | catalog_products, inventory_movements, orders, tenants | BEGIN, SELECT, DELETE, COMMIT, ROLLBACK | audit, ensureDatabase, ensureInventoryOpeningBalances, insertProduct, parseJSON, tenantCurrency | explicit local transaction with commit/rollback |
| `listCustomers` (L7536) | customers | SELECT | ensureDatabase, getTenant | no explicit transaction boundary detected in function body |
| `getCustomer` (L7553) | customers | SELECT | customerFromRow, ensureDatabase, getTenant | no explicit transaction boundary detected in function body |
| `upsertCustomer` (L7647) | no literal SQL table found | none detected | upsertCustomerSync | no explicit transaction boundary detected in function body |
| `updateCustomer` (L7651) | no literal SQL table found | none detected | getCustomer, upsertCustomer | no explicit transaction boundary detected in function body |
| `listInventoryMovements` (L7686) | inventory_movements | SELECT | ensureDatabase, getTenant | no explicit transaction boundary detected in function body |
| `getInventoryBalances` (L7700) | inventory_movements | SELECT | ensureDatabase, getTenant | no explicit transaction boundary detected in function body |
| `appendInventoryMovement` (L7837) | no literal SQL table found | BEGIN, COMMIT, ROLLBACK | appendInventoryMovementInTransaction, ensureDatabase, getTenant, waitForInventoryTransactionSlot | explicit local transaction with commit/rollback |
| `appendInventoryMovementBatch` (L7872) | inventory_movements | BEGIN, SELECT, COMMIT, ROLLBACK | appendInventoryMovementInTransaction, canonicalizeInventoryCommandValue, ensureDatabase, getTenant, waitForInventoryTransactionSlot | explicit local transaction with commit/rollback |
| `processSyncEvent` (L7999) | sync_events | BEGIN, SELECT, COMMIT, INSERT, ROLLBACK | appendInventoryMovementInTransaction, ensureDatabase, getTenant, json, nowIso, upsertCustomerSync | explicit local transaction with commit/rollback |
| `createPaymentWithIntent` (L8161) | customers, orders, payment_accounts, payment_idempotency_keys, payment_intents, payment_ledger_entries, payment_refunds, payments | SELECT, BEGIN, COMMIT, INSERT, ROLLBACK | audit, ensureDatabase, hashPaymentRequest, json, normaliseCurrency, nowIso, parseJSON, paymentFromRow, paymentIntentFromRow, resolvePaymentContext, syncMarketplacePaymentAllocation, tenantCurrency | explicit local transaction with commit/rollback |
| `getPaymentIntent` (L8266) | payment_intents | SELECT | ensureDatabase, paymentIntentFromRow, resolvePaymentContext | no explicit transaction boundary detected in function body |
| `insertPaymentIntent` (L8271) | orders, payment_accounts, payment_intents | SELECT, INSERT | ensureDatabase, json, normaliseCurrency, nowIso, paymentIntentFromRow, resolvePaymentContext, tenantCurrency | no explicit transaction boundary detected in function body |
| `getPaymentAccountForProviderNotification` (L8303) | payment_accounts, tenants | SELECT | ensureDatabase, parseJSON | no explicit transaction boundary detected in function body |
| `resolvePaymentIntentForProviderEvidence` (L8328) | payment_evidence, payment_intents | SELECT | ensureDatabase, getPaymentAccountForProviderNotification, nowIso, paymentEvidenceFromRow, paymentIntentFromRow | no explicit transaction boundary detected in function body |
| `insertProviderNotificationEvidence` (L8425) | payment_accounts, payment_evidence | SELECT, INSERT | audit, classifyProviderNotificationIdentity, ensureDatabase, json, nowIso, paymentEvidenceFromRow, resolvePaymentIntentForProviderEvidence | no explicit transaction boundary detected in function body |
| `createPaymentConfirmationAttempt` (L8610) | payment_confirmation_attempts, payment_evidence, payment_intents, payments | SELECT, INSERT | audit, ensureDatabase, nowIso, paymentConfirmationAttemptFromRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `updatePaymentConfirmationAttempt` (L8646) | payment_confirmation_attempts | SELECT, UPDATE | audit, ensureDatabase, json, nowIso, parseJSON, paymentConfirmationAttemptFromRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `getPaymentConfirmationAttempt` (L8679) | payment_confirmation_attempts | SELECT | ensureDatabase, paymentConfirmationAttemptFromRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `getPaymentConfirmationAttemptByProviderTransaction` (L8687) | payment_confirmation_attempts, payment_evidence | SELECT | ensureDatabase, paymentConfirmationAttemptFromRow, tenantOrganizationId | no explicit transaction boundary detected in function body |
| `insertPaymentEvidence` (L8710) | payment_evidence, payment_intents, payments | SELECT, INSERT | audit, ensureDatabase, hashPaymentRequest, json, nowIso, paymentEvidenceFromRow, resolvePaymentContext | no explicit transaction boundary detected in function body |
| `listPaymentEvidence` (L8781) | payment_evidence | SELECT | ensureDatabase, getPayment | no explicit transaction boundary detected in function body |
| `insertPaymentVerification` (L8787) | payment_evidence, payment_intents, payment_verifications, payments | SELECT, INSERT | audit, ensureDatabase, json, nowIso, paymentVerificationFromRow, resolvePaymentContext | no explicit transaction boundary detected in function body |
| `listPaymentVerifications` (L8917) | payment_verifications | SELECT | ensureDatabase, getPayment | no explicit transaction boundary detected in function body |
| `insertPaymentDecision` (L8923) | payment_decisions, payment_verifications, payments | SELECT, INSERT | ensureDatabase, json, nowIso, paymentDecisionFromRow, resolvePaymentContext | no explicit transaction boundary detected in function body |
| `listPaymentDecisions` (L8970) | payment_decisions | SELECT | ensureDatabase, getPayment | no explicit transaction boundary detected in function body |
| `getPaymentIdempotency` (L8976) | payment_idempotency_keys | SELECT | ensureDatabase, resolvePaymentContext | no explicit transaction boundary detected in function body |
| `insertPaymentIdempotency` (L8981) | payment_idempotency_keys | INSERT | ensureDatabase, getPaymentIdempotency, nowIso, resolvePaymentContext | no explicit transaction boundary detected in function body |
| `updatePaymentIdempotencyProgress` (L8993) | payment_idempotency_keys | UPDATE | ensureDatabase, getPaymentIdempotency, resolvePaymentContext | no explicit transaction boundary detected in function body |
| `completePaymentIdempotency` (L9015) | payment_idempotency_keys | UPDATE | ensureDatabase, getPaymentIdempotency, resolvePaymentContext | no explicit transaction boundary detected in function body |
| `beginPaymentStatusQuery` (L9040) | payment_status_query_commands, payments | BEGIN, SELECT, UPDATE, COMMIT, INSERT, ROLLBACK | ensureDatabase, nowIso, resolvePaymentContext | explicit local transaction with commit/rollback |
| `markPaymentStatusQueryProviderStarted` (L9137) | payment_status_query_commands | UPDATE | ensureDatabase, nowIso, resolvePaymentContext | no explicit transaction boundary detected in function body |
| `completePaymentStatusQuery` (L9164) | payment_status_query_commands | UPDATE, SELECT | ensureDatabase, json, nowIso, resolvePaymentContext | no explicit transaction boundary detected in function body |
| `commitPaymentDecision` (L9205) | marketplace_payment_allocations, marketplace_seller_orders, marketplace_settlements, payment_accounts, payment_decisions, payment_evidence, payment_idempotency_keys, payment_intents, payment_ledger_entries, payment_status_query_commands, payment_verifications, payments | BEGIN, SELECT, COMMIT, INSERT, UPDATE, ROLLBACK | audit, ensureDatabase, json, normaliseCurrency, nowIso, paymentFromRow, paymentVerificationFromRow, resolvePaymentContext | explicit local transaction with commit/rollback |
| `listPaymentAccounts` (L9633) | payment_accounts | SELECT | ensureDatabase, parseJSON, resolvePaymentContext | no explicit transaction boundary detected in function body |
| `createPaymentAccount` (L9644) | payment_accounts | INSERT | audit, ensureDatabase, json, listPaymentAccounts, nowIso, resolvePaymentContext | no explicit transaction boundary detected in function body |
| `createPayment` (L9661) | customers, orders, payment_accounts, payment_ledger_entries, payments | SELECT, BEGIN, INSERT, COMMIT, ROLLBACK | audit, ensureDatabase, json, normaliseCurrency, nowIso, parseJSON, paymentFromRow, resolvePaymentContext, syncMarketplacePaymentAllocation, tenantCurrency | explicit local transaction with commit/rollback |
| `listPaymentRoutingPolicies` (L9717) | payment_routing_policies | SELECT | ensureDatabase, getTenantByChatId, parseJSON | no explicit transaction boundary detected in function body |
| `upsertPaymentRoutingPolicy` (L9735) | payment_routing_policies | SELECT, UPDATE, INSERT | ensureDatabase, getTenantByChatId, json, listPaymentRoutingPolicies, nowIso | no explicit transaction boundary detected in function body |
| `getPaymentSettlementByIdempotencyKey` (L9764) | payment_settlements | SELECT | ensureDatabase, getTenantByChatId, normalizePaymentSettlement | no explicit transaction boundary detected in function body |
| `createPaymentSettlement` (L9772) | payment_settlements, payments | SELECT, INSERT | audit, ensureDatabase, getTenantByChatId, json, normaliseCurrency, normalizePaymentSettlement, nowIso | no explicit transaction boundary detected in function body |
| `finalizePaymentSettlement` (L9841) | payment_settlements | BEGIN, SELECT, COMMIT, UPDATE, ROLLBACK | audit, ensureDatabase, getTenantByChatId, json, normalizePaymentSettlement, nowIso | explicit local transaction with commit/rollback |
| `listPaymentSettlements` (L9883) | payment_settlements | SELECT | ensureDatabase, getTenantByChatId | no explicit transaction boundary detected in function body |
| `getPaymentRefunds` (L9918) | payment_refunds | SELECT | ensureDatabase, getTenantByChatId | no explicit transaction boundary detected in function body |
| `getPaymentRefundByIdempotencyKey` (L9928) | payment_refunds | SELECT | ensureDatabase, getTenantByChatId, normalizePaymentRefund | no explicit transaction boundary detected in function body |
| `createPaymentRefundRequest` (L9936) | payment_refunds, payments | SELECT, INSERT | audit, ensureDatabase, getTenantByChatId, normaliseCurrency, normalizePaymentRefund, nowIso | no explicit transaction boundary detected in function body |
| `finalizePaymentRefund` (L9997) | marketplace_payment_allocations, marketplace_refunds, marketplace_settlements, payment_ledger_entries, payment_refunds, payments | BEGIN, SELECT, COMMIT, UPDATE, INSERT, ROLLBACK | audit, ensureDatabase, getTenantByChatId, json, normalizePaymentRefund, nowIso | explicit local transaction with commit/rollback |
| `getPayment` (L10117) | payments | SELECT | ensureDatabase, paymentFromRow, resolvePaymentContext | no explicit transaction boundary detected in function body |
| `getOrderPaymentSummary` (L10123) | orders, payment_refunds, payments | SELECT | ensureDatabase, normaliseCurrency, resolvePaymentContext | no explicit transaction boundary detected in function body |
| `listPayments` (L10174) | payments | SELECT | ensureDatabase, resolvePaymentContext | no explicit transaction boundary detected in function body |
| `transitionPayment` (L10185) | marketplace_payment_allocations, marketplace_seller_orders, marketplace_settlements, payment_ledger_entries, payments | SELECT, BEGIN, UPDATE, INSERT, COMMIT, ROLLBACK | audit, ensureDatabase, json, normaliseCurrency, nowIso, paymentFromRow, paymentStateTimestampColumn, resolvePaymentContext | explicit local transaction with commit/rollback |
| `listPaymentLedger` (L10228) | payment_ledger_entries | SELECT | ensureDatabase, getPayment, normaliseCurrency, parseJSON | no explicit transaction boundary detected in function body |
| `recordPaymentReconciliation` (L10238) | payment_reconciliations | SELECT, INSERT | ensureDatabase, getPayment, json, normaliseCurrency, nowIso | no explicit transaction boundary detected in function body |
| `listPaymentReconciliations` (L10283) | payment_reconciliations | SELECT | ensureDatabase, getPayment | no explicit transaction boundary detected in function body |
| `reconcilePayment` (L10292) | payment_reconciliations | INSERT, SELECT | ensureDatabase, getPayment, normaliseCurrency, nowIso, transitionPayment | no explicit transaction boundary detected in function body |
| `getOrderFulfillment` (L10411) | fulfillments | SELECT | ensureDatabase, fulfillmentFromRow, getCoreFulfillmentOrder | no explicit transaction boundary detected in function body |
| `selectDeliveryCourier` (L10487) | delivery_assignments, membership_roles, memberships | SELECT | ensureDatabase | no explicit transaction boundary detected in function body |
| `assignDeliveryCourier` (L10521) | delivery_assignment_commands, delivery_assignments, fulfillments, membership_roles, memberships, orders, tenants | SELECT, BEGIN, COMMIT, INSERT, ROLLBACK | assertLogisticsSchedulingAuthorization, assertServiceDeliveryReadyForExecution, audit, ensureDatabase, getCoreFulfillmentOrder, getTenant, hasCourierLocationGrant, json, normalizeCoreFulfillmentType, nowIso, orderFromRow, selectDeliveryCourier | explicit local transaction with commit/rollback |
| `listDeliveryAssignments` (L10683) | delivery_assignments, fulfillments, locations, membership_roles, memberships, users | SELECT | ensureDatabase, getTenant, parseJSON | no explicit transaction boundary detected in function body |
| `getDeliveryAssignment` (L10784) | delivery_assignments, fulfillments, locations, membership_roles, memberships | SELECT | ensureDatabase, getTenant, hasCourierLocationGrant, parseJSON | no explicit transaction boundary detected in function body |
| `assertCourierOwnsDelivery` (L10846) | membership_roles, memberships | SELECT | ensureDatabase, getDeliveryAssignment, getTenant, hasCourierLocationGrant | no explicit transaction boundary detected in function body |
| `createLogisticsSchedulingActivity` (L11105) | logistics_scheduling_activities | BEGIN, SELECT, COMMIT, INSERT, ROLLBACK | assertLogisticsSchedulingAuthorization, assertSchedulingLocation, assertSchedulingReferences, audit, ensureDatabase, getCanonicalSchedulingTimeZone, getTenant, json, logisticsSchedulingRow, nowIso, parseJSON, schedulingRequestHash | explicit local transaction with commit/rollback |
| `getLogisticsSchedulingTimeZone` (L11237) | no literal SQL table found | none detected | ensureDatabase, getCanonicalSchedulingTimeZone, getTenant | no explicit transaction boundary detected in function body |
| `getLogisticsSchedulingActivity` (L11244) | logistics_scheduling_activities | SELECT | ensureDatabase, getTenant, logisticsSchedulingRow | no explicit transaction boundary detected in function body |
| `listLogisticsSchedulingActivities` (L11254) | logistics_scheduling_activities | SELECT | assertSchedulingLocation, ensureDatabase, getTenant | no explicit transaction boundary detected in function body |
| `evaluateLogisticsSchedulingActivity` (L11289) | logistics_scheduling_activities | SELECT | assertLogisticsSchedulingAuthorization, assertSchedulingLocation, ensureDatabase, getCanonicalSchedulingTimeZone, getTenant, parseJSON | no explicit transaction boundary detected in function body |
| `transitionLogisticsSchedulingActivity` (L11362) | logistics_scheduling_activities | BEGIN, SELECT, COMMIT, UPDATE, ROLLBACK | assertLogisticsSchedulingAuthorization, assertSchedulingLocation, audit, ensureDatabase, getCanonicalSchedulingTimeZone, getTenant, logisticsSchedulingRow, nowIso, parseJSON | explicit local transaction with commit/rollback |
| `transitionDeliveryAssignment` (L11650) | delivery_assignment_commands, delivery_assignments, fulfillments, locations, membership_roles, memberships, orders, tenants | BEGIN, SELECT, COMMIT, UPDATE, INSERT, ROLLBACK | applyCoreFulfillmentInventoryConsequence, assertDeliveryProofInput, audit, deliveryProofReference, ensureDatabase, getCoreFulfillmentOrder, getTenant, hasCourierLocationGrant, isCanonicalMarketplaceOrderRow, json, normalizeCoreFulfillmentStatus, nowIso, orderFromRow, parseJSON, resolveDeliveryProof | explicit local transaction with commit/rollback |
| `transitionOrderFulfillment` (L11912) | delivery_assignments, fulfillment_commands, fulfillments, locations, orders, tenants, users | SELECT, BEGIN, COMMIT, INSERT, UPDATE, ROLLBACK | applyCoreFulfillmentInventoryConsequence, assertDeliveryProofInput, assertServiceDeliveryReadyForExecution, audit, ensureDatabase, fulfillmentFromRow, getCoreFulfillmentOrder, isCanonicalMarketplaceOrderRow, json, normalizeCoreFulfillmentStatus, normalizeCoreFulfillmentType, nowIso, orderFromRow, parseJSON, resolveDeliveryProof | explicit local transaction with commit/rollback |
| `coreFulfillmentContract` (L12144) | no literal SQL table found | none detected | none detected | no explicit transaction boundary detected in function body |
| `getOrders` (L12164) | orders | SELECT | ensureDatabase, orderFromRow | no explicit transaction boundary detected in function body |
| `saveQueuedOrders` (L12172) | customers, orders, payments, tenants | BEGIN, SELECT, COMMIT, ROLLBACK | audit, ensureCanonicalPaymentForOrder, ensureDatabase, insertOrder, normaliseCurrency, nowIso, parseJSON, queuedOrderIdentityHash, tenantCurrency, upsertCustomerSync, validateAndTotalOrderItems | explicit local transaction with commit/rollback |
| `pullNewOrders` (L12272) | orders | BEGIN, SELECT, UPDATE, COMMIT, ROLLBACK | audit, ensureDatabase, orderFromRow | explicit local transaction with commit/rollback |
| `searchMarketplaceListings` (L12299) | catalog_products, tenants | SELECT | defaultVendorCode, ensureDatabase, normaliseCurrency, parseJSON, productFromRow | no explicit transaction boundary detected in function body |
| `createMarketplaceOrder` (L12327) | catalog_products, inventory_movements, locations, marketplace_checkout_idempotency, marketplace_fulfillments, marketplace_inventory_reservations, marketplace_orders, marketplace_payment_allocations, marketplace_seller_orders, marketplace_settlements, tenants | SELECT, BEGIN, COMMIT, INSERT, UPDATE, ROLLBACK | appendInventoryMovementInTransaction, audit, defaultVendorCode, ensureDatabase, hashToken, insertOrder, insertProduct, json, normaliseCurrency, nowIso, parseJSON, productFromRow | explicit local transaction with commit/rollback |
| `updateMarketplaceOrderStatus` (L12701) | catalog_products, inventory_movements, locations, marketplace_fulfillments, marketplace_inventory_reservations, marketplace_orders, marketplace_payment_allocations, marketplace_refunds, marketplace_seller_orders, marketplace_settlements, orders, payment_refunds, payments, tenants | BEGIN, SELECT, COMMIT, UPDATE, INSERT, ROLLBACK | appendInventoryMovementInTransaction, audit, ensureDatabase, insertProduct, json, nowIso, orderFromRow, parseJSON, productFromRow | explicit local transaction with commit/rollback |
| `getMarketplaceOrderTracking` (L12904) | orders, tenants | SELECT | ensureDatabase, getTenant, hashToken, normaliseCurrency, orderFromRow, parseJSON | no explicit transaction boundary detected in function body |
| `getTelegramBuyerFulfillmentExperience` (L12929) | fulfillments, marketplace_fulfillments, marketplace_orders, marketplace_seller_orders, orders | SELECT | ensureDatabase, getTenant, parseJSON | no explicit transaction boundary detected in function body |
| `listTelegramBuyerOrders` (L12983) | marketplace_orders, marketplace_seller_orders | SELECT | ensureDatabase, getTenant | no explicit transaction boundary detected in function body |
| `getTelegramBuyerServiceBookings` (L13017) | marketplace_orders, marketplace_seller_orders, orders, service_bookings, service_resource_commitments, service_resources | SELECT | ensureDatabase, getTenant, orderFromRow | no explicit transaction boundary detected in function body |
| `assessTelegramBuyerServiceFeasibility` (L13079) | locations, membership_roles, memberships, organizations, service_bookings, service_resource_availability, service_resource_commitments, service_resources | SELECT | bookingRequiredText, bookingTimestamp, ensureDatabase, getTelegramBuyerServiceBookings, getTenant, parseJSON | no explicit transaction boundary detected in function body |
| `listAuditEvents` (L13217) | audit_events | SELECT | ensureDatabase, getTenant, parseJSON | no explicit transaction boundary detected in function body |
| `verifyAuditEventChain` (L13252) | audit_events | SELECT | ensureDatabase, getTenant, json | no explicit transaction boundary detected in function body |
| `createDatabaseBackup` (L13323) | no literal SQL table found | OTHER | ensureDatabase, sqlString | no explicit transaction boundary detected in function body |
| `getOrCreateUserByTelegram` (L13346) | users | SELECT, UPDATE, INSERT | ensureDatabase, nowIso | no explicit transaction boundary detected in function body |
| `listTenantMemberships` (L13360) | membership_roles, memberships, users | SELECT | ensureDatabase | no explicit transaction boundary detected in function body |
| `listUserMemberships` (L13380) | memberships, tenants | SELECT | ensureDatabase, parseJSON | no explicit transaction boundary detected in function body |
| `assignMembershipContextualRole` (L13448) | locations, membership_roles, memberships, service_resources, tenants | SELECT, INSERT | assertContextualRoleAssignable, audit, ensureDatabase, nowIso | no explicit transaction boundary detected in function body |
| `revokeMembershipContextualRole` (L13541) | membership_roles, memberships | SELECT, UPDATE | audit, ensureDatabase, nowIso | no explicit transaction boundary detected in function body |
| `changeMembershipRole` (L13602) | membership_roles, memberships | SELECT, UPDATE, INSERT | audit, ensureDatabase, nowIso | no explicit transaction boundary detected in function body |
| `ensureMembership` (L13657) | no literal SQL table found | none detected | ensureMembershipSync | no explicit transaction boundary detected in function body |
| `createTenantForUser` (L13661) | auth_challenges, tenant_creation_requests, tenants | BEGIN, SELECT, COMMIT, INSERT, UPDATE, ROLLBACK | audit, ensureCanonicalIdentityForTenant, ensureDatabase, ensureMembershipSync, hashToken, json, normaliseCurrency, nowIso, parseJSON | explicit local transaction with commit/rollback |
| `createSession` (L13741) | locations, membership_roles, memberships, pack_lifecycle, sessions, tenants | SELECT, INSERT | createDeviceRow, ensureDatabase, hashToken | no explicit transaction boundary detected in function body |
| `authenticateSessionToken` (L13776) | devices, locations, membership_roles, memberships, pack_lifecycle, sessions, tenants | SELECT, UPDATE | ensureDatabase, hashToken, nowIso, parseJSON | no explicit transaction boundary detected in function body |
| `recordAuditEvent` (L13906) | no literal SQL table found | none detected | audit, ensureDatabase | no explicit transaction boundary detected in function body |
| `getAuditRetentionPolicy` (L13925) | audit_retention_policies | SELECT | ensureDatabase, getTenant | no explicit transaction boundary detected in function body |
| `setAuditRetentionPolicy` (L13938) | audit_retention_policies | INSERT | audit, ensureDatabase, getAuditRetentionPolicy, getTenant, nowIso | no explicit transaction boundary detected in function body |
| `createComplianceRequest` (L13965) | compliance_requests, customers, locations | SELECT, INSERT | audit, ensureDatabase, getComplianceRequest, getTenant, nowIso | no explicit transaction boundary detected in function body |
| `getComplianceRequest` (L14010) | compliance_requests | SELECT | ensureDatabase, getTenant | no explicit transaction boundary detected in function body |
| `listComplianceRequests` (L14023) | compliance_requests | SELECT | ensureDatabase, getTenant | no explicit transaction boundary detected in function body |
| `resolveComplianceRequest` (L14040) | compliance_requests | UPDATE | audit, ensureDatabase, getComplianceRequest, getTenant, nowIso | no explicit transaction boundary detected in function body |
| `buildComplianceExport` (L14073) | audit_events, customers, locations, orders | SELECT | customerFromRow, ensureDatabase, getAuditRetentionPolicy, getTenant, listComplianceRequests, nowIso, parseJSON | no explicit transaction boundary detected in function body |
| `revokeSession` (L14157) | sessions | UPDATE | ensureDatabase, nowIso | no explicit transaction boundary detected in function body |
| `listDevices` (L14169) | devices, sessions | SELECT | ensureDatabase | no explicit transaction boundary detected in function body |
| `revokeDevice` (L14220) | devices, memberships, sessions | SELECT, UPDATE | audit, ensureDatabase, nowIso | no explicit transaction boundary detected in function body |
| `createAuthChallenge` (L14236) | auth_challenges | INSERT | ensureDatabase, hashToken | no explicit transaction boundary detected in function body |
| `getAuthChallengeForTenantCreation` (L14245) | auth_challenges, tenant_creation_requests | SELECT | ensureDatabase, hashToken | no explicit transaction boundary detected in function body |
| `consumeAuthChallenge` (L14258) | auth_challenges | SELECT, UPDATE | ensureDatabase, hashToken, nowIso | no explicit transaction boundary detected in function body |
| `createPairingChallenge` (L14267) | memberships, pairing_challenges | SELECT, INSERT | audit, ensureDatabase, hashToken | no explicit transaction boundary detected in function body |
| `consumePairingChallenge` (L14282) | pairing_challenges, users | SELECT, BEGIN, INSERT, UPDATE, COMMIT, ROLLBACK | audit, ensureDatabase, ensureMembershipSync, hashToken, nowIso | explicit local transaction with commit/rollback |
| `createInvite` (L14310) | invites, memberships | SELECT, INSERT | audit, ensureDatabase, hashToken | no explicit transaction boundary detected in function body |
| `listInvites` (L14328) | invites, users | SELECT | ensureDatabase | no explicit transaction boundary detected in function body |
| `revokeInvite` (L14345) | invites, memberships | SELECT, UPDATE | audit, ensureDatabase, hashToken, nowIso | no explicit transaction boundary detected in function body |
| `consumeInvite` (L14364) | invites, memberships, tenants | SELECT, BEGIN, UPDATE, COMMIT, ROLLBACK | audit, ensureDatabase, ensureMembershipSync, hashToken, nowIso, roleRank | explicit local transaction with commit/rollback |
| `createPaymentOperationalAction` (L14401) | payment_operational_actions | SELECT, INSERT | audit, ensureDatabase, getPayment, normalizePaymentOperationalAction, nowIso | no explicit transaction boundary detected in function body |
| `updatePaymentOperationalAction` (L14428) | payment_operational_actions, payments, tenants | SELECT, UPDATE | audit, ensureDatabase, json, normalizePaymentOperationalAction, nowIso | no explicit transaction boundary detected in function body |
| `listPaymentOperationalActions` (L14450) | no literal SQL table found | none detected | ensureDatabase, getPayment | no explicit transaction boundary detected in function body |
| `recordPaymentProviderCapabilityEvidence` (L14465) | payment_provider_capability_certifications | SELECT, INSERT | audit, ensureDatabase, getTenantByChatId, json, normalizePaymentProviderCapabilityCertification, nowIso | no explicit transaction boundary detected in function body |
| `certifyPaymentProviderCapability` (L14521) | payment_provider_capability_certifications | SELECT, INSERT | audit, ensureDatabase, getTenantByChatId, json, normalizePaymentProviderCapabilityCertification, nowIso | no explicit transaction boundary detected in function body |
| `listPaymentProviderCapabilityEvidence` (L14591) | payment_provider_capability_certifications | SELECT | ensureDatabase, getTenantByChatId | no explicit transaction boundary detected in function body |
| `recordPaymentProductionCertification` (L14626) | payment_production_certifications | SELECT, INSERT | audit, ensureDatabase, getTenantByChatId, json, normalizePaymentProductionCertification, nowIso | no explicit transaction boundary detected in function body |
| `listPaymentProductionCertifications` (L14674) | payment_production_certifications | SELECT | ensureDatabase, getTenantByChatId | no explicit transaction boundary detected in function body |
| `getDatabasePath` (L14704) | no literal SQL table found | none detected | none detected | no explicit transaction boundary detected in function body |
| `getDatabaseForTests` (L14709) | no literal SQL table found | none detected | ensureDatabase | no explicit transaction boundary detected in function body |
| `listRestaurantRecipes` (L14776) | restaurant_recipes | SELECT | ensureDatabase, getTenant | no explicit transaction boundary detected in function body |
| `createRestaurantRecipe` (L14786) | restaurant_recipes | BEGIN, SELECT, COMMIT, INSERT, ROLLBACK | audit, ensureDatabase, getTenant, json, normalizeRestaurantRecipeInput, nowIso, restaurantRecipeFromRow, waitForInventoryTransactionSlot | explicit local transaction with commit/rollback |
| `updateRestaurantRecipe` (L14825) | restaurant_recipes | BEGIN, SELECT, UPDATE, COMMIT, ROLLBACK | audit, ensureDatabase, getTenant, json, normalizeRestaurantRecipeInput, nowIso, parseJSON, restaurantRecipeFromRow, waitForInventoryTransactionSlot | explicit local transaction with commit/rollback |

## Table ownership and dependency map

| Table | Provisional logical owner | Read/write function counts | DDL source lines | FK edges touching table | Indexes |
|---|---|---:|---|---:|---:|
| `accounts_receivable` | B2B commerce | 3/3 | 1043 | 7 | 2 |
| `ar_ledger_entries` | B2B commerce | 1/3 | 1067 | 3 | 1 |
| `ar_payment_allocations` | B2B commerce | 1/1 | 1085 | 3 | 1 |
| `audit_events` | Audit | 3/0 | 355 | 0 | 6 |
| `audit_retention_policies` | Audit | 1/1 | 690 | 1 | 0 |
| `auth_challenges` | Identity and access | 3/3 | 410 | 2 | 0 |
| `catalog_products` | Catalog | 11/0 | 316 | 1 | 2 |
| `channel_identities` | Channel and integration configuration | 1/0 | 497 | 1 | 1 |
| `compliance_requests` | Compliance | 2/2 | 697 | 2 | 2 |
| `customer_credit_terms` | B2B commerce | 4/3 | 1008 | 3 | 2 |
| `customer_pricing_rules` | B2B commerce | 4/1 | 873 | 2 | 2 |
| `customers` | Commerce / customer | 7/0 | 585 | 9 | 3 |
| `delivery_assignment_commands` | Fulfillment and Logistics | 2/2 | 2588 | 1 | 1 |
| `delivery_assignments` | Fulfillment and Logistics | 6/2 | 2224 | 5 | 5 |
| `delivery_assignments_v44` | Fulfillment and Logistics | 0/0 | 2254 | 5 | 0 |
| `devices` | Identity and access | 3/2 | 390 | 3 | 1 |
| `fulfillment_commands` | Fulfillment and Logistics | 1/1 | 2551 | 2 | 1 |
| `fulfillments` | Fulfillment and Logistics | 7/3 | 2195 | 8 | 2 |
| `inventory_movements` | Inventory | 6/0 | 622 | 2 | 3 |
| `invites` | Identity and access | 3/3 | 449 | 3 | 1 |
| `invoice_items` | B2B commerce | 0/1 | 1133 | 1 | 1 |
| `invoices` | B2B commerce | 4/2 | 1111 | 5 | 2 |
| `locations` | Tenant and organization core | 21/2 | 485 | 17 | 3 |
| `logistics_scheduling_activities` | Logistics Scheduling request coordination | 5/2 | 3236 | 6 | 4 |
| `marketplace_checkout_idempotency` | Marketplace | 1/1 | 1267 | 1 | 1 |
| `marketplace_fulfillments` | Marketplace | 1/2 | 1192 | 1 | 1 |
| `marketplace_inventory_reservations` | Marketplace | 0/2 | 1205 | 3 | 1 |
| `marketplace_orders` | Marketplace | 4/2 | 1154 | 7 | 3 |
| `marketplace_payment_allocations` | Marketplace | 4/5 | 1220 | 4 | 2 |
| `marketplace_payment_allocations_v40` | Marketplace | 0/0 | 2106 | 4 | 0 |
| `marketplace_refunds` | Marketplace | 1/2 | 1251 | 4 | 1 |
| `marketplace_seller_orders` | Marketplace | 6/2 | 1175 | 9 | 1 |
| `marketplace_settlements` | Marketplace | 0/5 | 1236 | 3 | 1 |
| `membership_roles` | Identity and access | 12/3 | 3136 | 1 | 2 |
| `memberships` | Identity and access | 19/2 | 379 | 3 | 2 |
| `metadata` | Persistence infrastructure | 0/0 | 297 | 0 | 0 |
| `orders` | Commerce / customer | 21/3 | 329 | 3 | 5 |
| `organizations` | Tenant and organization core | 15/1 | 476 | 83 | 0 |
| `pack_lifecycle` | Pack and business-template configuration | 4/1 | 2161 | 3 | 2 |
| `pairing_challenges` | Identity and access | 1/2 | 417, 433 | 2 | 2 |
| `payment_accounts` | Payments | 7/1 | 776 | 5 | 1 |
| `payment_confirmation_attempts` | Payments | 4/2 | 2420 | 5 | 4 |
| `payment_decisions` | Payments | 2/2 | 2368 | 7 | 4 |
| `payment_evidence` | Payments | 8/2 | 2312 | 8 | 8 |
| `payment_idempotency_keys` | Payments | 3/5 | 2388 | 1 | 1 |
| `payment_intents` | Payments | 8/2 | 2290 | 10 | 3 |
| `payment_ledger_entries` | Payments | 1/5 | 824 | 2 | 3 |
| `payment_ledger_entries_gap113` | Payments | 0/0 | 3071 | 3 | 0 |
| `payment_operational_actions` | Payments | 2/2 | 2807 | 3 | 3 |
| `payment_outbound_intents` | Payments | 6/2 | 1777 | 5 | 3 |
| `payment_procurement_settlement_allocations` | Payments | 4/1 | 1827 | 3 | 2 |
| `payment_procurement_settlements` | Payments | 3/1 | 1811 | 5 | 1 |
| `payment_production_certifications` | Payments | 2/1 | 2841 | 2 | 1 |
| `payment_provider_capability_certifications` | Payments | 3/2 | 2871 | 2 | 1 |
| `payment_reconciliations` | Payments | 3/2 | 841 | 2 | 3 |
| `payment_refunds` | Payments | 7/3 | 2988 | 3 | 3 |
| `payment_routing_policies` | Payments | 2/1 | 2782 | 2 | 1 |
| `payment_settlements` | Payments | 4/2 | 2949 | 2 | 3 |
| `payment_status_query_commands` | Payments | 3/3 | 2452 | 2 | 1 |
| `payment_verifications` | Payments | 4/1 | 2341 | 5 | 7 |
| `payments` | Payments | 18/5 | 790 | 19 | 10 |
| `payments_gap113` | Payments | 0/0 | 3030 | 4 | 0 |
| `phone_routing` | Channel and integration configuration | 0/0 | 349 | 1 | 0 |
| `procurement_award_lines` | Procurement | 2/1 | 1612 | 5 | 1 |
| `procurement_awards` | Procurement | 4/2 | 1586 | 8 | 2 |
| `procurement_comparison_line_offers` | Procurement | 1/1 | 1557 | 5 | 1 |
| `procurement_comparison_suppliers` | Procurement | 0/1 | 1536 | 3 | 1 |
| `procurement_comparisons` | Procurement | 3/1 | 1523 | 6 | 1 |
| `procurement_demand_items` | Procurement | 3/2 | 1321 | 2 | 2 |
| `procurement_demands` | Procurement | 5/4 | 1288 | 8 | 3 |
| `procurement_receipt_lines` | Procurement | 2/1 | 1742 | 2 | 1 |
| `procurement_receipts` | Procurement | 3/1 | 1722 | 5 | 1 |
| `procurement_rfq_items` | Procurement | 4/1 | 1430 | 5 | 1 |
| `procurement_rfq_response_items` | Procurement | 3/1 | 1483 | 2 | 1 |
| `procurement_rfq_responses` | Procurement | 5/2 | 1459 | 8 | 2 |
| `procurement_rfq_suppliers` | Procurement | 2/2 | 1447 | 2 | 1 |
| `procurement_rfqs` | Procurement | 8/2 | 1404 | 9 | 2 |
| `procurement_supplier_participants` | Procurement | 4/1 | 1369 | 3 | 1 |
| `procurement_supplier_relationships` | Procurement | 7/2 | 1379 | 4 | 2 |
| `purchase_order_items` | Procurement | 2/2 | 974 | 2 | 2 |
| `purchase_orders` | Procurement | 7/3 | 950 | 7 | 6 |
| `purchase_orders_phase17_6_new` | Needs manual ownership review | 0/0 | 1656 | 5 | 0 |
| `quote_items` | B2B commerce | 0/1 | 923 | 1 | 1 |
| `quotes` | B2B commerce | 1/2 | 902 | 5 | 2 |
| `restaurant_recipes` | Restaurant capability | 3/2 | 3558 | 2 | 2 |
| `schema_migrations` | Persistence infrastructure | 0/0 | 293 | 0 | 0 |
| `service_booking_commands` | Service capability | 2/2 | 2668 | 2 | 1 |
| `service_bookings` | Service capability | 6/2 | 2652 | 4 | 2 |
| `service_delivery_assessment_commands` | Service capability | 1/1 | 2606 | 1 | 1 |
| `service_resource_availability` | Service capability | 4/1 | 3358 | 3 | 1 |
| `service_resource_availability_commands` | Service capability | 1/1 | 3371 | 2 | 0 |
| `service_resource_commands` | Service capability | 2/2 | 3340 | 2 | 1 |
| `service_resource_commitments` | Service capability | 6/1 | 3394, 3440 | 4 | 2 |
| `service_resources` | Service capability | 10/2 | 3319 | 6 | 2 |
| `sessions` | Identity and access | 2/3 | 400 | 1 | 2 |
| `supplier_network_capabilities` | Supplier Network | 4/2 | 3204 | 3 | 2 |
| `supplier_network_capacity_signals` | Supplier Network | 3/2 | 1924 | 3 | 2 |
| `supplier_network_catalog_listings` | Supplier Network | 4/2 | 1890 | 3 | 2 |
| `supplier_network_commercial_terms` | Supplier Network | 3/2 | 1959 | 3 | 3 |
| `supplier_network_performance_observations` | Supplier Network | 3/1 | 2032 | 2 | 2 |
| `supplier_network_profiles` | Supplier Network | 2/2 | 1860 | 3 | 1 |
| `supplier_network_qualifications` | Supplier Network | 4/2 | 1996 | 4 | 3 |
| `supplier_network_service_areas` | Supplier Network | 3/2 | 3172 | 3 | 2 |
| `supplier_network_trust_evidence` | Supplier Network | 3/1 | 2066 | 2 | 3 |
| `sync_events` | Event and synchronization infrastructure | 1/1 | 650 | 0 | 2 |
| `telegram_storefront_configs` | Channel and integration configuration | 1/2 | 2132 | 3 | 1 |
| `tenant_business_templates` | Pack and business-template configuration | 1/1 | 3285 | 2 | 0 |
| `tenant_creation_requests` | Identity and access | 2/1 | 3301 | 3 | 1 |
| `tenants` | Tenant and organization core | 30/3 | 306 | 16 | 1 |
| `users` | Identity and access | 5/2 | 372 | 62 | 0 |

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
| 44 | 42 | L2249 | CREATE TABLE, ALTER TABLE, CREATE INDEX, DROP TABLE, DROP INDEX, INSERT | delivery_assignments_v44, delivery_assignments, schema_migrations |
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

**Migration ordering observation:** source order is not numerically ascending. The guards cover versions 1–85, but the source code places later-numbered guards before earlier-numbered ones in several places. Preserve actual source order and dependency behavior; do not sort or rewrite migration history based on version number alone.

## Cross-domain transactional invariants

### Marketplace checkout atomicity

- Functions: `createMarketplaceOrder`
- Tables: `marketplace_orders`, `marketplace_seller_orders`, `marketplace_fulfillments`, `marketplace_inventory_reservations`, `marketplace_payment_allocations`, `marketplace_settlements`, `marketplace_checkout_idempotency`, `catalog_products`, `inventory_movements`
- Invariant: Checkout creates canonical marketplace/seller order, fulfillment/reservation/payment allocation/settlement and idempotency records while applying inventory consequences in one SQLite transaction; preserve single commit/replay boundary.
- Authority boundary: Marketplace command coordinates canonical Inventory and Payment records; it must not become a second Inventory or Payment authority.
### Marketplace cancellation compensation

- Functions: `updateMarketplaceOrderStatus`
- Tables: `orders`, `marketplace_seller_orders`, `marketplace_inventory_reservations`, `inventory_movements`, `marketplace_payment_allocations`, `payment_refunds`, `marketplace_refunds`, `marketplace_settlements`, `marketplace_fulfillments`, `payments`
- Invariant: Cancellation releases reserved stock once and creates canonical Payment refund identity while updating Marketplace projections and lifecycle rows atomically.
- Authority boundary: Marketplace may orchestrate compensation but Payment refund and Inventory movement remain canonical authorities.
### Payment financial decision and ledger

- Functions: `commitPaymentDecision`, `createPayment`, `transitionPayment`, `finalizePaymentRefund`, `finalizePaymentSettlement`
- Tables: `payments`, `payment_decisions`, `payment_ledger_entries`, `payment_idempotency_keys`, `payment_verifications`, `payment_evidence`, `payment_intents`, `marketplace_payment_allocations`, `marketplace_settlements`
- Invariant: Financial state, evidence/verification binding, ledger entries, idempotency and marketplace settlement consequences are transactionally coordinated.
- Authority boundary: Payment Core remains sole financial decision/ledger authority; do not split transaction steps by route.
### Fulfillment and delivery command lifecycle

- Functions: `transitionOrderFulfillment`, `transitionDeliveryAssignment`, `assignDeliveryCourier`
- Tables: `orders`, `fulfillments`, `delivery_assignments`, `fulfillment_commands`, `delivery_assignment_commands`, `inventory_movements`, `locations`, `memberships`, `membership_roles`
- Invariant: Fulfillment/delivery commands validate tenant/org/location/courier scope, durable command replay, proof/lifecycle transitions and existing Inventory consequences within their transaction boundaries.
- Authority boundary: Keep the frozen Order → Fulfillment → Delivery Assignment → Delivery Lifecycle → Proof/Exception → Inventory consequence chain; Payment/Settlement stay outside Logistics.
### Procurement receipt and Inventory posting

- Functions: `createProcurementReceipt`, `appendInventoryMovement`
- Tables: `purchase_orders`, `purchase_order_items`, `procurement_receipts`, `procurement_receipt_lines`, `catalog_products`, `locations`, `inventory_movements`, `audit_events`
- Invariant: Receipt validation binds to approved procurement-origin PO lines and organization location; receipt lines and canonical inventory movements must commit or roll back together, with deterministic event IDs and replay-safe pending state.
- Authority boundary: Procurement owns receipt intent; Inventory owns stock movement. Their transaction contract must be retained as one unit.
### Procurement RFQ-time capacity snapshot

- Functions: `createProcurementRfq`
- Tables: `procurement_rfqs`, `procurement_rfq_items`, `procurement_rfq_suppliers`, `supplier_network_capacity_signals`, `supplier_network_profiles`, `supplier_network_qualifications`
- Invariant: Supplier capacity evidence is snapshotted at RFQ creation for each invited supplier and persisted with capture time; later evidence changes must not mutate the historical RFQ snapshot.
- Authority boundary: Supplier Network owns source evidence; Procurement owns immutable RFQ-time snapshot. Neither snapshot nor discovery matching authorizes operational scheduling.
### Service booking/resource commitment

- Functions: `createServiceBooking`, `transitionServiceBooking`, `createServiceResource`, `updateServiceResource`, `setServiceResourceAvailability`
- Tables: `service_resources`, `service_resource_availability`, `service_resource_commitments`, `service_bookings`, `service_booking_commands`, `service_resource_commands`, `service_resource_availability_commands`, `orders`, `locations`
- Invariant: Booking/resource/availability/commitment state shares resource/location scope and idempotent command records; avoid extracting handlers separately from their persistence and scheduling invariant.
- Authority boundary: Service capability owns booking/resource commitments; it does not become a second Logistics Scheduling authority.

## Cohesive units that must remain together

- **Marketplace checkout and cancellation:** `createMarketplaceOrder`, `updateMarketplaceOrderStatus`. Shared Marketplace lifecycle, inventory reservations/movements, Payment allocation/refund, settlement and idempotency effects.
- **Payment decision/refund/settlement core:** `commitPaymentDecision`, `createPayment`, `transitionPayment`, `createPaymentRefundRequest`, `finalizePaymentRefund`, `createPaymentSettlement`, `finalizePaymentSettlement`. Financial decision, ledger, evidence, idempotency, and Marketplace allocation effects are transactionally coupled.
- **Inventory movement primitive and consumers:** `appendInventoryMovement`, `appendInventoryMovementBatch`, `createProcurementReceipt`, `createMarketplaceOrder`, `updateMarketplaceOrderStatus`, `transitionOrderFulfillment`, `transitionDeliveryAssignment`. Canonical Inventory ledger is consumed by Procurement, Marketplace and Fulfillment; keep the existing transaction/replay primitive authoritative.
- **Fulfillment and delivery lifecycle:** `assignDeliveryCourier`, `transitionDeliveryAssignment`, `transitionOrderFulfillment`. Command idempotency, tenant/location/courier scope, proof and Inventory consequence share invariants.
- **Service resource and booking lifecycle:** `createServiceResource`, `updateServiceResource`, `setServiceResourceAvailability`, `createServiceBooking`, `transitionServiceBooking`. Resource availability, commitments, bookings and location-scoped authorization are coupled.
- **Identity/session/membership lifecycle:** `createTenantForUser`, `ensureMembership`, `createSession`, `authenticateSessionToken`, `consumeInvite`, `consumePairingChallenge`, `changeMembershipRole`, `assignMembershipContextualRole`, `revokeMembershipContextualRole`. Membership, contextual roles, device/session identity and tenant scope must remain coherent.

## Potentially bounded extraction candidates (not approved)

| Candidate | Functions | Reason / dependencies | Risk | Status |
|---|---|---|---|---|
| `restaurant_recipes` | `listRestaurantRecipes`, `createRestaurantRecipe`, `updateRestaurantRecipe` | Small, single-domain persistence cluster with a dedicated table; creation/update still write audit events and serialize through the shared Inventory transaction slot. | low-to-medium | candidate for a later proof slice only; not approved |
| `tenant_business_templates` | `getBusinessTemplateConfig`, `saveBusinessTemplateConfig` | Small tenant configuration cluster; must retain tenant lookup, owner authorization at route boundary, fixed template-key allowlist and audit. | low-to-medium | candidate for later proof only; route/store behavior and migration coupling need test |
| `pack_lifecycle` | `getPackLifecycle`, `transitionPackLifecycle` | Cohesive lifecycle record but transition calls Pack readiness preconditions, role/actor checks and shared audit. | medium | candidate for later proof only; not approved |

## Decision

**No extraction from `store-sqlite.js` is approved by this audit pass.** The immediate next step is to validate the SQL/call graph against tests and inspect the cross-domain transactions above. A domain-shaped table prefix or function-name cluster is not a safe persistence boundary.

Machine-readable statement/function/table/index/FK/migration records: `sqlite-dependency-map.json`.