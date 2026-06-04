#!/usr/bin/env bash
set -euo pipefail

echo "This script deploys Supabase DB migrations and Edge Functions (food-scan, ai-assistant)."
echo "Make sure you have the Supabase CLI installed: https://supabase.com/docs/guides/cli"
echo "You must be logged in: run 'supabase login' before running this script."

read -p "Proceed with deploying to the currently active Supabase project? (y/N) " answer
if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
  echo "Aborted."
  exit 1
fi

echo "Applying migrations (this may reset your local/dev DB)..."
supabase db reset --confirm

echo "Deploying functions..."
supabase functions deploy food-scan
supabase functions deploy ai-assistant

echo "Done. Review the Supabase dashboard and function logs to verify."
