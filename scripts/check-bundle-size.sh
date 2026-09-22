#!/bin/bash
# Bundle size budget check script
# Verifies that no route exceeds 200KB of JS (excluding framework chunks)

set -e

MANIFEST_DIR=".next"
BUDGET_KB=200
BUDGET_BYTES=$((BUDGET_KB * 1024))

echo "🔍 Checking bundle sizes against budget: ${BUDGET_KB}KB per route (excluding framework chunks)"
echo ""

# Check if build exists
if [ ! -d "$MANIFEST_DIR" ]; then
  echo "❌ Error: .next directory not found. Run 'pnpm build' first."
  exit 1
fi

# Parse build-manifest.json
MANIFEST_FILE="$MANIFEST_DIR/build-manifest.json"

if [ ! -f "$MANIFEST_FILE" ]; then
  echo "❌ Error: build-manifest.json not found at $MANIFEST_FILE"
  exit 1
fi

# Node script to parse manifest and check sizes
node << 'EOF'
const fs = require('fs');
const path = require('path');

const BUDGET_KB = 200;
const BUDGET_BYTES = BUDGET_KB * 1024;
const MANIFEST_FILE = '.next/build-manifest.json';

// Chunks that should be excluded (framework, polyfills, etc)
const FRAMEWORK_CHUNKS = [
  'polyfills-',
  'framework-',
  'main-app-',
  'pages/_app',
  'pages/_error',
];

function isFrameworkChunk(chunkName) {
  return FRAMEWORK_CHUNKS.some(prefix => chunkName.includes(prefix));
}

function getBundleSize(chunkPath) {
  try {
    const fullPath = path.join(process.cwd(), chunkPath);
    return fs.statSync(fullPath).size;
  } catch {
    return 0;
  }
}

try {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
  const pages = manifest.pages || {};

  let failures = [];
  let warnings = [];
  let passCount = 0;

  // Iterate through pages
  Object.entries(pages).forEach(([pageName, chunks]) => {
    if (!Array.isArray(chunks)) return;

    let totalSize = 0;
    let chunkDetails = [];

    chunks.forEach(chunk => {
      if (isFrameworkChunk(chunk)) {
        return; // Skip framework chunks
      }

      const chunkPath = `.next/${chunk}`;
      const size = getBundleSize(chunkPath);

      if (size > 0) {
        totalSize += size;
        chunkDetails.push({
          name: chunk,
          size,
          sizeKB: (size / 1024).toFixed(2),
        });
      }
    });

    const totalKB = (totalSize / 1024).toFixed(2);

    if (totalSize > BUDGET_BYTES) {
      failures.push({
        page: pageName,
        sizeKB: totalKB,
        budgetKB: BUDGET_KB,
        chunks: chunkDetails.sort((a, b) => b.size - a.size),
      });
    } else if (totalSize > BUDGET_BYTES * 0.8) {
      // Warn if approaching budget (80%)
      warnings.push({
        page: pageName,
        sizeKB: totalKB,
        budgetKB: BUDGET_KB,
      });
    } else {
      passCount++;
    }
  });

  // Report results
  console.log(`✅ Passed: ${passCount} routes`);

  if (warnings.length > 0) {
    console.log(`\n⚠️  Warnings (approaching budget):`);
    warnings.forEach(w => {
      console.log(`  - ${w.page}: ${w.sizeKB}KB (budget: ${w.budgetKB}KB)`);
    });
  }

  if (failures.length > 0) {
    console.log(`\n❌ Budget exceeded (${failures.length} routes):`);
    failures.forEach(f => {
      console.log(`\n  Route: ${f.page}`);
      console.log(`  Size: ${f.sizeKB}KB (budget: ${f.budgetKB}KB)`);
      console.log(`  Largest chunks:`);
      f.chunks.slice(0, 5).forEach(c => {
        console.log(`    - ${c.name}: ${c.sizeKB}KB`);
      });
    });

    console.log(`\n💡 Tips to reduce bundle size:`);
    console.log(`  1. Use dynamic imports for large dependencies`);
    console.log(`  2. Check for unused code (tree-shaking)`);
    console.log(`  3. Consider code-splitting at route boundaries`);
    console.log(`  4. Run 'ANALYZE=true pnpm build' for detailed analysis`);

    process.exit(1);
  }

  console.log(`\n✨ All routes within budget!`);
} catch (error) {
  console.error('Error checking bundle sizes:', error);
  process.exit(1);
}
EOF

echo ""
echo "📊 For detailed analysis, run: ANALYZE=true pnpm build"
