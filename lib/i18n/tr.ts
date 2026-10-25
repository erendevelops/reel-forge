export const tr = {
  brand: 'REELFORGE',
  nav: { projects: 'Projeler', setup: 'Kurulum' },
  guard: {
    host: 'Bu adres üzerinden erişime izin verilmiyor.',
    crossSite: 'Başka bir siteden gelen istek reddedildi.',
  },
  claude: {
    missing:
      'Claude Code kurulu değil veya bu uygulamayı başlatan terminal onu göremiyor. Kurduktan sonra yeni bir terminal açıp uygulamayı yeniden başlat ya da Ayarlar’a claude dosyasının tam yolunu yaz.',
    loggedOut: 'Claude Code kurulu ama giriş yapılmamış. Bir terminalde "claude" komutunu çalıştırıp Pro veya Max hesabınla giriş yap, sonra tekrar kontrol et.',
    noResponse: 'Claude Code bulundu ama yanıt vermedi. Terminalde "claude" komutunu bir kez çalıştırıp açılış sorularını tamamla.',
    ok: 'giriş yapılmış',
  },
  setup: {
    title: 'KURULUM',
    recheck: 'Tekrar kontrol et',
    copy: 'Kopyala',
    downloadFaceModel: 'Yüz modelini indir (230 KB)',
    checks: {
      node: 'Node.js 20+',
      claude: 'Claude Code',
      ffmpeg: 'FFmpeg',
      python: 'Python 3.10+',
      whisper: 'faster-whisper',
      mediapipe: 'MediaPipe',
      'face-model': 'Yüz algılama modeli',
      chrome: 'Chrome (render için)',
    },
  },
  projects: {
    title: 'PROJELER',
    empty: 'Henüz proje yok.',
    new: 'Yeni proje',
    versions: 'Sürümler',
    noVersions: 'Henüz sürüm yok.',
    renderDraft: 'Taslak oluştur',
    renderFinal: 'Son hâlini oluştur',
  },
  newProject: {
    title: 'YENİ PROJE',
    name: 'Proje adı',
    presets: {
      faceless: 'Yüzsüz reel',
      'talking-head': 'Konuşan yüz',
      'app-video': 'Uygulama videosu',
    },
    ratios: 'Oranlar',
    language: 'Dil',
    inputs: 'Girdi klasörleri veya dosyaları',
    addInput: 'Bir tane daha ekle',
    create: 'Oluştur',
    errors: { name: 'Proje adı gerekli.' },
  },
  jobs: {
    running: 'Çalışıyor',
    done: 'Bitti',
    failed: 'Başarısız',
    cancelled: 'İptal edildi',
    pausedLimit: 'Claude kullanım sınırına ulaşıldı',
    resetsAt: 'Sıfırlanma',
    resume: 'Devam et',
    cancel: 'İptal',
    restarted: 'sunucu yeniden başladı',
  },
};

export type Dictionary = typeof tr;
