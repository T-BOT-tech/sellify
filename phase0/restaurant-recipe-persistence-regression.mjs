// The recipe HTTP routes are registered in the server ROUTES table (before listen).
// Revalidated against current mainline after SC-03/Inventory consolidation (PR #256).
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const dataDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-restaurant-recipes-'));
process.env.SELLIFY_DATA_DIR = dataDir;
process.env.SELLIFY_DB_PATH = path.join(dataDir, 'sellify.sqlite');

try {
  const serverSource = await readFile(new URL('../backend/server.js', import.meta.url), 'utf8');
  const authSource = await readFile(new URL('../backend/lib/authorization.js', import.meta.url), 'utf8');
  const routesStart = serverSource.indexOf('const ROUTES = [');
  const routesEnd = serverSource.indexOf('\n];', routesStart);
  const serverListen = serverSource.indexOf('server.listen(');
  assert.ok(routesStart >= 0 && routesEnd > routesStart && serverListen > routesEnd,
    'HTTP route table must be declared before server.listen');
  const routeTable = serverSource.slice(routesStart, routesEnd);
  assert.ok(routeTable.includes('handleRestaurantRecipes') && !serverSource.slice(serverListen).includes('handleRestaurantRecipes'),
    'Restaurant Recipe routes must be registered inside the canonical ROUTES table, not appended after listen');
  assert.ok(serverSource.includes('handleRestaurantRecipes(req, res, decodeURIComponent(m[1]))'),
    'Restaurant Recipe API must be registered on the authenticated tenant route');
  assert.ok(serverSource.includes("requireAuthorization(session, tenant, 'restaurant_recipe', 'restaurant:recipes:manage'"),
    'Recipe mutations must use server-side Recipe management authorization');
  assert.ok(authSource.includes("'restaurant:recipes:manage'"),
    'Recipe management permission must exist in the central authorization policy');

  const store = await import('../backend/lib/store-sqlite.js');
  const suffix = String(Date.now());
  const owner = await store.getOrCreateUserByTelegram('restaurant-recipe-owner-' + suffix, 'Recipe Owner');
  const tenant = await store.createTenantForUser({
    userId: owner.id, sellerName: 'Recipe Seller', businessType: 'restaurant',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  await store.saveCatalog(tenant.chatId, [
    { id: 'tomato', name: 'Tomato', price: 100, item_type: 'product', unit: 'kg' },
    { id: 'flour', name: 'Flour', price: 200, item_type: 'product', unit: 'kg' },
    { id: 'consultation', name: 'Consultation', price: 500, item_type: 'service' },
    { id: 'pasta', name: 'Pasta', price: 900, item_type: 'product' },
  ]);

  const db = store.getDatabaseForTests();
  assert.equal(db.prepare('SELECT version FROM schema_migrations WHERE version = 83').get()?.version, 83,
    'Restaurant Recipe persistence migration 83 must be applied after SC-03 migrations 81/82');
  assert.equal(db.prepare('SELECT version FROM schema_migrations WHERE version = 81').get()?.version, 81,
    'SC-03.4 resource commitment migration 81 must remain present');
  assert.equal(db.prepare('SELECT version FROM schema_migrations WHERE version = 82').get()?.version, 82,
    'location timezone migration 82 must remain present');

  const recipeInput = {
    id: 'recipe-' + suffix,
    name: 'Tomato Pasta',
    description: 'House pasta sauce',
    menuProductId: 'pasta',
    yieldQuantity: 4,
    yieldUnit: 'portion',
    ingredients: [
      { productId: 'tomato', quantity: 0.5, unit: 'kg' },
      { productId: 'flour', quantity: 0.25, unit: 'kg' },
    ],
  };
  const created = await store.createRestaurantRecipe(tenant.chatId, recipeInput, { userId: owner.id });
  assert.equal(created.duplicate, false);
  assert.equal(created.recipe.name, 'Tomato Pasta');
  assert.equal(created.recipe.ingredients.length, 2);
  assert.equal(created.recipe.version, 1);
  assert.equal(created.recipe.organizationId, tenant.organizationId);

  const replay = await store.createRestaurantRecipe(tenant.chatId, recipeInput, { userId: owner.id });
  assert.equal(replay.duplicate, true, 'same recipe ID and exact content must be safe to retry');
  assert.equal(replay.recipe.id, created.recipe.id);

  await assert.rejects(
    store.createRestaurantRecipe(tenant.chatId, { ...recipeInput, name: 'Changed Pasta' }, { userId: owner.id }),
    error => error?.statusCode === 409 && error?.code === 'RESTAURANT_RECIPE_ID_REUSED',
    'reusing a recipe ID with altered content must fail closed',
  );
  await assert.rejects(
    store.createRestaurantRecipe(tenant.chatId, {
      ...recipeInput, id: 'invalid-missing-' + suffix,
      ingredients: [{ productId: 'missing', quantity: 1, unit: 'kg' }],
    }, { userId: owner.id }),
    error => error?.code === 'RESTAURANT_RECIPE_INGREDIENT_PRODUCT_INVALID',
  );
  await assert.rejects(
    store.createRestaurantRecipe(tenant.chatId, {
      ...recipeInput, id: 'invalid-service-' + suffix,
      ingredients: [{ productId: 'consultation', quantity: 1, unit: 'visit' }],
    }, { userId: owner.id }),
    error => error?.code === 'RESTAURANT_RECIPE_INGREDIENT_NOT_STOCKED',
    'service catalog items cannot be used as physical recipe ingredients',
  );

  const updated = await store.updateRestaurantRecipe(tenant.chatId, created.recipe.id, {
    expectedVersion: 1, description: 'Updated recipe notes',
  }, { userId: owner.id });
  assert.equal(updated.recipe.version, 2);
  assert.equal(updated.recipe.description, 'Updated recipe notes');
  assert.equal(updated.recipe.ingredients.length, 2);
  await assert.rejects(
    store.updateRestaurantRecipe(tenant.chatId, created.recipe.id, {
      expectedVersion: 1, name: 'Stale update',
    }, { userId: owner.id }),
    error => error?.statusCode === 409 && error?.code === 'RESTAURANT_RECIPE_VERSION_CONFLICT',
  );

  const archived = await store.updateRestaurantRecipe(tenant.chatId, created.recipe.id, {
    expectedVersion: 2, status: 'ARCHIVED',
  }, { userId: owner.id });
  assert.equal(archived.recipe.status, 'ARCHIVED');
  assert.equal((await store.listRestaurantRecipes(tenant.chatId)).length, 0);
  assert.equal((await store.listRestaurantRecipes(tenant.chatId, { includeArchived: true })).length, 1);

  const otherUser = await store.getOrCreateUserByTelegram('restaurant-recipe-other-' + suffix, 'Other Owner');
  const otherTenant = await store.createTenantForUser({
    userId: otherUser.id, sellerName: 'Other Recipe Seller', businessType: 'restaurant',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  assert.equal((await store.listRestaurantRecipes(otherTenant.chatId, { includeArchived: true })).length, 0);
  await assert.rejects(
    store.updateRestaurantRecipe(otherTenant.chatId, created.recipe.id, {
      expectedVersion: 2, name: 'Cross organization edit',
    }, { userId: otherUser.id }),
    error => error?.statusCode === 404 && error?.code === 'RESTAURANT_RECIPE_NOT_FOUND',
    'recipe IDs must not expose or mutate another organization records',
  );

  const auditRows = db.prepare(`
    SELECT action, entity_type, entity_id FROM audit_events
    WHERE organization_id = ? AND entity_type = 'restaurant_recipe'
    ORDER BY id
  `).all(tenant.organizationId);
  assert.deepEqual(auditRows.map(row => row.action), [
    'restaurant.recipe.created', 'restaurant.recipe.updated', 'restaurant.recipe.archived',
  ]);
  assert.ok(auditRows.every(row => row.entity_id === created.recipe.id));
  console.log('Restaurant Recipe Persistence Regression: PASS');
} finally {
  await rm(dataDir, { recursive: true, force: true });
}
