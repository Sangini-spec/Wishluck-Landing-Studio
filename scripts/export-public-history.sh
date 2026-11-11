#!/usr/bin/env bash
# Preserve actual commits while excluding workspace-private assignment/context.
# Does not push, force-update a remote, or change the working repository.
set -euo pipefail
source_root="$(git rev-parse --show-toplevel)"
destination="${1:-$source_root/generated-artifacts/public-github-export}"
if [[ -e "$destination" ]]; then
  echo "Choose a new export directory; existing paths are not overwritten." >&2
  exit 1
fi
git clone --no-hardlinks --single-branch --branch main "$source_root" "$destination"
export FILTER_BRANCH_SQUELCH_WARNING=1
git -C "$destination" filter-branch --index-filter \
  'git rm -r --cached --ignore-unmatch .agents docs/source attached_assets replit.md generated-artifacts .local .cache .conversation .env .env.local .env.production .env.development' \
  -- main
while IFS= read -r ref; do
  [[ "$ref" == refs/heads/main ]] || git -C "$destination" update-ref -d "$ref"
done < <(git -C "$destination" for-each-ref --format='%(refname)')
git -C "$destination" remote remove origin
(
  cd "$destination"
  node scripts/check-public-export.mjs
)
echo "Sanitized main is ready. Review it and push only main; never mirror the private workspace."
