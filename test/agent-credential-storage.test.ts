import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalCwd = process.cwd();
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalNodeEnv = process.env.NODE_ENV;
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'printflow-agent-credentials-'));

async function run() {
  process.chdir(tempDir);
  process.env.DATABASE_URL = '';
  process.env.NODE_ENV = 'test';

  try {
    const storage = await import('../src/db/paymentStorage');
    const issued = await storage.issuePrintAgentToken({
      agentId: 'agent_test_shop',
      shopId: 'shop_test',
      deviceName: 'TEST-PC01'
    });

    assert.match(issued.token, /^agt_tok_[A-Za-z0-9_-]+$/);
    const persisted = JSON.parse(fs.readFileSync(path.join(tempDir, '.data', 'payment_integrations.json'), 'utf8'));
    assert.equal(persisted.agentDevices.agent_test_shop.token_hash.length, 64);
    assert.equal(persisted.agentDevices.agent_test_shop.token_hash.includes(issued.token), false);

    const paired = await storage.pairPrintAgent({
      shopId: 'shop_test',
      token: issued.token,
      deviceName: 'TEST-PC01'
    });
    assert.equal(paired?.agentId, issued.agentId);

    const heartbeat = await storage.authenticatePrintAgent({
      agentId: issued.agentId,
      token: issued.token,
      targetShopId: 'shop_test'
    });
    assert.equal(heartbeat.valid, true);
    assert.equal((await storage.getPrintAgentStatus(issued.agentId, 'shop_test'))?.status, 'ONLINE');

    await storage.savePrintAgentPrinters(issued.agentId, [{
      name: 'Test Printer',
      displayName: 'Test Printer',
      status: 'READY',
      isOnline: true,
      isDefault: true,
      capabilities: { paperSizes: ['A4'], supportsColor: false, supportsDuplex: true }
    }]);
    assert.equal((await storage.getPrintAgentStatus(issued.agentId, 'shop_test'))?.connectedPrintersCount, 1);
    assert.equal((await storage.getShopPrintAgentPrinters('shop_test'))[0]?.printer.name, 'Test Printer');
    assert.equal((await storage.getShopPrinterEntitlements('shop_shree_ganesh')).printerLimit, 5);
    assert.equal(await storage.revokePrintAgent(issued.agentId), true);
    assert.equal((await storage.authenticatePrintAgent({
      agentId: issued.agentId,
      token: issued.token
    })).valid, false);
  } finally {
    process.chdir(originalCwd);
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

run().then(() => {
  console.log('Print agent credential storage tests passed.');
}).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
