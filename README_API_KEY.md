# LocationIQ API Key Configuration

This application uses LocationIQ for location search functionality. To enable location search, you need to configure your LocationIQ API key.

## Steps to Configure API Key

1. **Get a LocationIQ API Key**:
   - Visit [LocationIQ](https://locationiq.com/)
   - Sign up for a free account
   - Navigate to your dashboard to get your API key
   - Free tier includes 5,000 requests per day

2. **Add API Key to Environment Variables**:
   - Copy `.env.example` to `.env` (or create a new `.env` file in the root directory)
   - Add your API key:
   ```
   VITE_LOCATIONIQ_API_KEY=your-actual-api-key-here
   ```
   - The `.env` file is already in `.gitignore` and won't be committed to version control

3. **Restart the Development Server**:
   - Stop the current server (Ctrl+C)
   - Run `npm run dev` again
   - The location search will now work!

## Security Notes

⚠️ **Important Security Information**:

1. **Client-Side Visibility**: Since this is a client-side React application, the API key will still be visible in the browser's network tab and source code. This is **normal and expected** for client-side geocoding APIs like LocationIQ.

2. **Best Practices**:
   - ✅ Use environment variables (already implemented)
   - ✅ Set up **domain restrictions** in your LocationIQ dashboard to limit where the key can be used
   - ✅ Monitor your API usage in the LocationIQ dashboard
   - ✅ Use rate limiting features provided by LocationIQ
   - ✅ Never commit `.env` files to version control (already in `.gitignore`)

3. **For Production**:
   - Consider setting up domain restrictions in LocationIQ dashboard
   - Monitor API usage regularly
   - Consider using a backend proxy if you need to completely hide the API key (though this is usually unnecessary for geocoding APIs)

## Features Enabled with API Key

- **Location Search**: Users can search for addresses or place names
- **Forward Geocoding**: Converts address/place names to coordinates
- **Reverse Geocoding**: Converts coordinates to readable addresses (for future use)
- **UK-Only Results**: Results are restricted to UK locations
- **Postcode Prioritization**: Postcode searches are prioritized in results

## API Documentation

For more information about LocationIQ API:
- [LocationIQ Reverse Geocoding Docs](https://docs.locationiq.com/docs/reverse-geocoding)
- [LocationIQ Search/Forward Geocoding](https://docs.locationiq.com/docs/search)

## Rate Limits

- Free tier: 5,000 requests per day
- Paid plans available for higher limits

## Troubleshooting

If you see "Please configure your LocationIQ API key" error:
1. Make sure you created a `.env` file in the root directory
2. Make sure the variable name is exactly `VITE_LOCATIONIQ_API_KEY`
3. Restart your development server after creating/updating `.env`
4. Check that there are no spaces around the `=` sign
