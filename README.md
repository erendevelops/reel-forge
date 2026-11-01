# Reelforge

**Türkçe** · [English](#english)

Claude ile video yapmanın kolay yolu. Videolarını yüklüyorsun, kartlardan istediklerini seçiyorsun; Claude sahne sahne planlıyor, sen önizlemede bakıp düzeltiyorsun, sonra videoyu alıyorsun.

- **Üç tür video:** yüzün görünmediği reels (ara görüntü + seslendirme), konuşan kafa videosu, uygulama tanıtım videosu
- **Kendi bilgisayarında çalışır.** Hesap yok, bulut yok, API anahtarı yok. Zaten kullandığın **Claude Pro veya Max** aboneliğinle çalışır.
- Türkçe ve İngilizce arayüz

---

## 1. Gerekenler

| | |
|---|---|
| Bilgisayar | Windows 10/11 veya macOS |
| Claude | **Pro veya Max** aboneliği |
| Disk | Birkaç GB boş alan (videolar proje klasörüne kopyalanır) |

## 2. Kurulum (bir kez, ~15 dakika)

Komutları **Terminal**'e yazacaksın. Windows'ta: Başlat → "Terminal" yaz → aç. macOS'ta: Spotlight → "Terminal".
Her komutu yapıştır, Enter'a bas, bitmesini bekle. Bir program kurulduktan sonra **Terminal'i kapatıp yeniden aç**.

**Windows**

```bash
winget install OpenJS.NodeJS.LTS
winget install Gyan.FFmpeg
winget install Python.Python.3.12
winget install Google.Chrome
```

**macOS** (önce [Homebrew](https://brew.sh) kur)

```bash
brew install node ffmpeg python@3.12
brew install --cask google-chrome
```

**Sonra (iki sistemde de):**

```bash
npm install -g @anthropic-ai/claude-code
claude
```

`claude` açılınca Claude hesabınla giriş yap, sonra pencereyi kapat.

```bash
python -m pip install --user faster-whisper numpy mediapipe
```

(macOS'ta `python` yerine `python3` yaz.)

İsteğe bağlı: Claude'un webden bulduğu görsellerin arka planını silebilmesi için:

```bash
python -m pip install --user "rembg[cpu]"
```

**Projeyi indir:** GitHub sayfasında yeşil **Code** düğmesi → **Download ZIP** → zip'i bir klasöre çıkar.
Terminal'de o klasöre geç ve bağımlılıkları kur:

```bash
cd İNDİRDİĞİN-KLASÖRÜN-YOLU
npm install
```

> İpucu: Windows'ta klasörü Gezgin'de açıp adres çubuğuna `cmd` yazarsan Terminal doğrudan orada açılır.

## 3. Çalıştırma

```bash
npm run app
```

`Ready` yazısını görünce tarayıcıda (Chrome önerilir) **http://localhost:3000** adresini aç.
Terminal açık kaldığı sürece uygulama çalışır; kapatmak için Terminal'de **Ctrl+C**.

İlk açılışta **Kurulum** sayfasına bak: her satır ✓ olmalı. Eksik olanın yanında kopyalanabilir bir kurulum komutu çıkar.

## 4. Kullanım

1. **Yeni proje** → türü seç (Yüzsüz reel, Konuşan yüz, Uygulama videosu), ad ver, oranları seç (**9:16 dikey**, **16:9 yatay**, 4:5, 1:1).
2. **Dosyaları ekle:** videolarını, ses kaydını ya da uygulamanın kod klasörünü kutuya sürükle (ya da *Dosya seç / Klasör seç*). Orijinal dosyalarına dokunulmaz, kopyası alınır.
3. **Editini kur:** kartlardan neleri istediğini seç (altyazı stili, düzen, sayaç, liste, logo ve görseller, ses efekti, müzik…). Claude **yalnızca seçtiklerini** kullanır ve seçtiğin her kartı en az bir kez kullanır. İstersen beğendiğin reels bağlantılarını da ekle; Claude onları indirip izler ve görünüşünü adım adım taklit eder. *Onayla ve analiz et*.
4. **Analiz:** Claude dosyaları inceler (birkaç dakika). Sağda ne yaptığını canlı görürsün.
5. **Metin kontrolü** (reels): yanlış duyulan kelimeye tıkla, düzelt, *Onayla*.
6. **Müzik** (seçtiysen): Claude 3–4 parça önerir. Dinle, birini seç, parçayı indirip kutuya bırak. Beğenmezsen *Başka öner*.
7. **Senaryo:** proje sayfasındaki *Sıradaki adım* kartında **Plan oluştur**'a bas. Claude her sahneyi ve **neden** öyle yaptığını yazar, ilk taslak videoyu da hazırlar.
8. **Düzenle:** soldan bir sahne seç; sağda önizleme var.
   - Yazıları, sayıları, zamanları, sesleri, renkleri kendin değiştir → **Kaydet**
   - **Görüntüler:** sahnenin videosunu *Değiştir* ile başka bir klipten, istediğin saniyeden seç → *Bu kısmı kullan*
   - Bir kartı (ör. grafik) istemiyorsan yanındaki **Kaldır**'a bas
   - Her değişiklik yeni bir **sürüm** olur, eskileri kaybolmaz.
   - **Kartları değiştir**'den kart seçimini değiştirirsen Claude planı **baştan** kurar.
9. **Claude ile konuş:** sağdaki sohbete her şeyi yaz (beğenmediklerin, istediklerin, referanstaki gibi olmasını istediklerin) → *Gönder ve baştan oluştur*. Claude bu sohbetteki bütün geri bildirimlere göre videoyu baştan kurar, her maddeye tek tek cevap verir ve yeni bir sürüm yapar. Senaryo ve inceleme sayfasında aynı sohbet var.
10. **Onayla ve render al:** son videoyu her oran için çıkarır.
11. **İnceleme:** videoyu izle, kalite kontrollerine bak, iki sürümü yan yana karşılaştır, indir. Claude'un yazdığı **paylaşım metnini** (açıklama + hashtag'ler) tek tıkla kopyala.

**Logo ve görseller** ya da **Özel sahneler** kartı seçiliyse Claude, konuşmada geçen ama görüntüde olmayan şeylerin (ürün, cihaz, yer…) gerçek görsellerini webden bulur, gerekirse arka planını siler ve o kelimede gösterir.

**Projeler sayfası** her projenin önizleme resmini gösterir; bir projeyi silmek için kartındaki **Sil**'e bas (Claude çalışırken silinmez).

**Logo şeffaf olsun:** Logo ve görseller kartında arka planı `transparent` yap; çerçeve ve gölge kalkar.

Claude kalıcı bir tercih fark ederse (*"liste daha sağda olsun"* gibi) saklamayı önerir. Saklanan tercihler sonraki projelerde de kullanılır; **Ayarlar**'dan düzenlenir.

**Videolar nerede?** Uygulama klasöründe `workspace/projects/<proje-adı>/versions/v<numara>/render/` içinde.

## 5. Sık sorulanlar

- **Sayfa boş kalıyor / bir adım ilerlemiyor:** sayfayı yenile (F5).
- **Claude "kullanım limiti" dedi:** Claude aboneliğinin limiti doldu. Yazan saatte *Devam et*'e bas; yarım kalan iş kaybolmaz.
- **Kurulum sayfasında kırmızı satır var:** yanındaki komutu Terminal'de çalıştır, Terminal'i yeniden aç, *Tekrar kontrol et*.
- **Önizleme siyah:** Chrome kullan. Bazı gömülü tarayıcılar önizlemeyi engeller.
- **Kodda değişiklik yaptım / güncelledim:** uygulamayı Ctrl+C ile kapatıp `npm run app` ile yeniden başlat.

## Lisans

© 2026 **erendevelops**. Ücretsiz kullanabilir, değiştirebilir ve paylaşabilirsin. Değiştirilmiş sürümlerde erendevelops adı korunmalı; değiştirilmiş sürümler üzerinde **hak iddia etmek yasaktır**. Ayrıntılar: [LICENSE](LICENSE).

---

<a id="english"></a>

# Reelforge (English)

The easy way to make videos with Claude. Drop in your footage, pick the building blocks you want, Claude plans the edit scene by scene, you check and tweak it in a live preview, and you get your video.

- **Three kinds of video:** faceless reels (B-roll + voice-over), talking-head videos, app launch videos
- **Runs on your own computer.** No account, no cloud, no API key. Uses the **Claude Pro or Max** subscription you already have.
- Turkish and English interface

## 1. What you need

| | |
|---|---|
| Computer | Windows 10/11 or macOS |
| Claude | A **Pro or Max** subscription |
| Disk | A few GB free (footage is copied into the project) |

## 2. Install (once, ~15 minutes)

Type the commands into **Terminal**. Windows: Start → type "Terminal". macOS: Spotlight → "Terminal".
Paste each command, press Enter, wait for it to finish. After installing a program, **close and reopen Terminal**.

**Windows**

```bash
winget install OpenJS.NodeJS.LTS
winget install Gyan.FFmpeg
winget install Python.Python.3.12
winget install Google.Chrome
```

**macOS** (install [Homebrew](https://brew.sh) first)

```bash
brew install node ffmpeg python@3.12
brew install --cask google-chrome
```

**Then (both systems):**

```bash
npm install -g @anthropic-ai/claude-code
claude
```

When `claude` opens, sign in with your Claude account, then close it.

```bash
python -m pip install --user faster-whisper numpy mediapipe
```

(On macOS type `python3` instead of `python`.)

Optional: so Claude can remove the background of images it finds on the web:

```bash
python -m pip install --user "rembg[cpu]"
```

**Get the project:** on the GitHub page, green **Code** button → **Download ZIP** → unzip it into a folder.
In Terminal, go to that folder and install its parts:

```bash
cd PATH-TO-THE-FOLDER
npm install
```

> Tip: on Windows, open the folder in File Explorer and type `cmd` in the address bar to open Terminal right there.

## 3. Run it

```bash
npm run app
```

When you see `Ready`, open **http://localhost:3000** in your browser (Chrome recommended).
The app runs while Terminal stays open; press **Ctrl+C** in Terminal to stop it.

On first launch, check the **Setup** page: every row should be ✓. Anything missing shows a copyable install command next to it.

## 4. How to use it

1. **New project** → pick the kind (Faceless reel, Talking head, App video), a name and the ratios (**9:16 vertical**, **16:9 horizontal**, 4:5, 1:1).
2. **Add your files:** drag your videos, voice-over or the app's code folder onto the box (or *Pick files / Pick a folder*). Your originals are never touched; the app works on a copy.
3. **Build your edit:** tick the cards you want (caption style, layout, counter, list, logos & images, sound effects, music…). Claude **only uses what you tick**, and uses every card you tick at least once. Optionally paste links to reels you like; Claude downloads and watches them and rebuilds their look beat for beat. *Confirm and analyse*.
4. **Analysis:** Claude studies your files (a few minutes). You see what it's doing live on the right.
5. **Transcript check** (reels): click a misheard word, fix it, *Confirm*.
6. **Music** (if ticked): Claude suggests 3–4 tracks. Listen, pick one, download it and drop it in. Don't like them? *Suggest others*.
7. **Storyboard:** press **Make the plan** in the *Next step* card on the project page. Claude writes every scene and **why** it chose it, and renders a first draft.
8. **Edit:** pick a scene on the left; the preview is on the right.
   - Change texts, numbers, timings, sounds and colours yourself → **Save**
   - **Shots:** *Change* a scene's footage to another clip, from any second → *Use this part*
   - Don't want a card (e.g. a chart)? Press **Remove** next to it
   - Every change becomes a new **version**; old ones are kept.
   - Change your ticked cards with **Change cards** and Claude plans again **from scratch**.
9. **Talk to Claude:** write everything in the chat on the right (what you dislike, what you want, what should look like the reference) → *Send and rebuild*. Claude rebuilds the video from all the feedback in the chat, answers each point and makes a new version. The storyboard and review pages share the same chat.
10. **Approve & render:** makes the final video for every ratio.
11. **Review:** watch it, see the quality checks, compare two versions side by side, download. Copy the **post text** Claude wrote (caption + hashtags) in one click.

With the **Logos & images** or **Custom scenes** card ticked, Claude finds real pictures on the web of things that are said but not shown (a product, device, place…), removes their background when needed and shows them on that word.

The **Projects** page shows a preview image for each project; press **Delete** on a card to delete it (not while Claude is working).

**Transparent logo:** set the Logos & images card's background to `transparent`; the frame and shadow go away.

When Claude spots a lasting preference (*"move the list further right"*), it offers to keep it. Kept preferences apply to your next projects too; edit them in **Settings**.

**Where are my videos?** In the app folder, under `workspace/projects/<project-name>/versions/v<number>/render/`.

## 5. FAQ

- **A page stays empty / a step doesn't move on:** refresh the page (F5).
- **Claude says "usage limit":** your Claude plan's limit is reached. Press *Resume* at the time shown; nothing done so far is lost.
- **A red row on the Setup page:** run the command next to it in Terminal, reopen Terminal, *Check again*.
- **The preview is black:** use Chrome. Some embedded browsers block the preview.
- **I changed or updated the code:** stop the app with Ctrl+C and start it again with `npm run app`.

## License

© 2026 **erendevelops**. Free to use, modify and share. Modified versions must keep the erendevelops credit, and **claiming rights over modified versions is forbidden**. Details: [LICENSE](LICENSE).
