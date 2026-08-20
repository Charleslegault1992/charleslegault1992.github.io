# Google authentication

The game uses Google Identity Services in the browser and verifies the returned ID token on the game server.
Both sides must use the same OAuth 2.0 Web client ID.

## Google Cloud

1. Open Google Cloud Console and create or select the game project.
2. Configure the OAuth consent screen.
3. Create an OAuth 2.0 Client ID with application type `Web application`.
4. Add these authorized JavaScript origins:
   - `https://charleslegault1992.github.io`
   - `http://127.0.0.1:5173`
   - `http://localhost:5173`
5. Copy the generated client ID. This flow does not require a redirect URI.

## GitHub Pages client

In the GitHub repository, open `Settings > Secrets and variables > Actions > Variables` and create:

```text
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

The value is public by design and is embedded in the Vite client bundle.

## OVH game server

Add the same value to the server environment file:

```text
GAME_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Restart the Node service after changing the environment. The server validates every Google credential against this
audience before creating or opening a game account.
