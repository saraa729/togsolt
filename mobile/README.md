# ExpoCraft Mobile

Expo/React Native эхлэл scaffold. Энэ нь production store release биш, web API-тэй
холбогдож бүтээгдэхүүний жагсаалт харуулах minimum native demo юм.

## Run

```bash
cd mobile
npm install
EXPO_PUBLIC_API_URL=http://localhost:4000 npm run start
```

LAN төхөөрөмжөөс турших бол backend-ийн LAN хаягийг өгнө:

```bash
EXPO_PUBLIC_API_URL=http://192.168.10.34:4000 npm run start
```

## Production-д үлдэх зүйл

- Login/register/refresh secure storage
- Cart/checkout native screens
- Socket.io messages
- Seller order status update
- iOS/Android signing
- App Store/Play Store privacy labels ба release
