#!/bin/sh
# Docker entrypoint script for runtime environment variable injection.
# Generates __ENV.js with runtime env vars before starting Next.js.
# This allows one Docker image to be used across all environments.

set -e

echo "🚀 Starting Game Web Client..."

# Generate __ENV.js with runtime environment variables
# NOTE: heredoc delimiter is UNQUOTED (<< EOF, not << 'EOF') on purpose —
# quoting it disables shell expansion, so ${BFF_ORIGIN} would be written to the
# file literally instead of the container's runtime value. Unquoted = interpolated.
cat > /app/public/__ENV.js << EOF
window.__ENV = {
  BFF_ORIGIN: "${BFF_ORIGIN:-http://localhost:18080}",
  APP_ENV: "${APP_ENV:-production}",
  FEATURE_FLAGS: "${FEATURE_FLAGS:-}",
};
EOF

echo "✅ Generated __ENV.js:"
cat /app/public/__ENV.js
echo ""

# Start Next.js
exec "$@"
