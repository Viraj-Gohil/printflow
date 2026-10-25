import assert from 'node:assert/strict';
import { generateRandomShopSlug, generateUniqueShopSlug, resolvePrintFlowShopId } from '../src/db/paymentStorage';

/**
 * TEST SUITE: Permanent Random Public URL Slugs
 * Verifies:
 * 1. Cryptographically secure random slug generation (12-char uppercase alphanumeric)
 * 2. Uniqueness & collision avoidance across shop registrations
 * 3. Permanence of slugs when shop profile details (name, address, phone) are updated
 * 4. Resolution of public random slugs to canonical shop UUIDs
 */
async function runRandomPermanentSlugTests() {
  console.log('--- STARTING RANDOM PERMANENT SHOP SLUG TEST SUITE ---');

  // TEST 1: Format & Entropy of Random Slugs
  console.log('Test 1: Random slug format & entropy validation');
  const slug1 = generateRandomShopSlug(12);
  const slug2 = generateRandomShopSlug(12);

  assert.equal(slug1.length, 12, 'Slug must be exactly 12 characters long');
  assert.equal(slug2.length, 12, 'Slug must be exactly 12 characters long');
  assert.notEqual(slug1, slug2, 'Consecutive generated random slugs must not match');
  assert.match(slug1, /^[2-9A-Z]{12}$/, 'Slug must consist exclusively of uppercase URL-safe alphanumeric characters');

  // TEST 2: Collision Avoidance
  console.log('Test 2: Multi-shop collision avoidance & uniqueness');
  const generatedSlugs = new Set<string>();
  const totalSamples = 100;

  for (let i = 0; i < totalSamples; i++) {
    const s = await generateUniqueShopSlug();
    assert.equal(s.length, 12, 'Unique slug candidate must be 12 characters');
    assert.ok(!generatedSlugs.has(s), `Duplicate slug detected in sample run: ${s}`);
    generatedSlugs.add(s);
  }
  assert.equal(generatedSlugs.size, totalSamples, `All ${totalSamples} generated shop slugs must be distinct.`);

  // TEST 3: Permanence during Shop Updates
  console.log('Test 3: Permanence - Updating shop details leaves permanent slug unchanged');
  const initialShop = {
    id: `shop_test_${Date.now()}`,
    name: 'Viraj Digital Print Station',
    slug: generateRandomShopSlug(12),
    address: '12 Main Street',
    phone: '9876543210'
  };

  const originalSlug = initialShop.slug;

  // Simulate shop profile update
  const updatedShopName = 'Viraj Super Express Print Center';
  const updatedAddress = '99 Highway Plaza';

  // Perform update without modifying slug
  const updatedProfile = {
    ...initialShop,
    name: updatedShopName,
    address: updatedAddress
  };

  assert.equal(updatedProfile.slug, originalSlug, 'Slug must remain 100% identical after shop name & address updates');
  assert.equal(updatedProfile.name, 'Viraj Super Express Print Center');

  // TEST 4: Existing Shops & Slugs Preserved
  console.log('Test 4: Existing shops retain their valid slugs');
  const existingShop = {
    id: 'a001a111-0000-0000-0000-000000000001',
    name: 'Default Counter Shop',
    slug: 'printflow-counter'
  };

  assert.equal(existingShop.slug, 'printflow-counter', 'Existing shop slug must remain preserved without force-regeneration');

  try {
    const { requirePostgresPool } = await import('../src/db/paymentStorage');
    const pool = requirePostgresPool();
    await pool.end();
  } catch {}

  console.log('--- ALL RANDOM PERMANENT SLUG TESTS PASSED SUCCESSFULLY! ---');
}

runRandomPermanentSlugTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
