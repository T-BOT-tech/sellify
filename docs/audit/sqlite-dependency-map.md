# SQLite dependency map

- Baseline: `e216db18ade2a5ffa66aff9dc3096e207251a918`
- Source: `backend/lib/store-sqlite.js` (blob `061581230a4443413224508d22aba21eecdbca1b`)
- Exported functions: **253**
- Declared tables: **110** (112 declarations)
- Migration guards: **85**
- Index declarations: **206**
- Inline foreign-key REFERENCES clauses: **292**

> Dependency inventory, not an ownership assignment or extraction approval. Function/table dependencies are derived from source-level SQL references. Table ownership remains explicitly unassigned.

## Table dependency map

| Table | Declaration lines | Function access (operations) | Indexes | Ownership |
|---|---|---|---|---|
| `accounts_receivable` | 1043 | getReceivable:READ; listReceivables:READ; createReceivable:READ/INSERT; transitionReceivable:UPDATE; allocatePaymentToReceivable:UPDATE | idx_ar_org_status, idx_ar_org_customer | not assigned |
| `ar_ledger_entries` | 1067 | createReceivable:INSERT; transitionReceivable:INSERT; allocatePaymentToReceivable:INSERT; listReceivableLedger:READ | idx_ar_ledger_receivable | not assigned |
| `ar_payment_allocations` | 1085 | allocatePaymentToReceivable:READ/INSERT | idx_ar_alloc_payment | not assigned |
| `audit_events` | 355 | listAuditEvents:READ; verifyAuditEventChain:READ; buildComplianceExport:READ | idx_audit_tenant_created, idx_audit_organization_created, idx_audit_org_time, idx_audit_actor_time, idx_audit_entity_time, idx_audit_lineage | not assigned |
| `audit_retention_policies` | 690 | getAuditRetentionPolicy:READ; setAuditRetentionPolicy:INSERT | none | not assigned |
| `auth_challenges` | 410 | createTenantForUser:READ/UPDATE; createAuthChallenge:INSERT; getAuthChallengeForTenantCreation:READ; consumeAuthChallenge:READ/UPDATE | none | not assigned |
| `catalog_products` | 316 | upsertSupplierNetworkCommercialTerms:READ; upsertSupplierNetworkCatalogListing:READ; getSupplierNetworkMarketplaceIntegration:READ; discoverSupplierNetwork:READ; createProcurementReceipt:READ; updateTenant:READ; getCatalog:READ; saveCatalog:READ/DELETE; searchMarketplaceListings:READ; createMarketplaceOrder:READ; updateMarketplaceOrderStatus:READ | idx_catalog_marketplace, idx_catalog_currency | not assigned |
| `channel_identities` | 497 | getIdentityForTenant:READ | idx_channel_identities_org | not assigned |
| `compliance_requests` | 697 | createComplianceRequest:INSERT; getComplianceRequest:READ; listComplianceRequests:READ; resolveComplianceRequest:UPDATE | idx_compliance_requests_org_status, idx_compliance_requests_subject | not assigned |
| `customer_credit_terms` | 1008 | getCreditTerms:READ; listCreditTerms:READ; createCreditTerms:READ/INSERT; transitionCreditTerms:UPDATE; updateCreditTerms:UPDATE; createReceivable:READ | idx_credit_terms_org_status, idx_credit_terms_org_customer | not assigned |
| `customer_pricing_rules` | 873 | listCustomerPricing:READ; getCustomerPricing:READ; upsertCustomerPricing:READ/INSERT; createQuote:READ | idx_customer_pricing_org_customer, idx_customer_pricing_org_product | not assigned |
| `customers` | 585 | listCustomers:READ; getCustomer:READ; createPaymentWithIntent:READ; createPayment:READ; saveQueuedOrders:READ; createComplianceRequest:READ; buildComplianceExport:READ | idx_customers_org_updated, idx_customers_org_phone, idx_customers_org_name | not assigned |
| `delivery_assignment_commands` | 2588 | assignDeliveryCourier:READ/INSERT; transitionDeliveryAssignment:READ/INSERT | idx_delivery_assignment_commands_order | not assigned |
| `delivery_assignments` | 2224 | selectDeliveryCourier:READ; assignDeliveryCourier:READ/INSERT; listDeliveryAssignments:READ; getDeliveryAssignment:READ; transitionDeliveryAssignment:READ/INSERT/UPDATE; transitionOrderFulfillment:READ | idx_delivery_assignments_courier, idx_delivery_assignments_org, idx_delivery_assignments_courier, idx_delivery_assignments_org, idx_delivery_assignments_active_fulfillment UNIQUE | not assigned |
| `delivery_assignments_v44` | 2254 | none detected | none | not assigned |
| `devices` | 390 | authenticateSessionToken:READ/UPDATE; listDevices:READ; revokeDevice:READ/UPDATE | idx_devices_tenant | not assigned |
| `fulfillment_commands` | 2551 | transitionOrderFulfillment:READ/INSERT | idx_fulfillment_commands_order | not assigned |
| `fulfillments` | 2195 | getOrderFulfillment:READ; assignDeliveryCourier:READ/INSERT; listDeliveryAssignments:READ; getDeliveryAssignment:READ; transitionDeliveryAssignment:READ/UPDATE; transitionOrderFulfillment:READ/INSERT/UPDATE; getTelegramBuyerFulfillmentExperience:READ | idx_fulfillments_org_status, idx_fulfillments_location_status | not assigned |
| `inventory_movements` | 622 | saveCatalog:READ; listInventoryMovements:READ; getInventoryBalances:READ; appendInventoryMovementBatch:READ; createMarketplaceOrder:READ; updateMarketplaceOrderStatus:READ | idx_inventory_movements_org_product_time, idx_inventory_movements_location_product_time, idx_inventory_movements_reference | not assigned |
| `invites` | 449 | createInvite:INSERT; listInvites:READ; revokeInvite:READ/UPDATE; consumeInvite:READ/UPDATE | idx_invites_tenant | not assigned |
| `invoice_items` | 1133 | createInvoice:INSERT | idx_invoice_items_invoice | not assigned |
| `invoices` | 1111 | getInvoice:READ; listInvoices:READ; createInvoice:READ/INSERT; transitionInvoice:READ/UPDATE | idx_invoices_org_status, idx_invoices_org_customer | not assigned |
| `locations` | 485 | createProcurementReceipt:READ; listOrganizationLocations:READ; getOrganizationLocation:READ; createOrganizationLocation:READ/INSERT; updateOrganizationLocation:READ/UPDATE; getIdentityForTenant:READ; getServiceResourceAvailability:READ; setServiceResourceAvailability:READ; transitionServiceBooking:READ; listDeliveryAssignments:READ; getDeliveryAssignment:READ; transitionDeliveryAssignment:READ; transitionOrderFulfillment:READ; createMarketplaceOrder:READ; updateMarketplaceOrderStatus:READ; assessTelegramBuyerServiceFeasibility:READ; assignMembershipContextualRole:READ; createSession:READ; authenticateSessionToken:READ; createComplianceRequest:READ; buildComplianceExport:READ | idx_locations_org, idx_locations_org_code, idx_locations_org_type | not assigned |
| `logistics_scheduling_activities` | 3236 | createLogisticsSchedulingActivity:READ/INSERT; getLogisticsSchedulingActivity:READ; listLogisticsSchedulingActivities:READ; evaluateLogisticsSchedulingActivity:READ; transitionLogisticsSchedulingActivity:READ/UPDATE | idx_logistics_scheduling_org_status, idx_logistics_scheduling_org_location, idx_logistics_scheduling_order, idx_logistics_scheduling_fulfillment | not assigned |
| `marketplace_checkout_idempotency` | 1267 | createMarketplaceOrder:READ/INSERT | idx_marketplace_checkout_idem_buyer | not assigned |
| `marketplace_fulfillments` | 1192 | createMarketplaceOrder:INSERT; updateMarketplaceOrderStatus:UPDATE; getTelegramBuyerFulfillmentExperience:READ | idx_marketplace_fulfillments_order | not assigned |
| `marketplace_inventory_reservations` | 1205 | createMarketplaceOrder:INSERT; updateMarketplaceOrderStatus:UPDATE | idx_marketplace_reservations_product | not assigned |
| `marketplace_orders` | 1154 | createMarketplaceOrder:READ/INSERT/UPDATE; updateMarketplaceOrderStatus:UPDATE; getTelegramBuyerFulfillmentExperience:READ; listTelegramBuyerOrders:READ; getTelegramBuyerServiceBookings:READ | uq_marketplace_orders_idempotency UNIQUE, idx_marketplace_orders_buyer, idx_marketplace_orders_status | not assigned |
| `marketplace_payment_allocations` | 1220 | commitPaymentDecision:READ/UPDATE; finalizePaymentRefund:READ/UPDATE; transitionPayment:READ/UPDATE; createMarketplaceOrder:INSERT; updateMarketplaceOrderStatus:READ/UPDATE | idx_marketplace_payment_allocations_order, idx_marketplace_payment_allocations_order | not assigned |
| `marketplace_payment_allocations_v40` | 2106 | none detected | none | not assigned |
| `marketplace_refunds` | 1251 | finalizePaymentRefund:READ/UPDATE; updateMarketplaceOrderStatus:INSERT | idx_marketplace_refunds_order | not assigned |
| `marketplace_seller_orders` | 1175 | commitPaymentDecision:READ; transitionPayment:READ; createMarketplaceOrder:INSERT; updateMarketplaceOrderStatus:READ/UPDATE; getTelegramBuyerFulfillmentExperience:READ; listTelegramBuyerOrders:READ; getTelegramBuyerServiceBookings:READ | idx_marketplace_seller_orders_seller | not assigned |
| `marketplace_settlements` | 1236 | commitPaymentDecision:UPDATE; finalizePaymentRefund:UPDATE; transitionPayment:UPDATE; createMarketplaceOrder:INSERT; updateMarketplaceOrderStatus:UPDATE | idx_marketplace_settlements_org_status | not assigned |
| `membership_roles` | 3136 | selectDeliveryCourier:READ; assignDeliveryCourier:READ; listDeliveryAssignments:READ; getDeliveryAssignment:READ; assertCourierOwnsDelivery:READ; transitionDeliveryAssignment:READ; assessTelegramBuyerServiceFeasibility:READ; listTenantMemberships:READ; assignMembershipContextualRole:READ/INSERT; revokeMembershipContextualRole:READ/UPDATE; changeMembershipRole:INSERT/UPDATE; createSession:READ; authenticateSessionToken:READ | idx_membership_roles_membership, idx_membership_roles_scope | not assigned |
| `memberships` | 379 | selectDeliveryCourier:READ; assignDeliveryCourier:READ; listDeliveryAssignments:READ; getDeliveryAssignment:READ; assertCourierOwnsDelivery:READ; transitionDeliveryAssignment:READ; assessTelegramBuyerServiceFeasibility:READ; listTenantMemberships:READ; listUserMemberships:READ; assignMembershipContextualRole:READ; revokeMembershipContextualRole:READ; changeMembershipRole:READ/UPDATE; createSession:READ; authenticateSessionToken:READ; revokeDevice:READ; createPairingChallenge:READ; createInvite:READ; revokeInvite:READ; consumeInvite:READ/UPDATE | idx_memberships_user, idx_memberships_tenant | not assigned |
| `metadata` | 297 | none detected | none | not assigned |
| `orders` | 329 | createReceivable:READ; createServiceBooking:READ; transitionServiceBooking:READ; recordServiceDeliveryAssessment:READ/UPDATE; updateTenant:READ; saveCatalog:READ; createPaymentWithIntent:READ; insertPaymentIntent:READ; createPayment:READ; getOrderPaymentSummary:READ; assignDeliveryCourier:READ; transitionDeliveryAssignment:READ; transitionOrderFulfillment:READ; getOrders:READ; saveQueuedOrders:READ; pullNewOrders:READ/UPDATE; updateMarketplaceOrderStatus:READ/UPDATE; getMarketplaceOrderTracking:READ; getTelegramBuyerFulfillmentExperience:READ; getTelegramBuyerServiceBookings:READ; buildComplianceExport:READ | idx_orders_tenant_created, idx_orders_undelivered, idx_orders_marketplace, idx_orders_customer, idx_orders_currency | not assigned |
| `organizations` | 476 | upsertSupplierNetworkProfile:READ; discoverProcurementSuppliers:READ; listProcurementSupplierRelationships:READ; createProcurementSupplierRelationship:READ; transitionProcurementSupplierRelationship:READ; createProcurementRfqResponse:READ; transitionProcurementRfqResponse:READ; getSupplierNetworkMarketplaceIntegration:READ; discoverSupplierNetwork:READ; createProcurementComparison:READ; getIdentityForTenant:READ; getServiceResourceAvailability:READ; setServiceResourceAvailability:READ; transitionServiceBooking:READ; updateTenant:UPDATE; assessTelegramBuyerServiceFeasibility:READ | none | not assigned |
| `pack_lifecycle` | 2161 | transitionPackLifecycle:READ/INSERT/UPDATE; getPackLifecycle:READ; createSession:READ; authenticateSessionToken:READ | idx_pack_lifecycle_org_state, idx_pack_lifecycle_pack | not assigned |
| `pairing_challenges` | 417, 433 | createPairingChallenge:INSERT; consumePairingChallenge:READ/UPDATE | idx_pairing_challenges_tenant, idx_pairing_challenges_tenant | not assigned |
| `payment_accounts` | 776 | createPaymentWithIntent:READ; insertPaymentIntent:READ; getPaymentAccountForProviderNotification:READ; insertProviderNotificationEvidence:READ; commitPaymentDecision:READ; listPaymentAccounts:READ; createPaymentAccount:INSERT; createPayment:READ | idx_payment_accounts_org | not assigned |
| `payment_confirmation_attempts` | 2420 | createPaymentConfirmationAttempt:READ/INSERT; updatePaymentConfirmationAttempt:READ/UPDATE; getPaymentConfirmationAttempt:READ; getPaymentConfirmationAttemptByProviderTransaction:READ | idx_payment_confirmation_attempts_org_status, idx_payment_confirmation_attempts_evidence, idx_payment_confirmation_attempts_intent, uq_payment_confirmation_attempts_provider_tx UNIQUE | not assigned |
| `payment_decisions` | 2368 | insertPaymentDecision:READ/INSERT; listPaymentDecisions:READ; commitPaymentDecision:INSERT | idx_payment_decisions_payment, idx_payment_decisions_evidence, idx_payment_decisions_verification, idx_payment_decisions_org_created | not assigned |
| `payment_evidence` | 2312 | resolvePaymentIntentForProviderEvidence:READ; insertProviderNotificationEvidence:READ/INSERT; createPaymentConfirmationAttempt:READ; getPaymentConfirmationAttemptByProviderTransaction:READ; insertPaymentEvidence:READ/INSERT; listPaymentEvidence:READ; insertPaymentVerification:READ; commitPaymentDecision:READ | idx_payment_evidence_org_provider_fingerprint UNIQUE, idx_payment_evidence_org_provider_transaction UNIQUE, idx_payment_evidence_payment, idx_payment_evidence_intent, idx_payment_evidence_org_status, idx_payment_evidence_external_reference, uq_payment_evidence_notification UNIQUE, idx_payment_evidence_auth_reference | not assigned |
| `payment_idempotency_keys` | 2388 | createPaymentWithIntent:READ/INSERT; getPaymentIdempotency:READ; insertPaymentIdempotency:INSERT; updatePaymentIdempotencyProgress:UPDATE; completePaymentIdempotency:UPDATE; commitPaymentDecision:READ/INSERT | idx_payment_idempotency_expiry | not assigned |
| `payment_intents` | 2290 | createPaymentWithIntent:READ/INSERT; getPaymentIntent:READ; insertPaymentIntent:READ/INSERT; resolvePaymentIntentForProviderEvidence:READ; createPaymentConfirmationAttempt:READ; insertPaymentEvidence:READ; insertPaymentVerification:READ; commitPaymentDecision:READ | idx_payment_intents_org_created, idx_payment_intents_org_order, idx_payment_intents_org_status | not assigned |
| `payment_ledger_entries` | 824 | createPaymentWithIntent:INSERT; commitPaymentDecision:INSERT; createPayment:INSERT; finalizePaymentRefund:INSERT; transitionPayment:INSERT; listPaymentLedger:READ | idx_payment_ledger_payment, idx_payment_ledger_decision, idx_payment_ledger_payment | not assigned |
| `payment_ledger_entries_gap113` | 3071 | none detected | none | not assigned |
| `payment_operational_actions` | 2807 | createPaymentOperationalAction:READ/INSERT; updatePaymentOperationalAction:READ/UPDATE; listPaymentOperationalActions:READ | uq_payment_operational_idempotency UNIQUE, idx_payment_operational_payment, idx_payment_operational_status | not assigned |
| `payment_outbound_intents` | 1777 | listPaymentOutboundIntents:READ; getPaymentOutboundIntent:READ; createPaymentOutboundIntent:READ/INSERT; transitionPaymentOutboundIntent:READ/UPDATE; listProcurementSettlementAllocations:READ; allocateConfirmedOutboundPaymentToProcurementSettlement:READ | idx_payment_outbound_org_state, idx_payment_outbound_po, idx_payment_outbound_counterparty | not assigned |
| `payment_procurement_settlement_allocations` | 1827 | getProcurementSettlement:READ; listProcurementSettlements:READ; listProcurementSettlementAllocations:READ; allocateConfirmedOutboundPaymentToProcurementSettlement:READ/INSERT | idx_payment_procurement_settlement_allocations_settlement, idx_payment_procurement_settlement_allocations_intent | not assigned |
| `payment_procurement_settlements` | 1811 | getProcurementSettlement:READ; listProcurementSettlements:READ; listProcurementSettlementAllocations:READ; allocateConfirmedOutboundPaymentToProcurementSettlement:UPDATE | idx_payment_procurement_settlements_org_status | not assigned |
| `payment_production_certifications` | 2841 | recordPaymentProductionCertification:READ/INSERT; listPaymentProductionCertifications:READ | idx_payment_production_certifications | not assigned |
| `payment_provider_capability_certifications` | 2871 | recordPaymentProviderCapabilityEvidence:READ/INSERT; certifyPaymentProviderCapability:READ/INSERT; listPaymentProviderCapabilityEvidence:READ | idx_payment_provider_capability_certification | not assigned |
| `payment_reconciliations` | 841 | recordPaymentReconciliation:READ/INSERT; listPaymentReconciliations:READ; reconcilePayment:READ/INSERT | idx_payment_reconciliation_org, idx_payment_reconciliation_payment_created, idx_payment_reconciliation_fingerprint | not assigned |
| `payment_refunds` | 2988 | createPaymentWithIntent:READ; getPaymentRefunds:READ; getPaymentRefundByIdempotencyKey:READ; createPaymentRefundRequest:READ/INSERT; finalizePaymentRefund:READ/UPDATE; getOrderPaymentSummary:READ; updateMarketplaceOrderStatus:READ/INSERT | idx_payment_refunds_payment, idx_payment_refunds_org_status, idx_payment_refunds_provider | not assigned |
| `payment_routing_policies` | 2782 | listPaymentRoutingPolicies:READ; upsertPaymentRoutingPolicy:READ/INSERT/UPDATE | idx_payment_routing_policy_match | not assigned |
| `payment_settlements` | 2949 | getPaymentSettlementByIdempotencyKey:READ; createPaymentSettlement:READ/INSERT; finalizePaymentSettlement:READ/UPDATE; listPaymentSettlements:READ | idx_payment_settlements_payment, idx_payment_settlements_org_status, idx_payment_settlements_provider_reference | not assigned |
| `payment_status_query_commands` | 2452 | beginPaymentStatusQuery:READ/INSERT/UPDATE; markPaymentStatusQueryProviderStarted:UPDATE; completePaymentStatusQuery:READ/UPDATE; commitPaymentDecision:READ | idx_payment_status_query_commands_payment | not assigned |
| `payment_verifications` | 2341 | insertPaymentVerification:READ/INSERT; listPaymentVerifications:READ; insertPaymentDecision:READ; commitPaymentDecision:READ | idx_payment_verifications_payment, idx_payment_verifications_evidence, idx_payment_verifications_intent, idx_payment_verifications_org_result, idx_payment_verifications_evidence_verifier UNIQUE, uq_payment_verifications_provider_transaction UNIQUE, idx_payment_verifications_provider_transaction | not assigned |
| `payments` | 790 | createPaymentWithIntent:READ/INSERT; createPaymentConfirmationAttempt:READ; insertPaymentEvidence:READ; insertPaymentVerification:READ; insertPaymentDecision:READ; beginPaymentStatusQuery:READ; commitPaymentDecision:READ/UPDATE; createPayment:READ/INSERT; createPaymentSettlement:READ; createPaymentRefundRequest:READ; finalizePaymentRefund:READ/UPDATE; getPayment:READ; getOrderPaymentSummary:READ; listPayments:READ; transitionPayment:READ/UPDATE; saveQueuedOrders:READ; updateMarketplaceOrderStatus:READ; updatePaymentOperationalAction:READ | idx_payments_org_created, idx_payments_order, idx_payments_state, uq_payments_external_reference UNIQUE, idx_payments_payment_intent, idx_payments_org_created, idx_payments_order, idx_payments_state, idx_payments_payment_intent, uq_payments_external_reference UNIQUE | not assigned |
| `payments_gap113` | 3030 | none detected | none | not assigned |
| `phone_routing` | 349 | none detected | none | not assigned |
| `procurement_award_lines` | 1612 | createProcurementAward:INSERT; transitionProcurementAward:READ; createPurchaseOrderFromProcurementAward:READ | idx_procurement_award_lines_award | not assigned |
| `procurement_awards` | 1586 | listProcurementAwards:READ; createProcurementAward:READ/INSERT; transitionProcurementAward:READ/UPDATE; createPurchaseOrderFromProcurementAward:READ | idx_procurement_awards_org_status, idx_procurement_awards_demand | not assigned |
| `procurement_comparison_line_offers` | 1557 | createProcurementComparison:INSERT; createProcurementAward:READ | idx_procurement_comparison_lines_comparison | not assigned |
| `procurement_comparison_suppliers` | 1536 | createProcurementComparison:INSERT | idx_procurement_comparison_suppliers_rank | not assigned |
| `procurement_comparisons` | 1523 | listProcurementComparisons:READ; createProcurementComparison:READ/INSERT; createProcurementAward:READ | idx_procurement_comparisons_rfq | not assigned |
| `procurement_demand_items` | 1321 | createProcurementDemand:INSERT; getProcurementDemand:READ; updateProcurementDemand:READ/INSERT/DELETE; createProcurementRfq:READ | idx_procurement_demand_items_demand, idx_procurement_demand_items_product | not assigned |
| `procurement_demands` | 1288 | createProcurementDemand:READ/INSERT; getProcurementDemand:READ; updateProcurementDemand:READ/UPDATE; transitionProcurementDemand:READ/UPDATE; createProcurementAward:READ; transitionProcurementAward:UPDATE | idx_procurement_demands_org_status, idx_procurement_demands_requester, idx_procurement_demands_source | not assigned |
| `procurement_receipt_lines` | 1742 | recalculateSupplierNetworkPerformance:READ; createProcurementReceipt:READ/INSERT | idx_procurement_receipt_lines_receipt | not assigned |
| `procurement_receipts` | 1722 | recalculateSupplierNetworkPerformance:READ; listProcurementReceipts:READ; createProcurementReceipt:READ/INSERT/UPDATE | idx_procurement_receipts_po | not assigned |
| `procurement_rfq_items` | 1430 | createProcurementRfq:INSERT; createProcurementRfqResponse:READ; createProcurementComparison:READ; createProcurementAward:READ; createPurchaseOrderFromProcurementAward:READ | idx_procurement_rfq_items_rfq | not assigned |
| `procurement_rfq_response_items` | 1483 | createProcurementRfqResponse:READ/INSERT/DELETE; transitionProcurementRfqResponse:READ; createProcurementComparison:READ | idx_procurement_rfq_response_items_response | not assigned |
| `procurement_rfq_responses` | 1459 | createProcurementRfqResponse:READ/INSERT/UPDATE; transitionProcurementRfqResponse:READ/UPDATE; recalculateSupplierNetworkPerformance:READ; createProcurementComparison:READ; createProcurementAward:READ | idx_procurement_rfq_responses_rfq, idx_procurement_rfq_responses_supplier | not assigned |
| `procurement_rfq_suppliers` | 1447 | createProcurementRfq:INSERT; transitionProcurementRfq:READ; transitionProcurementRfqResponse:UPDATE; recalculateSupplierNetworkPerformance:READ | idx_procurement_rfq_suppliers_supplier | not assigned |
| `procurement_rfqs` | 1404 | createProcurementRfq:READ/INSERT; listProcurementRfqs:READ; transitionProcurementRfq:READ/UPDATE; createProcurementRfqResponse:READ; transitionProcurementRfqResponse:READ; recalculateSupplierNetworkPerformance:READ; createProcurementComparison:READ; createProcurementAward:READ | idx_procurement_rfqs_org_status, idx_procurement_rfqs_demand | not assigned |
| `procurement_supplier_participants` | 1369 | setProcurementSupplierParticipation:INSERT/UPDATE; discoverProcurementSuppliers:READ; listSupplierNetworkTrustEvidence:READ; refreshSupplierNetworkTrustEvidence:READ; recalculateSupplierNetworkPerformance:READ; discoverSupplierNetwork:READ | idx_procurement_supplier_discovery | not assigned |
| `procurement_supplier_relationships` | 1379 | listProcurementSupplierRelationships:READ; createProcurementSupplierRelationship:READ/INSERT; transitionProcurementSupplierRelationship:READ/UPDATE; listSupplierNetworkTrustEvidence:READ; refreshSupplierNetworkTrustEvidence:READ; listSupplierNetworkPerformance:READ; getSupplierNetworkPerformance:READ; discoverSupplierNetwork:READ | idx_procurement_supplier_relationships_buyer, idx_procurement_supplier_relationships_supplier | not assigned |
| `purchase_order_items` | 974 | recalculateSupplierNetworkPerformance:READ; createPurchaseOrder:INSERT; createProcurementReceipt:READ; createPurchaseOrderFromProcurementAward:INSERT | idx_purchase_order_items_order, idx_purchase_order_items_order | not assigned |
| `purchase_orders` | 950 | createPaymentOutboundIntent:READ; createProcurementPaymentIntent:READ; recalculateSupplierNetworkPerformance:READ; listPurchaseOrders:READ; createPurchaseOrder:READ/INSERT; createProcurementReceipt:READ; createPurchaseOrderFromProcurementAward:READ/INSERT; transitionPurchaseOrder:UPDATE | idx_purchase_orders_org_customer, idx_purchase_orders_org_status, idx_purchase_orders_org_customer, idx_purchase_orders_org_supplier, idx_purchase_orders_org_status, idx_purchase_orders_org_source | not assigned |
| `purchase_orders_phase17_6_new` | 1656 | none detected | none | not assigned |
| `quote_items` | 923 | createQuote:INSERT | idx_quote_items_quote | not assigned |
| `quotes` | 902 | listQuotes:READ; createQuote:INSERT; transitionQuote:UPDATE | idx_quotes_org_customer, idx_quotes_org_status | not assigned |
| `restaurant_recipes` | 3558 | listRestaurantRecipes:READ; createRestaurantRecipe:READ/INSERT; updateRestaurantRecipe:READ/UPDATE | idx_restaurant_recipes_org_status, idx_restaurant_recipes_chat_updated | not assigned |
| `schema_migrations` | 293 | none detected | none | not assigned |
| `service_booking_commands` | 2668 | createServiceBooking:READ/INSERT; transitionServiceBooking:READ/INSERT | idx_service_booking_commands_booking | not assigned |
| `service_bookings` | 2652 | createServiceBooking:READ/INSERT; transitionServiceBooking:READ/UPDATE; listServiceProviderBookings:READ; listServiceBookings:READ; getTelegramBuyerServiceBookings:READ; assessTelegramBuyerServiceFeasibility:READ | idx_service_bookings_order, idx_service_bookings_resource_window | not assigned |
| `service_delivery_assessment_commands` | 2606 | recordServiceDeliveryAssessment:READ/INSERT | idx_service_delivery_assessment_commands_order | not assigned |
| `service_resource_availability` | 3358 | getServiceResourceAvailability:READ; setServiceResourceAvailability:READ/INSERT; transitionServiceBooking:READ; assessTelegramBuyerServiceFeasibility:READ | idx_service_resource_availability_org | not assigned |
| `service_resource_availability_commands` | 3371 | setServiceResourceAvailability:READ/INSERT | none | not assigned |
| `service_resource_commands` | 3340 | createServiceResource:READ/INSERT; updateServiceResource:READ/INSERT | idx_service_resource_commands_resource | not assigned |
| `service_resource_commitments` | 3394, 3440 | updateServiceResource:READ; setServiceResourceAvailability:READ; transitionServiceBooking:READ/INSERT/UPDATE; listServiceProviderBookings:READ; getTelegramBuyerServiceBookings:READ; assessTelegramBuyerServiceFeasibility:READ | idx_service_resource_commitments_overlap, idx_service_resource_commitments_overlap | not assigned |
| `service_resources` | 3319 | listServiceResources:READ; createServiceResource:READ/INSERT; updateServiceResource:READ/UPDATE; getServiceResourceAvailability:READ; setServiceResourceAvailability:READ; transitionServiceBooking:READ; listServiceProviderBookings:READ; getTelegramBuyerServiceBookings:READ; assessTelegramBuyerServiceFeasibility:READ; assignMembershipContextualRole:READ | idx_service_resources_org_status, idx_service_resources_service | not assigned |
| `sessions` | 400 | createSession:INSERT; authenticateSessionToken:READ; revokeSession:UPDATE; listDevices:READ; revokeDevice:UPDATE | idx_sessions_hash, idx_sessions_device | not assigned |
| `supplier_network_capabilities` | 3204 | upsertSupplierNetworkCommercialTerms:READ; listSupplierNetworkCapabilities:READ; upsertSupplierNetworkCapability:READ/INSERT/UPDATE; transitionSupplierNetworkCapability:UPDATE; discoverSupplierNetwork:READ | idx_supplier_network_capabilities_org_status, idx_supplier_network_capabilities_discovery | not assigned |
| `supplier_network_capacity_signals` | 1924 | listSupplierNetworkCapacities:READ; upsertSupplierNetworkCapacity:READ/INSERT/UPDATE; transitionSupplierNetworkCapacity:UPDATE; discoverSupplierNetwork:READ | idx_supplier_network_capacity_org_status, idx_supplier_network_capacity_discovery | not assigned |
| `supplier_network_catalog_listings` | 1890 | listSupplierNetworkCatalogListings:READ; upsertSupplierNetworkCatalogListing:READ/INSERT/UPDATE; transitionSupplierNetworkCatalogListing:UPDATE; getSupplierNetworkMarketplaceIntegration:READ; discoverSupplierNetwork:READ | idx_supplier_network_catalog_org_status, idx_supplier_network_catalog_product | not assigned |
| `supplier_network_commercial_terms` | 1959 | listSupplierNetworkCommercialTerms:READ; upsertSupplierNetworkCommercialTerms:READ/INSERT/UPDATE; transitionSupplierNetworkCommercialTerms:UPDATE; discoverSupplierNetwork:READ | idx_supplier_network_commercial_org_status, idx_supplier_network_commercial_discovery, uq_supplier_network_commercial_network UNIQUE | not assigned |
| `supplier_network_performance_observations` | 2032 | refreshSupplierNetworkTrustEvidence:READ; listSupplierNetworkPerformance:READ; getSupplierNetworkPerformance:READ; recalculateSupplierNetworkPerformance:INSERT | idx_supplier_network_performance_supplier_metric, idx_supplier_network_performance_visibility | not assigned |
| `supplier_network_profiles` | 1860 | upsertSupplierNetworkProfile:INSERT/UPDATE; transitionSupplierNetworkProfile:UPDATE; getSupplierNetworkMarketplaceIntegration:READ; discoverSupplierNetwork:READ | idx_supplier_network_profiles_visibility_status | not assigned |
| `supplier_network_qualifications` | 1996 | listSupplierNetworkQualifications:READ; upsertSupplierNetworkQualification:READ/INSERT/UPDATE; transitionSupplierNetworkQualification:UPDATE; listSupplierNetworkTrustEvidence:READ; refreshSupplierNetworkTrustEvidence:READ; discoverSupplierNetwork:READ | idx_supplier_network_qualification_org_status, idx_supplier_network_qualification_discovery, uq_supplier_network_qualification_reference UNIQUE | not assigned |
| `supplier_network_service_areas` | 3172 | listSupplierNetworkServiceAreas:READ; upsertSupplierNetworkServiceArea:READ/INSERT/UPDATE; transitionSupplierNetworkServiceArea:UPDATE; discoverSupplierNetwork:READ | idx_supplier_network_service_areas_org_status, idx_supplier_network_service_areas_discovery | not assigned |
| `supplier_network_trust_evidence` | 2066 | listSupplierNetworkTrustEvidence:READ; getSupplierNetworkTrustEvidence:READ; refreshSupplierNetworkTrustEvidence:INSERT; discoverSupplierNetwork:READ | idx_supplier_network_trust_supplier_type, idx_supplier_network_trust_visibility, uq_supplier_network_trust_source UNIQUE | not assigned |
| `sync_events` | 650 | processSyncEvent:READ/INSERT | idx_sync_events_org_time, idx_sync_events_org_type | not assigned |
| `telegram_storefront_configs` | 2132 | getTelegramStorefrontConfig:READ; upsertTelegramStorefrontConfig:INSERT/UPDATE; verifyTelegramStorefront:UPDATE | idx_telegram_storefront_status | not assigned |
| `tenant_business_templates` | 3285 | getBusinessTemplateConfig:READ; saveBusinessTemplateConfig:INSERT | none | not assigned |
| `tenant_creation_requests` | 3301 | createTenantForUser:READ/INSERT; getAuthChallengeForTenantCreation:READ | idx_tenant_creation_requests_user | not assigned |
| `tenants` | 306 | getTelegramStorefrontConfig:READ; getSupplierNetworkMarketplaceIntegration:READ; discoverSupplierNetwork:READ; createServiceResource:READ; updateServiceResource:READ; setServiceResourceAvailability:READ; createServiceBooking:READ; transitionServiceBooking:READ; recordServiceDeliveryAssessment:READ; getOrCreateTenant:READ/INSERT; getTenant:READ; getTenantByApiKey:READ; updateTenant:READ/UPDATE; listTenants:READ; saveCatalog:READ; getPaymentAccountForProviderNotification:READ; assignDeliveryCourier:READ; transitionDeliveryAssignment:READ; transitionOrderFulfillment:READ; saveQueuedOrders:READ; searchMarketplaceListings:READ; createMarketplaceOrder:READ; updateMarketplaceOrderStatus:READ; getMarketplaceOrderTracking:READ; listUserMemberships:READ; assignMembershipContextualRole:READ; createTenantForUser:INSERT; createSession:READ; authenticateSessionToken:READ; consumeInvite:READ; updatePaymentOperationalAction:READ | idx_tenants_organization | not assigned |
| `users` | 372 | listDeliveryAssignments:READ; transitionOrderFulfillment:READ; getOrCreateUserByTelegram:READ/INSERT/UPDATE; listTenantMemberships:READ; consumePairingChallenge:INSERT; listInvites:READ | none | not assigned |

## Exported function map

| Function | Line | Tables (operations) | Calls to exported functions | Transaction statements | Migration guards |
|---|---:|---|---|---|---|
| `transitionPackLifecycle` | 3646 | pack_lifecycle:READ/INSERT/UPDATE | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `getPackLifecycle` | 3727 | pack_lifecycle:READ | none detected | none | none |
| `getTelegramStorefrontConfig` | 3769 | tenants:READ, telegram_storefront_configs:READ | none detected | none | none |
| `upsertTelegramStorefrontConfig` | 3789 | telegram_storefront_configs:INSERT/UPDATE | getTenant, getTelegramStorefrontConfig | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `verifyTelegramStorefront` | 3845 | telegram_storefront_configs:UPDATE | getTenant, getTelegramStorefrontConfig | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `listSupplierNetworkQualifications` | 3880 | supplier_network_qualifications:READ | none detected | none | none |
| `getSupplierNetworkQualification` | 3881 | none detected | none detected | none | none |
| `upsertSupplierNetworkQualification` | 3882 | supplier_network_qualifications:READ/INSERT/UPDATE | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `transitionSupplierNetworkQualification` | 3883 | supplier_network_qualifications:UPDATE | none detected | none | none |
| `listSupplierNetworkCommercialTerms` | 3891 | supplier_network_commercial_terms:READ | none detected | none | none |
| `getSupplierNetworkCommercialTerms` | 3892 | none detected | none detected | none | none |
| `upsertSupplierNetworkCommercialTerms` | 3893 | catalog_products:READ, supplier_network_capabilities:READ, supplier_network_commercial_terms:READ/INSERT/UPDATE | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `transitionSupplierNetworkCommercialTerms` | 3894 | supplier_network_commercial_terms:UPDATE | none detected | none | none |
| `listSupplierNetworkCapacities` | 3950 | supplier_network_capacity_signals:READ | none detected | none | none |
| `getSupplierNetworkCapacity` | 3951 | none detected | none detected | none | none |
| `upsertSupplierNetworkCapacity` | 3952 | supplier_network_capacity_signals:READ/INSERT/UPDATE | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `transitionSupplierNetworkCapacity` | 3996 | supplier_network_capacity_signals:UPDATE | none detected | none | none |
| `listSupplierNetworkServiceAreas` | 3998 | supplier_network_service_areas:READ | none detected | none | none |
| `getSupplierNetworkServiceArea` | 3999 | none detected | none detected | none | none |
| `upsertSupplierNetworkServiceArea` | 4000 | supplier_network_service_areas:READ/INSERT/UPDATE | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `transitionSupplierNetworkServiceArea` | 4001 | supplier_network_service_areas:UPDATE | none detected | none | none |
| `listSupplierNetworkCatalogListings` | 4010 | supplier_network_catalog_listings:READ | none detected | none | none |
| `getSupplierNetworkCatalogListing` | 4011 | none detected | none detected | none | none |
| `upsertSupplierNetworkCatalogListing` | 4012 | catalog_products:READ, supplier_network_catalog_listings:READ/INSERT/UPDATE | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `transitionSupplierNetworkCatalogListing` | 4013 | supplier_network_catalog_listings:UPDATE | none detected | none | none |
| `listSupplierNetworkCapabilities` | 4021 | supplier_network_capabilities:READ | none detected | none | none |
| `getSupplierNetworkCapability` | 4022 | none detected | none detected | none | none |
| `upsertSupplierNetworkCapability` | 4023 | supplier_network_capabilities:READ/INSERT/UPDATE | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `transitionSupplierNetworkCapability` | 4024 | supplier_network_capabilities:UPDATE | none detected | none | none |
| `getSupplierNetworkProfile` | 4036 | none detected | none detected | none | none |
| `upsertSupplierNetworkProfile` | 4037 | organizations:READ, supplier_network_profiles:INSERT/UPDATE | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `transitionSupplierNetworkProfile` | 4038 | supplier_network_profiles:UPDATE | none detected | none | none |
| `listPaymentOutboundIntents` | 4045 | payment_outbound_intents:READ | none detected | none | none |
| `getPaymentOutboundIntent` | 4046 | payment_outbound_intents:READ | none detected | none | none |
| `createPaymentOutboundIntent` | 4047 | purchase_orders:READ, payment_outbound_intents:READ/INSERT | none detected | none | none |
| `transitionPaymentOutboundIntent` | 4048 | payment_outbound_intents:READ/UPDATE | none detected | none | none |
| `createProcurementPaymentIntent` | 4049 | purchase_orders:READ | createPaymentOutboundIntent | none | none |
| `getProcurementSettlement` | 4068 | payment_procurement_settlements:READ, payment_procurement_settlement_allocations:READ | none detected | none | none |
| `listProcurementSettlements` | 4069 | payment_procurement_settlements:READ, payment_procurement_settlement_allocations:READ | none detected | none | none |
| `listProcurementSettlementAllocations` | 4070 | payment_procurement_settlements:READ, payment_procurement_settlement_allocations:READ, payment_outbound_intents:READ | none detected | none | none |
| `allocateConfirmedOutboundPaymentToProcurementSettlement` | 4071 | payment_outbound_intents:READ, payment_procurement_settlement_allocations:READ/INSERT, payment_procurement_settlements:UPDATE | getProcurementSettlement | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `createProcurementDemand` | 4248 | procurement_demands:READ/INSERT, procurement_demand_items:INSERT | getProcurementDemand | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `getProcurementDemand` | 4292 | procurement_demands:READ, procurement_demand_items:READ | none detected | none | none |
| `listProcurementDemands` | 4301 | none detected | none detected | none | none |
| `updateProcurementDemand` | 4314 | procurement_demands:READ/UPDATE, procurement_demand_items:READ/INSERT/DELETE | getProcurementDemand | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `transitionProcurementDemand` | 4349 | procurement_demands:READ/UPDATE | getProcurementDemand | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `getProcurementSupplierParticipation` | 4379 | none detected | none detected | none | none |
| `setProcurementSupplierParticipation` | 4380 | procurement_supplier_participants:INSERT/UPDATE | getProcurementSupplierParticipation | none | none |
| `discoverProcurementSuppliers` | 4381 | procurement_supplier_participants:READ, organizations:READ | none detected | none | none |
| `listProcurementSupplierRelationships` | 4382 | procurement_supplier_relationships:READ, organizations:READ | none detected | none | none |
| `createProcurementSupplierRelationship` | 4383 | organizations:READ, procurement_supplier_relationships:READ/INSERT | none detected | none | none |
| `transitionProcurementSupplierRelationship` | 4384 | procurement_supplier_relationships:READ/UPDATE, organizations:READ | none detected | none | none |
| `createProcurementRfq` | 4441 | procurement_rfqs:READ/INSERT, procurement_demand_items:READ, procurement_rfq_items:INSERT, procurement_rfq_suppliers:INSERT | getProcurementDemand | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `listProcurementRfqs` | 4443 | procurement_rfqs:READ | none detected | none | none |
| `transitionProcurementRfq` | 4444 | procurement_rfqs:READ/UPDATE, procurement_rfq_suppliers:READ | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `createProcurementRfqResponse` | 4446 | procurement_rfqs:READ, procurement_rfq_items:READ, procurement_rfq_responses:READ/INSERT/UPDATE, organizations:READ, procurement_rfq_response_items:READ/INSERT/DELETE | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `transitionProcurementRfqResponse` | 4448 | procurement_rfq_responses:READ/UPDATE, procurement_rfqs:READ, organizations:READ, procurement_rfq_response_items:READ, procurement_rfq_suppliers:UPDATE | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `listSupplierNetworkTrustEvidence` | 4574 | supplier_network_qualifications:READ, procurement_supplier_relationships:READ, procurement_supplier_participants:READ, supplier_network_trust_evidence:READ | none detected | none | none |
| `getSupplierNetworkTrustEvidence` | 4617 | supplier_network_trust_evidence:READ | none detected | none | none |
| `refreshSupplierNetworkTrustEvidence` | 4625 | procurement_supplier_participants:READ, procurement_supplier_relationships:READ, supplier_network_qualifications:READ, supplier_network_performance_observations:READ, supplier_network_trust_evidence:INSERT | listSupplierNetworkTrustEvidence | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `listSupplierNetworkPerformance` | 4659 | procurement_supplier_relationships:READ, supplier_network_performance_observations:READ | none detected | none | none |
| `getSupplierNetworkPerformance` | 4673 | supplier_network_performance_observations:READ, procurement_supplier_relationships:READ | none detected | none | none |
| `recalculateSupplierNetworkPerformance` | 4686 | procurement_supplier_participants:READ, procurement_rfq_responses:READ, procurement_rfq_suppliers:READ, procurement_rfqs:READ, purchase_orders:READ, procurement_receipt_lines:READ, procurement_receipts:READ, purchase_order_items:READ, supplier_network_performance_observations:INSERT | listSupplierNetworkPerformance | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `getSupplierNetworkMarketplaceIntegration` | 4739 | organizations:READ, supplier_network_profiles:READ, supplier_network_catalog_listings:READ, catalog_products:READ, tenants:READ | none detected | none | none |
| `discoverSupplierNetwork` | 4741 | procurement_supplier_participants:READ, organizations:READ, supplier_network_profiles:READ, procurement_supplier_relationships:READ, supplier_network_catalog_listings:READ, catalog_products:READ, tenants:READ, supplier_network_capabilities:READ, supplier_network_service_areas:READ, supplier_network_capacity_signals:READ, supplier_network_commercial_terms:READ, supplier_network_qualifications:READ, supplier_network_trust_evidence:READ | none detected | none | none |
| `getProcurementComparison` | 4819 | none detected | none detected | none | none |
| `listProcurementComparisons` | 4826 | procurement_comparisons:READ | none detected | none | none |
| `createProcurementComparison` | 4838 | procurement_rfqs:READ, procurement_rfq_items:READ, procurement_rfq_responses:READ, organizations:READ, procurement_comparisons:READ/INSERT, procurement_rfq_response_items:READ, procurement_comparison_suppliers:INSERT, procurement_comparison_line_offers:INSERT | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `getProcurementAward` | 4969 | none detected | none detected | none | none |
| `listProcurementAwards` | 4976 | procurement_awards:READ | none detected | none | none |
| `createProcurementAward` | 4994 | procurement_demands:READ, procurement_rfqs:READ, procurement_comparisons:READ, procurement_comparison_line_offers:READ, procurement_rfq_responses:READ, procurement_rfq_items:READ, procurement_awards:READ/INSERT, procurement_award_lines:INSERT | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `transitionProcurementAward` | 5053 | procurement_awards:READ/UPDATE, procurement_award_lines:READ, procurement_demands:UPDATE | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `listCustomerPricing` | 5106 | customer_pricing_rules:READ | none detected | none | none |
| `getCustomerPricing` | 5118 | customer_pricing_rules:READ | none detected | none | none |
| `upsertCustomerPricing` | 5123 | customer_pricing_rules:READ/INSERT | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `updateCustomerPricing` | 5184 | none detected | getCustomerPricing, upsertCustomerPricing | none | none |
| `getQuote` | 5218 | none detected | none detected | none | none |
| `listQuotes` | 5223 | quotes:READ | none detected | none | none |
| `createQuote` | 5238 | customer_pricing_rules:READ, quotes:INSERT, quote_items:INSERT | none detected | BEGIN, COMMIT, ROLLBACK | none |
| `transitionQuote` | 5284 | quotes:UPDATE | none detected | none | none |
| `getCreditTerms` | 5379 | customer_credit_terms:READ | none detected | none | none |
| `listCreditTerms` | 5385 | customer_credit_terms:READ | none detected | none | none |
| `createCreditTerms` | 5395 | customer_credit_terms:READ/INSERT | getCreditTerms | none | none |
| `transitionCreditTerms` | 5430 | customer_credit_terms:UPDATE | getCreditTerms | none | none |
| `updateCreditTerms` | 5448 | customer_credit_terms:UPDATE | getCreditTerms | none | none |
| `getPurchaseOrder` | 5467 | none detected | none detected | none | none |
| `listPurchaseOrders` | 5472 | purchase_orders:READ | none detected | none | none |
| `createPurchaseOrder` | 5482 | purchase_orders:READ/INSERT, purchase_order_items:INSERT | createPurchaseOrderFromProcurementAward | BEGIN, COMMIT, ROLLBACK | none |
| `getProcurementReceipt` | 5562 | none detected | none detected | none | none |
| `listProcurementReceipts` | 5568 | procurement_receipts:READ | none detected | none | none |
| `createProcurementReceipt` | 5579 | purchase_orders:READ, locations:READ, purchase_order_items:READ, procurement_receipt_lines:READ/INSERT, procurement_receipts:READ/INSERT/UPDATE, catalog_products:READ | appendInventoryMovement | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `createPurchaseOrderFromProcurementAward` | 5680 | procurement_awards:READ, procurement_award_lines:READ, procurement_rfq_items:READ, purchase_orders:READ/INSERT, purchase_order_items:INSERT | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `transitionPurchaseOrder` | 5732 | purchase_orders:UPDATE | none detected | none | none |
| `getReceivable` | 5775 | accounts_receivable:READ | none detected | none | none |
| `listReceivables` | 5781 | accounts_receivable:READ | none detected | none | none |
| `createReceivable` | 5791 | customer_credit_terms:READ, orders:READ, accounts_receivable:READ/INSERT, ar_ledger_entries:INSERT | getReceivable | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `transitionReceivable` | 5843 | ar_ledger_entries:INSERT, accounts_receivable:UPDATE | getReceivable | none | none |
| `allocatePaymentToReceivable` | 5857 | ar_payment_allocations:READ/INSERT, ar_ledger_entries:INSERT, accounts_receivable:UPDATE | getReceivable, getPayment | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `listReceivableLedger` | 5884 | ar_ledger_entries:READ | getReceivable | none | none |
| `getInvoice` | 5908 | invoices:READ | none detected | none | none |
| `listInvoices` | 5915 | invoices:READ | none detected | none | none |
| `createInvoice` | 5940 | invoices:READ/INSERT, invoice_items:INSERT | getReceivable, getInvoice | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `transitionInvoice` | 5969 | invoices:READ/UPDATE | getInvoice | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `listOrganizationLocations` | 6176 | locations:READ | none detected | none | none |
| `getOrganizationLocation` | 6189 | locations:READ | none detected | none | none |
| `createOrganizationLocation` | 6197 | locations:READ/INSERT | none detected | none | none |
| `updateOrganizationLocation` | 6219 | locations:READ/UPDATE | none detected | none | none |
| `getIdentityForTenant` | 6245 | organizations:READ, locations:READ, channel_identities:READ | none detected | none | none |
| `listServiceResources` | 6544 | service_resources:READ | none detected | none | none |
| `createServiceResource` | 6557 | tenants:READ, service_resource_commands:READ/INSERT, service_resources:READ/INSERT | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `updateServiceResource` | 6602 | tenants:READ, service_resources:READ/UPDATE, service_resource_commands:READ/INSERT, service_resource_commitments:READ | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `getServiceResourceAvailability` | 6691 | service_resources:READ, organizations:READ, locations:READ, service_resource_availability:READ | none detected | none | none |
| `setServiceResourceAvailability` | 6725 | tenants:READ, service_resources:READ, locations:READ, organizations:READ, service_resource_availability_commands:READ/INSERT, service_resource_availability:READ/INSERT, service_resource_commitments:READ | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `createServiceBooking` | 6817 | tenants:READ, orders:READ, service_booking_commands:READ/INSERT, service_bookings:READ/INSERT | getTenant | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `transitionServiceBooking` | 6867 | tenants:READ, service_bookings:READ/UPDATE, service_booking_commands:READ/INSERT, service_resources:READ, orders:READ, service_resource_availability:READ, organizations:READ, locations:READ, service_resource_commitments:READ/INSERT/UPDATE | getTenant | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `listServiceProviderBookings` | 6998 | service_bookings:READ, service_resource_commitments:READ, service_resources:READ | getTenant | none | none |
| `listServiceBookings` | 7028 | service_bookings:READ | getTenant | none | none |
| `recordServiceDeliveryAssessment` | 7036 | orders:READ/UPDATE, tenants:READ, service_delivery_assessment_commands:READ/INSERT | getTenant | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `getOrCreateTenant` | 7255 | tenants:READ/INSERT | none detected | none | none |
| `getTenant` | 7275 | tenants:READ | none detected | none | none |
| `getBusinessTemplateConfig` | 7287 | tenant_business_templates:READ | getTenant | none | none |
| `saveBusinessTemplateConfig` | 7301 | tenant_business_templates:INSERT | getTenant | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `getTenantByApiKey` | 7368 | tenants:READ | none detected | none | none |
| `updateTenant` | 7374 | catalog_products:READ, orders:READ, tenants:READ/UPDATE, organizations:UPDATE | getTenant | none | none |
| `listTenants` | 7416 | tenants:READ | none detected | none | none |
| `getCatalog` | 7421 | catalog_products:READ | none detected | none | none |
| `saveCatalog` | 7428 | catalog_products:READ/DELETE, tenants:READ, inventory_movements:READ, orders:READ | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `listCustomers` | 7536 | customers:READ | getTenant | none | none |
| `getCustomer` | 7553 | customers:READ | getTenant | none | none |
| `upsertCustomer` | 7647 | none detected | none detected | none | none |
| `updateCustomer` | 7651 | none detected | getCustomer, upsertCustomer | none | none |
| `listInventoryMovements` | 7686 | inventory_movements:READ | getTenant | none | none |
| `getInventoryBalances` | 7700 | inventory_movements:READ | getTenant | none | none |
| `appendInventoryMovement` | 7837 | none detected | getTenant | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `appendInventoryMovementBatch` | 7872 | inventory_movements:READ | getTenant | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `processSyncEvent` | 7999 | sync_events:READ/INSERT | getTenant | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `createPaymentWithIntent` | 8161 | orders:READ, customers:READ, payment_accounts:READ, payment_idempotency_keys:READ/INSERT, payments:READ/INSERT, payment_intents:READ/INSERT, payment_refunds:READ, payment_ledger_entries:INSERT | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `getPaymentIntent` | 8266 | payment_intents:READ | none detected | none | none |
| `insertPaymentIntent` | 8271 | payment_accounts:READ, orders:READ, payment_intents:READ/INSERT | none detected | none | none |
| `getPaymentAccountForProviderNotification` | 8303 | payment_accounts:READ, tenants:READ | none detected | none | none |
| `resolvePaymentIntentForProviderEvidence` | 8328 | payment_evidence:READ, payment_intents:READ | getPaymentAccountForProviderNotification | none | none |
| `insertProviderNotificationEvidence` | 8425 | payment_accounts:READ, payment_evidence:READ/INSERT | resolvePaymentIntentForProviderEvidence | none | none |
| `createPaymentConfirmationAttempt` | 8610 | payment_evidence:READ, payment_intents:READ, payments:READ, payment_confirmation_attempts:READ/INSERT | none detected | none | none |
| `updatePaymentConfirmationAttempt` | 8646 | payment_confirmation_attempts:READ/UPDATE | none detected | none | none |
| `getPaymentConfirmationAttempt` | 8679 | payment_confirmation_attempts:READ | none detected | none | none |
| `getPaymentConfirmationAttemptByProviderTransaction` | 8687 | payment_confirmation_attempts:READ, payment_evidence:READ | none detected | none | none |
| `insertPaymentEvidence` | 8710 | payment_intents:READ, payments:READ, payment_evidence:READ/INSERT | none detected | none | none |
| `listPaymentEvidence` | 8781 | payment_evidence:READ | getPayment | none | none |
| `insertPaymentVerification` | 8787 | payment_evidence:READ, payments:READ, payment_intents:READ, payment_verifications:READ/INSERT | none detected | none | none |
| `listPaymentVerifications` | 8917 | payment_verifications:READ | getPayment | none | none |
| `insertPaymentDecision` | 8923 | payments:READ, payment_verifications:READ, payment_decisions:READ/INSERT | none detected | none | none |
| `listPaymentDecisions` | 8970 | payment_decisions:READ | getPayment | none | none |
| `getPaymentIdempotency` | 8976 | payment_idempotency_keys:READ | none detected | none | none |
| `insertPaymentIdempotency` | 8981 | payment_idempotency_keys:INSERT | getPaymentIdempotency | none | none |
| `updatePaymentIdempotencyProgress` | 8993 | payment_idempotency_keys:UPDATE | getPaymentIdempotency | none | none |
| `completePaymentIdempotency` | 9015 | payment_idempotency_keys:UPDATE | getPaymentIdempotency | none | none |
| `beginPaymentStatusQuery` | 9040 | payment_status_query_commands:READ/INSERT/UPDATE, payments:READ | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `markPaymentStatusQueryProviderStarted` | 9137 | payment_status_query_commands:UPDATE | none detected | none | none |
| `completePaymentStatusQuery` | 9164 | payment_status_query_commands:READ/UPDATE | none detected | none | none |
| `commitPaymentDecision` | 9205 | payment_idempotency_keys:READ/INSERT, payment_status_query_commands:READ, payments:READ/UPDATE, payment_verifications:READ, payment_evidence:READ, payment_intents:READ, payment_accounts:READ, marketplace_payment_allocations:READ/UPDATE, marketplace_seller_orders:READ, payment_decisions:INSERT, payment_ledger_entries:INSERT, marketplace_settlements:UPDATE | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `listPaymentAccounts` | 9633 | payment_accounts:READ | none detected | none | none |
| `createPaymentAccount` | 9644 | payment_accounts:INSERT | listPaymentAccounts | none | none |
| `createPayment` | 9661 | orders:READ, customers:READ, payment_accounts:READ, payments:READ/INSERT, payment_ledger_entries:INSERT | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `listPaymentRoutingPolicies` | 9717 | payment_routing_policies:READ | none detected | none | none |
| `upsertPaymentRoutingPolicy` | 9735 | payment_routing_policies:READ/INSERT/UPDATE | listPaymentRoutingPolicies | none | none |
| `getPaymentSettlementByIdempotencyKey` | 9764 | payment_settlements:READ | none detected | none | none |
| `createPaymentSettlement` | 9772 | payments:READ, payment_settlements:READ/INSERT | none detected | none | none |
| `finalizePaymentSettlement` | 9841 | payment_settlements:READ/UPDATE | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `listPaymentSettlements` | 9883 | payment_settlements:READ | none detected | none | none |
| `getPaymentRefunds` | 9918 | payment_refunds:READ | none detected | none | none |
| `getPaymentRefundByIdempotencyKey` | 9928 | payment_refunds:READ | none detected | none | none |
| `createPaymentRefundRequest` | 9936 | payments:READ, payment_refunds:READ/INSERT | none detected | none | none |
| `finalizePaymentRefund` | 9997 | payment_refunds:READ/UPDATE, payments:READ/UPDATE, marketplace_refunds:READ/UPDATE, marketplace_payment_allocations:READ/UPDATE, payment_ledger_entries:INSERT, marketplace_settlements:UPDATE | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `getPayment` | 10117 | payments:READ | none detected | none | none |
| `getOrderPaymentSummary` | 10123 | orders:READ, payment_refunds:READ, payments:READ | none detected | none | none |
| `listPayments` | 10174 | payments:READ | none detected | none | none |
| `transitionPayment` | 10185 | payments:READ/UPDATE, marketplace_payment_allocations:READ/UPDATE, marketplace_seller_orders:READ, payment_ledger_entries:INSERT, marketplace_settlements:UPDATE | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `listPaymentLedger` | 10228 | payment_ledger_entries:READ | getPayment | none | none |
| `recordPaymentReconciliation` | 10238 | payment_reconciliations:READ/INSERT | getPayment | none | none |
| `listPaymentReconciliations` | 10283 | payment_reconciliations:READ | getPayment | none | none |
| `reconcilePayment` | 10292 | payment_reconciliations:READ/INSERT | getPayment, transitionPayment | none | none |
| `getOrderFulfillment` | 10411 | fulfillments:READ | none detected | none | none |
| `selectDeliveryCourier` | 10487 | memberships:READ, membership_roles:READ, delivery_assignments:READ | none detected | none | none |
| `assignDeliveryCourier` | 10521 | fulfillments:READ/INSERT, orders:READ, tenants:READ, delivery_assignment_commands:READ/INSERT, delivery_assignments:READ/INSERT, memberships:READ, membership_roles:READ | getTenant, selectDeliveryCourier | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `listDeliveryAssignments` | 10683 | locations:READ, memberships:READ, membership_roles:READ, delivery_assignments:READ, fulfillments:READ, users:READ | getTenant | none | none |
| `getDeliveryAssignment` | 10784 | delivery_assignments:READ, fulfillments:READ, locations:READ, memberships:READ, membership_roles:READ | getTenant | none | none |
| `assertCourierOwnsDelivery` | 10846 | memberships:READ, membership_roles:READ | getTenant, getDeliveryAssignment | none | none |
| `createLogisticsSchedulingActivity` | 11105 | logistics_scheduling_activities:READ/INSERT | getTenant | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `getLogisticsSchedulingTimeZone` | 11237 | none detected | getTenant | none | none |
| `getLogisticsSchedulingActivity` | 11244 | logistics_scheduling_activities:READ | getTenant | none | none |
| `listLogisticsSchedulingActivities` | 11254 | logistics_scheduling_activities:READ | getTenant | none | none |
| `evaluateLogisticsSchedulingActivity` | 11289 | logistics_scheduling_activities:READ | getTenant | none | none |
| `transitionLogisticsSchedulingActivity` | 11362 | logistics_scheduling_activities:READ/UPDATE | getTenant | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `transitionDeliveryAssignment` | 11650 | tenants:READ, fulfillments:READ/UPDATE, orders:READ, delivery_assignment_commands:READ/INSERT, delivery_assignments:READ/INSERT/UPDATE, memberships:READ, membership_roles:READ, locations:READ | getTenant | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `transitionOrderFulfillment` | 11912 | users:READ, orders:READ, tenants:READ, fulfillment_commands:READ/INSERT, locations:READ, fulfillments:READ/INSERT/UPDATE, delivery_assignments:READ | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `coreFulfillmentContract` | 12144 | none detected | none detected | none | none |
| `getOrders` | 12164 | orders:READ | none detected | none | none |
| `saveQueuedOrders` | 12172 | orders:READ, payments:READ, tenants:READ, customers:READ | none detected | BEGIN, COMMIT, ROLLBACK | none |
| `pullNewOrders` | 12272 | orders:READ/UPDATE | none detected | BEGIN, COMMIT, ROLLBACK | none |
| `searchMarketplaceListings` | 12299 | catalog_products:READ, tenants:READ | none detected | none | none |
| `createMarketplaceOrder` | 12327 | catalog_products:READ, marketplace_checkout_idempotency:READ/INSERT, marketplace_orders:READ/INSERT/UPDATE, tenants:READ, locations:READ, inventory_movements:READ, marketplace_seller_orders:INSERT, marketplace_fulfillments:INSERT, marketplace_inventory_reservations:INSERT, marketplace_payment_allocations:INSERT, marketplace_settlements:INSERT | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `updateMarketplaceOrderStatus` | 12701 | orders:READ/UPDATE, marketplace_seller_orders:READ/UPDATE, catalog_products:READ, tenants:READ, locations:READ, inventory_movements:READ, marketplace_payment_allocations:READ/UPDATE, payments:READ, payment_refunds:READ/INSERT, marketplace_refunds:INSERT, marketplace_inventory_reservations:UPDATE, marketplace_settlements:UPDATE, marketplace_fulfillments:UPDATE, marketplace_orders:UPDATE | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `getMarketplaceOrderTracking` | 12904 | orders:READ, tenants:READ | getTenant | none | none |
| `getTelegramBuyerFulfillmentExperience` | 12929 | marketplace_orders:READ, marketplace_seller_orders:READ, orders:READ, fulfillments:READ, marketplace_fulfillments:READ | getTenant | none | none |
| `listTelegramBuyerOrders` | 12983 | marketplace_orders:READ, marketplace_seller_orders:READ | getTenant | none | none |
| `getTelegramBuyerServiceBookings` | 13017 | marketplace_orders:READ, marketplace_seller_orders:READ, orders:READ, service_bookings:READ, service_resource_commitments:READ, service_resources:READ | getTenant | none | none |
| `assessTelegramBuyerServiceFeasibility` | 13079 | organizations:READ, membership_roles:READ, memberships:READ, service_resources:READ, service_resource_availability:READ, locations:READ, service_bookings:READ, service_resource_commitments:READ | getTelegramBuyerServiceBookings, getTenant | none | none |
| `listAuditEvents` | 13217 | audit_events:READ | getTenant | none | none |
| `verifyAuditEventChain` | 13252 | audit_events:READ | getTenant | none | none |
| `createDatabaseBackup` | 13323 | none detected | none detected | none | none |
| `getOrCreateUserByTelegram` | 13346 | users:READ/INSERT/UPDATE | none detected | none | none |
| `listTenantMemberships` | 13360 | memberships:READ, users:READ, membership_roles:READ | none detected | none | none |
| `listUserMemberships` | 13380 | memberships:READ, tenants:READ | none detected | none | none |
| `assignMembershipContextualRole` | 13448 | tenants:READ, locations:READ, service_resources:READ, memberships:READ, membership_roles:READ/INSERT | none detected | none | none |
| `revokeMembershipContextualRole` | 13541 | memberships:READ, membership_roles:READ/UPDATE | none detected | none | none |
| `changeMembershipRole` | 13602 | memberships:READ/UPDATE, membership_roles:INSERT/UPDATE | none detected | none | none |
| `ensureMembership` | 13657 | none detected | none detected | none | none |
| `createTenantForUser` | 13661 | tenant_creation_requests:READ/INSERT, auth_challenges:READ/UPDATE, tenants:INSERT | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `createSession` | 13741 | memberships:READ, locations:READ, tenants:READ, membership_roles:READ, pack_lifecycle:READ, sessions:INSERT | none detected | none | none |
| `authenticateSessionToken` | 13776 | locations:READ, membership_roles:READ, pack_lifecycle:READ, sessions:READ, devices:READ/UPDATE, memberships:READ, tenants:READ | none detected | none | none |
| `recordAuditEvent` | 13906 | none detected | none detected | none | none |
| `getAuditRetentionPolicy` | 13925 | audit_retention_policies:READ | getTenant | none | none |
| `setAuditRetentionPolicy` | 13938 | audit_retention_policies:INSERT | getTenant, getAuditRetentionPolicy | none | none |
| `createComplianceRequest` | 13965 | customers:READ, locations:READ, compliance_requests:INSERT | getTenant, getComplianceRequest | none | none |
| `getComplianceRequest` | 14010 | compliance_requests:READ | getTenant | none | none |
| `listComplianceRequests` | 14023 | compliance_requests:READ | getTenant | none | none |
| `resolveComplianceRequest` | 14040 | compliance_requests:UPDATE | getTenant, getComplianceRequest | none | none |
| `buildComplianceExport` | 14073 | customers:READ, orders:READ, audit_events:READ, locations:READ | getTenant, listComplianceRequests, getAuditRetentionPolicy | none | none |
| `revokeSession` | 14157 | sessions:UPDATE | none detected | none | none |
| `listDevices` | 14169 | devices:READ, sessions:READ | none detected | none | none |
| `revokeDevice` | 14220 | memberships:READ, devices:READ/UPDATE, sessions:UPDATE | none detected | none | none |
| `createAuthChallenge` | 14236 | auth_challenges:INSERT | none detected | none | none |
| `getAuthChallengeForTenantCreation` | 14245 | auth_challenges:READ, tenant_creation_requests:READ | none detected | none | none |
| `consumeAuthChallenge` | 14258 | auth_challenges:READ/UPDATE | none detected | none | none |
| `createPairingChallenge` | 14267 | memberships:READ, pairing_challenges:INSERT | none detected | none | none |
| `consumePairingChallenge` | 14282 | pairing_challenges:READ/UPDATE, users:INSERT | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `createInvite` | 14310 | memberships:READ, invites:INSERT | none detected | none | none |
| `listInvites` | 14328 | invites:READ, users:READ | none detected | none | none |
| `revokeInvite` | 14345 | memberships:READ, invites:READ/UPDATE | none detected | none | none |
| `consumeInvite` | 14364 | invites:READ/UPDATE, memberships:READ/UPDATE, tenants:READ | none detected | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `createPaymentOperationalAction` | 14401 | payment_operational_actions:READ/INSERT | getPayment | none | none |
| `updatePaymentOperationalAction` | 14428 | payment_operational_actions:READ/UPDATE, payments:READ, tenants:READ | none detected | none | none |
| `listPaymentOperationalActions` | 14450 | payment_operational_actions:READ | getPayment | none | none |
| `recordPaymentProviderCapabilityEvidence` | 14465 | payment_provider_capability_certifications:READ/INSERT | none detected | none | none |
| `certifyPaymentProviderCapability` | 14521 | payment_provider_capability_certifications:READ/INSERT | none detected | none | none |
| `listPaymentProviderCapabilityEvidence` | 14591 | payment_provider_capability_certifications:READ | none detected | none | none |
| `recordPaymentProductionCertification` | 14626 | payment_production_certifications:READ/INSERT | none detected | none | none |
| `listPaymentProductionCertifications` | 14674 | payment_production_certifications:READ | none detected | none | none |
| `getDatabasePath` | 14704 | none detected | none detected | none | none |
| `getDatabaseForTests` | 14709 | none detected | none detected | none | none |
| `listRestaurantRecipes` | 14776 | restaurant_recipes:READ | getTenant | none | none |
| `createRestaurantRecipe` | 14786 | restaurant_recipes:READ/INSERT | getTenant | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |
| `updateRestaurantRecipe` | 14825 | restaurant_recipes:READ/UPDATE | getTenant | BEGIN IMMEDIATE, COMMIT, ROLLBACK | none |

## Transaction coupling signals

- **upsertSupplierNetworkCommercialTerms**: catalog_products, supplier_network_capabilities, supplier_network_commercial_terms; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none
- **upsertSupplierNetworkCatalogListing**: catalog_products, supplier_network_catalog_listings; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none
- **upsertSupplierNetworkProfile**: organizations, supplier_network_profiles; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none
- **allocateConfirmedOutboundPaymentToProcurementSettlement**: payment_outbound_intents, payment_procurement_settlement_allocations, payment_procurement_settlements; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls getProcurementSettlement
- **createProcurementDemand**: procurement_demands, procurement_demand_items; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls getProcurementDemand
- **updateProcurementDemand**: procurement_demands, procurement_demand_items; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls getProcurementDemand
- **createProcurementRfq**: procurement_rfqs, procurement_demand_items, procurement_rfq_items, procurement_rfq_suppliers; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls getProcurementDemand
- **transitionProcurementRfq**: procurement_rfqs, procurement_rfq_suppliers; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none
- **createProcurementRfqResponse**: procurement_rfqs, procurement_rfq_items, procurement_rfq_responses, organizations, procurement_rfq_response_items; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none
- **transitionProcurementRfqResponse**: procurement_rfq_responses, procurement_rfqs, organizations, procurement_rfq_response_items, procurement_rfq_suppliers; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none
- **refreshSupplierNetworkTrustEvidence**: procurement_supplier_participants, procurement_supplier_relationships, supplier_network_qualifications, supplier_network_performance_observations, supplier_network_trust_evidence; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls listSupplierNetworkTrustEvidence
- **recalculateSupplierNetworkPerformance**: procurement_supplier_participants, procurement_rfq_responses, procurement_rfq_suppliers, procurement_rfqs, purchase_orders, procurement_receipt_lines, procurement_receipts, purchase_order_items, supplier_network_performance_observations; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls listSupplierNetworkPerformance
- **createProcurementComparison**: procurement_rfqs, procurement_rfq_items, procurement_rfq_responses, organizations, procurement_comparisons, procurement_rfq_response_items, procurement_comparison_suppliers, procurement_comparison_line_offers; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none
- **createProcurementAward**: procurement_demands, procurement_rfqs, procurement_comparisons, procurement_comparison_line_offers, procurement_rfq_responses, procurement_rfq_items, procurement_awards, procurement_award_lines; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none
- **transitionProcurementAward**: procurement_awards, procurement_award_lines, procurement_demands; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none
- **createQuote**: customer_pricing_rules, quotes, quote_items; BEGIN, COMMIT, ROLLBACK; calls none
- **createPurchaseOrder**: purchase_orders, purchase_order_items; BEGIN, COMMIT, ROLLBACK; calls createPurchaseOrderFromProcurementAward
- **createProcurementReceipt**: purchase_orders, locations, purchase_order_items, procurement_receipt_lines, procurement_receipts, catalog_products; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls appendInventoryMovement
- **createPurchaseOrderFromProcurementAward**: procurement_awards, procurement_award_lines, procurement_rfq_items, purchase_orders, purchase_order_items; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none
- **createReceivable**: customer_credit_terms, orders, accounts_receivable, ar_ledger_entries; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls getReceivable
- **allocatePaymentToReceivable**: ar_payment_allocations, ar_ledger_entries, accounts_receivable; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls getReceivable, getPayment
- **createInvoice**: invoices, invoice_items; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls getReceivable, getInvoice
- **createServiceResource**: tenants, service_resource_commands, service_resources; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none
- **updateServiceResource**: tenants, service_resources, service_resource_commands, service_resource_commitments; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none
- **setServiceResourceAvailability**: tenants, service_resources, locations, organizations, service_resource_availability_commands, service_resource_availability, service_resource_commitments; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none
- **createServiceBooking**: tenants, orders, service_booking_commands, service_bookings; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls getTenant
- **transitionServiceBooking**: tenants, service_bookings, service_booking_commands, service_resources, orders, service_resource_availability, organizations, locations, service_resource_commitments; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls getTenant
- **recordServiceDeliveryAssessment**: orders, tenants, service_delivery_assessment_commands; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls getTenant
- **saveCatalog**: catalog_products, tenants, inventory_movements, orders; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none
- **createPaymentWithIntent**: orders, customers, payment_accounts, payment_idempotency_keys, payments, payment_intents, payment_refunds, payment_ledger_entries; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none
- **beginPaymentStatusQuery**: payment_status_query_commands, payments; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none
- **commitPaymentDecision**: payment_idempotency_keys, payment_status_query_commands, payments, payment_verifications, payment_evidence, payment_intents, payment_accounts, marketplace_payment_allocations, marketplace_seller_orders, payment_decisions, payment_ledger_entries, marketplace_settlements; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none
- **createPayment**: orders, customers, payment_accounts, payments, payment_ledger_entries; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none
- **finalizePaymentRefund**: payment_refunds, payments, marketplace_refunds, marketplace_payment_allocations, payment_ledger_entries, marketplace_settlements; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none
- **transitionPayment**: payments, marketplace_payment_allocations, marketplace_seller_orders, payment_ledger_entries, marketplace_settlements; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none
- **assignDeliveryCourier**: fulfillments, orders, tenants, delivery_assignment_commands, delivery_assignments, memberships, membership_roles; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls getTenant, selectDeliveryCourier
- **transitionDeliveryAssignment**: tenants, fulfillments, orders, delivery_assignment_commands, delivery_assignments, memberships, membership_roles, locations; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls getTenant
- **transitionOrderFulfillment**: users, orders, tenants, fulfillment_commands, locations, fulfillments, delivery_assignments; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none
- **saveQueuedOrders**: orders, payments, tenants, customers; BEGIN, COMMIT, ROLLBACK; calls none
- **createMarketplaceOrder**: catalog_products, marketplace_checkout_idempotency, marketplace_orders, tenants, locations, inventory_movements, marketplace_seller_orders, marketplace_fulfillments, marketplace_inventory_reservations, marketplace_payment_allocations, marketplace_settlements; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none
- **updateMarketplaceOrderStatus**: orders, marketplace_seller_orders, catalog_products, tenants, locations, inventory_movements, marketplace_payment_allocations, payments, payment_refunds, marketplace_refunds, marketplace_inventory_reservations, marketplace_settlements, marketplace_fulfillments, marketplace_orders; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none
- **createTenantForUser**: tenant_creation_requests, auth_challenges, tenants; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none
- **consumePairingChallenge**: pairing_challenges, users; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none
- **consumeInvite**: invites, memberships, tenants; BEGIN IMMEDIATE, COMMIT, ROLLBACK; calls none

## Single-table review candidates (not extraction approvals)

- `getPackLifecycle` → `pack_lifecycle`
- `listSupplierNetworkQualifications` → `supplier_network_qualifications`
- `transitionSupplierNetworkQualification` → `supplier_network_qualifications`
- `listSupplierNetworkCommercialTerms` → `supplier_network_commercial_terms`
- `transitionSupplierNetworkCommercialTerms` → `supplier_network_commercial_terms`
- `listSupplierNetworkCapacities` → `supplier_network_capacity_signals`
- `transitionSupplierNetworkCapacity` → `supplier_network_capacity_signals`
- `listSupplierNetworkServiceAreas` → `supplier_network_service_areas`
- `transitionSupplierNetworkServiceArea` → `supplier_network_service_areas`
- `listSupplierNetworkCatalogListings` → `supplier_network_catalog_listings`
- `transitionSupplierNetworkCatalogListing` → `supplier_network_catalog_listings`
- `listSupplierNetworkCapabilities` → `supplier_network_capabilities`
- `transitionSupplierNetworkCapability` → `supplier_network_capabilities`
- `transitionSupplierNetworkProfile` → `supplier_network_profiles`
- `listPaymentOutboundIntents` → `payment_outbound_intents`
- `getPaymentOutboundIntent` → `payment_outbound_intents`
- `transitionPaymentOutboundIntent` → `payment_outbound_intents`
- `listProcurementRfqs` → `procurement_rfqs`
- `getSupplierNetworkTrustEvidence` → `supplier_network_trust_evidence`
- `listProcurementComparisons` → `procurement_comparisons`
- `listProcurementAwards` → `procurement_awards`
- `listCustomerPricing` → `customer_pricing_rules`
- `getCustomerPricing` → `customer_pricing_rules`
- `listQuotes` → `quotes`
- `transitionQuote` → `quotes`
- `getCreditTerms` → `customer_credit_terms`
- `listCreditTerms` → `customer_credit_terms`
- `listPurchaseOrders` → `purchase_orders`
- `listProcurementReceipts` → `procurement_receipts`
- `transitionPurchaseOrder` → `purchase_orders`
- `getReceivable` → `accounts_receivable`
- `listReceivables` → `accounts_receivable`
- `getInvoice` → `invoices`
- `listInvoices` → `invoices`
- `listOrganizationLocations` → `locations`
- `getOrganizationLocation` → `locations`
- `createOrganizationLocation` → `locations`
- `updateOrganizationLocation` → `locations`
- `listServiceResources` → `service_resources`
- `getOrCreateTenant` → `tenants`
- `getTenant` → `tenants`
- `getTenantByApiKey` → `tenants`
- `listTenants` → `tenants`
- `getCatalog` → `catalog_products`
- `getPaymentIntent` → `payment_intents`
- `updatePaymentConfirmationAttempt` → `payment_confirmation_attempts`
- `getPaymentConfirmationAttempt` → `payment_confirmation_attempts`
- `getPaymentIdempotency` → `payment_idempotency_keys`
- `markPaymentStatusQueryProviderStarted` → `payment_status_query_commands`
- `completePaymentStatusQuery` → `payment_status_query_commands`
- `listPaymentAccounts` → `payment_accounts`
- `listPaymentRoutingPolicies` → `payment_routing_policies`
- `getPaymentSettlementByIdempotencyKey` → `payment_settlements`
- `listPaymentSettlements` → `payment_settlements`
- `getPaymentRefunds` → `payment_refunds`
- `getPaymentRefundByIdempotencyKey` → `payment_refunds`
- `getPayment` → `payments`
- `listPayments` → `payments`
- `getOrderFulfillment` → `fulfillments`
- `getOrders` → `orders`
- `getOrCreateUserByTelegram` → `users`
- `revokeSession` → `sessions`
- `createAuthChallenge` → `auth_challenges`
- `consumeAuthChallenge` → `auth_challenges`
- `recordPaymentProviderCapabilityEvidence` → `payment_provider_capability_certifications`
- `certifyPaymentProviderCapability` → `payment_provider_capability_certifications`
- `listPaymentProviderCapabilityEvidence` → `payment_provider_capability_certifications`
- `recordPaymentProductionCertification` → `payment_production_certifications`
- `listPaymentProductionCertifications` → `payment_production_certifications`

## Indexes

| Name | Table | Unique | Line |
|---|---|---|---:|
| `idx_catalog_marketplace` | `catalog_products` | false | 326 |
| `idx_orders_tenant_created` | `orders` | false | 342 |
| `idx_orders_undelivered` | `orders` | false | 344 |
| `idx_orders_marketplace` | `orders` | false | 346 |
| `idx_audit_tenant_created` | `audit_events` | false | 364 |
| `idx_memberships_user` | `memberships` | false | 388 |
| `idx_memberships_tenant` | `memberships` | false | 389 |
| `idx_devices_tenant` | `devices` | false | 399 |
| `idx_sessions_hash` | `sessions` | false | 408 |
| `idx_sessions_device` | `sessions` | false | 409 |
| `idx_pairing_challenges_tenant` | `pairing_challenges` | false | 426 |
| `idx_pairing_challenges_tenant` | `pairing_challenges` | false | 442 |
| `idx_invites_tenant` | `invites` | false | 460 |
| `idx_locations_org` | `locations` | false | 495 |
| `idx_channel_identities_org` | `channel_identities` | false | 507 |
| `idx_tenants_organization` | `tenants` | false | 510 |
| `idx_audit_organization_created` | `audit_events` | false | 513 |
| `idx_locations_org_code` | `locations` | false | 572 |
| `idx_locations_org_type` | `locations` | false | 573 |
| `idx_customers_org_updated` | `customers` | false | 602 |
| `idx_customers_org_phone` | `customers` | false | 604 |
| `idx_customers_org_name` | `customers` | false | 606 |
| `idx_orders_customer` | `orders` | false | 609 |
| `idx_inventory_movements_org_product_time` | `inventory_movements` | false | 639 |
| `idx_inventory_movements_location_product_time` | `inventory_movements` | false | 641 |
| `idx_inventory_movements_reference` | `inventory_movements` | false | 643 |
| `idx_sync_events_org_time` | `sync_events` | false | 665 |
| `idx_sync_events_org_type` | `sync_events` | false | 666 |
| `idx_audit_org_time` | `audit_events` | false | 683 |
| `idx_audit_actor_time` | `audit_events` | false | 685 |
| `idx_audit_entity_time` | `audit_events` | false | 687 |
| `idx_compliance_requests_org_status` | `compliance_requests` | false | 711 |
| `idx_compliance_requests_subject` | `compliance_requests` | false | 713 |
| `idx_catalog_currency` | `catalog_products` | false | 759 |
| `idx_orders_currency` | `orders` | false | 761 |
| `idx_payment_accounts_org` | `payment_accounts` | false | 787 |
| `idx_payments_org_created` | `payments` | false | 814 |
| `idx_payments_order` | `payments` | false | 816 |
| `idx_payments_state` | `payments` | false | 818 |
| `uq_payments_external_reference` | `payments` | true | 820 |
| `idx_payment_ledger_payment` | `payment_ledger_entries` | false | 838 |
| `idx_payment_reconciliation_org` | `payment_reconciliations` | false | 854 |
| `idx_customer_pricing_org_customer` | `customer_pricing_rules` | false | 889 |
| `idx_customer_pricing_org_product` | `customer_pricing_rules` | false | 891 |
| `idx_quotes_org_customer` | `quotes` | false | 935 |
| `idx_quotes_org_status` | `quotes` | false | 937 |
| `idx_quote_items_quote` | `quote_items` | false | 939 |
| `idx_purchase_orders_org_customer` | `purchase_orders` | false | 986 |
| `idx_purchase_orders_org_status` | `purchase_orders` | false | 988 |
| `idx_purchase_order_items_order` | `purchase_order_items` | false | 990 |
| `idx_credit_terms_org_status` | `customer_credit_terms` | false | 1032 |
| `idx_credit_terms_org_customer` | `customer_credit_terms` | false | 1034 |
| `idx_ar_org_status` | `accounts_receivable` | false | 1062 |
| `idx_ar_org_customer` | `accounts_receivable` | false | 1064 |
| `idx_ar_ledger_receivable` | `ar_ledger_entries` | false | 1082 |
| `idx_ar_alloc_payment` | `ar_payment_allocations` | false | 1096 |
| `idx_invoices_org_status` | `invoices` | false | 1131 |
| `idx_invoices_org_customer` | `invoices` | false | 1132 |
| `idx_invoice_items_invoice` | `invoice_items` | false | 1144 |
| `uq_marketplace_orders_idempotency` | `marketplace_orders` | true | 1167 |
| `idx_marketplace_orders_buyer` | `marketplace_orders` | false | 1170 |
| `idx_marketplace_orders_status` | `marketplace_orders` | false | 1172 |
| `idx_marketplace_seller_orders_seller` | `marketplace_seller_orders` | false | 1189 |
| `idx_marketplace_fulfillments_order` | `marketplace_fulfillments` | false | 1202 |
| `idx_marketplace_reservations_product` | `marketplace_inventory_reservations` | false | 1217 |
| `idx_marketplace_payment_allocations_order` | `marketplace_payment_allocations` | false | 1233 |
| `idx_marketplace_settlements_org_status` | `marketplace_settlements` | false | 1248 |
| `idx_marketplace_refunds_order` | `marketplace_refunds` | false | 1264 |
| `idx_marketplace_checkout_idem_buyer` | `marketplace_checkout_idempotency` | false | 1276 |
| `idx_procurement_demands_org_status` | `procurement_demands` | false | 1314 |
| `idx_procurement_demands_requester` | `procurement_demands` | false | 1316 |
| `idx_procurement_demands_source` | `procurement_demands` | false | 1318 |
| `idx_procurement_demand_items_demand` | `procurement_demand_items` | false | 1336 |
| `idx_procurement_demand_items_product` | `procurement_demand_items` | false | 1338 |
| `idx_procurement_supplier_discovery` | `procurement_supplier_participants` | false | 1378 |
| `idx_procurement_supplier_relationships_buyer` | `procurement_supplier_relationships` | false | 1393 |
| `idx_procurement_supplier_relationships_supplier` | `procurement_supplier_relationships` | false | 1394 |
| `idx_procurement_rfqs_org_status` | `procurement_rfqs` | false | 1427 |
| `idx_procurement_rfqs_demand` | `procurement_rfqs` | false | 1428 |
| `idx_procurement_rfq_items_rfq` | `procurement_rfq_items` | false | 1445 |
| `idx_procurement_rfq_suppliers_supplier` | `procurement_rfq_suppliers` | false | 1457 |
| `idx_procurement_rfq_responses_rfq` | `procurement_rfq_responses` | false | 1480 |
| `idx_procurement_rfq_responses_supplier` | `procurement_rfq_responses` | false | 1481 |
| `idx_procurement_rfq_response_items_response` | `procurement_rfq_response_items` | false | 1496 |
| `idx_procurement_comparisons_rfq` | `procurement_comparisons` | false | 1535 |
| `idx_procurement_comparison_suppliers_rank` | `procurement_comparison_suppliers` | false | 1556 |
| `idx_procurement_comparison_lines_comparison` | `procurement_comparison_line_offers` | false | 1575 |
| `idx_procurement_awards_org_status` | `procurement_awards` | false | 1608 |
| `idx_procurement_awards_demand` | `procurement_awards` | false | 1610 |
| `idx_procurement_award_lines_award` | `procurement_award_lines` | false | 1629 |
| `idx_purchase_orders_org_customer` | `purchase_orders` | false | 1696 |
| `idx_purchase_orders_org_supplier` | `purchase_orders` | false | 1697 |
| `idx_purchase_orders_org_status` | `purchase_orders` | false | 1698 |
| `idx_purchase_orders_org_source` | `purchase_orders` | false | 1699 |
| `idx_purchase_order_items_order` | `purchase_order_items` | false | 1700 |
| `idx_procurement_receipts_po` | `procurement_receipts` | false | 1740 |
| `idx_procurement_receipt_lines_receipt` | `procurement_receipt_lines` | false | 1753 |
| `idx_payment_outbound_org_state` | `payment_outbound_intents` | false | 1792 |
| `idx_payment_outbound_po` | `payment_outbound_intents` | false | 1793 |
| `idx_payment_outbound_counterparty` | `payment_outbound_intents` | false | 1794 |
| `idx_payment_procurement_settlements_org_status` | `payment_procurement_settlements` | false | 1825 |
| `idx_payment_procurement_settlement_allocations_settlement` | `payment_procurement_settlement_allocations` | false | 1837 |
| `idx_payment_procurement_settlement_allocations_intent` | `payment_procurement_settlement_allocations` | false | 1839 |
| `idx_supplier_network_profiles_visibility_status` | `supplier_network_profiles` | false | 1878 |
| `idx_supplier_network_catalog_org_status` | `supplier_network_catalog_listings` | false | 1912 |
| `idx_supplier_network_catalog_product` | `supplier_network_catalog_listings` | false | 1914 |
| `idx_supplier_network_capacity_org_status` | `supplier_network_capacity_signals` | false | 1946 |
| `idx_supplier_network_capacity_discovery` | `supplier_network_capacity_signals` | false | 1948 |
| `idx_supplier_network_commercial_org_status` | `supplier_network_commercial_terms` | false | 1983 |
| `idx_supplier_network_commercial_discovery` | `supplier_network_commercial_terms` | false | 1985 |
| `uq_supplier_network_commercial_network` | `supplier_network_commercial_terms` | true | 1987 |
| `idx_supplier_network_qualification_org_status` | `supplier_network_qualifications` | false | 2017 |
| `idx_supplier_network_qualification_discovery` | `supplier_network_qualifications` | false | 2019 |
| `uq_supplier_network_qualification_reference` | `supplier_network_qualifications` | true | 2021 |
| `idx_supplier_network_performance_supplier_metric` | `supplier_network_performance_observations` | false | 2048 |
| `idx_supplier_network_performance_visibility` | `supplier_network_performance_observations` | false | 2050 |
| `idx_supplier_network_trust_supplier_type` | `supplier_network_trust_evidence` | false | 2082 |
| `idx_supplier_network_trust_visibility` | `supplier_network_trust_evidence` | false | 2084 |
| `uq_supplier_network_trust_source` | `supplier_network_trust_evidence` | true | 2086 |
| `idx_marketplace_payment_allocations_order` | `marketplace_payment_allocations` | false | 2124 |
| `idx_telegram_storefront_status` | `telegram_storefront_configs` | false | 2148 |
| `idx_pack_lifecycle_org_state` | `pack_lifecycle` | false | 2182 |
| `idx_pack_lifecycle_pack` | `pack_lifecycle` | false | 2184 |
| `idx_fulfillments_org_status` | `fulfillments` | false | 2213 |
| `idx_fulfillments_location_status` | `fulfillments` | false | 2215 |
| `idx_delivery_assignments_courier` | `delivery_assignments` | false | 2239 |
| `idx_delivery_assignments_org` | `delivery_assignments` | false | 2241 |
| `idx_delivery_assignments_courier` | `delivery_assignments` | false | 2274 |
| `idx_delivery_assignments_org` | `delivery_assignments` | false | 2276 |
| `idx_delivery_assignments_active_fulfillment` | `delivery_assignments` | true | 2278 |
| `idx_payment_intents_org_created` | `payment_intents` | false | 2308 |
| `idx_payment_intents_org_order` | `payment_intents` | false | 2309 |
| `idx_payment_intents_org_status` | `payment_intents` | false | 2310 |
| `idx_payment_evidence_org_provider_fingerprint` | `payment_evidence` | true | 2334 |
| `idx_payment_evidence_org_provider_transaction` | `payment_evidence` | true | 2335 |
| `idx_payment_evidence_payment` | `payment_evidence` | false | 2336 |
| `idx_payment_evidence_intent` | `payment_evidence` | false | 2337 |
| `idx_payment_evidence_org_status` | `payment_evidence` | false | 2338 |
| `idx_payment_evidence_external_reference` | `payment_evidence` | false | 2339 |
| `idx_payment_verifications_payment` | `payment_verifications` | false | 2363 |
| `idx_payment_verifications_evidence` | `payment_verifications` | false | 2364 |
| `idx_payment_verifications_intent` | `payment_verifications` | false | 2365 |
| `idx_payment_verifications_org_result` | `payment_verifications` | false | 2366 |
| `idx_payment_decisions_payment` | `payment_decisions` | false | 2383 |
| `idx_payment_decisions_evidence` | `payment_decisions` | false | 2384 |
| `idx_payment_decisions_verification` | `payment_decisions` | false | 2385 |
| `idx_payment_decisions_org_created` | `payment_decisions` | false | 2386 |
| `idx_payment_idempotency_expiry` | `payment_idempotency_keys` | false | 2402 |
| `idx_payment_confirmation_attempts_org_status` | `payment_confirmation_attempts` | false | 2440 |
| `idx_payment_confirmation_attempts_evidence` | `payment_confirmation_attempts` | false | 2441 |
| `idx_payment_confirmation_attempts_intent` | `payment_confirmation_attempts` | false | 2442 |
| `uq_payment_confirmation_attempts_provider_tx` | `payment_confirmation_attempts` | true | 2443 |
| `idx_payment_status_query_commands_payment` | `payment_status_query_commands` | false | 2465 |
| `idx_payment_ledger_decision` | `payment_ledger_entries` | false | 2533 |
| `idx_fulfillment_commands_order` | `fulfillment_commands` | false | 2560 |
| `idx_delivery_assignment_commands_order` | `delivery_assignment_commands` | false | 2597 |
| `idx_service_delivery_assessment_commands_order` | `service_delivery_assessment_commands` | false | 2614 |
| `idx_service_bookings_order` | `service_bookings` | false | 2666 |
| `idx_service_booking_commands_booking` | `service_booking_commands` | false | 2677 |
| `uq_payment_evidence_notification` | `payment_evidence` | true | 2758 |
| `idx_payment_evidence_auth_reference` | `payment_evidence` | false | 2761 |
| `idx_payments_payment_intent` | `payments` | false | 2775 |
| `idx_payment_routing_policy_match` | `payment_routing_policies` | false | 2798 |
| `uq_payment_operational_idempotency` | `payment_operational_actions` | true | 2825 |
| `idx_payment_operational_payment` | `payment_operational_actions` | false | 2828 |
| `idx_payment_operational_status` | `payment_operational_actions` | false | 2830 |
| `idx_payment_production_certifications` | `payment_production_certifications` | false | 2858 |
| `idx_payment_provider_capability_certification` | `payment_provider_capability_certifications` | false | 2889 |
| `idx_payment_verifications_evidence_verifier` | `payment_verifications` | true | 2900 |
| `idx_audit_lineage` | `audit_events` | false | 2923 |
| `uq_payment_verifications_provider_transaction` | `payment_verifications` | true | 2934 |
| `idx_payment_verifications_provider_transaction` | `payment_verifications` | false | 2937 |
| `idx_payment_settlements_payment` | `payment_settlements` | false | 2973 |
| `idx_payment_settlements_org_status` | `payment_settlements` | false | 2975 |
| `idx_payment_settlements_provider_reference` | `payment_settlements` | false | 2977 |
| `idx_payment_refunds_payment` | `payment_refunds` | false | 3011 |
| `idx_payment_refunds_org_status` | `payment_refunds` | false | 3013 |
| `idx_payment_refunds_provider` | `payment_refunds` | false | 3015 |
| `idx_payments_org_created` | `payments` | false | 3063 |
| `idx_payments_order` | `payments` | false | 3064 |
| `idx_payments_state` | `payments` | false | 3065 |
| `idx_payments_payment_intent` | `payments` | false | 3066 |
| `uq_payments_external_reference` | `payments` | true | 3067 |
| `idx_payment_ledger_payment` | `payment_ledger_entries` | false | 3096 |
| `idx_payment_reconciliation_payment_created` | `payment_reconciliations` | false | 3124 |
| `idx_payment_reconciliation_fingerprint` | `payment_reconciliations` | false | 3125 |
| `idx_membership_roles_membership` | `membership_roles` | false | 3148 |
| `idx_membership_roles_scope` | `membership_roles` | false | 3150 |
| `idx_supplier_network_service_areas_org_status` | `supplier_network_service_areas` | false | 3192 |
| `idx_supplier_network_service_areas_discovery` | `supplier_network_service_areas` | false | 3194 |
| `idx_supplier_network_capabilities_org_status` | `supplier_network_capabilities` | false | 3222 |
| `idx_supplier_network_capabilities_discovery` | `supplier_network_capabilities` | false | 3224 |
| `idx_logistics_scheduling_org_status` | `logistics_scheduling_activities` | false | 3269 |
| `idx_logistics_scheduling_org_location` | `logistics_scheduling_activities` | false | 3271 |
| `idx_logistics_scheduling_order` | `logistics_scheduling_activities` | false | 3273 |
| `idx_logistics_scheduling_fulfillment` | `logistics_scheduling_activities` | false | 3275 |
| `idx_tenant_creation_requests_user` | `tenant_creation_requests` | false | 3309 |
| `idx_service_resources_org_status` | `service_resources` | false | 3336 |
| `idx_service_resources_service` | `service_resources` | false | 3338 |
| `idx_service_resource_commands_resource` | `service_resource_commands` | false | 3349 |
| `idx_service_resource_availability_org` | `service_resource_availability` | false | 3369 |
| `idx_service_resource_commitments_overlap` | `service_resource_commitments` | false | 3408 |
| `idx_service_resource_commitments_overlap` | `service_resource_commitments` | false | 3454 |
| `idx_service_bookings_resource_window` | `service_bookings` | false | 3456 |
| `idx_restaurant_recipes_org_status` | `restaurant_recipes` | false | 3577 |
| `idx_restaurant_recipes_chat_updated` | `restaurant_recipes` | false | 3579 |

## Foreign-key references

- `tenants(chat_id)` at line 317
- `tenants(chat_id)` at line 330
- `tenants(chat_id)` at line 351
- `users(id)` at line 381
- `tenants(chat_id)` at line 382
- `users(id)` at line 392
- `tenants(chat_id)` at line 393
- `devices(id)` at line 402
- `users(id)` at line 412
- `tenants(chat_id)` at line 419
- `users(id)` at line 420
- `tenants(chat_id)` at line 435
- `users(id)` at line 436
- `tenants(chat_id)` at line 451
- `users(id)` at line 452
- `users(id)` at line 457
- `organizations(id)` at line 487
- `organizations(id)` at line 499
- `organizations(id)` at line 509
- `organizations(id)` at line 512
- `organizations(id)` at line 587
- `locations(id)` at line 588
- `customers(id)` at line 608
- `organizations(id)` at line 625
- `locations(id)` at line 626
- `organizations(id)` at line 691
- `organizations(id)` at line 699
- `locations(id)` at line 700
- `organizations(id)` at line 778
- `organizations(id)` at line 792
- `locations(id)` at line 793
- `payment_accounts(id)` at line 796
- `payments(id)` at line 826
- `organizations(id)` at line 827
- `payments(id)` at line 843
- `organizations(id)` at line 844
- `organizations(id)` at line 875
- `customers(id)` at line 876
- `organizations(id)` at line 904
- `customers(id)` at line 905
- `quotes(id)` at line 925
- `organizations(id)` at line 952
- `customers(id)` at line 953
- `quotes(id)` at line 954
- `purchase_orders(id)` at line 976
- `organizations(id)` at line 1010
- `customers(id)` at line 1011
- `organizations(id)` at line 1045
- `locations(id)` at line 1046
- `customers(id)` at line 1047
- `customer_credit_terms(id)` at line 1048
- `accounts_receivable(id)` at line 1069
- `organizations(id)` at line 1070
- `payments(id)` at line 1076
- `accounts_receivable(id)` at line 1087
- `payments(id)` at line 1088
- `organizations(id)` at line 1089
- `organizations(id)` at line 1113
- `locations(id)` at line 1114
- `customers(id)` at line 1115
- `accounts_receivable(id)` at line 1116
- `invoices(id)` at line 1135
- `marketplace_orders(id)` at line 1177
- `tenants(chat_id)` at line 1178
- `organizations(id)` at line 1180
- `marketplace_seller_orders(id)` at line 1194
- `marketplace_orders(id)` at line 1207
- `marketplace_seller_orders(id)` at line 1208
- `tenants(chat_id)` at line 1209
- `marketplace_orders(id)` at line 1222
- `marketplace_seller_orders(id)` at line 1223
- `payments(id)` at line 1224
- `organizations(id)` at line 1225
- `marketplace_orders(id)` at line 1238
- `marketplace_seller_orders(id)` at line 1239
- `organizations(id)` at line 1240
- `marketplace_orders(id)` at line 1253
- `marketplace_seller_orders(id)` at line 1254
- `payments(id)` at line 1255
- `organizations(id)` at line 1256
- `marketplace_orders(id)` at line 1273
- `organizations(id)` at line 1290
- `users(id)` at line 1292
- `locations(id)` at line 1296
- `users(id)` at line 1304
- `users(id)` at line 1305
- `procurement_demands(id)` at line 1323
- `organizations(id)` at line 1370
- `users(id)` at line 1373
- `users(id)` at line 1374
- `organizations(id)` at line 1381
- `organizations(id)` at line 1382
- `users(id)` at line 1386
- `users(id)` at line 1387
- `organizations(id)` at line 1406
- `procurement_demands(id)` at line 1407
- `users(id)` at line 1415
- `users(id)` at line 1416
- `procurement_rfqs(id)` at line 1432
- `procurement_demand_items(id)` at line 1433
- `procurement_rfqs(id)` at line 1449
- `organizations(id)` at line 1450
- `procurement_rfqs(id)` at line 1461
- `organizations(id)` at line 1462
- `users(id)` at line 1472
- `users(id)` at line 1473
- `procurement_rfq_responses(id)` at line 1485
- `procurement_rfq_items(id)` at line 1486
- `organizations(id)` at line 1525
- `procurement_rfqs(id)` at line 1526
- `users(id)` at line 1531
- `procurement_comparisons(id)` at line 1538
- `organizations(id)` at line 1539
- `procurement_rfq_responses(id)` at line 1540
- `procurement_comparisons(id)` at line 1559
- `organizations(id)` at line 1560
- `procurement_rfq_responses(id)` at line 1561
- `procurement_rfq_items(id)` at line 1562
- `organizations(id)` at line 1588
- `procurement_demands(id)` at line 1589
- `procurement_rfqs(id)` at line 1590
- `procurement_comparisons(id)` at line 1591
- `users(id)` at line 1598
- `users(id)` at line 1599
- `procurement_awards(id)` at line 1614
- `procurement_rfq_items(id)` at line 1615
- `organizations(id)` at line 1616
- `procurement_rfq_responses(id)` at line 1617
- `procurement_comparison_line_offers(id)` at line 1618
- `organizations(id)` at line 1658
- `customers(id)` at line 1659
- `quotes(id)` at line 1660
- `procurement_awards(id)` at line 1661
- `organizations(id)` at line 1662
- `organizations(id)` at line 1724
- `purchase_orders(id)` at line 1725
- `locations(id)` at line 1726
- `users(id)` at line 1733
- `procurement_receipts(id)` at line 1744
- `purchase_order_items(id)` at line 1745
- `organizations(id)` at line 1779
- `organizations(id)` at line 1780
- `purchase_orders(id)` at line 1781
- `users(id)` at line 1787
- `organizations(id)` at line 1813
- `purchase_orders(id)` at line 1814
- `organizations(id)` at line 1815
- `users(id)` at line 1819
- `payment_procurement_settlements(id)` at line 1829
- `payment_outbound_intents(id)` at line 1830
- `users(id)` at line 1833
- `organizations(id)` at line 1861
- `users(id)` at line 1872
- `users(id)` at line 1873
- `organizations(id)` at line 1892
- `users(id)` at line 1905
- `users(id)` at line 1906
- `organizations(id)` at line 1926
- `users(id)` at line 1939
- `users(id)` at line 1940
- `organizations(id)` at line 1961
- `users(id)` at line 1976
- `users(id)` at line 1977
- `organizations(id)` at line 1998
- `users(id)` at line 2007
- `users(id)` at line 2011
- `users(id)` at line 2012
- `organizations(id)` at line 2034
- `users(id)` at line 2045
- `organizations(id)` at line 2068
- `users(id)` at line 2079
- `marketplace_orders(id)` at line 2108
- `marketplace_seller_orders(id)` at line 2109
- `payments(id)` at line 2110
- `organizations(id)` at line 2111
- `organizations(id)` at line 2133
- `users(id)` at line 2142
- `users(id)` at line 2143
- `organizations(id)` at line 2163
- `users(id)` at line 2175
- `users(id)` at line 2176
- `orders(server_order_id)` at line 2197
- `organizations(id)` at line 2198
- `locations(id)` at line 2199
- `users(id)` at line 2207
- `users(id)` at line 2208
- `fulfillments(id)` at line 2226
- `organizations(id)` at line 2227
- `locations(id)` at line 2228
- `users(id)` at line 2229
- `users(id)` at line 2232
- `fulfillments(id)` at line 2256
- `organizations(id)` at line 2257
- `locations(id)` at line 2258
- `users(id)` at line 2259
- `users(id)` at line 2262
- `organizations(id)` at line 2292
- `locations(id)` at line 2293
- `payment_accounts(id)` at line 2295
- `users(id)` at line 2304
- `organizations(id)` at line 2314
- `locations(id)` at line 2315
- `payments(id)` at line 2316
- `payment_intents(id)` at line 2317
- `users(id)` at line 2329
- `organizations(id)` at line 2343
- `payments(id)` at line 2344
- `payment_intents(id)` at line 2345
- `payment_evidence(id)` at line 2346
- `organizations(id)` at line 2370
- `payments(id)` at line 2371
- `payment_intents(id)` at line 2372
- `payment_evidence(id)` at line 2373
- `payment_verifications(id)` at line 2374
- `users(id)` at line 2380
- `organizations(id)` at line 2390
- `payment_accounts(id)` at line 2411
- `organizations(id)` at line 2422
- `payments(id)` at line 2423
- `payment_intents(id)` at line 2424
- `payment_evidence(id)` at line 2425
- `payment_accounts(id)` at line 2426
- `organizations(id)` at line 2454
- `payments(id)` at line 2455
- `payment_decisions(id)` at line 2531
- `organizations(id)` at line 2552
- `orders(server_order_id)` at line 2554
- `organizations(id)` at line 2589
- `organizations(id)` at line 2607
- `organizations(id)` at line 2654
- `tenants(chat_id)` at line 2655
- `organizations(id)` at line 2669
- `service_bookings(id)` at line 2671
- `payment_intents(id)` at line 2773
- `organizations(id)` at line 2784
- `locations(id)` at line 2791
- `organizations(id)` at line 2809
- `payments(id)` at line 2810
- `users(id)` at line 2820
- `organizations(id)` at line 2843
- `users(id)` at line 2851
- `organizations(id)` at line 2873
- `users(id)` at line 2884
- `organizations(id)` at line 2951
- `payments(id)` at line 2952
- `organizations(id)` at line 2990
- `payments(id)` at line 2991
- `payment_intents(id)` at line 2992
- `organizations(id)` at line 3032
- `locations(id)` at line 3033
- `payment_accounts(id)` at line 3036
- `payment_intents(id)` at line 3053
- `payments(id)` at line 3073
- `organizations(id)` at line 3074
- `payment_decisions(id)` at line 3084
- `memberships(id)` at line 3138
- `organizations(id)` at line 3174
- `users(id)` at line 3185
- `users(id)` at line 3186
- `organizations(id)` at line 3206
- `users(id)` at line 3215
- `users(id)` at line 3216
- `organizations(id)` at line 3238
- `locations(id)` at line 3239
- `fulfillments(id)` at line 3250
- `users(id)` at line 3258
- `users(id)` at line 3260
- `users(id)` at line 3261
- `tenants(chat_id)` at line 3286
- `users(id)` at line 3290
- `auth_challenges(token_hash)` at line 3302
- `users(id)` at line 3303
- `tenants(chat_id)` at line 3304
- `organizations(id)` at line 3321
- `tenants(chat_id)` at line 3322
- `organizations(id)` at line 3341
- `service_resources(id)` at line 3343
- `service_resources(id)` at line 3359
- `organizations(id)` at line 3360
- `tenants(chat_id)` at line 3361
- `organizations(id)` at line 3372
- `service_resources(id)` at line 3374
- `organizations(id)` at line 3396
- `tenants(chat_id)` at line 3397
- `service_resources(id)` at line 3398
- `service_bookings(id)` at line 3399
- `organizations(id)` at line 3442
- `tenants(chat_id)` at line 3443
- `service_resources(id)` at line 3444
- `service_bookings(id)` at line 3445
- `organizations(id)` at line 3560
- `tenants(chat_id)` at line 3561

## Migration guards

- Version 1, line 304
- Version 2, line 370
- Version 3, line 431
- Version 4, line 447
- Version 5, line 464
- Version 6, line 474
- Version 7, line 570
- Version 8, line 583
- Version 9, line 620
- Version 10, line 648
- Version 11, line 675
- Version 12, line 740
- Version 13, line 774
- Version 14, line 871
- Version 15, line 900
- Version 16, line 948
- Version 17, line 1006
- Version 18, line 1041
- Version 19, line 1109
- Version 20, line 1149
- Version 21, line 1286
- Version 22, line 1367
- Version 23, line 1402
- Version 24, line 1521
- Version 25, line 1584
- Version 26, line 1653
- Version 27, line 1720
- Version 28, line 1775
- Version 29, line 1809
- Version 30, line 1858
- Version 32, line 1888
- Version 34, line 1922
- Version 35, line 1957
- Version 36, line 1994
- Version 37, line 2030
- Version 38, line 2064
- Version 60, line 2104
- Version 39, line 2130
- Version 40, line 2159
- Version 42, line 2193
- Version 43, line 2222
- Version 44, line 2249
- Version 45, line 2288
- Version 61, line 2408
- Version 62, line 2418
- Version 64, line 2450
- Version 65, line 2473
- Version 66, line 2500
- Version 68, line 2526
- Version 69, line 2538
- Version 70, line 2549
- Version 71, line 2586
- Version 72, line 2604
- Version 73, line 2650
- Version 74, line 2684
- Version 75, line 2701
- Version 67, line 2712
- Version 63, line 2745
- Version 46, line 2769
- Version 51, line 2780
- Version 52, line 2805
- Version 55, line 2839
- Version 53, line 2869
- Version 54, line 2898
- Version 56, line 2909
- Version 57, line 2917
- Version 59, line 2932
- Version 50, line 2947
- Version 49, line 2986
- Version 48, line 3025
- Version 47, line 3111
- Version 41, line 3134
- Version 33, line 3170
- Version 31, line 3202
- Version 58, line 3234
- Version 76, line 3283
- Version 77, line 3299
- Version 78, line 3317
- Version 79, line 3356
- Version 80, line 3386
- Version 81, line 3413
- Version 82, line 3545
- Version 83, line 3556
- Version 84, line 3587
- Version 85, line 3596

## Lexical non-table tokens excluded

- `Payment` (observed in insertPaymentDecision, commitPaymentDecision)
- `SET` (observed in upsertCustomerPricing, setServiceResourceAvailability, saveBusinessTemplateConfig, assignMembershipContextualRole, setAuditRetentionPolicy)
- `a` (observed in insertPaymentVerification, commitPaymentDecision, saveQueuedOrders)
- `any` (observed in transitionOrderFulfillment)
- `buyer` (observed in createPurchaseOrderFromProcurementAward)
- `caller` (observed in transitionOrderFulfillment)
- `durable` (observed in recordServiceDeliveryAssessment, assignDeliveryCourier)
- `expiring` (observed in listDevices)
- `fulfillment` (observed in coreFulfillmentContract)
- `incomplete` (observed in assessTelegramBuyerServiceFeasibility)
- `its` (observed in completePaymentStatusQuery)
- `name` (observed in saveQueuedOrders)
- `public` (observed in saveQueuedOrders)
- `real` (observed in saveBusinessTemplateConfig)
- `the` (observed in upsertCustomerPricing, recordServiceDeliveryAssessment, saveCatalog)

## Safe extraction criteria

- Preserve multi-table mutations and their explicit transaction boundary as one unit.
- Keep idempotency key, event/ledger, audit, and lifecycle invariants together until regression coverage proves separability.
- Treat direct function-call edges and shared-table writes as coupling signals, not automatic ownership.
- Do not extract based on naming prefixes alone.

## Limitations

- SQL keyword scanning within exported function bodies can miss SQL composed by helper functions or dynamic fragments.
- REFERENCES clauses are captured only when inline in this source; runtime PRAGMA foreign_key_list remains required.
- Function-to-function edges include direct calls to exported functions only.
- Table-to-domain ownership is not inferred from names; the map records observed access only.
- Table register is normalized to all 110 declared table names; lexical non-table tokens (for example prose words accidentally matched after SQL keywords) are excluded and listed separately.
- The table list includes declared tables with no observed exported-function access; these may be migration-only, legacy, or accessed through non-exported helpers.
