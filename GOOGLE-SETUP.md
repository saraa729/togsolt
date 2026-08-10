# Жинхэнэ Gmail-ээр нэвтрэх тохиргоо

Кодын тал бэлэн: frontend нь Google Identity Services товч гаргана, backend нь
Google-ийн ID токеныг Google дээр шалгаад зөвхөн баталгаажсан Gmail-ээр сесс
үүсгэнэ. Ажиллуулахын тулд Google-өөс **OAuth Client ID** авч env-д тавина.

## 1. Google Cloud Console дээр Client ID үүсгэх

1. https://console.cloud.google.com/ руу орж нэвтэр
2. Дээд талын төслийн сонголтоос **New Project** → нэр өг (жишээ: `expocraft`) → **Create**
3. Зүүн цэс → **APIs & Services** → **OAuth consent screen**
   - User Type: **External** → **Create**
   - App name: `ExpoCraft`, хэрэглэгчийн и-мэйл, доор нь дахин и-мэйлээ бич → **Save and Continue**
   - Scopes, Test users хэсгийг алгасаад **Save** дар
   - **Test users** хэсэгт дипломоо хамгаалахдаа ашиглах Gmail хаягаа нэм
     (Publishing status нь "Testing" үед зөвхөн эдгээр хаяг нэвтэрч чадна)
4. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: `ExpoCraft Web`
   - **Authorized JavaScript origins** → **ADD URI** дарж дараахыг нэм:
     ```
     http://localhost:3000
     ```
     Google OAuth нь `192.168...` шиг raw/private IP-г origin дээр авахгүй.
     Жинхэнэ Google login-ийг local дээр шалгах бол browser-оо яг
     `http://localhost:3000` дээр нээ.
   - **Create** дар
5. Гарч ирэх **Client ID**-г хуулж ав
   (`123456789-abc123.apps.googleusercontent.com` хэлбэртэй)

## 2. Client ID-г local demo-д тавих

Local demo дээр нэг газар тавихад хангалттай. `./dev.sh` энэ public Client ID-г
backend рүү автоматаар дамжуулна.

`frontend/.env.local`:
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<өөрийн-client-id>
```

Backend-ийг `./dev.sh`-гүй дангаар нь асаавал `Backend/.env` дээр мөн ижил
утгыг тавина:
```
GOOGLE_CLIENT_ID=<өөрийн-client-id>
```

Production дээр frontend/backend хоёр тусдаа deploy тул env dashboard дээр
хоёуланд нь ижил Client ID-г тавина.

## 3. Дахин асаах

```bash
./dev.sh
```

Frontend-ийн орчны хувьсагч сервер асахад уншигддаг тул **заавал дахин асаах**
шаардлагатай. Одоо `/login` болон `/register` дээр "Sign in with Google" товч
гарч ирнэ.

---

## Анхаарах зүйлс

**Яг Google Console дээр нэмсэн origin-оор ор.** Local demo дээр Google login
шалгахдаа:

```
http://localhost:3000/login
```

гэж орно. `http://192.168.10.34:3000` зэрэг raw IP-г Google OAuth origin дээр
авахгүй.

**Алдаа 400: `origin_mismatch` гарвал** Google Cloud Console → APIs & Services
→ Credentials → OAuth 2.0 Client IDs → `ExpoCraft Web` → **Authorized
JavaScript origins** дээр local development-д зөвхөн үүнийг нэм:

```
http://localhost:3000
```

`/login`, `/register` гэх мэт path нэмэхгүй. Зөвхөн origin нэмнэ. Хадгалсны
дараа 1-2 минут хүлээгээд browser дээр hard refresh (`Cmd + Shift + R`) хийнэ.

**Өөр төхөөрөмжөөс үзүүлэх хэрэгтэй бол** raw IP биш public HTTPS origin ашигла:
өөрийн domain, Vercel deploy URL, Cloudflare Tunnel, ngrok гэх мэт. Тэр үед
Google Console дээр жишээ нь `https://your-demo-domain.com` origin-ийг нэмнэ.

**Утасны дугаар.** Google утасны дугаар дамжуулдаггүй. Дотоодын худалдан
авагчид утас заавал шаардлагатай тул шинээр бүртгүүлэх үед товчны доор
утас асуух жижиг форм гарч ирнэ. "Би Монголоос гадуур байна" гэж сонговол
утас шаардахгүй.

**Аль хэдийн нууц үгээр бүртгүүлсэн и-мэйл.** Тухайн и-мэйл Google-ээр
нэвтрэх гэвэл backend `google_link_required` алдаа өгнө — энэ нь зориудаар:
хэн нэгэн зөвхөн и-мэйл мэдээд бусдын нууц үгтэй акаунтыг эзэмших боломжийг
хаана. Үзүүлэхдээ **шинэ Gmail хаяг** ашигла, эсвэл эхлээд тухайн и-мэйлээр
бүртгүүлээгүй эсэхийг шалга.

**Тохируулаагүй бол юу болох вэ.** Товч огт харагдахгүй, нууц үгээр нэвтрэх
хэвийн ажиллана. Backend талд `/auth/google` нь `503 google_auth_unavailable`
буцаана. Өөрөөр хэлбэл тохируулаагүй байх нь сайтыг эвдэхгүй.

## Хурдан шалгах

1. `frontend/.env.local` дээр `NEXT_PUBLIC_GOOGLE_CLIENT_ID` хоосон биш эсэхийг
   шалга.
2. `./dev.sh` асаагаад `/login` руу ор.
3. Google товч гарч ирвэл товчоо дараад жинхэнэ Gmail хаягаа сонго.
4. Шинэ дотоод хэрэглэгч бол утас асууна. Утас оруулсны дараа `/home` руу орвол
   Gmail login амжилттай.
