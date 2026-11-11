export interface KamusEntry {
  word: string;
  page?: number;
  category: 'kata_kerja_bawa' | 'petikan_pustaka' | 'kamus_dewan' | 'alam_sekitar';
  meaning: string;
  example: string;
  visualCue: string;
}

export interface QuizQuestion {
  id: string;
  topic: 'pustaka' | 'sains';
  wordFocus: string;
  question: string;
  contextHint: string;
  options: [string, string, string]; // [Gate A (Left), Gate B (Center), Gate C (Right)]
  correctIndex: 0 | 1 | 2;
  explanation: string;
}

export const PETIKAN_PUSTAKA_MINI = {
  title: 'Pustaka Mini Keluarga',
  subtitle: 'Baca dan cari makna (Buku Teks Bahasa Melayu KPM · Halaman 8 · Nota Guru 2.1.2)',
  paragraphs: [
    'Ayah Kishan, iaitu Encik Subramaniam amat mementingkan pendidikan anak-anaknya. Beliau menggalakkan Kishan dan adiknya membaca bahan bacaan yang bermutu. Oleh sebab itu, beliau telah menyediakan bilik bacaan di rumah. Bilik bacaan itu dinamai Pustaka Mini Keluarga.',
    'Kishan dan adiknya berasa amat gembira. Mereka membantu ibu bapa mereka menghias dan mengemas pustaka mini itu. Mereka menampalkan poster yang menarik dan bermaklumat.',
    'Ibu Kishan sering menyediakan tugasan untuk mereka. Tugasan itu disediakan dalam perisian komputer. Setiap minggu, Kishan dan adiknya perlu menyiapkan tugasan itu. Mereka melakukan tugasan itu di pustaka mini tersebut.',
    'Pada minggu lalu, ibu Kishan memberikan tugasan kosa kata. Beliau menyenaraikan perkataan seperti jinjing, tatang, pangku, dukung dan kandar. Beliau meminta Kishan dan adiknya mencari maksud perkataan itu dengan merujuk kamus dan media elektronik.'
  ],
  highlightedWords: [
    'mementingkan',
    'menggalakkan',
    'bermutu',
    'menghias',
    'pustaka',
    'menampalkan',
    'perisian',
    'jinjing',
    'tatang',
    'pangku',
    'dukung',
    'kandar'
  ]
};

export const KAMUS_DEWAN_ENTRIES: KamusEntry[] = [
  {
    word: 'jinjing',
    page: 538,
    category: 'kata_kerja_bawa',
    meaning: 'Membawa sesuatu dengan tangan terhulur ke bawah; membimbit.',
    example: 'Ibu menjinjing beg plastik berisi sayur-sayuran dari pasar.',
    visualCue: 'Tangan lurus ke bawah memegang tangkai beg (membimbit).'
  },
  {
    word: 'kandar',
    page: 539,
    category: 'kata_kerja_bawa',
    meaning: 'Kayu atau tongkat yang digunakan untuk menggalas (memikul) barang di bahu.',
    example: 'Pak Tua mengandar dua bakul buah-buahan menggunakan sebatang kayu kandar.',
    visualCue: 'Kayu melintang di atas bahu dengan beban di kedua-dua hujung.'
  },
  {
    word: 'tatang',
    page: 538,
    category: 'kata_kerja_bawa',
    meaning: 'Membawa sesuatu di atas tapak tangan dengan berhati-hati.',
    example: 'Kakak menatang sedulang air teh panas untuk dihidangkan kepada tetamu.',
    visualCue: 'Tapak tangan terbuka menghadap ke atas menampung dulang.'
  },
  {
    word: 'pangku',
    page: 538,
    category: 'kata_kerja_bawa',
    meaning: 'Meletakkan atau meriba sesuatu di atas paha ketika duduk.',
    example: 'Ibu memangku adik kecil sambil membacakan buku cerita di Pustaka Mini.',
    visualCue: 'Duduk sambil meletakkan anak atau buku di atas riba/paha.'
  },
  {
    word: 'dukung',
    page: 538,
    category: 'kata_kerja_bawa',
    meaning: 'Membawa kanak-kanak atau sesuatu di pinggang atau di belakang badan.',
    example: 'Abang mendukung adiknya yang keletihan selepas berjoging di taman.',
    visualCue: 'Menggendong di belakang atau di sisi pinggang.'
  },
  {
    word: 'junjung',
    page: 538,
    category: 'kamus_dewan',
    meaning: '1. Membawa sesuatu di atas kepala. 2. Mematuhi atau menurut perintah.',
    example: 'Wanita kampung itu menjunjung sebakul padi di atas kepalanya.',
    visualCue: 'Beban diletakkan di atas kepala sambil berjalan tegak.'
  },
  {
    word: 'jasa',
    page: 538,
    category: 'kamus_dewan',
    meaning: 'Perbuatan yang baik (terhadap negara, manusia, dsb); bakti.',
    example: 'Jasa ibu bapa dan guru amat besar dalam mendidik kita menjadi insan berguna.',
    visualCue: 'Sumbangan bakti dan budi baik kepada masyarakat.'
  },
  {
    word: 'jentera',
    page: 538,
    category: 'kamus_dewan',
    meaning: 'Alat yang bahagian-bahagiannya bergerak bersama-sama dan daripadanya kita memperoleh tenaga atau daya.',
    example: 'Jentera menuai padi sedang beroperasi di sawah.',
    visualCue: 'Mesin bergerigi atau kenderaan berat bermotor.'
  },
  {
    word: 'joging',
    page: 538,
    category: 'kamus_dewan',
    meaning: 'Lari perlahan-lahan terutamanya sebagai senaman.',
    example: 'Encik Subramaniam dan Kishan berjoging di taman setiap pagi Ahad.',
    visualCue: 'Senaman berlari anak untuk kesihatan badan.'
  },
  {
    word: 'kedap',
    page: 539,
    category: 'kamus_dewan',
    meaning: '1. Sangat rapat. 2. Tertutup rapat sehingga tidak dapat dimasuki air, gas dll.',
    example: 'Simpan biskut itu di dalam bekas kedap udara supaya kekal rangup.',
    visualCue: 'Bekas tertutup rapat tanpa ruang udara atau air.'
  },
  {
    word: 'kilau',
    page: 539,
    category: 'kamus_dewan',
    meaning: 'Cahaya yang bersinar; cahaya yang gemerlap.',
    example: 'Kilau bintang di langit malam sungguh indah dipandang.',
    visualCue: 'Pancaran cahaya berkilauan seperti permata.'
  },
  {
    word: 'komponen',
    page: 539,
    category: 'kamus_dewan',
    meaning: 'Bahagian yang melengkapi atau mencukupkan sesuatu.',
    example: 'Papan kekunci dan tetikus ialah komponen penting bagi sebuah komputer.',
    visualCue: 'Bahagian-bahagian binaan yang melengkapkan sistem.'
  },
  {
    word: 'kuiz',
    page: 539,
    category: 'kamus_dewan',
    meaning: 'Ujian tentang pengetahuan seseorang dengan mengemukakan soalan-soalan untuk dijawab.',
    example: 'Kishan menyertai pertandingan kuiz kosa kata Bahasa Melayu di sekolah.',
    visualCue: 'Soalan uji minda untuk menguji kefahaman murid.'
  },
  {
    word: 'pustaka',
    category: 'petikan_pustaka',
    meaning: 'Buku, kitab, atau tempat menyimpan koleksi bahan bacaan (perpustakaan).',
    example: 'Ayah Kishan menyediakan Pustaka Mini Keluarga sebagai bilik bacaan di rumah.',
    visualCue: 'Rak penuh buku ilmiah dan ruang membaca yang selesa.'
  },
  {
    word: 'perisian',
    category: 'petikan_pustaka',
    meaning: 'Program atau atur cara komputer yang digunakan untuk mengendalikan sistem dan tugasan.',
    example: 'Ibu Kishan menyediakan tugasan kosa kata di dalam perisian komputer.',
    visualCue: 'Aplikasi digital di dalam skrin komputer.'
  },
  {
    word: 'bermutu',
    category: 'petikan_pustaka',
    meaning: 'Mempunyai nilai atau kualiti yang tinggi; sangat baik.',
    example: 'Encik Subramaniam menggalakkan anak-anaknya membaca bahan bacaan yang bermutu.',
    visualCue: 'Bahan bacaan berkualiti tinggi dan berfaedah.'
  },
  {
    word: 'mementingkan',
    category: 'petikan_pustaka',
    meaning: 'Memberikan perhatian atau keutamaan yang sangat tinggi terhadap sesuatu.',
    example: 'Encik Subramaniam amat mementingkan pendidikan anak-anaknya.',
    visualCue: 'Mengutamakan perkara yang paling bernilai.'
  },
  {
    word: 'menghias',
    category: 'petikan_pustaka',
    meaning: 'Menjadikan sesuatu lebih cantik dan elok dengan hiasan.',
    example: 'Kishan dan adiknya membantu ibu bapa menghias Pustaka Mini Keluarga.',
    visualCue: 'Mencantikkan bilik dengan poster dan susunan kemas.'
  }
];

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q-jinjing',
    topic: 'pustaka',
    wordFocus: 'jinjing',
    question: 'Apakah maksud perkataan "jinjing" berdasarkan Kamus Pelajar Bahasa Melayu Dewan?',
    contextHint: 'Kamus Dewan m/s 538 · Tugasan Kosa Kata Ibu Kishan',
    options: [
      'Membawa dengan tangan terhulur ke bawah (membimbit)',
      'Membawa sesuatu di atas kepala',
      'Meletakkan sesuatu di atas paha'
    ],
    correctIndex: 0,
    explanation: '"Jinjing" bermaksud membawa sesuatu dengan tangan terhulur ke bawah atau membimbit.'
  },
  {
    id: 'q-kandar',
    topic: 'pustaka',
    wordFocus: 'kandar',
    question: 'Apakah maksud perkataan "kandar" yang terdapat dalam Kamus Pelajar (m/s 539)?',
    contextHint: 'Kamus Dewan m/s 539 · Perkataan berbingkai biru dalam petikan',
    options: [
      'Lari perlahan-lahan sebagai senaman',
      'Kayu atau tongkat untuk menggalas (memikul) barang',
      'Bahagian yang melengkapi sesuatu'
    ],
    correctIndex: 1,
    explanation: '"Kandar" ialah kayu atau tongkat yang digunakan untuk menggalas (memikul) barang di bahu.'
  },
  {
    id: 'q-pustaka-nama',
    topic: 'pustaka',
    wordFocus: 'pustaka',
    question: 'Apakah nama bilik bacaan yang disediakan oleh Encik Subramaniam untuk Kishan dan adiknya?',
    contextHint: 'Perenggan 1 · Petikan Buku Teks Bahasa Melayu',
    options: [
      'Bilik Komputer Sekolah',
      'Dewan Sukan Keluarga',
      'Pustaka Mini Keluarga'
    ],
    correctIndex: 2,
    explanation: 'Ayah Kishan menyediakan bilik bacaan di rumah yang dinamai Pustaka Mini Keluarga.'
  },
  {
    id: 'q-tatang',
    topic: 'pustaka',
    wordFocus: 'tatang',
    question: 'Pilih maksud yang paling tepat bagi perkataan "tatang":',
    contextHint: 'Tugasan Kosa Kata · Cara membawa barang',
    options: [
      'Membawa sesuatu di atas tapak tangan',
      'Memikul guni berat di atas bahu',
      'Menarik kereta sorong di kebun'
    ],
    correctIndex: 0,
    explanation: '"Tatang" (menatang) bermaksud membawa sesuatu di atas tapak tangan dengan berhati-hati.'
  },
  {
    id: 'q-perisian',
    topic: 'pustaka',
    wordFocus: 'perisian',
    question: 'Di manakah Ibu Kishan menyediakan tugasan mingguan untuk Kishan dan adiknya?',
    contextHint: 'Perenggan 3 · "Tugasan itu disediakan dalam..."',
    options: [
      'Di atas papan hitam kayu',
      'Dalam perisian komputer',
      'Pada dinding taman permainan'
    ],
    correctIndex: 1,
    explanation: 'Ibu Kishan menyediakan tugasan mingguan untuk mereka di dalam perisian komputer.'
  },
  {
    id: 'q-junjung',
    topic: 'pustaka',
    wordFocus: 'junjung',
    question: 'Menurut Kamus Pelajar Dewan (m/s 538), apakah maksud pertama bagi perkataan "junjung"?',
    contextHint: 'Kamus Dewan m/s 538 · Selepas perkataan joging',
    options: [
      'Membawa sesuatu dengan tangan ke bawah',
      'Tertutup rapat sehingga tiada udara masuk',
      'Membawa sesuatu di atas kepala'
    ],
    correctIndex: 2,
    explanation: '"Junjung" bermaksud (1) membawa sesuatu di atas kepala, atau (2) mematuhi/menurut.'
  },
  {
    id: 'q-kedap',
    topic: 'pustaka',
    wordFocus: 'kedap',
    question: 'Perkataan manakah bermaksud "tertutup rapat sehingga tidak dapat dimasuki air atau gas"?',
    contextHint: 'Kamus Dewan m/s 539 · Di bawah perkataan kandar',
    options: [
      'Kedap',
      'Kilau',
      'Komponen'
    ],
    correctIndex: 0,
    explanation: '"Kedap" bermaksud sangat rapat atau tertutup rapat sehingga tidak dapat dimasuki air, gas dll.'
  },
  {
    id: 'q-pangku',
    topic: 'pustaka',
    wordFocus: 'pangku',
    question: 'Apakah perbuatan "pangku" (memangku) yang disenaraikan oleh ibu Kishan?',
    contextHint: 'Tugasan Kosa Kata · jinjing, tatang, pangku, dukung, kandar',
    options: [
      'Menggalas barang dengan tongkat kayu',
      'Meletakkan atau meriba sesuatu di atas paha',
      'Membimbit beg plastik di sisi badan'
    ],
    correctIndex: 1,
    explanation: '"Pangku" bermaksud meletakkan atau meriba sesuatu di atas paha ketika sedang duduk.'
  },
  {
    id: 'q-kuiz-kamus',
    topic: 'pustaka',
    wordFocus: 'kuiz',
    question: 'Apakah takrif perkataan "kuiz" dalam Kamus Pelajar Bahasa Melayu Dewan (m/s 539)?',
    contextHint: 'Kamus Dewan m/s 539 · Entri terakhir pada halaman',
    options: [
      'Alat yang bahagiannya bergerak menghasilkan tenaga',
      'Perbuatan yang baik terhadap negara dan manusia',
      'Ujian pengetahuan dengan mengemukakan soalan untuk dijawab'
    ],
    correctIndex: 2,
    explanation: '"Kuiz" ditakrifkan sebagai ujian tentang pengetahuan seseorang dengan mengemukakan soalan-soalan untuk dijawab.'
  },
  {
    id: 'q-bermutu',
    topic: 'pustaka',
    wordFocus: 'bermutu',
    question: 'Encik Subramaniam menggalakkan anak-anaknya membaca bahan bacaan yang "bermutu". "Bermutu" bermaksud:',
    contextHint: 'Perenggan 1 · Kosa kata berwarna merah',
    options: [
      'Mempunyai kualiti dan nilai yang tinggi',
      'Mempunyai harga yang sangat mahal sahaja',
      'Mengandungi gambar kartun semata-mata'
    ],
    correctIndex: 0,
    explanation: '"Bermutu" bermaksud bernilai tinggi atau berkualiti baik.'
  },
  // Sains Tahun 6 Unit 5: Pemeliharaan dan Pemuliharaan Alam Sekitar (from Image 1)
  {
    id: 'q-sains-1',
    topic: 'sains',
    wordFocus: 'Pemeliharaan Alam',
    question: 'Sains Tahun 6 (Unit 5): Apakah tujuan utama misi membersihkan kawasan daripada sampah?',
    contextHint: 'Unit 5: Pemeliharaan dan Pemuliharaan Alam Sekitar',
    options: [
      'Memelihara ekosistem dan kebersihan habitat hidupan',
      'Menambahkan bilangan tapak pelupusan sampah terbuka',
      'Mengurangkan kawasan hutan simpan semula jadi'
    ],
    correctIndex: 0,
    explanation: 'Membersihkan kawasan daripada sampah membantu memelihara kebersihan dan kelestarian ekosistem alam sekitar.'
  },
  {
    id: 'q-sains-2',
    topic: 'sains',
    wordFocus: 'Kitar Semula',
    question: 'Dalam misi Obby Alam Bersih, apakah tindakan terbaik apabila menjumpai botol plastik dan tin aluminium?',
    contextHint: 'Misi Obby: Kutip sampah & masukkan ke tong kitar semula',
    options: [
      'Campakkan ke dalam sungai berdekatan',
      'Kutip dan asingkan ke dalam tong kitar semula',
      'Bakar sampah plastik di kawasan terbuka'
    ],
    correctIndex: 1,
    explanation: 'Botol plastik dan tin aluminium perlu dikutip dan diasingkan ke dalam tong kitar semula (Jingga) untuk pemuliharaan sumber.'
  },
  {
    id: 'q-sains-3',
    topic: 'sains',
    wordFocus: 'Pemuliharaan',
    question: 'Apakah maksud "Pemuliharaan" dalam Sains Tahun 6 Unit 5?',
    contextHint: 'Sains Tahun 6 · Pemeliharaan dan Pemuliharaan',
    options: [
      'Membiarkan haiwan pupus tanpa sebarang perlindungan',
      'Menebang semua pokok tua untuk membina kilang',
      'Mengembalikan haiwan dan tumbuhan kepada keadaan asal supaya tidak pupus'
    ],
    correctIndex: 2,
    explanation: 'Pemuliharaan ialah usaha mengembalikan hidupan dan alam sekitar kepada keadaan asal seperti menanam semula pokok.'
  }
];
