# DATA SAFETY MEASURES

## Where Data is Stored
- SQLite database: safari-pos/database/safaripos.db
- Backups: safari-pos/backups/
- NOT in browser (sessionStorage cleared on logout)

## Automatic Protections
1. Backup created on every server startup
2. Soft delete for users (records preserved)
3. Double verification for all deletions
4. Products marked inactive instead of hard delete

## Manual Backups
- Admin can create backups anytime
- Download backups to external storage
- Recommended: Daily backup routine

## What is NOT stored in browser
- Passwords (only in session for active login)
- Product data (server database only)
- Sales records (server database only)
- Business settings (server database only)

## Browser Storage Usage
- sessionStorage: Temporary token (cleared on logout/close)
- localStorage: NOT USED (cleared on login page)
- Cookies: NOT USED

## Emergency Recovery
1. Check backups folder
2. Copy latest backup .db file
3. Rename to safaripos.db
4. Replace in database folder
5. Restart server
