// Reusable first-offering suggestions. These are defaults for canonical catalog
// items, not business-specific records, booking workflows, inventory authorities,
// Pack activations, or readiness claims.
const COMMON_TEMPLATES = {
  product: [
    { key: 'general-product', label: 'General product', name: '', category: 'General', unit: 'piece' },
    { key: 'packaged-good', label: 'Packaged good', name: '', category: 'Packaged goods', unit: 'piece' },
    { key: 'bulk-good', label: 'Bulk good', name: '', category: 'Bulk goods', unit: 'kg' },
  ],
  service: [
    { key: 'general-service', label: 'General service', name: '', category: 'Services', unit: 'session' },
    { key: 'onsite-service', label: 'On-site service', name: '', category: 'On-site services', unit: 'visit' },
    { key: 'professional-service', label: 'Professional service', name: '', category: 'Professional services', unit: 'session' },
  ],
};

const BUSINESS_TEMPLATES = {
  'retail-shop': {
    product: [
      { key: 'retail-stock-item', label: 'Retail item', name: '', category: 'Retail', unit: 'piece' },
      { key: 'retail-packaged-good', label: 'Packaged good', name: '', category: 'Packaged goods', unit: 'piece' },
      { key: 'retail-bulk-good', label: 'Bulk good', name: '', category: 'Bulk goods', unit: 'kg' },
    ],
    service: [
      { key: 'retail-add-on-service', label: 'Add-on service', name: '', category: 'Services', unit: 'session' },
      { key: 'retail-delivery-service', label: 'Delivery service', name: '', category: 'Delivery services', unit: 'delivery' },
    ],
  },
  barbershop: {
    product: [
      { key: 'salon-retail-product', label: 'Hair or beauty product', name: '', category: 'Hair and beauty products', unit: 'piece' },
      { key: 'salon-accessory', label: 'Accessory', name: '', category: 'Accessories', unit: 'piece' },
    ],
    service: [
      { key: 'haircut', label: 'Haircut', name: 'Haircut', category: 'Hair services', unit: 'session' },
      { key: 'wash-style', label: 'Wash or styling', name: '', category: 'Hair services', unit: 'session' },
      { key: 'beard-trim', label: 'Beard trim', name: 'Beard trim', category: 'Grooming services', unit: 'session' },
    ],
  },
  'hotel-rooms': {
    product: [
      { key: 'guest-retail-item', label: 'Guest retail item', name: '', category: 'Guest retail', unit: 'piece' },
      { key: 'food-beverage', label: 'Food or beverage', name: '', category: 'Food and beverage', unit: 'piece' },
    ],
    service: [
      { key: 'guest-service', label: 'Guest service', name: '', category: 'Guest services', unit: 'session' },
      { key: 'room-stay-offering', label: 'Room stay offering', name: '', category: 'Accommodation', unit: 'night' },
    ],
  },
  rental: {
    product: [
      { key: 'retail-product', label: 'Product sold outright', name: '', category: 'Products', unit: 'piece' },
      { key: 'rental-accessory', label: 'Rental accessory', name: '', category: 'Accessories', unit: 'piece' },
    ],
    service: [
      { key: 'equipment-rental', label: 'Equipment rental', name: '', category: 'Equipment rental', unit: 'rental' },
      { key: 'vehicle-rental', label: 'Vehicle rental', name: '', category: 'Vehicle rental', unit: 'rental' },
    ],
  },
  consultation: {
    product: [
      { key: 'consultation-material', label: 'Material or resource', name: '', category: 'Materials', unit: 'piece' },
      { key: 'consultation-product', label: 'Product sold alongside service', name: '', category: 'Products', unit: 'piece' },
    ],
    service: [
      { key: 'consultation-session', label: 'Consultation session', name: '', category: 'Consulting', unit: 'session' },
      { key: 'assessment', label: 'Assessment', name: '', category: 'Assessments', unit: 'assessment' },
    ],
  },
  repair: {
    product: [
      { key: 'spare-part', label: 'Spare part', name: '', category: 'Spare parts', unit: 'piece' },
      { key: 'accessory', label: 'Accessory', name: '', category: 'Accessories', unit: 'piece' },
      { key: 'consumable', label: 'Consumable', name: '', category: 'Consumables', unit: 'piece' },
    ],
    service: [
      { key: 'diagnostics', label: 'Diagnostics', name: 'Diagnostics', category: 'Repair services', unit: 'job' },
      { key: 'repair-job', label: 'Repair job', name: '', category: 'Repair services', unit: 'job' },
      { key: 'maintenance', label: 'Maintenance', name: '', category: 'Maintenance', unit: 'visit' },
    ],
  },
  restaurant: {
    product: [
      { key: 'menu-item', label: 'Menu item', name: '', category: 'Menu', unit: 'portion' },
      { key: 'packaged-food', label: 'Packaged food', name: '', category: 'Packaged food', unit: 'piece' },
      { key: 'beverage', label: 'Beverage', name: '', category: 'Beverages', unit: 'piece' },
    ],
    service: [
      { key: 'catering-service', label: 'Catering service', name: '', category: 'Catering', unit: 'event' },
      { key: 'dining-service', label: 'Dining service', name: '', category: 'Dining services', unit: 'service' },
    ],
  },
  wholesale: {
    product: [
      { key: 'case-goods', label: 'Case or carton', name: '', category: 'Wholesale goods', unit: 'case' },
      { key: 'bulk-goods', label: 'Bulk goods', name: '', category: 'Wholesale goods', unit: 'kg' },
      { key: 'single-unit', label: 'Single unit', name: '', category: 'Wholesale goods', unit: 'piece' },
    ],
    service: [
      { key: 'distribution-service', label: 'Distribution service', name: '', category: 'Distribution', unit: 'delivery' },
      { key: 'business-support', label: 'Business support service', name: '', category: 'Business services', unit: 'session' },
    ],
  },
};

export function getOfferingTemplates({ businessTemplate = 'other', itemType = 'product' } = {}) {
  const type = itemType === 'service' ? 'service' : 'product';
  const selected = BUSINESS_TEMPLATES[String(businessTemplate)]?.[type] || COMMON_TEMPLATES[type];
  return selected.map(template => ({ ...template, itemType: type }));
}

export function getOfferingTemplate({ businessTemplate = 'other', itemType = 'product', templateKey } = {}) {
  if (typeof templateKey !== 'string' || !templateKey) return null;
  return getOfferingTemplates({ businessTemplate, itemType })
    .find(template => template.key === templateKey) || null;
}
