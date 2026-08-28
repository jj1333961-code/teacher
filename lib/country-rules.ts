export type CountryDocumentRule = {
  labelAr: string
  labelEn: string
  pattern?: RegExp
  hintAr: string
  hintEn: string
  example?: string
  fallback?: boolean
}

export const COUNTRY_DOCUMENT_RULES: Record<string, CountryDocumentRule> = {
  EG: { labelAr: 'الرقم القومي المصري', labelEn: 'Egyptian national ID', pattern: /^\d{14}$/, hintAr: '14 رقمًا', hintEn: '14 digits', example: '29801011234567' },
  SA: { labelAr: 'رقم الهوية الوطنية أو الإقامة', labelEn: 'National ID or residency number', pattern: /^[12]\d{9}$/, hintAr: '10 أرقام ويبدأ بـ 1 أو 2', hintEn: '10 digits starting with 1 or 2' },
  AE: { labelAr: 'رقم الهوية الإماراتية', labelEn: 'Emirates ID', pattern: /^784[- ]?\d{4}[- ]?\d{7}[- ]?\d$/, hintAr: '15 خانة تبدأ بـ 784، ويمكن كتابة الشرطات', hintEn: '15 characters starting with 784; separators are optional', example: '784-1987-1234567-1' },
  CN: { labelAr: 'رقم بطاقة هوية المواطن', labelEn: 'Resident identity card number', pattern: /^\d{17}[0-9X]$/i, hintAr: '18 خانة وقد تنتهي بحرف X', hintEn: '18 characters and may end with X', example: '11010519491231002X' },
  IN: { labelAr: 'رقم Aadhaar', labelEn: 'Aadhaar number', pattern: /^[2-9]\d{11}$/, hintAr: '12 رقمًا ولا يبدأ بـ 0 أو 1', hintEn: '12 digits and cannot start with 0 or 1', example: '234567890123' },
  BR: { labelAr: 'رقم CPF', labelEn: 'CPF number', pattern: /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, hintAr: '11 رقمًا مع نقاط أو شرطة اختيارية', hintEn: '11 digits; dots and hyphen are optional', example: '123.456.789-09' },
  ES: { labelAr: 'رقم DNI أو NIE', labelEn: 'DNI or NIE number', pattern: /^(?:\d{8}[A-Z]|[XYZ]\d{7}[A-Z])$/i, hintAr: '8 أرقام وحرف، أو X/Y/Z ثم 7 أرقام وحرف', hintEn: '8 digits and a letter, or X/Y/Z plus 7 digits and a letter', example: '12345678Z' },
  IT: { labelAr: 'الرمز الضريبي Codice Fiscale', labelEn: 'Codice Fiscale', pattern: /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i, hintAr: '16 حرفًا ورقمًا', hintEn: '16 letters and digits', example: 'RSSMRA80A01H501U' },
  MX: { labelAr: 'رقم CURP', labelEn: 'CURP number', pattern: /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/i, hintAr: '18 حرفًا ورقمًا بصيغة CURP', hintEn: '18 letters and digits in CURP format', example: 'GARC850101HDFRRL09' },
  SG: { labelAr: 'رقم NRIC أو FIN', labelEn: 'NRIC or FIN', pattern: /^[STFGM]\d{7}[A-Z]$/i, hintAr: 'حرف، 7 أرقام، ثم حرف تحقق', hintEn: 'A letter, 7 digits, and a check letter', example: 'S1234567D' },
  ZA: { labelAr: 'رقم الهوية الجنوب أفريقي', labelEn: 'South African ID number', pattern: /^\d{13}$/, hintAr: '13 رقمًا', hintEn: '13 digits' },
  US: { labelAr: 'رقم جواز السفر أو وثيقة الهوية الرسمية', labelEn: 'Passport or official identity document number', fallback: true, hintAr: 'من 6 إلى 9 أحرف أو أرقام حسب الوثيقة', hintEn: '6 to 9 letters or digits, depending on the document', example: 'X12345678' },
  GB: { labelAr: 'رقم جواز السفر أو وثيقة الهوية الرسمية', labelEn: 'Passport or official identity document number', fallback: true, hintAr: 'من 6 إلى 9 أحرف أو أرقام حسب الوثيقة', hintEn: '6 to 9 letters or digits, depending on the document', example: '123456789' },
}

export const FALLBACK_DOCUMENT_RULE: CountryDocumentRule = {
  labelAr: 'رقم جواز السفر أو الهوية الشخصية',
  labelEn: 'Passport or personal identity number',
  fallback: true,
  hintAr: 'من 4 إلى 30 حرفًا أو رقمًا كما يظهر في الوثيقة',
  hintEn: '4 to 30 letters or digits as shown on the document',
  example: 'A1234567',
}
