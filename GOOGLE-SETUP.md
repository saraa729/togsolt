# Google-ээр нэвтрэх тохиргоо

Код бүрэн бэлэн. Ажиллуулахын тулд Google-өөс **OAuth Client ID** авч, хоёр
газар тавихад л хангалттай. Нийт ~5 минут, төлбөргүй.

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
   - **Create** дар
5. Гарч ирэх **Client ID**-г хуулж ав
   (`123456789-abc123.apps.googleusercontent.com` хэлбэртэй)

## 2. Client ID-г төсөлдөө тавих

**Хоёуланд нь ижил утга** тавина.

`frontend/.env.local`:
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<өөрийн-client-id>
```

`Backend/.env` (байхгүй бол шинээр үүсгэ):
```
GOOGLE_CLIENT_ID=<өөрийн-client-id>
```

## 3. Дахин асаах

```bash
./dev.sh
```

Frontend-ийн орчны хувьсагч сервер асахад уншигддаг тул **заавал дахин асаах**
шаардлагатай. Одоо `/login` болон `/register` дээр "Sign in with Google" товч
гарч ирнэ.

---

## Анхаарах зүйлс

**Заавал `http://localhost:3000`-оор ор.** `http://192.168.1.15:3000` гэх мэт
IP хаягаар орвол Google `origin_mismatch` алдаа өгнө — тэр хаягийг мөн
"Authorized JavaScript origins"-д нэмээгүй бол. Өөр компьютерээс үзүүлэх бол
тухайн хаягаа нэмэх хэрэгтэй.

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
