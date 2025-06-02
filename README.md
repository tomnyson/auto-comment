# Facebook Comment Bot

A Node.js script that uses Puppeteer to post comments on Facebook posts using saved cookies for authentication.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `cookie.json` file with your Facebook cookies. You can get these by:
   - Log into Facebook in Chrome
   - Open Developer Tools (F12)
   - Go to Application tab
   - Under Storage, find Cookies
   - Copy the cookies for facebook.com
   - Save them in a file named `cookie.json`

3. Edit `index.js`:
   - Update `COMMENTS` array with your comments
   - Set `POST_URL` to your target post URL
   - Adjust `INTERVAL` if needed (default: 3000ms)

## Usage

Run the script:
```bash
npm start
```

The script will:
1. Launch a browser window
2. Load your Facebook cookies
3. Navigate to the target post
4. Post comments with the specified interval

## Notes

- The browser window stays open for debugging
- Comments are posted with a delay to avoid detection
- Make sure your cookies are valid before running

## Permissions

The extension requires the following permissions:
- `activeTab`: To interact with the current webpage
- `scripting`: To inject and run scripts
- `storage`: To save your settings

## Troubleshooting

If the extension is not working:
1. Make sure you're on a page with a comment section
2. Try refreshing the page
3. Check if you're logged in to the website
4. Ensure the comment input box is visible on the page # auto-comment
