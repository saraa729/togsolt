# ExpoCraft Mobile Store Release

## Release Readiness

- Bundle IDs are fixed:
  - iOS: `mn.expocraft.app`
  - Android: `mn.expocraft.app`
- EAS production profiles exist in `eas.json`.
- Privacy disclosures are tracked in `PRIVACY.md`.
- Store metadata lives in `store/metadata.json`.

## Build

```bash
npm run build:ios
npm run build:android
```

## Submit

```bash
npm run submit:ios
npm run submit:android
```

## Final External Gates

- Apple Developer account access.
- Google Play Console account access.
- App Store privacy labels.
- Google Play Data Safety form.
- Signed production builds submitted and approved.
