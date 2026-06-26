# Push Testing

Use this when validating remote push notifications for the iOS artifact. The client registration path is already wired in `src/lib/pushNotifications.ts`; actual delivery still depends on Apple/APNs credentials and backend sender configuration.

## Preflight

1. Build on a real iPhone. Remote APNs delivery is not a reliable Simulator test.
2. In Xcode, open `ios/App/App.xcworkspace`.
3. Select the `App` target and confirm:
   - Signing uses the Apple Developer team for `no.kollekt.app`.
   - Capability `Push Notifications` is enabled.
   - Capability `Background Modes` includes `Remote notifications` if background delivery is required.
4. Confirm the resulting entitlements include `aps-environment`.
5. Confirm the backend push sender has an APNs auth key/certificate for the same bundle id and environment.

## Enable Client Debug Logs

Add this only for a local debug build:

```bash
VITE_DEBUG_PUSH=true
```

Then sync and run on device:

```bash
npm run mobile:sync
npm run mobile:open:ios
```

Watch Safari Web Inspector or Xcode logs for:

```text
[push] registered device token
[push] device token saved
```

If permission is denied, delete the app or reset notification permissions in iOS Settings and try again.

## Verify Token Storage

After login, the app should call:

```text
POST /api/push/device-token
```

The payload includes:

```json
{
  "token": "<apns-device-token>",
  "platform": "ios"
}
```

Confirm the token exists in the backend `push_device_tokens` table for the logged-in member.

## Send a Test Push

Send a manual APNs notification to the saved token using your APNs key/tooling. Include a route so tap handling is verified:

```json
{
  "aps": {
    "alert": {
      "title": "Kollekt test",
      "body": "Open economy"
    },
    "sound": "default"
  },
  "route": "/economy"
}
```

Expected result:

1. Notification appears on the device.
2. Tapping it opens Kollekt.
3. The app navigates to `/economy`.
4. With `VITE_DEBUG_PUSH=true`, logs include `[push] notification tapped`.

## Common Failures

- No permission prompt: app already has a prior notification decision; reset it in iOS Settings or reinstall.
- No device token: missing `Push Notifications` capability, wrong signing team, or no `aps-environment` entitlement.
- Token saved but no notification: APNs key/certificate, bundle id, environment, or backend sender config mismatch.
- Tap opens app but does not route: payload is missing a top-level `route` string that starts with `/`.
