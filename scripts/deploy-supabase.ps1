Write-Host "This script deploys Supabase DB migrations and Edge Functions (food-scan, ai-assistant)."
Write-Host "Ensure you have the Supabase CLI installed: https://supabase.com/docs/guides/cli"
Write-Host "You must be logged in: run 'supabase login' before running this script."

$confirm = Read-Host "Proceed with deploying to the currently active Supabase project? (Y/N)"
if ($confirm -ne 'Y' -and $confirm -ne 'y') {
  Write-Host "Aborted."
  exit 1
}

Write-Host "Applying migrations (this may reset your local/dev DB)..."
supabase db reset --confirm

Write-Host "Deploying functions..."
supabase functions deploy food-scan
supabase functions deploy ai-assistant

Write-Host "Done. Review the Supabase dashboard and function logs to verify."
