/**
 * НормативПро — список ключевых строительных нормативов России
 *
 * Источники (в порядке надёжности):
 *
 * 1. docs.cntd.ru — крупнейшая база: просмотр бесплатный, скачивание PDF — платная подписка
 *    Прямая ссылка на документ: https://docs.cntd.ru/document/<ID>
 *
 * 2. fgistp.minstroyrf.ru — ФГИС ТП Минстрой, открытые PDF для ряда СП
 *    https://fgistp.minstroyrf.ru/
 *
 * 3. minstroyrf.gov.ru — приказы и официальные публикации в PDF
 *    https://minstroyrf.gov.ru/trades/normativno-tekhnicheskoe-regulirovanie/
 *
 * 4. protect.gost.ru — ФГБУ «РСТ», часть ГОСТ Р доступна бесплатно
 *    https://protect.gost.ru/
 *
 * 5. rg.ru — Российская газета, официальные тексты нормативных актов
 *    https://rg.ru/
 *
 * 6. standartgost.ru — неофициальный агрегатор, многие документы в открытом доступе
 *    https://standartgost.ru/
 *
 * Для массового получения PDF рекомендуется:
 *   - Оформить подписку на КОДЕКС (kodeks.ru) или ТехЭксперт
 *   - Использовать API ФГИС ТП при наличии доступа
 *   - Обратиться в ФАУ «ФЦС» (faufcc.ru) за официальными копиями
 */

export interface NormativeDoc {
  /** Краткое обозначение */
  code: string
  /** Полное название */
  name: string
  /** Статус: действующий / изменён / отменён */
  status: 'active' | 'amended' | 'cancelled'
  /** ID на docs.cntd.ru */
  cntdId: string
  /** Прямая ссылка на PDF (если известна и публична) */
  pdfUrl?: string
  /** Страница для ручного скачивания */
  pageUrl: string
  /** Альтернативная страница */
  altUrl?: string
  /** Область применения */
  scope: string
  /** Имя файла для сохранения */
  fileName: string
}

export const NORMATIVE_DOCS: NormativeDoc[] = [
  // ==================== НЕСУЩИЕ КОНСТРУКЦИИ И НАГРУЗКИ ====================
  {
    code: 'СП 20.13330.2017',
    name: 'Нагрузки и воздействия',
    status: 'active',
    cntdId: '1200147056',
    pageUrl: 'https://docs.cntd.ru/document/1200147056',
    altUrl: 'https://standartgost.ru/g/%D0%A1%D0%9F_20.13330.2017',
    scope: 'Проектирование строительных конструкций на нагрузки',
    fileName: 'SP_20.13330.2017_nagruzki.pdf',
  },
  {
    code: 'СП 22.13330.2016',
    name: 'Основания зданий и сооружений',
    status: 'active',
    cntdId: '1200133979',
    pageUrl: 'https://docs.cntd.ru/document/1200133979',
    altUrl: 'https://standartgost.ru/g/%D0%A1%D0%9F_22.13330.2016',
    scope: 'Проектирование оснований зданий и сооружений',
    fileName: 'SP_22.13330.2016_osnovaniya.pdf',
  },
  {
    code: 'СП 50.13330.2012',
    name: 'Тепловая защита зданий',
    status: 'active',
    cntdId: '1200095525',
    pageUrl: 'https://docs.cntd.ru/document/1200095525',
    altUrl: 'https://standartgost.ru/g/%D0%A1%D0%9F_50.13330.2012',
    scope: 'Нормы теплозащиты жилых и общественных зданий',
    fileName: 'SP_50.13330.2012_teplovaya_zaschita.pdf',
  },
  {
    code: 'СП 54.13330.2022',
    name: 'Здания жилые многоквартирные',
    status: 'active',
    cntdId: '1200190920',
    pageUrl: 'https://docs.cntd.ru/document/1200190920',
    altUrl: 'https://standartgost.ru/g/%D0%A1%D0%9F_54.13330.2022',
    scope: 'Требования к многоквартирным жилым домам',
    fileName: 'SP_54.13330.2022_zhilye_zdaniya.pdf',
  },
  {
    code: 'СП 70.13330.2012',
    name: 'Несущие и ограждающие конструкции',
    status: 'active',
    cntdId: '1200092523',
    pageUrl: 'https://docs.cntd.ru/document/1200092523',
    altUrl: 'https://standartgost.ru/g/%D0%A1%D0%9F_70.13330.2012',
    scope: 'Производство строительно-монтажных работ',
    fileName: 'SP_70.13330.2012_konstruktsii.pdf',
  },
  // ==================== ИНЖЕНЕРНЫЕ СИСТЕМЫ ====================
  {
    code: 'СП 131.13330.2020',
    name: 'Строительная климатология',
    status: 'active',
    cntdId: '1200174605',
    pageUrl: 'https://docs.cntd.ru/document/1200174605',
    altUrl: 'https://standartgost.ru/g/%D0%A1%D0%9F_131.13330.2020',
    scope: 'Климатические данные для проектирования',
    fileName: 'SP_131.13330.2020_klimatologiya.pdf',
  },
  {
    code: 'СП 30.13330.2020',
    name: 'Внутренний водопровод и канализация зданий',
    status: 'active',
    cntdId: '1200174289',
    pageUrl: 'https://docs.cntd.ru/document/1200174289',
    scope: 'Проектирование водопровода и канализации',
    fileName: 'SP_30.13330.2020_vodosnab.pdf',
  },
  {
    code: 'СП 60.13330.2020',
    name: 'Отопление, вентиляция и кондиционирование воздуха',
    status: 'active',
    cntdId: '1200174300',
    pageUrl: 'https://docs.cntd.ru/document/1200174300',
    scope: 'Проектирование систем ОВиК',
    fileName: 'SP_60.13330.2020_ovk.pdf',
  },
  // ==================== ПОЖАРНАЯ БЕЗОПАСНОСТЬ ====================
  {
    code: 'СП 1.13130.2020',
    name: 'Системы противопожарной защиты. Эвакуационные пути и выходы',
    status: 'active',
    cntdId: '1200171693',
    pageUrl: 'https://docs.cntd.ru/document/1200171693',
    scope: 'Требования к путям эвакуации',
    fileName: 'SP_1.13130.2020_evakuatsiya.pdf',
  },
  {
    code: 'СП 2.13130.2020',
    name: 'Системы противопожарной защиты. Обеспечение огнестойкости объектов защиты',
    status: 'active',
    cntdId: '1200171698',
    pageUrl: 'https://docs.cntd.ru/document/1200171698',
    scope: 'Огнестойкость строительных конструкций',
    fileName: 'SP_2.13130.2020_ognestoykost.pdf',
  },
  // ==================== ФУНДАМЕНТЫ И ГЕОТЕХНИКА ====================
  {
    code: 'СП 24.13330.2021',
    name: 'Свайные фундаменты',
    status: 'active',
    cntdId: '1200183519',
    pageUrl: 'https://docs.cntd.ru/document/1200183519',
    scope: 'Проектирование свайных фундаментов',
    fileName: 'SP_24.13330.2021_svai.pdf',
  },
  // ==================== ГОСТ Р ====================
  {
    code: 'ГОСТ Р 21.1101-2013',
    name: 'СПДС. Основные требования к проектной и рабочей документации',
    status: 'active',
    cntdId: '1200104153',
    pageUrl: 'https://docs.cntd.ru/document/1200104153',
    altUrl: 'https://protect.gost.ru/document.aspx?control=7&id=180108',
    scope: 'Требования к составу и оформлению проектной документации',
    fileName: 'GOST_R_21.1101-2013_SPDS.pdf',
  },
  {
    code: 'ГОСТ 27751-2014',
    name: 'Надёжность строительных конструкций и оснований. Основные положения',
    status: 'active',
    cntdId: '1200115736',
    pageUrl: 'https://docs.cntd.ru/document/1200115736',
    altUrl: 'https://protect.gost.ru/document.aspx?control=7&id=197765',
    scope: 'Расчётные принципы для строительных конструкций',
    fileName: 'GOST_27751-2014_nadezhnost.pdf',
  },
  // ==================== СанПиН ====================
  {
    code: 'СанПиН 1.2.3685-21',
    name: 'Гигиенические нормативы и требования к обеспечению безопасности и (или) безвредности',
    status: 'active',
    cntdId: '1200170203',
    pageUrl: 'https://docs.cntd.ru/document/1200170203',
    altUrl: 'https://rg.ru/documents/2021/03/05/gigiena-dok.html',
    scope: 'Санитарные нормы для жилых и общественных зданий',
    fileName: 'SanPiN_1.2.3685-21_gigienich_normativy.pdf',
  },
  {
    code: 'СП 59.13330.2020',
    name: 'Доступность зданий и сооружений для маломобильных групп населения',
    status: 'active',
    cntdId: '1200174007',
    pageUrl: 'https://docs.cntd.ru/document/1200174007',
    scope: 'Требования доступной среды (МГН)',
    fileName: 'SP_59.13330.2020_mgn.pdf',
  },
]

// Вывод в консоль при прямом запуске (tsx scripts/docs-list.ts)
const isMain = process.argv[1]?.endsWith('docs-list.ts') || process.argv[1]?.endsWith('docs-list')
if (isMain) {
  console.log('\n=== НормативПро: Список ключевых строительных нормативов ===\n')
  console.log('Всего документов:', NORMATIVE_DOCS.length)
  console.log()

  const grouped: Record<string, NormativeDoc[]> = {}
  for (const doc of NORMATIVE_DOCS) {
    const prefix = doc.code.startsWith('СП') ? 'Своды правил (СП)'
      : doc.code.startsWith('ГОСТ') ? 'ГОСТы'
      : doc.code.startsWith('СанПиН') ? 'СанПиН'
      : 'Прочие'
    grouped[prefix] = grouped[prefix] || []
    grouped[prefix].push(doc)
  }

  for (const [group, docs] of Object.entries(grouped)) {
    console.log(`--- ${group} ---`)
    for (const doc of docs) {
      console.log(`  ${doc.code}`)
      console.log(`    ${doc.name}`)
      console.log(`    Страница: ${doc.pageUrl}`)
      if (doc.pdfUrl) console.log(`    PDF: ${doc.pdfUrl}`)
      if (doc.altUrl) console.log(`    Alt: ${doc.altUrl}`)
      console.log()
    }
  }

  console.log('=== Инструкция по получению PDF ===\n')
  console.log('ВАРИАНТ 1 — Автоматически (standartgost.ru):')
  console.log('  Запустите: npx tsx scripts/fetch-normatives.ts')
  console.log('  Скрипт попробует скачать документы с открытых источников.\n')
  console.log('ВАРИАНТ 2 — Платная подписка docs.cntd.ru:')
  console.log('  1. Зарегистрируйтесь на docs.cntd.ru')
  console.log('  2. Оформите подписку "Эксперт" (~3000 руб/мес)')
  console.log('  3. Откройте каждый документ по ссылке pageUrl')
  console.log('  4. Нажмите кнопку "Скачать PDF"\n')
  console.log('ВАРИАНТ 3 — ФГИС ТП (fgistp.minstroyrf.ru):')
  console.log('  Ряд действующих СП доступен как PDF после бесплатной регистрации.\n')
  console.log('ВАРИАНТ 4 — protect.gost.ru (ГОСТ):')
  console.log('  Часть ГОСТов доступна бесплатно на официальном портале ФГБУ РСТ.\n')
  console.log('ВАРИАНТ 5 — Обратиться в ФАУ ФЦС (faufcc.ru):')
  console.log('  Федеральный центр нормирования и стандартизации в строительстве')
  console.log('  предоставляет официальные копии нормативных документов.\n')
}
