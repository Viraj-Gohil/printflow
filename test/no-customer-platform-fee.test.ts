import assert from 'node:assert/strict';
import { DurableGuestCheckoutRepository } from '../src/db/guestCheckoutRepository';

/**
 * TEST SUITE: Customer Print Payments - No ₹2 Platform Fee Verification
 * Verifies that customer print orders calculate amount strictly from selected
 * shop pricing rules and file page counts with 0 platform or service fees.
 */
async function runNoPlatformFeeTests() {
  console.log('--- STARTING CUSTOMER NO-PLATFORM-FEE TEST SUITE ---');

  // TEST 1: GuestCheckoutRepository Authoritative Quote Calculation
  console.log('Test 1: Server-authoritative quote calculation contains 0 platform fee');

  const mockDb = {
    connect: async () => ({
      query: async (text: string, params?: any[]) => {
        // 1. Fetch verified files
        if (text.includes('FROM public.uploaded_files')) {
          return {
            rowCount: 2,
            rows: [
              {
                id: '11111111-1111-1111-1111-111111111111',
                original_filename: 'Assignment_Math.pdf',
                verified_page_count: 5,
                upload_state: 'VERIFIED'
              },
              {
                id: '22222222-2222-2222-2222-222222222222',
                original_filename: 'Project_Report.pdf',
                verified_page_count: 10,
                upload_state: 'VERIFIED'
              }
            ]
          };
        }

        // 2. Fetch active pricing rules
        if (text.includes('FROM public.pricing_rules')) {
          return {
            rowCount: 1,
            rows: [
              {
                paper_size: 'A4',
                color_mode: 'BW',
                sides: 'SINGLE',
                price_per_page: 2.0 // ₹2.00 per page
              }
            ]
          };
        }

        // 3. Fetch shop min_order_amount
        if (text.includes('FROM public.shops')) {
          return {
            rowCount: 1,
            rows: [{ min_order_amount: 1.0 }] // ₹1.00 minimum
          };
        }

        // 4. Quote Insert
        if (text.includes('INSERT INTO public.print_checkout_quotes')) {
          return {
            rowCount: 1,
            rows: [{ id: 'quote_no_fee_123' }]
          };
        }

        // 5. Update Print Jobs & Transaction control
        return { rowCount: 1, rows: [] };
      },
      release: () => {}
    })
  };

  const repo = new DurableGuestCheckoutRepository(mockDb as any);

  const jobId = 'a0000000-0000-0000-0000-000000000001';
  const shopId = 'b0000000-0000-0000-0000-000000000002';

  const fileConfigs = [
    { fileId: '11111111-1111-1111-1111-111111111111', paperSize: 'A4' as const, colorMode: 'BW' as const, sides: 'SINGLE' as const, copies: 1 }, // 5 pages * ₹2 = ₹10 (1000 paise)
    { fileId: '22222222-2222-2222-2222-222222222222', paperSize: 'A4' as const, colorMode: 'BW' as const, sides: 'SINGLE' as const, copies: 1 }  // 10 pages * ₹2 = ₹20 (2000 paise)
  ];

  const quote = await repo.calculateAuthoritativeQuote(jobId, shopId, fileConfigs);

  // Expected subtotal = 1000 + 2000 = 3000 paise (₹30.00)
  const expectedSubtotalMinor = 3000;
  assert.equal(
    quote.amountMinor,
    expectedSubtotalMinor,
    `Quote amountMinor (${quote.amountMinor} paise) must match exact printing charge (${expectedSubtotalMinor} paise) with NO platform fee added.`
  );
  assert.equal(
    quote.totalAmountRupees,
    30.0,
    `Quote totalAmountRupees (${quote.totalAmountRupees}) must equal exact subtotal ₹30.00.`
  );

  // TEST 2: Verify zero platform fee discrepancy in pricing snapshot breakdown
  console.log('Test 2: Breakdown line totals sum up exactly to total amount without surplus charges');
  const sumOfLineTotalsMinor = quote.breakdown.reduce((sum, item) => sum + item.lineTotalMinor, 0);
  assert.equal(
    sumOfLineTotalsMinor,
    quote.amountMinor,
    'Sum of individual file line totals must exactly equal total quote amount (zero hidden surcharge or platform fee).'
  );

  // TEST 3: Verify single page calculation
  console.log('Test 3: Single page print order quote equals exact single-page rate');
  const singleFileMockDb = {
    connect: async () => ({
      query: async (text: string) => {
        if (text.includes('FROM public.uploaded_files')) {
          return {
            rowCount: 1,
            rows: [{ id: '11111111-1111-1111-1111-111111111111', original_filename: 'Doc.pdf', verified_page_count: 1, upload_state: 'VERIFIED' }]
          };
        }
        if (text.includes('FROM public.pricing_rules')) {
          return { rowCount: 1, rows: [{ paper_size: 'A4', color_mode: 'BW', sides: 'SINGLE', price_per_page: 3.5 }] };
        }
        if (text.includes('FROM public.shops')) {
          return { rowCount: 1, rows: [{ min_order_amount: 1.0 }] };
        }
        if (text.includes('INSERT INTO public.print_checkout_quotes')) {
          return { rowCount: 1, rows: [{ id: 'quote_single_350' }] };
        }
        return { rowCount: 1, rows: [] };
      },
      release: () => {}
    })
  };

  const singleRepo = new DurableGuestCheckoutRepository(singleFileMockDb as any);
  const singleQuote = await singleRepo.calculateAuthoritativeQuote(jobId, shopId, [
    { fileId: '11111111-1111-1111-1111-111111111111', paperSize: 'A4' as const, colorMode: 'BW' as const, sides: 'SINGLE' as const, copies: 1 }
  ]);

  assert.equal(singleQuote.amountMinor, 350, 'Single page 3.50 INR print job must be exactly 350 paise without ₹2 addition (which would have been 550 paise).');
  assert.equal(singleQuote.totalAmountRupees, 3.50);

  console.log('--- ALL CUSTOMER NO-PLATFORM-FEE TESTS PASSED SUCCESSFULLY! ---');
}

runNoPlatformFeeTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
