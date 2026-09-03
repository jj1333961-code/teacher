export type IdentityKind = 'numeric' | 'alphanumeric' | 'passport-or-local-id'

export type CountryRule = {
  iso2: string
  dialCode: string
  identity: IdentityKind
  phoneLengths: readonly number[]
}

// The browser adds localized names with Intl.DisplayNames; these rules stay language-neutral.
export const COUNTRY_RULES: readonly CountryRule[] = [
  ['AF','93','numeric',[9]],['AL','355','alphanumeric',[8,9]],['DZ','213','numeric',[9]],['AS','1','numeric',[7]],['AD','376','numeric',[6,9]],['AO','244','numeric',[9]],['AI','1','numeric',[7]],['AG','1','numeric',[7]],['AR','54','numeric',[10]],['AM','374','numeric',[8]],['AW','297','numeric',[7]],['AU','61','numeric',[9]],['AT','43','numeric',[10,11]],['AZ','994','alphanumeric',[9]],['BS','1','numeric',[7]],['BH','973','numeric',[8]],['BD','880','numeric',[10]],['BB','1','numeric',[7]],['BY','375','alphanumeric',[9]],['BE','32','numeric',[9]],['BZ','501','numeric',[7]],['BJ','229','numeric',[8]],['BM','1','numeric',[7]],['BT','975','numeric',[8]],['BO','591','numeric',[8]],['BQ','599','numeric',[7]],['BA','387','numeric',[8]],['BW','267','numeric',[8]],['BR','55','numeric',[10,11]],['IO','246','numeric',[7]],['BN','673','numeric',[7]],['BG','359','numeric',[8,9]],['BF','226','numeric',[8]],['BI','257','numeric',[8]],['CV','238','numeric',[7]],['KH','855','numeric',[8,9]],['CM','237','numeric',[9]],['CA','1','numeric',[10]],['KY','1','numeric',[7]],['CF','236','numeric',[8]],['TD','235','numeric',[8]],['CL','56','numeric',[9]],['CN','86','numeric',[11]],['CX','61','numeric',[9]],['CC','61','numeric',[9]],['CO','57','numeric',[10]],['KM','269','numeric',[7]],['CG','242','numeric',[9]],['CD','243','numeric',[9]],['CK','682','numeric',[5]],['CR','506','numeric',[8]],['CI','225','numeric',[10]],['HR','385','numeric',[8,9]],['CU','53','numeric',[8]],['CW','599','numeric',[7]],['CY','357','numeric',[8]],['CZ','420','numeric',[9]],['DK','45','numeric',[8]],['DJ','253','numeric',[8]],['DM','1','numeric',[7]],['DO','1','numeric',[7]],['EC','593','numeric',[9]],['EG','20','numeric',[10]],['SV','503','numeric',[8]],['GQ','240','numeric',[9]],['ER','291','numeric',[7]],['EE','372','numeric',[7,8]],['SZ','268','numeric',[8]],['ET','251','numeric',[9]],['FK','500','numeric',[5]],['FO','298','numeric',[6]],['FJ','679','numeric',[7]],['FI','358','numeric',[9,10]],['FR','33','numeric',[9]],['GF','594','numeric',[9]],['PF','689','numeric',[8]],['GA','241','numeric',[7]],['GM','220','numeric',[7]],['GE','995','numeric',[9]],['DE','49','numeric',[10,11]],['GH','233','numeric',[9]],['GI','350','numeric',[8]],['GR','30','numeric',[10]],['GL','299','numeric',[6]],['GD','1','numeric',[7]],['GP','590','numeric',[9]],['GU','1','numeric',[7]],['GT','502','numeric',[8]],['GG','44','numeric',[10]],['GN','224','numeric',[9]],['GW','245','numeric',[7]],['GY','592','numeric',[7]],['HT','509','numeric',[8]],['HN','504','numeric',[8]],['HK','852','numeric',[8]],['HU','36','numeric',[9]],['IS','354','numeric',[7]],['IN','91','numeric',[10]],['ID','62','numeric',[9,10,11]],['IR','98','numeric',[10]],['IQ','964','numeric',[10]],['IE','353','numeric',[9]],['IM','44','numeric',[10]],['IL','972','numeric',[9]],['IT','39','numeric',[9,10]],['JM','1','numeric',[7]],['JP','81','numeric',[10]],['JE','44','numeric',[10]],['JO','962','numeric',[9]],['KZ','7','numeric',[10]],['KE','254','numeric',[9]],['KI','686','numeric',[5]],['KP','850','numeric',[10]],['KR','82','numeric',[10]],['KW','965','numeric',[8]],['KG','996','numeric',[9]],['LA','856','numeric',[8,10]],['LV','371','numeric',[8]],['LB','961','numeric',[7,8]],['LS','266','numeric',[8]],['LR','231','numeric',[7,8]],['LY','218','numeric',[9]],['LI','423','numeric',[7]],['LT','370','numeric',[8]],['LU','352','numeric',[9]],['MO','853','numeric',[8]],['MG','261','numeric',[9]],['MW','265','numeric',[9]],['MY','60','numeric',[9,10]],['MV','960','numeric',[7]],['ML','223','numeric',[8]],['MT','356','numeric',[8]],['MH','692','numeric',[7]],['MQ','596','numeric',[9]],['MR','222','numeric',[8]],['MU','230','numeric',[8]],['YT','262','numeric',[9]],['MX','52','numeric',[10]],['FM','691','numeric',[7]],['MD','373','numeric',[8]],['MC','377','numeric',[8,9]],['MN','976','numeric',[8]],['ME','382','numeric',[8]],['MS','1','numeric',[7]],['MA','212','numeric',[9]],['MZ','258','numeric',[9]],['MM','95','numeric',[8,9,10]],['NA','264','numeric',[9]],['NR','674','numeric',[7]],['NP','977','numeric',[10]],['NL','31','numeric',[9]],['NC','687','numeric',[6]],['NZ','64','numeric',[8,9]],['NI','505','numeric',[8]],['NE','227','numeric',[8]],['NG','234','numeric',[10]],['NU','683','numeric',[4]],['NF','672','numeric',[5,6]],['MK','389','numeric',[8]],['MP','1','numeric',[7]],['NO','47','numeric',[8]],['OM','968','numeric',[8]],['PK','92','numeric',[10]],['PW','680','numeric',[7]],['PS','970','numeric',[9]],['PA','507','numeric',[8]],['PG','675','numeric',[8]],['PY','595','numeric',[9]],['PE','51','numeric',[9]],['PH','63','numeric',[10]],['PL','48','numeric',[9]],['PT','351','numeric',[9]],['PR','1','numeric',[7]],['QA','974','numeric',[8]],['RE','262','numeric',[9]],['RO','40','numeric',[9]],['RU','7','numeric',[10]],['RW','250','numeric',[9]],['BL','590','numeric',[9]],['SH','290','numeric',[4]],['KN','1','numeric',[7]],['LC','1','numeric',[7]],['MF','590','numeric',[9]],['PM','508','numeric',[6]],['VC','1','numeric',[7]],['WS','685','numeric',[7]],['SM','378','numeric',[8,10]],['ST','239','numeric',[7]],['SA','966','numeric',[9]],['SN','221','numeric',[9]],['RS','381','numeric',[9]],['SC','248','numeric',[7]],['SL','232','numeric',[8]],['SG','65','numeric',[8]],['SX','1','numeric',[7]],['SK','421','numeric',[9]],['SI','386','numeric',[8]],['SB','677','numeric',[7]],['SO','252','numeric',[8]],['ZA','27','numeric',[9]],['SS','211','numeric',[9]],['ES','34','numeric',[9]],['LK','94','numeric',[9]],['SD','249','numeric',[9]],['SR','597','numeric',[7]],['SJ','47','numeric',[8]],['SE','46','numeric',[9]],['CH','41','numeric',[9]],['SY','963','numeric',[9]],['TW','886','numeric',[9,10]],['TJ','992','numeric',[9]],['TZ','255','numeric',[9]],['TH','66','numeric',[9]],['TL','670','numeric',[8]],['TG','228','numeric',[8]],['TK','690','numeric',[4]],['TO','676','numeric',[5,7]],['TT','1','numeric',[7]],['TN','216','numeric',[8]],['TR','90','numeric',[10]],['TM','993','numeric',[8]],['TC','1','numeric',[7]],['TV','688','numeric',[5]],['UG','256','numeric',[9]],['UA','380','numeric',[9]],['AE','971','numeric',[9]],['GB','44','numeric',[10]],['US','1','numeric',[10]],['UY','598','numeric',[8]],['UZ','998','numeric',[9]],['VU','678','numeric',[7]],['VA','39','numeric',[10]],['VE','58','numeric',[10]],['VN','84','numeric',[9,10]],['VG','1','numeric',[7]],['VI','1','numeric',[7]],['WF','681','numeric',[6]],['EH','212','numeric',[9]],['YE','967','numeric',[9]],['ZM','260','numeric',[9]],['ZW','263','numeric',[9]],
].map(([iso2, dialCode, identity, phoneLengths]) => ({ iso2, dialCode, identity, phoneLengths } as CountryRule))

export function getCountryRule(iso2: string) {
  return COUNTRY_RULES.find((country) => country.iso2 === iso2.toUpperCase()) ?? COUNTRY_RULES.find((country) => country.iso2 === 'EG')!
}

export function normalizeLocalPhone(value: string) {
  return value.replace(/\D/g, '').replace(/^0+/, '')
}

export function formatInternationalPhone(iso2: string, local: string) {
  const rule = getCountryRule(iso2)
  const normalized = normalizeLocalPhone(local)
  return normalized ? `+${rule.dialCode}${normalized}` : `+${rule.dialCode}`
}

export function validatePhone(iso2: string, local: string) {
  const rule = getCountryRule(iso2)
  const normalized = normalizeLocalPhone(local)
  return rule.phoneLengths.includes(normalized.length)
}

export function validateIdentity(iso2: string, value: string) {
  const rule = getCountryRule(iso2)
  const normalized = value.trim().replace(/[\s-]/g, '')
  if (rule.identity === 'numeric') return /^\d{6,20}$/.test(normalized)
  if (rule.identity === 'alphanumeric') return /^[A-Za-z0-9]{6,24}$/.test(normalized)
  return /^[A-Za-z0-9]{6,24}$/.test(normalized)
}

export function identityHint(iso2: string) {
  const rule = getCountryRule(iso2)
  return rule.identity === 'numeric' ? 'أرقام فقط، من 6 إلى 20 خانة' : 'حروف وأرقام، من 6 إلى 24 خانة؛ ويمكن استخدام رقم جواز السفر'
}
