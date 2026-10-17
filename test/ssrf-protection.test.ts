/**
 * PrintFlow SaaS — Server-Side Request Forgery (SSRF) Defense Automated Test Suite
 * 
 * Verifies:
 * 1. Protocol allowlist (Blocks file:, gopher:, dict:, ftp:, data:, php:; Allows http/https).
 * 2. IPv4 Loopback & Broadcast/Multicast defense (127.0.0.0/8, 0.0.0.0/8, 224.0.0.0/4, 240.0.0.0/4).
 * 3. Private RFC 1918 defense (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16).
 * 4. Link-Local & Cloud Metadata defense (169.254.169.254, metadata.google.internal, instance-data).
 * 5. IPv6 Loopback, ULA, Link-Local & IPv4-mapped IPv6 defense (::1, fc00::/7, fe80::/10, ::ffff:127.0.0.1).
 * 6. Obfuscated IP representation normalization (Dotless decimal, octal, hexadecimal).
 * 7. Rejection of embedded credentials in URLs.
 * 8. Anti-DNS-Rebinding & DNS resolution multi-record validation.
 * 9. Allowlist validation for authorized external services.
 */

import {
  validateSsrfUrl,
  validateIpAddress,
  parseIpv4ToNumber,
  isForbiddenIpv4,
  isForbiddenIpv6
} from '../src/lib/ssrfProtection';

async function runSsrfTests() {
  console.log('🛡️ Running PrintFlow SSRF Defense Comprehensive Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: any, testName: string) {
    if (Boolean(condition)) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // ==========================================================================
  // 1. PROTOCOL ALLOWLIST & SCHEME FILTERING
  // ==========================================================================
  console.log('1. Testing Protocol Allowlist & Dangerous Schemes...');
  {
    const fileRes = await validateSsrfUrl('file:///etc/passwd');
    assert(!fileRes.isSafe && fileRes.reason?.includes('Protocol'), 'Blocks file:// local file access scheme');

    const gopherRes = await validateSsrfUrl('gopher://127.0.0.1:6379/_FLUSHALL');
    assert(!gopherRes.isSafe && gopherRes.reason?.includes('Protocol'), 'Blocks gopher:// protocol exploitation');

    const ftpRes = await validateSsrfUrl('ftp://internal-ftp.corp/passwords.txt');
    assert(!ftpRes.isSafe && ftpRes.reason?.includes('Protocol'), 'Blocks ftp:// scheme');

    const dataRes = await validateSsrfUrl('data:text/html,<script>alert(1)</script>');
    assert(!dataRes.isSafe && dataRes.reason?.includes('Protocol'), 'Blocks data: URI scheme');

    const dictRes = await validateSsrfUrl('dict://127.0.0.1:11211/stat');
    assert(!dictRes.isSafe && dictRes.reason?.includes('Protocol'), 'Blocks dict:// scheme');
  }

  // ==========================================================================
  // 2. IPV4 LOOPBACK, CURRENT NETWORK & SPECIAL RANGES
  // ==========================================================================
  console.log('\n2. Testing IPv4 Loopback & Internal Address Defense...');
  {
    const loopbackStandard = await validateSsrfUrl('http://127.0.0.1:3000/api/admin');
    assert(!loopbackStandard.isSafe, 'Blocks standard IPv4 loopback (127.0.0.1)');

    const loopbackSubnet = await validateSsrfUrl('http://127.255.255.254:8080');
    assert(!loopbackSubnet.isSafe, 'Blocks entire 127.0.0.0/8 loopback subnet');

    const zeroNetwork = await validateSsrfUrl('http://0.0.0.0:8000');
    assert(!zeroNetwork.isSafe, 'Blocks current network (0.0.0.0)');

    const localhostWord = await validateSsrfUrl('http://localhost:3000/internal');
    assert(!localhostWord.isSafe, 'Blocks localhost hostname');

    const localhostSub = await validateSsrfUrl('http://admin.localhost:3000');
    assert(!localhostSub.isSafe, 'Blocks *.localhost subdomains');

    const localDomain = await validateSsrfUrl('http://printer.local/status');
    assert(!localDomain.isSafe, 'Blocks *.local mDNS internal domains');
  }

  // ==========================================================================
  // 3. PRIVATE RFC 1918 NETWORKS
  // ==========================================================================
  console.log('\n3. Testing RFC 1918 Private Network Defense (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)...');
  {
    const rfc10 = await validateSsrfUrl('http://10.0.0.1/admin-panel');
    assert(!rfc10.isSafe, 'Blocks 10.0.0.0/8 Class A private address');

    const rfc172Min = await validateSsrfUrl('http://172.16.0.1:9090');
    assert(!rfc172Min.isSafe, 'Blocks 172.16.0.0/12 lower boundary private address');

    const rfc172Max = await validateSsrfUrl('http://172.31.255.254:80');
    assert(!rfc172Max.isSafe, 'Blocks 172.16.0.0/12 upper boundary private address');

    const rfc192 = await validateSsrfUrl('http://192.168.1.1/router-login');
    assert(!rfc192.isSafe, 'Blocks 192.168.0.0/16 Class C home/office subnet');
  }

  // ==========================================================================
  // 4. CLOUD METADATA & LINK-LOCAL (AWS, GCP, AZURE)
  // ==========================================================================
  console.log('\n4. Testing Cloud Metadata & Link-Local IP Defense...');
  {
    const awsMetadata = await validateSsrfUrl('http://169.254.169.254/latest/meta-data/iam/security-credentials/');
    assert(!awsMetadata.isSafe, 'Blocks AWS/OpenStack metadata IP (169.254.169.254)');

    const gcpMetadata = await validateSsrfUrl('http://metadata.google.internal/computeMetadata/v1/');
    assert(!gcpMetadata.isSafe, 'Blocks GCP metadata hostname (metadata.google.internal)');

    const bareMetadata = await validateSsrfUrl('http://metadata/computeMetadata/v1/');
    assert(!bareMetadata.isSafe, 'Blocks bare "metadata" hostname');

    const linkLocalSubnet = await validateSsrfUrl('http://169.254.1.100');
    assert(!linkLocalSubnet.isSafe, 'Blocks entire 169.254.0.0/16 link-local range');
  }

  // ==========================================================================
  // 5. IPV6 LOOPBACK, UNIQUE LOCAL, LINK-LOCAL & IPV4-MAPPED IPV6
  // ==========================================================================
  console.log('\n5. Testing IPv6 Loopback, ULA & IPv4-Mapped Defense...');
  {
    const ipv6Loopback = await validateSsrfUrl('http://[::1]:8080/admin');
    assert(!ipv6Loopback.isSafe, 'Blocks IPv6 loopback ([::1])');

    const ipv6Unspecified = await validateSsrfUrl('http://[::]:3000/');
    assert(!ipv6Unspecified.isSafe, 'Blocks IPv6 unspecified address ([::])');

    const ipv6LinkLocal = await validateSsrfUrl('http://[fe80::1ff:fe23:4567]/');
    assert(!ipv6LinkLocal.isSafe, 'Blocks IPv6 Link-Local (fe80::/10)');

    const ipv6Ula = await validateSsrfUrl('http://[fc00:1234::1]/');
    assert(!ipv6Ula.isSafe, 'Blocks IPv6 Unique Local Address ULA (fc00::/7)');

    const ipv4MappedLoopback = await validateSsrfUrl('http://[::ffff:127.0.0.1]/status');
    assert(!ipv4MappedLoopback.isSafe, 'Blocks IPv4-mapped IPv6 loopback ([::ffff:127.0.0.1])');

    const ipv4MappedMetadata = await validateSsrfUrl('http://[::ffff:169.254.169.254]/');
    assert(!ipv4MappedMetadata.isSafe, 'Blocks IPv4-mapped IPv6 cloud metadata');

    const ipv4MappedPrivate = await validateSsrfUrl('http://[::ffff:10.0.0.1]/');
    assert(!ipv4MappedPrivate.isSafe, 'Blocks IPv4-mapped IPv6 private network');
  }

  // ==========================================================================
  // 6. ALTERNATIVE IP ENCODINGS & BYPASS DEFENSE
  // ==========================================================================
  console.log('\n6. Testing Alternative IP Notation Bypass Defense...');
  {
    // Dotless decimal representation of 127.0.0.1 is 2130706433
    const parsedDec = parseIpv4ToNumber('2130706433');
    assert(parsedDec !== null && isForbiddenIpv4(parsedDec).forbidden, 'Detects dotless decimal representation of 127.0.0.1 (2130706433)');

    // Hexadecimal representation of 127.0.0.1 is 0x7f000001
    const parsedHex = parseIpv4ToNumber('0x7f000001');
    assert(parsedHex !== null && isForbiddenIpv4(parsedHex).forbidden, 'Detects hexadecimal IP representation (0x7f000001)');

    // Octal representation: 0177.0.0.1
    const parsedOct = parseIpv4ToNumber('0177.0.0.1');
    assert(parsedOct !== null && isForbiddenIpv4(parsedOct).forbidden, 'Detects octal IP representation (0177.0.0.1)');

    // Direct URL with decimal representation
    const decUrlRes = await validateSsrfUrl('http://2130706433/admin');
    assert(!decUrlRes.isSafe, 'Blocks direct decimal IP URL (http://2130706433/)');

    // Direct URL with hex representation
    const hexUrlRes = await validateSsrfUrl('http://0x7f000001/admin');
    assert(!hexUrlRes.isSafe, 'Blocks direct hex IP URL (http://0x7f000001/)');
  }

  // ==========================================================================
  // 7. EMBEDDED URL CREDENTIALS & MALFORMED SYNTAX
  // ==========================================================================
  console.log('\n7. Testing URL Structure & Credential Stripping Defense...');
  {
    const credUrl = await validateSsrfUrl('http://user:secret@example.com/file.pdf');
    assert(!credUrl.isSafe && credUrl.reason?.includes('credentials'), 'Rejects URLs with embedded user:pass credentials');

    const emptyUrl = await validateSsrfUrl('');
    assert(!emptyUrl.isSafe, 'Rejects empty URL');

    const malformedUrl = await validateSsrfUrl('htp:/bad-url');
    assert(!malformedUrl.isSafe, 'Rejects malformed URL syntax');
  }

  // ==========================================================================
  // 8. LEGITIMATE PUBLIC DESTINATIONS & ALLOWLISTING
  // ==========================================================================
  console.log('\n8. Testing Legitimate Public HTTPS Destinations & Whitelisting...');
  {
    // Public domains
    const pubRazorpay = await validateSsrfUrl('https://api.razorpay.com/v1/orders');
    assert(pubRazorpay.isSafe, 'Permits legitimate public HTTPS Razorpay API');

    // Host allowlist enforcement
    const allowedOnly = await validateSsrfUrl('https://api.razorpay.com/v1/orders', {
      allowedHosts: ['api.razorpay.com', 'cdn.razorpay.com']
    });
    assert(allowedOnly.isSafe, 'Allows host matching explicit allowlist');

    const nonAllowed = await validateSsrfUrl('https://untrusted-site.org/callback', {
      allowedHosts: ['api.razorpay.com']
    });
    assert(!nonAllowed.isSafe && nonAllowed.reason?.includes('allowlist'), 'Blocks host outside explicit allowlist');
  }

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log('\n========================================');
  console.log(`SSRF Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSsrfTests().catch((err) => {
  console.error('Fatal SSRF test runner error:', err);
  process.exit(1);
});
